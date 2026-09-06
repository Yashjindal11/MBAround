import { describe, expect, it } from 'vitest';
import {
  extractRounds,
  htmlToText,
  parseDeadlineText,
} from '../scripts/data/collect-deadlines';

/**
 * These tests guard the single most dangerous function in the project. A
 * parser that silently returns a wrong or invented date would put a fabricated
 * deadline in front of an applicant, so the bias must always be toward
 * returning null.
 */
describe('parseDeadlineText', () => {
  it('parses month-first dates', () => {
    expect(parseDeadlineText('October 15, 2026')).toBe('2026-10-15');
    expect(parseDeadlineText('Sept 4 2026')).toBe('2026-09-04');
  });

  it('parses day-first dates', () => {
    expect(parseDeadlineText('15 October 2026')).toBe('2026-10-15');
    expect(parseDeadlineText('3rd April 2027')).toBe('2027-04-03');
  });

  it('handles ordinal suffixes and stray whitespace', () => {
    expect(parseDeadlineText('  January   6th,  2027 ')).toBe('2027-01-06');
  });

  it('returns null when the year is missing rather than guessing one', () => {
    expect(parseDeadlineText('October 15')).toBeNull();
    expect(parseDeadlineText('deadline in early October')).toBeNull();
  });

  it('returns null for impossible calendar dates', () => {
    expect(parseDeadlineText('February 31, 2026')).toBeNull();
    expect(parseDeadlineText('April 31, 2026')).toBeNull();
  });

  it('returns null for text containing no date at all', () => {
    expect(parseDeadlineText('Applications open soon')).toBeNull();
    expect(parseDeadlineText('')).toBeNull();
  });

  it('accepts a real leap day but rejects a fake one', () => {
    expect(parseDeadlineText('February 29, 2028')).toBe('2028-02-29');
    expect(parseDeadlineText('February 29, 2026')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('strips tags, scripts and styles', () => {
    const html =
      '<div><script>var x = "January 1, 2000";</script><style>a{}</style><p>Round 1: October 15, 2026</p></div>';
    const text = htmlToText(html);
    expect(text).toContain('Round 1: October 15, 2026');
    // A date hidden in a script must not leak into the extracted text.
    expect(text).not.toContain('2000');
  });
});

describe('extractRounds', () => {
  const url = 'https://example.edu/admissions';

  it('extracts rounds using the labels found on the page', () => {
    const text = 'Round 1 deadline is October 15, 2026. Round 2 deadline is January 5, 2027.';
    const rounds = extractRounds(text, url);
    expect(rounds).toHaveLength(2);
    expect(rounds[0]).toMatchObject({ roundName: 'Round 1', deadline: '2026-10-15' });
    expect(rounds[1]).toMatchObject({ roundName: 'Round 2', deadline: '2027-01-05' });
  });

  it('records the source URL on every round it returns', () => {
    const rounds = extractRounds('Round 1 closes October 15, 2026', url);
    expect(rounds.every((r) => r.sourceUrl === url)).toBe(true);
  });

  it('does not assume an R1/R2/R3 structure', () => {
    const text = 'Stage 1 closes 10 September 2026. Stage 2 closes 12 January 2027.';
    const rounds = extractRounds(text, url);
    expect(rounds.map((r) => r.roundName)).toEqual(['Stage 1', 'Stage 2']);
  });

  it('returns nothing when a round is named but no date is published', () => {
    const rounds = extractRounds('Round 1 dates will be announced shortly.', url);
    expect(rounds).toEqual([]);
  });

  it('ignores rolling admission prose rather than fabricating a round', () => {
    const rounds = extractRounds('We admit on a rolling basis throughout the year.', url);
    expect(rounds).toEqual([]);
  });

  it('does not emit the same round twice', () => {
    const text = 'Round 1 is October 15, 2026. Later: Round 1 is October 15, 2026.';
    expect(extractRounds(text, url)).toHaveLength(1);
  });
});

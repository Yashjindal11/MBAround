import { describe, expect, it } from 'vitest';
import {
  extractRounds,
  htmlToText,
  normaliseRoundName,
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

  it('orders rounds by their own number, not by document position', () => {
    // Wharton lists Round 3 first. Ordering by position rendered Round 3 at
    // the top of the timeline, ahead of a deadline that falls months earlier.
    const text =
      'Round 3 is April 2, 2027. Round 1 is September 3, 2026. Round 2 is January 6, 2027.';
    const rounds = extractRounds(text, url);
    expect(rounds.map((r) => r.roundName)).toEqual(['Round 1', 'Round 2', 'Round 3']);
    expect(rounds.map((r) => r.order)).toEqual([1, 2, 3]);
  });

  it('discards a gapped sequence instead of publishing a partial one', () => {
    // Kellogg yielded rounds 2 and 3 with no Round 1. A page missing its
    // earliest deadline still looks complete to a reader.
    const text = 'Round 2 is January 6, 2027. Round 3 is April 2, 2027.';
    expect(extractRounds(text, url)).toEqual([]);
  });

  it('rejects dates outside the cycle year window', () => {
    // Last cycle's table left live below this cycle's copy.
    const text = 'Round 1 is October 15, 2024. Round 2 is January 5, 2025.';
    expect(extractRounds(text, url, 2026)).toEqual([]);
  });

  it('accepts dates in either year of a two-year cycle', () => {
    const text = 'Round 1 is October 15, 2026. Round 2 is January 5, 2027.';
    expect(extractRounds(text, url, 2026)).toHaveLength(2);
  });
});

describe('normaliseRoundName', () => {
  it('canonicalises shouted and whispered labels to one name', () => {
    // 'ROUND 1' and 'Round 1' are distinct under the (cycle, name) unique
    // key, so leaving the casing alone let one round be inserted twice.
    expect(normaliseRoundName('ROUND 1')).toBe('Round 1');
    expect(normaliseRoundName('round  1')).toBe('Round 1');
    expect(normaliseRoundName('Round 1')).toBe('Round 1');
  });

  it('normalises word numbers without changing them', () => {
    expect(normaliseRoundName('ROUND THREE')).toBe('Round Three');
  });

  it('never renames a stage or cycle into a round', () => {
    // A school that runs stages does not run rounds; renaming would assert a
    // structure the school does not have.
    expect(normaliseRoundName('STAGE 1')).toBe('Stage 1');
    expect(normaliseRoundName('cycle 2')).toBe('Cycle 2');
  });
});

describe('extractRounds label casing', () => {
  it('collapses mixed-case duplicates of the same round', () => {
    const text = 'ROUND 1 is October 15, 2026. Round 1 is October 15, 2026.';
    const rounds = extractRounds(text, 'https://example.edu/a');
    expect(rounds).toHaveLength(1);
    expect(rounds[0].roundName).toBe('Round 1');
  });
});

import { describe, expect, it } from 'vitest';
import {
  compareRounds,
  countdownLabel,
  daysUntil,
  formatDate,
  isStale,
  isUpcoming,
  nextUpcoming,
  parseDate,
  verificationState,
} from '../src/lib/dates';
import type { DeadlineRow } from '../src/lib/types';

/** Fixed "now" so tests never depend on the real clock. */
const NOW = new Date('2026-09-06T10:00:00Z');

describe('parseDate', () => {
  it('parses ISO dates', () => {
    expect(parseDate('2026-09-17')?.getUTCFullYear()).toBe(2026);
    expect(parseDate('2026-09-17')?.getUTCMonth()).toBe(8);
    expect(parseDate('2026-09-17')?.getUTCDate()).toBe(17);
  });

  it('returns null for missing or malformed input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('does not shift the calendar day across timezones', () => {
    // Anchoring at UTC noon keeps Sep 17 as Sep 17 everywhere.
    expect(formatDate('2026-09-17')).toBe('September 17, 2026');
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
  });
});

describe('daysUntil / countdown', () => {
  it('counts whole days forward', () => {
    expect(daysUntil('2026-09-17', NOW)).toBe(11);
    expect(daysUntil('2026-09-06', NOW)).toBe(0);
  });

  it('returns negative values for past dates', () => {
    expect(daysUntil('2026-09-01', NOW)).toBe(-5);
  });

  it('returns null when there is no date', () => {
    expect(daysUntil(null, NOW)).toBeNull();
  });

  it('labels the countdown honestly', () => {
    expect(countdownLabel('2026-09-17', NOW)).toBe('11 days remaining');
    expect(countdownLabel('2026-09-07', NOW)).toBe('1 day remaining');
    expect(countdownLabel('2026-09-06', NOW)).toBe('Due today');
    expect(countdownLabel('2026-09-05', NOW)).toBe('Closed yesterday');
    // Missing data must never render as a date.
    expect(countdownLabel(null, NOW)).toBe('Not announced');
  });

  it('treats today as still upcoming', () => {
    expect(isUpcoming('2026-09-06', NOW)).toBe(true);
    expect(isUpcoming('2026-09-05', NOW)).toBe(false);
    expect(isUpcoming(null, NOW)).toBe(false);
  });
});

describe('verificationState', () => {
  it('distinguishes all four states', () => {
    expect(verificationState({ deadline: '2026-09-17', isAnnounced: true, isVerified: true }))
      .toBe('VERIFIED');
    expect(verificationState({ deadline: '2026-09-17', isAnnounced: true, isVerified: false }))
      .toBe('NEEDS_REVIEW');
    expect(verificationState({ deadline: null, isAnnounced: false, isVerified: false }))
      .toBe('NOT_ANNOUNCED');
    expect(verificationState({ deadline: null, isAnnounced: true, isVerified: false }))
      .toBe('UNAVAILABLE');
  });

  it('never reports verified without a date', () => {
    expect(verificationState({ deadline: null, isAnnounced: true, isVerified: true }))
      .not.toBe('VERIFIED');
  });
});

describe('compareRounds', () => {
  it('orders announced deadlines chronologically', () => {
    const rounds = [
      { deadline: '2027-01-06', displayOrder: 2 },
      { deadline: '2026-09-17', displayOrder: 1 },
    ];
    expect(rounds.sort(compareRounds)[0].deadline).toBe('2026-09-17');
  });

  it('pushes unannounced rounds to the end', () => {
    const rounds = [
      { deadline: null, displayOrder: 3 },
      { deadline: '2026-09-17', displayOrder: 1 },
    ];
    expect(rounds.sort(compareRounds)[0].deadline).toBe('2026-09-17');
  });

  it('falls back to display order between unannounced rounds', () => {
    const rounds = [
      { deadline: null, displayOrder: 4 },
      { deadline: null, displayOrder: 2 },
    ];
    expect(rounds.sort(compareRounds)[0].displayOrder).toBe(2);
  });

  it('works with DeadlineRow, which uses roundOrder', () => {
    const rows = [
      { deadline: null, roundOrder: 3 },
      { deadline: null, roundOrder: 1 },
    ];
    expect(rows.sort(compareRounds)[0].roundOrder).toBe(1);
  });

  it('supports arbitrary round counts, not just three', () => {
    const rounds = [
      { deadline: '2027-03-16', displayOrder: 4 },
      { deadline: '2026-09-22', displayOrder: 1 },
      { deadline: '2027-01-19', displayOrder: 3 },
      { deadline: '2026-11-10', displayOrder: 2 },
    ].sort(compareRounds);
    expect(rounds.map((r) => r.displayOrder)).toEqual([1, 2, 3, 4]);
  });
});

describe('nextUpcoming', () => {
  const row = (deadline: string | null): DeadlineRow =>
    ({ deadline, roundId: deadline ?? 'none' }) as DeadlineRow;

  it('finds the nearest future deadline', () => {
    const rows = [row('2027-01-06'), row('2026-09-17'), row('2026-08-01')];
    expect(nextUpcoming(rows, NOW)?.deadline).toBe('2026-09-17');
  });

  it('ignores past deadlines entirely', () => {
    expect(nextUpcoming([row('2026-08-01')], NOW)).toBeNull();
  });

  it('returns null when nothing is announced', () => {
    expect(nextUpcoming([row(null)], NOW)).toBeNull();
  });
});

describe('isStale', () => {
  it('flags records never verified', () => {
    expect(isStale(null, 30, NOW)).toBe(true);
  });

  it('flags records verified long ago', () => {
    expect(isStale('2026-06-01', 30, NOW)).toBe(true);
  });

  it('accepts recently verified records', () => {
    expect(isStale('2026-09-01', 30, NOW)).toBe(false);
  });
});

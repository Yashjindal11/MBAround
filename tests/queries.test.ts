import { describe, expect, it } from 'vitest';
import { sortDeadlineRows } from '../src/lib/queries/public';
import type { DeadlineRow } from '../src/lib/types';

/**
 * These cover the ordering contract only. The filtering and visibility rules
 * now live in Postgres (RLS + the deadline_rows view), so asserting them here
 * against a hand-built fixture would test a mock rather than the database that
 * actually serves users - and the fixture's invented dates were themselves a
 * liability. Those rules belong in migration-level tests against a real
 * instance, not in unit tests that can pass while production is broken.
 */

const row = (p: Partial<DeadlineRow>): DeadlineRow =>
  ({
    roundId: 'r', roundName: 'Round 1', roundOrder: 1,
    deadline: null, decisionDate: null, isAnnounced: true, isVerified: false,
    sourceUrl: null, sourceName: null, lastVerified: null, notes: null,
    cycleId: 'c', cycleName: '2026â€“27', programId: 'p', programName: 'MBA',
    programType: 'Full-time MBA', schoolId: 's', schoolName: 'A School',
    schoolSlug: 'a-school', country: 'X', region: 'Y', city: 'Z',
    ...p,
  }) as DeadlineRow;

describe('sortDeadlineRows', () => {
  it('sorts nearest first and pushes undated rows last', () => {
    const rows = [
      row({ roundId: '3', deadline: null }),
      row({ roundId: '1', deadline: '2027-01-06' }),
      row({ roundId: '2', deadline: '2026-09-17' }),
    ];
    expect(sortDeadlineRows(rows, 'nearest').map((r) => r.roundId))
      .toEqual(['2', '1', '3']);
  });

  it('sorts latest first, still keeping undated rows out of the way', () => {
    const rows = [
      row({ roundId: '1', deadline: '2026-09-17' }),
      row({ roundId: '2', deadline: '2027-01-06' }),
    ];
    expect(sortDeadlineRows(rows, 'latest').map((r) => r.roundId)).toEqual(['2', '1']);
  });

  it('sorts by school name', () => {
    const rows = [
      row({ roundId: '1', schoolName: 'Wharton' }),
      row({ roundId: '2', schoolName: 'INSEAD' }),
    ];
    expect(sortDeadlineRows(rows, 'school').map((r) => r.roundId)).toEqual(['2', '1']);
  });

  it('sorts by round order', () => {
    const rows = [
      row({ roundId: '1', roundOrder: 3 }),
      row({ roundId: '2', roundOrder: 1 }),
    ];
    expect(sortDeadlineRows(rows, 'round').map((r) => r.roundId)).toEqual(['2', '1']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ roundId: '1', deadline: '2027-01-06' }), row({ roundId: '2', deadline: '2026-09-17' })];
    const before = rows.map((r) => r.roundId);
    sortDeadlineRows(rows, 'nearest');
    expect(rows.map((r) => r.roundId)).toEqual(before);
  });
});

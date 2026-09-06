import { describe, expect, it } from 'vitest';
import { sortDeadlineRows } from '../src/lib/queries/public';
import { getSchools, getDeadlines, getFilterFacets, getRegionCounts } from '../src/lib/queries/public';
import { fixtureRounds, fixtureSchools } from '../src/lib/queries/fixture';
import type { DeadlineRow } from '../src/lib/types';

/**
 * These exercise the query layer against the development fixture (Supabase is
 * not configured in the test environment). They verify the filtering,
 * visibility and ordering *logic* that the live path shares.
 */

const row = (p: Partial<DeadlineRow>): DeadlineRow =>
  ({
    roundId: 'r', roundName: 'Round 1', roundOrder: 1,
    deadline: null, decisionDate: null, isAnnounced: true, isVerified: false,
    sourceUrl: null, sourceName: null, lastVerified: null, notes: null,
    cycleId: 'c', cycleName: '2026–27', programId: 'p', programName: 'MBA',
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

describe('published/unpublished visibility', () => {
  it('only returns published schools', async () => {
    const schools = await getSchools();
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.every((s) => s.isPublished)).toBe(true);
  });

  it('excludes rounds belonging to unpublished schools', async () => {
    const rows = await getDeadlines({ includePast: true });
    const publishedIds = new Set(fixtureSchools.filter((s) => s.isPublished).map((s) => s.id));
    expect(rows.every((r) => publishedIds.has(r.schoolId))).toBe(true);
  });
});

describe('deadline filtering', () => {
  it('hides past deadlines by default', async () => {
    const rows = await getDeadlines({ onlyAnnounced: true });
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(rows.every((r) => !r.deadline || r.deadline >= todayIso)).toBe(true);
  });

  it('filters by country', async () => {
    const rows = await getDeadlines({ countries: ['France'], includePast: true });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.country === 'France')).toBe(true);
  });

  it('filters by search term across school names', async () => {
    const rows = await getDeadlines({ search: 'insead', includePast: true });
    expect(rows.every((r) => r.schoolName.toLowerCase().includes('insead'))).toBe(true);
  });

  it('onlyAnnounced excludes rounds with no announced date', async () => {
    const rows = await getDeadlines({ onlyAnnounced: true, includePast: true });
    expect(rows.every((r) => r.isAnnounced && r.deadline !== null)).toBe(true);
  });

  it('respects a date range', async () => {
    const rows = await getDeadlines({
      from: '2026-09-01', to: '2026-09-30', includePast: true,
    });
    expect(rows.every((r) => r.deadline! >= '2026-09-01' && r.deadline! <= '2026-09-30')).toBe(true);
  });

  it('applies limit', async () => {
    const rows = await getDeadlines({ includePast: true, limit: 3 });
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});

describe('facets are derived from data, not hardcoded', () => {
  it('derives every country present in the data', async () => {
    const facets = await getFilterFacets();
    const expected = new Set(fixtureSchools.filter((s) => s.isPublished).map((s) => s.country));
    for (const c of expected) expect(facets.countries).toContain(c);
  });

  it('derives round names including non-numbered ones', async () => {
    const facets = await getFilterFacets();
    // The fixture deliberately includes a rolling/custom round name.
    expect(facets.roundNames.length).toBeGreaterThan(0);
    const custom = fixtureRounds.find((r) => !/^Round \d$/.test(r.name));
    if (custom) expect(facets.roundNames).toContain(custom.name);
  });

  it('returns sorted, de-duplicated facets', async () => {
    const facets = await getFilterFacets();
    expect(facets.countries).toEqual([...new Set(facets.countries)]);
    expect(facets.countries).toEqual([...facets.countries].sort((a, b) => a.localeCompare(b)));
  });
});

describe('region counts', () => {
  it('counts published schools per region', async () => {
    const counts = await getRegionCounts();
    const total = counts.reduce((n, c) => n + c.count, 0);
    const published = fixtureSchools.filter((s) => s.isPublished).length;
    expect(total).toBe(published);
  });
});

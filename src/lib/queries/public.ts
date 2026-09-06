import { isSupabaseConfigured, supabase } from '../supabase';
import { compareRounds } from '../dates';
import type {
  ApplicationCycle,
  ApplicationRound,
  DeadlineRow,
  Program,
  School,
} from '../types';
import { mapCycle, mapDeadlineRow, mapProgram, mapRound, mapSchool } from './mappers';

/**
 * Read-side data access.
 *
 * Every public page goes through these functions â€” no component talks to
 * Supabase directly.
 *
 * There is no offline fixture. This product's entire value is that a date on
 * the screen is a date a school actually published, so an unconfigured build
 * shows NOTHING rather than plausible-looking placeholders. Fake deadlines are
 * worse than an empty page: an empty page is obviously broken, while a wrong
 * deadline looks correct right up until someone misses an application.
 */

export interface SchoolFilters {
  search?: string;
  countries?: string[];
  regions?: string[];
  programTypes?: string[];
  limit?: number;
  offset?: number;
}

export interface DeadlineFilters {
  search?: string;
  countries?: string[];
  regions?: string[];
  schoolIds?: string[];
  programTypes?: string[];
  cycleNames?: string[];
  roundNames?: string[];
  from?: string;
  to?: string;
  includePast?: boolean;
  onlyAnnounced?: boolean;
  sort?: 'nearest' | 'latest' | 'school' | 'round';
  limit?: number;  offset?: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The ordering contract, kept in TypeScript even though the live path sorts in
 * SQL, because it is the one piece of ordering logic worth asserting directly:
 * an undated round must never jump ahead of a dated one. Callers that merge or
 * re-sort rows client-side (Compare, Timeline) use this so a school with no
 * announced dates sinks to the bottom instead of masquerading as "due soonest".
 */
export function sortDeadlineRows(
  rows: DeadlineRow[],
  sort: NonNullable<DeadlineFilters['sort']>,
): DeadlineRow[] {
  const copy = [...rows];
  switch (sort) {
    case 'latest':
      return copy.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? 1 : -1;
      });
    case 'school':
      return copy.sort(
        (a, b) =>
          a.schoolName.localeCompare(b.schoolName) || a.roundOrder - b.roundOrder,
      );
    case 'round':
      return copy.sort(
        (a, b) =>
          a.roundOrder - b.roundOrder || a.schoolName.localeCompare(b.schoolName),
      );
    case 'nearest':
    default:
      return copy.sort((a, b) => {
        if (!a.deadline && !b.deadline)
          return a.schoolName.localeCompare(b.schoolName);
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline < b.deadline ? -1 : 1;
      });
  }
}

/**
 * Narrows the client to non-null, and refuses to serve anything when the
 * database is absent. Returning empty arrays instead of throwing would let a
 * misconfigured deploy look like "no deadlines announced yet", which is a
 * factual claim we would be making without evidence.
 */
function db() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured. MBAround serves only database-backed, ' +
        'sourced data — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

/* -------------------------------------------------------------------------
 * Schools
 * ---------------------------------------------------------------------- */

export async function getSchools(filters: SchoolFilters = {}): Promise<School[]> {
  let query = db()
    .from('schools')
    .select('*')
    .eq('is_published', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (filters.search) query = query.ilike('name', `%${filters.search}%`);
  if (filters.countries?.length) query = query.in('country', filters.countries);
  if (filters.regions?.length) query = query.in('region', filters.regions);
  if (filters.limit) {
    const start = filters.offset ?? 0;
    query = query.range(start, start + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapSchool);
}

export async function getFeaturedSchools(limit = 6): Promise<School[]> {
  const { data, error } = await db()
    .from('schools')
    .select('*')
    .eq('is_published', true)
    .eq('is_featured', true)
    .order('display_order', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapSchool);
}

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const { data, error } = await db()
    .from('schools')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSchool(data) : null;
}

export async function searchSchools(term: string, limit = 10): Promise<School[]> {
  if (!term.trim()) return [];
  return getSchools({ search: term, limit });
}

/* -------------------------------------------------------------------------
 * Programs / cycles / rounds
 * ---------------------------------------------------------------------- */

export async function getProgramsForSchool(schoolId: string): Promise<Program[]> {
  const { data, error } = await db()
    .from('programs')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_published', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProgram);
}

export async function getCyclesForProgram(
  programId: string,
): Promise<ApplicationCycle[]> {  const { data, error } = await db()
    .from('application_cycles')
    .select('*')
    .eq('program_id', programId)
    .neq('status', 'DRAFT')
    .order('start_year', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCycle);
}

export async function getRoundsForCycle(
  cycleId: string,
): Promise<ApplicationRound[]> {
  const { data, error } = await db()
    .from('application_rounds')
    .select('*')
    .eq('application_cycle_id', cycleId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRound).sort(compareRounds);
}

/* -------------------------------------------------------------------------
 * Deadlines (the flattened view used across the product)
 * ---------------------------------------------------------------------- */

export async function getDeadlines(
  filters: DeadlineFilters = {},
): Promise<DeadlineRow[]> {  let query = db().from('deadline_rows').select('*');

  if (filters.onlyAnnounced) query = query.eq('is_announced', true);
  if (!filters.includePast) query = query.or(`deadline.gte.${todayIso()},deadline.is.null`);
  if (filters.countries?.length) query = query.in('country', filters.countries);
  if (filters.regions?.length) query = query.in('region', filters.regions);
  if (filters.schoolIds?.length) query = query.in('school_id', filters.schoolIds);
  if (filters.programTypes?.length)
    query = query.in('program_type', filters.programTypes);
  if (filters.cycleNames?.length) query = query.in('cycle_name', filters.cycleNames);
  if (filters.roundNames?.length) query = query.in('round_name', filters.roundNames);
  if (filters.from) query = query.gte('deadline', filters.from);
  if (filters.to) query = query.lte('deadline', filters.to);
  if (filters.search) query = query.ilike('school_name', `%${filters.search}%`);

  const sort = filters.sort ?? 'nearest';
  if (sort === 'nearest')
    query = query.order('deadline', { ascending: true, nullsFirst: false });
  else if (sort === 'latest')
    query = query.order('deadline', { ascending: false, nullsFirst: false });
  else if (sort === 'school') query = query.order('school_name', { ascending: true });
  else query = query.order('round_order', { ascending: true });

  if (filters.limit) {
    const start = filters.offset ?? 0;
    query = query.range(start, start + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDeadlineRow);
}

export async function getUpcomingDeadlines(limit = 8): Promise<DeadlineRow[]> {
  return getDeadlines({ onlyAnnounced: true, sort: 'nearest', limit });
}

export async function getDeadlinesForSchool(
  schoolId: string,
): Promise<DeadlineRow[]> {
  return getDeadlines({ schoolIds: [schoolId], includePast: true, sort: 'nearest' });
}

/* -------------------------------------------------------------------------
 * Derived filter facets â€” never hardcoded
 * ---------------------------------------------------------------------- */

export interface FilterFacets {
  countries: string[];
  regions: string[];
  programTypes: string[];
  cycleNames: string[];
  roundNames: string[];
}

/**
 * Filter options are derived from whatever is actually in the database.
 * Adding a school in a new country makes that country appear automatically.
 */
export async function getFilterFacets(): Promise<FilterFacets> {
  const rows = await getDeadlines({ includePast: true });
  const schools = await getSchools();

  const uniq = (xs: string[]) =>
    [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    countries: uniq([...schools.map((s) => s.country), ...rows.map((r) => r.country)]),
    regions: uniq([...schools.map((s) => s.region), ...rows.map((r) => r.region)]),
    programTypes: uniq(rows.map((r) => r.programType)),
    cycleNames: uniq(rows.map((r) => r.cycleName)),
    roundNames: uniq(rows.map((r) => r.roundName)),
  };
}

/** Region â†’ school count, for the homepage "Explore by region" section. */
export async function getRegionCounts(): Promise<
  { region: string; count: number }[]
> {
  const schools = await getSchools();
  const counts = new Map<string, number>();
  for (const s of schools) counts.set(s.region, (counts.get(s.region) ?? 0) + 1);
  return [...counts.entries()]
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

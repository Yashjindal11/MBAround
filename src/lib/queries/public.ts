import { isSupabaseConfigured, supabase } from '../supabase';
import { compareRounds } from '../dates';
import type {
  ApplicationCycle,
  ApplicationRound,
  DeadlineRow,
  Program,
  School,
} from '../types';
import {
  fixtureCycles,
  fixturePrograms,
  fixtureRounds,
  fixtureSchools,
} from './fixture';
import { mapCycle, mapDeadlineRow, mapProgram, mapRound, mapSchool } from './mappers';

/**
 * Read-side data access.
 *
 * Every public page goes through these functions — no component talks to
 * Supabase directly. When Supabase is not configured we serve the development
 * fixture so the UI is reviewable, but the shapes are identical, so switching
 * to a live database requires no UI changes.
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
  limit?: number;
  offset?: number;
}

/* -------------------------------------------------------------------------
 * Fixture helpers (dev-only path)
 * ---------------------------------------------------------------------- */

function fixtureDeadlineRows(): DeadlineRow[] {
  const schoolsById = new Map(fixtureSchools.map((s) => [s.id, s]));
  const programsById = new Map(fixturePrograms.map((p) => [p.id, p]));
  const cyclesById = new Map(fixtureCycles.map((c) => [c.id, c]));

  const rows: DeadlineRow[] = [];
  for (const round of fixtureRounds) {
    const cycle = cyclesById.get(round.applicationCycleId);
    if (!cycle) continue;
    const program = programsById.get(cycle.programId);
    if (!program || !program.isPublished) continue;
    const school = schoolsById.get(program.schoolId);
    if (!school || !school.isPublished) continue;

    rows.push({
      roundId: round.id,
      roundName: round.name,
      roundOrder: round.displayOrder,
      deadline: round.deadline,
      decisionDate: round.decisionDate,
      isAnnounced: round.isAnnounced,
      isVerified: round.isVerified,
      sourceUrl: round.sourceUrl,
      sourceName: round.sourceName,
      lastVerified: round.lastVerified,
      notes: round.notes,
      cycleId: cycle.id,
      cycleName: cycle.cycleName,
      programId: program.id,
      programName: program.name,
      programType: program.programType,
      schoolId: school.id,
      schoolName: school.name,
      schoolSlug: school.slug,
      country: school.country,
      region: school.region,
      city: school.city,
    });
  }
  return rows;
}

function applyDeadlineFilters(
  rows: DeadlineRow[],
  f: DeadlineFilters,
  todayIso: string,
): DeadlineRow[] {
  let out = rows;

  if (f.onlyAnnounced) out = out.filter((r) => r.isAnnounced && r.deadline);
  if (!f.includePast) {
    out = out.filter((r) => !r.deadline || r.deadline >= todayIso);
  }
  if (f.search) {
    const q = f.search.toLowerCase();
    out = out.filter(
      (r) =>
        r.schoolName.toLowerCase().includes(q) ||
        r.programName.toLowerCase().includes(q) ||
        r.roundName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q),
    );
  }
  if (f.countries?.length) out = out.filter((r) => f.countries!.includes(r.country));
  if (f.regions?.length) out = out.filter((r) => f.regions!.includes(r.region));
  if (f.schoolIds?.length) out = out.filter((r) => f.schoolIds!.includes(r.schoolId));
  if (f.programTypes?.length)
    out = out.filter((r) => f.programTypes!.includes(r.programType));
  if (f.cycleNames?.length) out = out.filter((r) => f.cycleNames!.includes(r.cycleName));
  if (f.roundNames?.length) out = out.filter((r) => f.roundNames!.includes(r.roundName));
  if (f.from) out = out.filter((r) => r.deadline && r.deadline >= f.from!);
  if (f.to) out = out.filter((r) => r.deadline && r.deadline <= f.to!);

  return sortDeadlineRows(out, f.sort ?? 'nearest');
}

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
          a.schoolName.localeCompare(b.schoolName) ||
          a.roundOrder - b.roundOrder,
      );
    case 'round':
      return copy.sort(
        (a, b) =>
          a.roundOrder - b.roundOrder ||
          a.schoolName.localeCompare(b.schoolName),
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------
 * Schools
 * ---------------------------------------------------------------------- */

export async function getSchools(filters: SchoolFilters = {}): Promise<School[]> {
  if (!isSupabaseConfigured || !supabase) {
    let out = fixtureSchools.filter((s) => s.isPublished);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      out = out.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.shortName ?? '').toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.country.toLowerCase().includes(q),
      );
    }
    if (filters.countries?.length)
      out = out.filter((s) => filters.countries!.includes(s.country));
    if (filters.regions?.length)
      out = out.filter((s) => filters.regions!.includes(s.region));
    out = out.sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
    );
    const start = filters.offset ?? 0;
    return filters.limit ? out.slice(start, start + filters.limit) : out;
  }

  let query = supabase
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
  if (!isSupabaseConfigured || !supabase) {
    return fixtureSchools
      .filter((s) => s.isPublished && s.isFeatured)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, limit);
  }
  const { data, error } = await supabase
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
  if (!isSupabaseConfigured || !supabase) {
    return fixtureSchools.find((s) => s.slug === slug && s.isPublished) ?? null;
  }
  const { data, error } = await supabase
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
  if (!isSupabaseConfigured || !supabase) {
    return fixturePrograms
      .filter((p) => p.schoolId === schoolId && p.isPublished)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }
  const { data, error } = await supabase
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
): Promise<ApplicationCycle[]> {
  if (!isSupabaseConfigured || !supabase) {
    return fixtureCycles.filter((c) => c.programId === programId);
  }
  const { data, error } = await supabase
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
  if (!isSupabaseConfigured || !supabase) {
    return fixtureRounds
      .filter((r) => r.applicationCycleId === cycleId)
      .sort(compareRounds);
  }
  const { data, error } = await supabase
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
): Promise<DeadlineRow[]> {
  if (!isSupabaseConfigured || !supabase) {
    const rows = applyDeadlineFilters(fixtureDeadlineRows(), filters, todayIso());
    const start = filters.offset ?? 0;
    return filters.limit ? rows.slice(start, start + filters.limit) : rows;
  }

  let query = supabase.from('deadline_rows').select('*');

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
 * Derived filter facets — never hardcoded
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

/** Region → school count, for the homepage "Explore by region" section. */
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

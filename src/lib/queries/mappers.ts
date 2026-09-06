import type {
  ApplicationCycle,
  ApplicationRound,
  DeadlineRow,
  Program,
  School,
} from '../types';

/** Row shapes as returned by Postgres (snake_case), mapped to domain types. */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapSchool(row: any): School {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortName: row.short_name ?? null,
    description: row.description ?? null,
    country: row.country,
    region: row.region,
    state: row.state ?? null,
    city: row.city,
    websiteUrl: row.website_url ?? null,
    admissionsUrl: row.admissions_url ?? null,
    logoUrl: row.logo_url ?? null,
    imageUrl: row.image_url ?? null,
    isFeatured: Boolean(row.is_featured),
    isPublished: Boolean(row.is_published),
    isVerified: Boolean(row.is_verified),
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProgram(row: any): Program {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    slug: row.slug,
    programType: row.program_type,
    description: row.description ?? null,
    durationMonths: row.duration_months ?? null,
    isPublished: Boolean(row.is_published),
    isVerified: Boolean(row.is_verified),
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCycle(row: any): ApplicationCycle {
  return {
    id: row.id,
    programId: row.program_id,
    cycleName: row.cycle_name,
    startYear: row.start_year,
    endYear: row.end_year,
    status: row.status,
    isCurrent: Boolean(row.is_current),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRound(row: any): ApplicationRound {
  return {
    id: row.id,
    applicationCycleId: row.application_cycle_id,
    name: row.name,
    deadline: row.deadline ?? null,
    decisionDate: row.decision_date ?? null,
    notes: row.notes ?? null,
    isAnnounced: Boolean(row.is_announced),
    isVerified: Boolean(row.is_verified),
    sourceUrl: row.source_url ?? null,
    sourceName: row.source_name ?? null,
    lastVerified: row.last_verified ?? null,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Maps a row from the `deadline_rows` database view. */
export function mapDeadlineRow(row: any): DeadlineRow {
  return {
    roundId: row.round_id,
    roundName: row.round_name,
    roundOrder: row.round_order ?? 0,
    deadline: row.deadline ?? null,
    decisionDate: row.decision_date ?? null,
    isAnnounced: Boolean(row.is_announced),
    isVerified: Boolean(row.is_verified),
    sourceUrl: row.source_url ?? null,
    sourceName: row.source_name ?? null,
    lastVerified: row.last_verified ?? null,
    notes: row.notes ?? null,
    cycleId: row.cycle_id,
    cycleName: row.cycle_name,
    programId: row.program_id,
    programName: row.program_name,
    programType: row.program_type,
    schoolId: row.school_id,
    schoolName: row.school_name,
    schoolSlug: row.school_slug,
    country: row.country,
    region: row.region,
    city: row.city,
  };
}

/** Domain → snake_case payload for writes. */
export function schoolToRow(s: Partial<School>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('name', s.name);
  set('slug', s.slug);
  set('short_name', s.shortName);
  set('description', s.description);
  set('country', s.country);
  set('region', s.region);
  set('state', s.state);
  set('city', s.city);
  set('website_url', s.websiteUrl);
  set('admissions_url', s.admissionsUrl);
  set('logo_url', s.logoUrl);
  set('image_url', s.imageUrl);
  set('is_featured', s.isFeatured);
  set('is_published', s.isPublished);
  set('is_verified', s.isVerified);
  set('display_order', s.displayOrder);
  return row;
}

export function programToRow(p: Partial<Program>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('school_id', p.schoolId);
  set('name', p.name);
  set('slug', p.slug);
  set('program_type', p.programType);
  set('description', p.description);
  set('duration_months', p.durationMonths);
  set('is_published', p.isPublished);
  set('is_verified', p.isVerified);
  set('display_order', p.displayOrder);
  return row;
}

export function cycleToRow(c: Partial<ApplicationCycle>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('program_id', c.programId);
  set('cycle_name', c.cycleName);
  set('start_year', c.startYear);
  set('end_year', c.endYear);
  set('status', c.status);
  set('is_current', c.isCurrent);
  return row;
}

export function roundToRow(r: Partial<ApplicationRound>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set('application_cycle_id', r.applicationCycleId);
  set('name', r.name);
  set('deadline', r.deadline);
  set('decision_date', r.decisionDate);
  set('notes', r.notes);
  set('is_announced', r.isAnnounced);
  set('is_verified', r.isVerified);
  set('source_url', r.sourceUrl);
  set('source_name', r.sourceName);
  set('last_verified', r.lastVerified);
  set('display_order', r.displayOrder);
  return row;
}

import { requireSupabase } from '../supabase';
import type {
  ApplicationCycle,
  ApplicationRound,
  AuditLogEntry,
  DataHealth,
  Program,
  School,
  Suggestion,
} from '../types';
import {
  cycleToRow,
  mapCycle,
  mapProgram,
  mapRound,
  mapSchool,
  programToRow,
  roundToRow,
  schoolToRow,
} from './mappers';

/**
 * Admin (write-side) data access.
 *
 * These call Supabase directly with the user's session, so every statement is
 * checked by RLS. Nothing here is trusted because the UI rendered a button —
 * an unauthorised user's write is rejected by the database.
 *
 * Audit entries are produced by database triggers, not by this module.
 */

/* ------------------------------------------------------------------ schools */

export interface AdminSchoolFilters {
  search?: string;
  countries?: string[];
  regions?: string[];
  published?: boolean;
  verified?: boolean;
  featured?: boolean;
  sort?: 'name' | 'country' | 'updated' | 'order';
  limit?: number;
  offset?: number;
}

export async function adminListSchools(
  f: AdminSchoolFilters = {},
): Promise<School[]> {
  let q = requireSupabase().from('schools').select('*');

  if (f.search) q = q.or(`name.ilike.%${f.search}%,short_name.ilike.%${f.search}%,city.ilike.%${f.search}%`);
  if (f.countries?.length) q = q.in('country', f.countries);
  if (f.regions?.length) q = q.in('region', f.regions);
  if (f.published !== undefined) q = q.eq('is_published', f.published);
  if (f.verified !== undefined) q = q.eq('is_verified', f.verified);
  if (f.featured !== undefined) q = q.eq('is_featured', f.featured);

  switch (f.sort) {
    case 'country': q = q.order('country').order('name'); break;
    case 'updated': q = q.order('updated_at', { ascending: false }); break;
    case 'order': q = q.order('display_order').order('name'); break;
    default: q = q.order('name');
  }

  if (f.limit) q = q.range(f.offset ?? 0, (f.offset ?? 0) + f.limit - 1);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapSchool);
}

export async function adminGetSchool(id: string): Promise<School | null> {
  const { data, error } = await requireSupabase()
    .from('schools').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapSchool(data) : null;
}

export async function createSchool(input: Partial<School>): Promise<School> {
  const { data, error } = await requireSupabase()
    .from('schools').insert(schoolToRow(input)).select().single();
  if (error) throw error;
  return mapSchool(data);
}

export async function updateSchool(id: string, patch: Partial<School>): Promise<School> {
  const { data, error } = await requireSupabase()
    .from('schools').update(schoolToRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return mapSchool(data);
}

export async function deleteSchool(id: string): Promise<void> {
  const { error } = await requireSupabase().from('schools').delete().eq('id', id);
  if (error) throw error;
}

/** Bulk operations. Structured so more can be added without new plumbing. */
export async function bulkUpdateSchools(
  ids: string[],
  patch: Partial<School>,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await requireSupabase()
    .from('schools').update(schoolToRow(patch)).in('id', ids);
  if (error) throw error;
}

/* ----------------------------------------------------------------- programs */

export async function adminListPrograms(filters: {
  schoolId?: string;
  search?: string;
  programType?: string;
  published?: boolean;
} = {}): Promise<Program[]> {
  let q = requireSupabase().from('programs').select('*');
  if (filters.schoolId) q = q.eq('school_id', filters.schoolId);
  if (filters.programType) q = q.eq('program_type', filters.programType);
  if (filters.published !== undefined) q = q.eq('is_published', filters.published);
  if (filters.search) q = q.ilike('name', `%${filters.search}%`);
  q = q.order('display_order').order('name');

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapProgram);
}

export async function createProgram(input: Partial<Program>): Promise<Program> {
  const { data, error } = await requireSupabase()
    .from('programs').insert(programToRow(input)).select().single();
  if (error) throw error;
  return mapProgram(data);
}

export async function updateProgram(id: string, patch: Partial<Program>): Promise<Program> {
  const { data, error } = await requireSupabase()
    .from('programs').update(programToRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return mapProgram(data);
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await requireSupabase().from('programs').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------- cycles */

export async function adminListCycles(programId?: string): Promise<ApplicationCycle[]> {
  let q = requireSupabase().from('application_cycles').select('*');
  if (programId) q = q.eq('program_id', programId);
  const { data, error } = await q.order('start_year', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCycle);
}

export async function createCycle(input: Partial<ApplicationCycle>): Promise<ApplicationCycle> {
  const { data, error } = await requireSupabase()
    .from('application_cycles').insert(cycleToRow(input)).select().single();
  if (error) throw error;
  return mapCycle(data);
}

export async function updateCycle(
  id: string,
  patch: Partial<ApplicationCycle>,
): Promise<ApplicationCycle> {
  const { data, error } = await requireSupabase()
    .from('application_cycles').update(cycleToRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return mapCycle(data);
}

/**
 * Only one cycle per programme may be current, enforced by a partial unique
 * index. Clear the old one first so the swap never violates it.
 */
export async function setCurrentCycle(programId: string, cycleId: string): Promise<void> {
  const sb = requireSupabase();
  const { error: clearErr } = await sb
    .from('application_cycles')
    .update({ is_current: false })
    .eq('program_id', programId)
    .neq('id', cycleId);
  if (clearErr) throw clearErr;

  const { error } = await sb
    .from('application_cycles')
    .update({ is_current: true, status: 'CURRENT' })
    .eq('id', cycleId);
  if (error) throw error;
}

export async function deleteCycle(id: string): Promise<void> {
  const { error } = await requireSupabase().from('application_cycles').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------- rounds */

export async function adminListRounds(cycleId?: string): Promise<ApplicationRound[]> {
  let q = requireSupabase().from('application_rounds').select('*');
  if (cycleId) q = q.eq('application_cycle_id', cycleId);
  const { data, error } = await q.order('display_order');
  if (error) throw error;
  return (data ?? []).map(mapRound);
}

export async function createRound(input: Partial<ApplicationRound>): Promise<ApplicationRound> {
  const { data, error } = await requireSupabase()
    .from('application_rounds').insert(roundToRow(input)).select().single();
  if (error) throw error;
  return mapRound(data);
}

export async function updateRound(
  id: string,
  patch: Partial<ApplicationRound>,
): Promise<ApplicationRound> {
  const { data, error } = await requireSupabase()
    .from('application_rounds').update(roundToRow(patch)).eq('id', id).select().single();
  if (error) throw error;
  return mapRound(data);
}

export async function deleteRound(id: string): Promise<void> {
  const { error } = await requireSupabase().from('application_rounds').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkUpdateRounds(
  ids: string[],
  patch: Partial<ApplicationRound>,
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await requireSupabase()
    .from('application_rounds').update(roundToRow(patch)).in('id', ids);
  if (error) throw error;
}

/* -------------------------------------------------- suggestions / audit log */

export async function adminListSuggestions(
  status?: 'PENDING' | 'APPROVED' | 'REJECTED',
): Promise<Suggestion[]> {
  let q = requireSupabase().from('suggestions').select('*');
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: r.id,
    schoolId: r.school_id,
    programId: r.program_id,
    roundId: r.round_id,
    fieldName: r.field_name,
    issue: r.issue,
    suggestedValue: r.suggested_value,
    sourceUrl: r.source_url,
    notes: r.notes,
    email: r.email,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }));
}

/** Approval/rejection goes through an RPC so it is authorised and audited. */
export async function reviewSuggestion(id: string, approve: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('review_suggestion', {
    p_suggestion_id: id,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function getAuditLog(
  filters: { entityType?: string; entityId?: string; limit?: number } = {},
): Promise<AuditLogEntry[]> {
  let q = requireSupabase().from('audit_log').select('*');
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.entityId) q = q.eq('entity_id', filters.entityId);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 100);
  if (error) throw error;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    id: r.id,
    actor: r.actor_email ?? r.actor,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    beforeData: r.before_data,
    afterData: r.after_data,
    createdAt: r.created_at,
  }));
}

export async function getDataHealth(): Promise<DataHealth> {
  const { data, error } = await requireSupabase().rpc('data_health');
  if (error) throw error;
  return data as DataHealth;
}

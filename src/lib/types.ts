/**
 * Canonical domain types for MBAround.
 *
 * These mirror the Supabase schema in `supabase/migrations/`. They are the
 * contract between the data-access layer (`src/lib/queries/*`) and the UI.
 * UI components must never reach into Supabase directly.
 */

export type Region =
  | 'North America'
  | 'Europe'
  | 'Asia'
  | 'Latin America'
  | 'Middle East'
  | 'Africa'
  | 'Oceania'
  | (string & {});

export type CycleStatus = 'DRAFT' | 'UPCOMING' | 'CURRENT' | 'ARCHIVED';

export type RecordStatus = 'OK' | 'NEEDS_REVIEW';

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR';

/**
 * How confident we are in a single piece of data. Drives the
 * `VerificationBadge` component and the admin data-health panel.
 */
export type VerificationState =
  | 'VERIFIED'
  | 'NEEDS_REVIEW'
  | 'NOT_ANNOUNCED'
  | 'UNAVAILABLE';

export interface School {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  description: string | null;
  country: string;
  region: Region;
  state: string | null;
  city: string;
  websiteUrl: string | null;
  admissionsUrl: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  isVerified: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  schoolId: string;
  name: string;
  slug: string;
  programType: string;
  description: string | null;
  durationMonths: number | null;
  isPublished: boolean;
  isVerified: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationCycle {
  id: string;
  programId: string;
  cycleName: string;
  startYear: number;
  endYear: number;
  status: CycleStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRound {
  id: string;
  applicationCycleId: string;
  name: string;
  /** ISO date (YYYY-MM-DD) or null when the school has not announced it. */
  deadline: string | null;
  decisionDate: string | null;
  notes: string | null;
  isAnnounced: boolean;
  isVerified: boolean;
  sourceUrl: string | null;
  sourceName: string | null;
  lastVerified: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A flattened row used by the deadlines table, timeline and comparison views. */
export interface DeadlineRow {
  roundId: string;
  roundName: string;
  roundOrder: number;
  deadline: string | null;
  decisionDate: string | null;
  isAnnounced: boolean;
  isVerified: boolean;
  sourceUrl: string | null;
  sourceName: string | null;
  lastVerified: string | null;
  notes: string | null;
  cycleId: string;
  cycleName: string;
  programId: string;
  programName: string;
  programType: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  country: string;
  region: Region;
  city: string;
}

export interface Suggestion {
  id: string;
  schoolId: string | null;
  programId: string | null;
  roundId: string | null;
  fieldName: string | null;
  issue: string;
  suggestedValue: string | null;
  sourceUrl: string | null;
  notes: string | null;
  email: string | null;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export type AuditAction =
  | 'SCHOOL_CREATED'
  | 'SCHOOL_UPDATED'
  | 'SCHOOL_DELETED'
  | 'PROGRAM_CREATED'
  | 'PROGRAM_UPDATED'
  | 'PROGRAM_DELETED'
  | 'CYCLE_CREATED'
  | 'CYCLE_UPDATED'
  | 'CYCLE_DELETED'
  | 'ROUND_CREATED'
  | 'ROUND_UPDATED'
  | 'ROUND_DELETED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'SUGGESTION_APPROVED'
  | 'SUGGESTION_REJECTED';

export interface AuditLogEntry {
  id: string;
  actor: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
}

export interface RankingSource {
  id: string;
  name: string;
  publisher: string;
  edition: string;
  url: string;
}

export interface SchoolRanking {
  id: string;
  schoolId: string;
  rankingSourceId: string;
  rank: number | null;
}

/** Aggregate counters powering the admin "Data health" panel. */
export interface DataHealth {
  totalSchools: number;
  publishedSchools: number;
  verifiedSchools: number;
  needsReview: number;
  missingOfficialSource: number;
  totalPrograms: number;
  currentCycles: number;
  upcomingDeadlines: number;
  unannouncedRounds: number;
  pendingSuggestions: number;
}

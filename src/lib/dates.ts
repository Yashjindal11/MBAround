import type { ApplicationRound, DeadlineRow, VerificationState } from './types';

/**
 * MBAround stores deadlines as calendar dates (YYYY-MM-DD) with no timezone.
 * Everything here works in "calendar day" space so a deadline never shifts
 * across a date boundary depending on where the user is sitting.
 */

/** Parse a `YYYY-MM-DD` string into a UTC-noon Date (immune to DST/offsets). */
export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today as a UTC-noon Date. Injectable so tests are deterministic. */
export function today(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12),
  );
}

/**
 * Whole days from `now` until `iso`.
 * Negative = in the past. `null` when there is no date to count to.
 */
export function daysUntil(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const target = parseDate(iso);
  if (!target) return null;
  const diff = target.getTime() - today(now).getTime();
  return Math.round(diff / 86_400_000);
}

export function isUpcoming(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const days = daysUntil(iso, now);
  return days !== null && days >= 0;
}

/** "18 days remaining" / "Today" / "Closed 3 days ago" */
export function countdownLabel(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  const days = daysUntil(iso, now);
  if (days === null) return 'Not announced';
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day remaining';
  if (days > 0) return `${days} days remaining`;
  const past = Math.abs(days);
  return past === 1 ? 'Closed yesterday' : `Closed ${past} days ago`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const COMPACT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** September 17, 2026 */
export function formatDate(iso: string | null | undefined): string {
  const date = parseDate(iso);
  return date ? LONG_DATE.format(date) : '—';
}

/** Sep 17, 2026 */
export function formatDateShort(iso: string | null | undefined): string {
  const date = parseDate(iso);
  return date ? SHORT_DATE.format(date) : '—';
}

/** Sep 17 */
export function formatDateCompact(iso: string | null | undefined): string {
  const date = parseDate(iso);
  return date ? COMPACT_DATE.format(date) : '—';
}

/** Relative wording for `last_verified`, e.g. "Last verified 12 days ago". */
export function formatRelativeVerified(iso: string | null | undefined): string {
  const days = daysUntil(iso);
  if (days === null) return 'Never verified';
  const ago = Math.abs(days);
  if (ago === 0) return 'Last verified today';
  if (ago === 1) return 'Last verified yesterday';
  if (ago < 30) return `Last verified ${ago} days ago`;
  const months = Math.round(ago / 30);
  return months === 1
    ? 'Last verified about a month ago'
    : `Last verified about ${months} months ago`;
}

/** A record is stale when it has not been re-checked recently. */
export function isStale(
  lastVerified: string | null | undefined,
  thresholdDays = 30,
  now: Date = new Date(),
): boolean {
  const days = daysUntil(lastVerified, now);
  if (days === null) return true;
  return Math.abs(days) > thresholdDays;
}

/**
 * Collapse the announced/verified flags into the single state the UI renders.
 * Missing data is *never* presented as a real date.
 */
export function verificationState(
  round: Pick<
    ApplicationRound,
    'deadline' | 'isAnnounced' | 'isVerified'
  >,
): VerificationState {
  if (!round.isAnnounced) return 'NOT_ANNOUNCED';
  if (!round.deadline) return 'UNAVAILABLE';
  return round.isVerified ? 'VERIFIED' : 'NEEDS_REVIEW';
}

/**
 * Sort rounds for display: announced dates first (chronologically), then
 * unannounced rounds in their configured `display_order`.
 *
 * Accepts anything carrying a deadline plus an ordering hint, so it works for
 * both `ApplicationRound` (displayOrder) and `DeadlineRow` (roundOrder).
 */
export function compareRounds(
  a: { deadline: string | null; displayOrder?: number; roundOrder?: number },
  b: { deadline: string | null; displayOrder?: number; roundOrder?: number },
): number {
  const orderOf = (x: { displayOrder?: number; roundOrder?: number }) =>
    x.displayOrder ?? x.roundOrder ?? 0;

  if (a.deadline && b.deadline) {
    if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    return orderOf(a) - orderOf(b);
  }
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return orderOf(a) - orderOf(b);
}

/** Nearest upcoming deadline for a set of rows, or null if none remain. */
export function nextUpcoming(
  rows: DeadlineRow[],
  now: Date = new Date(),
): DeadlineRow | null {
  const upcoming = rows
    .filter((r) => r.deadline && isUpcoming(r.deadline, now))
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
  return upcoming[0] ?? null;
}

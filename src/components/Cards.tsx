import { Link } from 'react-router-dom';
import { countdownLabel, daysUntil, formatDate, formatDateShort } from '../lib/dates';
import type { DeadlineRow, School } from '../lib/types';
import { ProvenanceLine } from './VerificationBadge';

/** Colour-codes urgency without shouting. */
function urgencyClass(deadline: string | null): string {
  const days = daysUntil(deadline);
  if (days === null) return 'text-ink-400';
  if (days < 0) return 'text-ink-400';
  if (days <= 7) return 'text-red-600';
  if (days <= 30) return 'text-amber-700';
  return 'text-ink-500';
}

export function LocationLine({ school }: { school: Pick<School, 'city' | 'state' | 'country'> }) {
  return (
    <>
      {[school.city, school.state, school.country].filter(Boolean).join(', ')}
    </>
  );
}

export function DeadlineCard({ row }: { row: DeadlineRow }) {
  return (
    <article className="surface group p-5 transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`/schools/${row.schoolSlug}`}
            className="block truncate text-base font-semibold text-ink-900 hover:text-accent-700"
          >
            {row.schoolName}
          </Link>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {row.programName} · {row.cycleName} · {row.city}, {row.country}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-2xs font-semibold text-ink-700">
          {row.roundName}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <p className="label-caps">Deadline</p>
          <p className="mt-0.5 font-display text-lg text-ink-900">
            {row.deadline ? formatDate(row.deadline) : 'Not announced'}
          </p>
        </div>
        <div>
          <p className="label-caps">Decision</p>
          <p className="mt-0.5 text-sm text-ink-700">
            {row.decisionDate ? formatDateShort(row.decisionDate) : '—'}
          </p>
        </div>
        <p className={`ml-auto text-sm font-medium ${urgencyClass(row.deadline)}`}>
          {countdownLabel(row.deadline)}
        </p>
      </div>

      {row.notes && <p className="mt-3 text-xs leading-relaxed text-ink-500">{row.notes}</p>}

      <div className="mt-4 border-t border-ink-100 pt-3">
        <ProvenanceLine record={row} />
      </div>
    </article>
  );
}

export function SchoolCard({
  school,
  programCount,
  nextDeadline,
}: {
  school: School;
  programCount?: number;
  nextDeadline?: DeadlineRow | null;
}) {
  return (
    <Link
      to={`/schools/${school.slug}`}
      className="surface group flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug text-ink-900 group-hover:text-accent-700">
          {school.name}
        </h3>
        {school.shortName && (
          <span className="shrink-0 rounded-md bg-ink-100 px-2 py-0.5 text-2xs font-semibold text-ink-600">
            {school.shortName}
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-ink-500">
        <LocationLine school={school} />
      </p>

      {school.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">
          {school.description}
        </p>
      )}

      <div className="mt-auto flex items-end justify-between gap-4 pt-5">
        <div>
          <p className="label-caps">Next deadline</p>
          <p className="mt-0.5 text-sm font-medium text-ink-900">
            {nextDeadline?.deadline
              ? formatDateShort(nextDeadline.deadline)
              : 'Not announced'}
          </p>
          {nextDeadline?.deadline && (
            <p className="text-2xs text-ink-500">
              {nextDeadline.roundName} · {countdownLabel(nextDeadline.deadline)}
            </p>
          )}
        </div>
        {programCount !== undefined && (
          <p className="text-2xs text-ink-500">
            {programCount} {programCount === 1 ? 'programme' : 'programmes'}
          </p>
        )}
      </div>
    </Link>
  );
}

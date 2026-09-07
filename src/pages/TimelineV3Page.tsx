import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { countdownLabel, daysUntil, formatDate, verificationState } from '../lib/dates';
import { ErrorState, LoadingState } from '../components/States';
import { VerificationBadge } from '../components/VerificationBadge';
import { ScopeRail, useSchoolScope } from '../components/SchoolScope';
import { SchoolPicker } from '../components/SchoolPicker';
import {
  DemoBanner,
  TimelineEmpty,
  TimelineHeader,
  UnannouncedList,
} from '../components/TimelineChrome';
import { useTimelineData } from '../components/useTimelineData';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';
import type { DeadlineRow } from '../lib/types';

const JSONLD = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Timeline', path: '/timeline' },
    { name: 'Agenda view', path: '/timeline/v3' },
  ]),
];

/**
 * Timeline v3 — an agenda ordered by urgency.
 *
 * The other two views are spatial: they answer "what does the cycle look
 * like?". Neither answers "what do I have to do next?", which is the question
 * an applicant actually has mid-cycle. This view drops the horizontal axis
 * entirely and buckets rounds by how soon they are due.
 *
 * Buckets are relative to today and computed from the data, so they hold no
 * assumption about how many rounds exist or what they are called. Past rounds
 * are collapsed rather than deleted: knowing a deadline has gone is useful,
 * and silently dropping it would misrepresent the cycle.
 */

/** Ordered most to least urgent. Thresholds are in days from today. */
const BUCKETS = [
  { id: 'overdue', label: 'Closed', hint: 'Already passed', max: -1 },
  { id: 'week', label: 'This week', hint: 'Within 7 days', max: 7 },
  { id: 'month', label: 'This month', hint: 'Within 30 days', max: 30 },
  { id: 'quarter', label: 'Next 3 months', hint: 'Within 90 days', max: 90 },
  { id: 'later', label: 'Later', hint: 'More than 90 days away', max: Infinity },
] as const;

type BucketId = (typeof BUCKETS)[number]['id'];

function bucketFor(days: number): BucketId {
  if (days < 0) return 'overdue';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  if (days <= 90) return 'quarter';
  return 'later';
}

/** Urgency colour. Deliberately not used as the only signal — text repeats it. */
function accentFor(id: BucketId): string {
  switch (id) {
    case 'overdue':
      return 'bg-ink-300';
    case 'week':
      return 'bg-rose-500';
    case 'month':
      return 'bg-amber-500';
    case 'quarter':
      return 'bg-accent-500';
    default:
      return 'bg-ink-300';
  }
}

export default function TimelineV3Page() {
  const [deselected, setDeselected] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
  const { schools, rows, loading, error, reload, isDemo } = useTimelineData();

  const scope = useSchoolScope(schools, rows);
  useSeo({
    title: 'MBA Deadlines by Urgency — What to Do Next',
    description:
      'MBA application deadlines grouped by how soon they are due, so the next thing you have to act on is always at the top.',
    path: '/timeline/v3',
    // Same data as /timeline in a different layout. Indexing all three would
    // split ranking signals between pages that compete with each other.
    // Remove this once one layout is chosen and becomes /timeline.
    noindex: true,
    jsonLd: JSONLD,
  });

  const isSelected = (slug: string) => !deselected.includes(slug);
  const toggle = (slug: string) =>
    setDeselected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const railSchools = scope.schools;
  const selectedCount = railSchools.filter((s) => isSelected(s.slug)).length;

  const selectAll = () =>
    setDeselected((prev) => prev.filter((slug) => !railSchools.some((s) => s.slug === slug)));
  const selectNone = () =>
    setDeselected((prev) => [...new Set([...prev, ...railSchools.map((s) => s.slug)])]);

  const selectedIds = useMemo(
    () => new Set(railSchools.filter((s) => !deselected.includes(s.slug)).map((s) => s.id)),
    [railSchools, deselected],
  );

  const inScope = useMemo(
    () => rows.filter((r) => selectedIds.has(r.schoolId)),
    [rows, selectedIds],
  );

  const dated = useMemo(
    () => inScope.filter((r) => r.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [inScope],
  );
  const undated = useMemo(() => inScope.filter((r) => !r.deadline), [inScope]);

  /** Rounds bucketed by urgency, each bucket still in date order. */
  const grouped = useMemo(() => {
    const map = new Map<BucketId, DeadlineRow[]>();
    for (const r of dated) {
      const days = daysUntil(r.deadline);
      if (days === null) continue;
      const id = bucketFor(days);
      map.set(id, [...(map.get(id) ?? []), r]);
    }
    return map;
  }, [dated]);

  /**
   * Deadlines falling on the same calendar day, across schools.
   *
   * This is the collision an applicant most needs warning about and the one a
   * proportional axis hides: two dots a pixel apart read as "about the same
   * time", not "both due that morning".
   */
  const clashes = useMemo(() => {
    const byDay = new Map<string, DeadlineRow[]>();
    for (const r of dated) {
      if ((daysUntil(r.deadline) ?? -1) < 0) continue;
      byDay.set(r.deadline!, [...(byDay.get(r.deadline!) ?? []), r]);
    }
    return [...byDay.entries()]
      .filter(([, items]) => items.length > 1)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [dated]);
  const nextUp = useMemo(
    () => dated.find((r) => (daysUntil(r.deadline) ?? -1) >= 0) ?? null,
    [dated],
  );

  const upcomingCount = useMemo(
    () => dated.filter((r) => (daysUntil(r.deadline) ?? -1) >= 0).length,
    [dated],
  );

  const stats = useMemo(
    () => [
      { label: 'Upcoming', value: String(upcomingCount) },
      { label: 'Clashing dates', value: String(clashes.length) },
      {
        label: 'Next deadline',
        value: nextUp ? countdownLabel(nextUp.deadline).replace(' remaining', '') : '—',
      },
    ],
    [upcomingCount, clashes.length, nextUp],
  );

  const rail = (
    <div className="space-y-1">
      {scope.controls}
      <SchoolPicker
        schools={railSchools}
        deselected={deselected}
        onToggle={toggle}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
      />
    </div>
  );

  return (
    <div className="container-page py-10 sm:py-14">
      <TimelineHeader
        eyebrow="Plan ahead"
        title="What's next"
        intro="Rounds grouped by how soon they close, nearest first — and an explicit warning wherever two schools want work from you on the same day."
        current="/timeline/v3"
        stats={dated.length > 0 ? stats : undefined}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_1fr]">
        <ScopeRail activeCount={scope.activeCount} onClear={scope.clearAll}>
          {rail}
        </ScopeRail>

        <div className="min-w-0">
          {isDemo && <DemoBanner />}

          {loading && <LoadingState rows={4} label="Loading agenda" />}
          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && dated.length === 0 && (
            <TimelineEmpty hasSelection={selectedCount > 0} anyRowsAtAll={rows.length > 0} />
          )}

          {dated.length > 0 && (
            <>
              {/* The single most useful fact on the page, stated plainly. */}
              {nextUp && (
                <div className="panel mb-4 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-l-[3px] border-l-accent-500 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="label-caps text-accent-700">Next deadline</p>
                      <p className="mt-1.5 font-display text-xl font-semibold leading-tight text-ink-900">
                        {nextUp.schoolName}
                      </p>
                      <p className="mt-0.5 text-2xs text-ink-500">
                        {nextUp.programName} &middot; {nextUp.roundName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-display text-2xl font-semibold leading-none text-ink-900">
                        {countdownLabel(nextUp.deadline).replace(' remaining', '')}
                      </p>
                      <p className="mt-1.5 text-2xs text-ink-500">
                        {formatDate(nextUp.deadline)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {clashes.length > 0 && (
                <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 dark:border-amber-500/40 dark:bg-amber-500/10">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path
                        d="M10 2.75 18 17.25H2L10 2.75Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                      <path d="M10 8v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="10" cy="14.25" r="0.9" fill="currentColor" />
                    </svg>
                    {clashes.length} date{clashes.length === 1 ? '' : 's'} with more than one
                    deadline
                  </h2>
                  <ul className="mt-2.5 space-y-1.5">
                    {clashes.map(([day, items]) => (
                      <li
                        key={day}
                        className="flex flex-wrap gap-x-2 text-2xs text-amber-800 dark:text-amber-300/90"
                      >
                        <span className="font-semibold">{formatDate(day)}</span>
                        <span>{items.map((i) => `${i.schoolName} (${i.roundName})`).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="space-y-4">
                {BUCKETS.map((bucket) => {
                  const items = grouped.get(bucket.id) ?? [];
                  if (items.length === 0) return null;

                  // Past rounds are hidden by default but never discarded.
                  if (bucket.id === 'overdue' && !showPast) {
                    return (
                      <button
                        key={bucket.id}
                        type="button"
                        onClick={() => setShowPast(true)}
                        className="w-full rounded-xl border border-dashed border-ink-200 px-4 py-3 text-2xs font-medium text-ink-500 transition-colors hover:border-ink-300 hover:bg-ink-50/60 hover:text-ink-700"
                      >
                        Show {items.length} closed deadline{items.length === 1 ? '' : 's'}
                      </button>
                    );
                  }

                  return (
                    <section key={bucket.id} className="panel overflow-hidden">
                      <div className="panel-head">
                        <div className="flex items-center gap-2.5">
                          <span className={'h-2 w-2 rounded-full ' + accentFor(bucket.id)} />
                          <h2 className="text-sm font-semibold text-ink-900">{bucket.label}</h2>
                          <span className="text-2xs text-ink-400">{bucket.hint}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="pill-neutral tabular">{items.length}</span>
                          {bucket.id === 'overdue' && (
                            <button
                              type="button"
                              onClick={() => setShowPast(false)}
                              className="text-2xs font-medium text-accent-700 hover:underline"
                            >
                              Hide
                            </button>
                          )}
                        </div>
                      </div>

                      <ul className="divide-y divide-ink-100">
                        {items.map((r) => (
                          <li
                            key={r.roundId}
                            className={
                              'flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 ' +
                              (bucket.id === 'overdue' ? 'opacity-60' : '')
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink-900">
                                {r.schoolSlug.startsWith('demo-') ? (
                                  r.schoolName
                                ) : (
                                  <Link
                                    to={`/schools/${r.schoolSlug}`}
                                    className="hover:underline"
                                  >
                                    {r.schoolName}
                                  </Link>
                                )}
                              </p>
                              <p className="truncate text-2xs text-ink-500">
                                {r.programName} &middot; {r.roundName}
                                {r.decisionDate && (
                                  <> &middot; decision {formatDate(r.decisionDate)}</>
                                )}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="whitespace-nowrap text-sm text-ink-900">
                                {formatDate(r.deadline)}
                              </p>
                              <p className="whitespace-nowrap text-2xs text-ink-500">
                                {countdownLabel(r.deadline)}
                              </p>
                            </div>

                            <VerificationBadge state={verificationState(r)} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          <UnannouncedList rows={undated} />
        </div>
      </div>
    </div>
  );
}

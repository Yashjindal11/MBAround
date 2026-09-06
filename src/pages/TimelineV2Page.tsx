import { useMemo, useState } from 'react';
import {
  countdownLabel,
  daysUntil,
  parseDate,
  verificationState,
} from '../lib/dates';
import { ErrorState, LoadingState } from '../components/States';
import { VerificationBadge } from '../components/VerificationBadge';
import { ScopeRail, useSchoolScope } from '../components/SchoolScope';
import {
  DemoBanner,
  TimelineEmpty,
  TimelineViewSwitcher,
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
    { name: 'Calendar view', path: '/timeline/v2' },
  ]),
];

/**
 * Timeline v2 — a month calendar.
 *
 * The original track view scales one axis to the whole span, which answers
 * "how far apart are these?" but not "how bad is my October?". Two deadlines a
 * day apart are two dots a pixel apart; a month with six deadlines looks much
 * like a month with one. Applicants plan in months, so this view gives every
 * month equal space and lets density become visible as height.
 *
 * Months are derived from the data, never from a fixed calendar year, and a
 * month with no deadlines is still rendered so gaps stay legible.
 */
export default function TimelineV2Page() {
  const [deselected, setDeselected] = useState<string[]>([]);
  const { schools, rows, loading, error, reload, isDemo } = useTimelineData();

  const scope = useSchoolScope(schools, rows);
  useSeo({
    title: 'MBA Deadline Calendar — Month by Month',
    description:
      'MBA application deadlines arranged as a month-by-month calendar, so crowded months and quiet ones are obvious before you commit to a plan.',
    path: '/timeline/v2',
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

  /**
   * Every month between the first and last deadline, including empty ones.
   *
   * Skipping empty months would compress a three-month gap into a thin border
   * and misrepresent the shape of the cycle — the specific thing this view is
   * meant to show.
   */
  const months = useMemo(() => {
    if (dated.length === 0) return [];

    const first = parseDate(dated[0].deadline)!;
    const last = parseDate(dated[dated.length - 1].deadline)!;

    const buckets = new Map<string, DeadlineRow[]>();
    for (const r of dated) {
      const d = parseDate(r.deadline)!;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, [...(buckets.get(key) ?? []), r]);
    }

    const out: { key: string; label: string; rows: DeadlineRow[] }[] = [];
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1, 12));
    const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1, 12));

    while (cursor.getTime() <= end.getTime()) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      out.push({
        key,
        label: cursor.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        rows: buckets.get(key) ?? [],
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }, [dated]);

  /** Busiest month, used to scale the density bar relative to reality. */
  const busiest = useMemo(
    () => months.reduce((max, m) => Math.max(max, m.rows.length), 0),
    [months],
  );

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }, []);

  const rail = (
    <div className="space-y-3">
      {scope.controls}
      <div className="border-t border-ink-100 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="label-caps">Schools</h3>
          <span className="text-2xs text-ink-500">
            {selectedCount} of {railSchools.length}
          </span>
        </div>
        <div className="mt-2 flex gap-3 border-b border-ink-100 pb-3">
          <button
            type="button"
            onClick={selectAll}
            disabled={selectedCount === railSchools.length}
            className="text-2xs font-medium text-accent-700 hover:underline disabled:cursor-default disabled:text-ink-300 disabled:no-underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={selectNone}
            disabled={selectedCount === 0}
            className="text-2xs font-medium text-accent-700 hover:underline disabled:cursor-default disabled:text-ink-300 disabled:no-underline"
          >
            Clear
          </button>
        </div>
        <div className="mt-2 max-h-[22rem] space-y-0.5 overflow-y-auto pr-1">
          {railSchools.length === 0 ? (
            <p className="py-2 text-2xs text-ink-500">No schools match these filters.</p>
          ) : (
            railSchools.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
              >
                <input
                  type="checkbox"
                  checked={isSelected(s.slug)}
                  onChange={() => toggle(s.slug)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
                />
                <span className="truncate" title={s.name}>
                  {s.shortName ?? s.name}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="label-caps">Plan ahead</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Deadline calendar
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Every month gets equal space, so a crowded month looks crowded. Months
          with nothing due are still shown &mdash; the quiet stretches are part of
          the plan too.
        </p>
      </header>

      <div className="mt-6">
        <TimelineViewSwitcher current="/timeline/v2" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ScopeRail activeCount={scope.activeCount} onClear={scope.clearAll}>
          {rail}
        </ScopeRail>

        <div className="min-w-0">
          {isDemo && <DemoBanner />}

          {loading && <LoadingState rows={3} label="Loading calendar" />}
          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && months.length === 0 && (
            <TimelineEmpty
              hasSelection={selectedCount > 0}
              anyRowsAtAll={rows.length > 0}
            />
          )}

          {months.length > 0 && (
            <div className="space-y-3">
              {months.map((month) => {
                const isCurrent = month.key === currentMonthKey;
                const density = busiest > 0 ? (month.rows.length / busiest) * 100 : 0;

                return (
                  <section
                    key={month.key}
                    className={
                      'surface overflow-hidden ' +
                      (isCurrent ? 'ring-1 ring-accent-400' : '')
                    }
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
                      <div className="flex items-baseline gap-2.5">
                        <h2 className="text-sm font-semibold text-ink-900">{month.label}</h2>
                        {isCurrent && (
                          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-2xs font-medium text-accent-800">
                            This month
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-ink-500">
                        {month.rows.length === 0
                          ? 'Nothing due'
                          : `${month.rows.length} deadline${month.rows.length === 1 ? '' : 's'}`}
                      </span>
                    </div>

                    {/* Density bar: month load at a glance, before reading rows. */}
                    {month.rows.length > 0 && (
                      <div className="h-1 w-full bg-ink-100">
                        <div
                          className="h-full bg-accent-400"
                          style={{ width: `${density}%` }}
                        />
                      </div>
                    )}

                    {month.rows.length === 0 ? (
                      <p className="px-5 py-4 text-2xs text-ink-400">
                        No announced deadlines this month.
                      </p>
                    ) : (
                      <ul className="divide-y divide-ink-100">
                        {month.rows.map((r) => {
                          const days = daysUntil(r.deadline) ?? 0;
                          const past = days < 0;
                          return (
                            <li
                              key={r.roundId}
                              className={
                                'flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 ' +
                                (past ? 'opacity-60' : '')
                              }
                            >
                              {/* Day-of-month anchor, so scanning is spatial. */}
                              <div className="w-10 shrink-0 text-center">
                                <div className="font-display text-lg font-semibold leading-none text-ink-900">
                                  {parseDate(r.deadline)!.getUTCDate()}
                                </div>
                                <div className="mt-0.5 text-3xs uppercase tracking-wide text-ink-400">
                                  {parseDate(r.deadline)!.toLocaleDateString('en-GB', {
                                    weekday: 'short',
                                    timeZone: 'UTC',
                                  })}
                                </div>
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink-900">
                                  {r.schoolName}
                                </p>
                                <p className="truncate text-2xs text-ink-500">
                                  {r.programName} &middot; {r.roundName}
                                </p>
                              </div>

                              <div className="flex items-center gap-3">
                                <span
                                  className={
                                    'whitespace-nowrap text-2xs ' +
                                    (past ? 'text-ink-400' : 'text-ink-600')
                                  }
                                >
                                  {countdownLabel(r.deadline)}
                                </span>
                                <VerificationBadge state={verificationState(r)} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <UnannouncedList rows={undated} />
        </div>
      </div>
    </div>
  );
}

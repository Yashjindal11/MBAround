import { useMemo, useState } from 'react';
import {
  countdownLabel,
  daysUntil,
  formatDateShort,
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
} from '../components/TimelineChrome';
import { useTimelineData } from '../components/useTimelineData';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';
import type { DeadlineRow } from '../lib/types';

const TIMELINE_JSONLD = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Timeline', path: '/timeline' },
  ]),
];

/**
 * Timeline built from whatever rounds exist - any number, any names.
 *
 * School selection lives in a left-hand rail (matching the deadlines page) and
 * every school is selected by default. Selection is therefore tracked as the
 * set of *deselected* slugs: schools load asynchronously, and a school added
 * in the admin panel should appear without anyone having to opt into it.
 */
export default function TimelinePage() {
  const [deselected, setDeselected] = useState<string[]>([]);

  const { schools, rows, loading, error, reload, isDemo } = useTimelineData();

  /** Region / country / programme facets, shared with the compare page. */
  const scope = useSchoolScope(schools, rows);

  const isSelected = (slug: string) => !deselected.includes(slug);

  useSeo({
    title: 'MBA Application Timeline & Deadline Calendar',
    description:
      'See MBA application deadlines laid out month by month across schools, so overlapping rounds and crowded weeks are visible before you commit to a plan.',
    path: '/timeline',
    jsonLd: TIMELINE_JSONLD,
  });

  const toggle = (slug: string) =>
    setDeselected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  /**
   * Only schools surviving the facets are eligible, and within those every
   * school is on unless explicitly unticked.
   */
  const railSchools = scope.schools;
  const selectedCount = railSchools.filter((s) => isSelected(s.slug)).length;

  const selectAll = () =>
    setDeselected((prev) => prev.filter((slug) => !railSchools.some((s) => s.slug === slug)));
  const selectNone = () =>
    setDeselected((prev) => [
      ...new Set([...prev, ...railSchools.map((s) => s.slug)]),
    ]);

  const selectedIds = useMemo(
    () =>
      new Set(
        railSchools.filter((s) => !deselected.includes(s.slug)).map((s) => s.id),
      ),
    [railSchools, deselected],
  );

  const inScope = useMemo(
    () => rows.filter((r) => selectedIds.has(r.schoolId)),
    [rows, selectedIds],
  );

  /** Rounds with a real date drive the chart. */
  const dated = useMemo(
    () =>
      inScope
        .filter((r) => r.deadline)
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [inScope],
  );

  /**
   * Rounds the school has not announced yet are surfaced explicitly rather
   * than dropped, so a gap in the data never reads as "no deadline".
   */
  const undated = useMemo(() => inScope.filter((r) => !r.deadline), [inScope]);

  /** Scale the track to the actual span of the selected deadlines. */
  const bounds = useMemo(() => {
    if (dated.length === 0) return null;
    const times = dated.map((r) => parseDate(r.deadline)!.getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const pad = Math.max((max - min) * 0.06, 5 * 86_400_000);
    return { min: min - pad, max: max + pad };
  }, [dated]);

  const pct = (iso: string) => {
    if (!bounds) return 0;
    const t = parseDate(iso)!.getTime();
    return ((t - bounds.min) / (bounds.max - bounds.min)) * 100;
  };

  /** Month gridlines derived from the visible span - never a fixed calendar. */
  const months = useMemo(() => {
    if (!bounds) return [];
    const out: { label: string; left: number }[] = [];
    const cursor = new Date(bounds.min);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor.getTime() <= bounds.max) {
      const t = cursor.getTime();
      if (t >= bounds.min) {
        out.push({
          label: cursor.toLocaleDateString('en-GB', {
            month: 'short',
            year: '2-digit',
            timeZone: 'UTC',
          }),
          left: ((t - bounds.min) / (bounds.max - bounds.min)) * 100,
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }, [bounds]);

  /** Position of "today", only when it falls inside the visible span. */
  const todayLeft = useMemo(() => {
    if (!bounds) return null;
    const now = Date.now();
    if (now < bounds.min || now > bounds.max) return null;
    return ((now - bounds.min) / (bounds.max - bounds.min)) * 100;
  }, [bounds]);

  /** Group by programme, preserving chronological order within each group. */
  const grouped = useMemo(() => {
    const map = new Map<string, DeadlineRow[]>();
    for (const r of dated) {
      const key = r.schoolName + ' - ' + r.programName;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [dated]);

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
            <p className="py-2 text-2xs text-ink-500">
              No schools match these filters.
            </p>
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
          Timeline
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Every announced round, laid out in time. Narrow the list on the left to
          focus on the schools you care about. Rounds a school hasn&rsquo;t
          announced yet are listed separately rather than guessed at.
        </p>
      </header>

      <div className="mt-6">
        <TimelineViewSwitcher current="/timeline" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ScopeRail activeCount={scope.activeCount} onClear={scope.clearAll}>
          {rail}
        </ScopeRail>

        <div className="min-w-0">
          {isDemo && <DemoBanner />}

          {loading && <LoadingState rows={3} label="Loading timeline" />}
          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && grouped.length === 0 && (
            <TimelineEmpty
              hasSelection={selectedCount > 0}
              anyRowsAtAll={rows.length > 0}
            />
          )}

          {grouped.length > 0 && (
            <>
              {/* Desktop: proportional horizontal track */}
              <div className="surface hidden overflow-hidden lg:block">
                <div className="border-b border-ink-100 px-6 pb-2 pt-4">
                  <div className="relative h-4">
                    {months.map((m) => (
                      <span
                        key={m.label}
                        className="absolute -translate-x-1/2 whitespace-nowrap text-2xs text-ink-400"
                        style={{ left: m.left + '%' }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative px-6">
                  {/* Month gridlines + today marker span the whole chart. */}
                  <div className="pointer-events-none absolute inset-0 px-6">
                    <div className="relative h-full">
                      {months.map((m) => (
                        <span
                          key={m.label}
                          className="absolute inset-y-0 w-px bg-ink-100"
                          style={{ left: m.left + '%' }}
                        />
                      ))}
                      {todayLeft !== null && (
                        <span
                          className="absolute inset-y-0 w-px bg-accent-400/70"
                          style={{ left: todayLeft + '%' }}
                        />
                      )}
                    </div>
                  </div>

                  {grouped.map(([label, items]) => (
                    <div
                      key={label}
                      className="relative border-t border-ink-100 py-6 first:border-t-0"
                    >
                      <p className="mb-4 text-sm font-semibold text-ink-900">{label}</p>
                      <div className="relative h-16">
                        <div className="absolute inset-x-0 top-6 h-px bg-ink-200" />
                        {items.map((r) => {
                          const past = (daysUntil(r.deadline) ?? 0) < 0;
                          return (
                            <div
                              key={r.roundId}
                              className="group absolute top-0 -translate-x-1/2"
                              style={{ left: pct(r.deadline!) + '%' }}
                            >
                              <div className="relative flex flex-col items-center">
                                <span
                                  className={
                                    'whitespace-nowrap text-2xs font-medium ' +
                                    (past ? 'text-ink-400' : 'text-ink-700')
                                  }
                                >
                                  {r.roundName}
                                </span>
                                <span
                                  className={
                                    'mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white transition-transform group-hover:scale-125 ' +
                                    (past ? 'bg-ink-300' : 'bg-accent-500')
                                  }
                                />
                                <span
                                  className={
                                    'mt-1.5 whitespace-nowrap text-2xs ' +
                                    (past ? 'text-ink-400' : 'text-ink-500')
                                  }
                                >
                                  {formatDateShort(r.deadline)}
                                </span>
                                <span className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-2xs text-white group-hover:block">
                                  {countdownLabel(r.deadline)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: vertical timeline */}
              <div className="lg:hidden">
                {grouped.map(([label, items]) => (
                  <div key={label} className="surface mb-4 p-5">
                    <p className="mb-4 text-sm font-semibold text-ink-900">{label}</p>
                    <ol className="relative border-l border-ink-200 pl-5">
                      {items.map((r) => (
                        <li key={r.roundId} className="relative pb-5 last:pb-0">
                          <span
                            className={
                              'absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ' +
                              ((daysUntil(r.deadline) ?? 0) < 0
                                ? 'bg-ink-300'
                                : 'bg-accent-500')
                            }
                          />
                          <p className="text-sm font-medium text-ink-900">{r.roundName}</p>
                          <p className="text-sm text-ink-700">{formatDateShort(r.deadline)}</p>
                          <p className="text-2xs text-ink-500">{countdownLabel(r.deadline)}</p>
                          <div className="mt-1.5">
                            <VerificationBadge state={verificationState(r)} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </>
          )}

          {undated.length > 0 && (
            <section className="surface mt-6 p-5">
              <h2 className="text-sm font-semibold text-ink-900">Not yet announced</h2>
              <p className="mt-1 text-2xs text-ink-500">
                These rounds exist but the school hasn&rsquo;t published a date, so
                they aren&rsquo;t placed on the timeline.
              </p>
              <ul className="mt-3 divide-y divide-ink-100">
                {undated.map((r) => (
                  <li
                    key={r.roundId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <span className="text-sm text-ink-700">
                      {r.schoolName} - {r.programName} - {r.roundName}
                    </span>
                    <VerificationBadge state={verificationState(r)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

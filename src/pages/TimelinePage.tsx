import { useMemo, useState } from 'react';
import { useAsync } from '../lib/useAsync';
import { getDeadlines, getSchools } from '../lib/queries/public';
import {
  countdownLabel,
  daysUntil,
  formatDateShort,
  parseDate,
  verificationState,
} from '../lib/dates';
import { EmptyState,         ErrorState, LoadingState } from '../components/States';
import { VerificationBadge } from '../components/VerificationBadge';
import { SearchInput } from '../components/Filters';
import type { DeadlineRow, School } from '../lib/types';

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
  const [query, setQuery] = useState('');

  const {
    data: schools,
    loading: schoolsLoading,
    error: schoolsError,
    reload: reloadSchools,
  } = useAsync(() => getSchools(), []);
  const {
    data: rows,
    loading: rowsLoading,
    error: rowsError,
  } = useAsync(() => getDeadlines({ includePast: true }), []);

  const allSchools = useMemo<School[]>(() => schools ?? [], [schools]);

  const isSelected = (slug: string) => !deselected.includes(slug);

  const toggle = (slug: string) =>
    setDeselected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const selectAll = () => setDeselected([]);
  const selectNone = () => setDeselected(allSchools.map((s) => s.slug));

  const selectedCount = allSchools.length - deselected.length;

  /** Schools shown in the rail, narrowed by the rail's own search box. */
  const railSchools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSchools;
    return allSchools.filter((s) =>
      [s.name, s.shortName, s.city, s.country]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [allSchools, query]);

  const selectedIds = useMemo(
    () =>
      new Set(
        allSchools.filter((s) => !deselected.includes(s.slug)).map((s) => s.id),
      ),
    [allSchools, deselected],
  );

  const inScope = useMemo(
    () => (rows ?? []).filter((r) => selectedIds.has(r.schoolId)),
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

  const loading = schoolsLoading || rowsLoading;
  const error = schoolsError ?? rowsError;

  const rail = (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Schools</h2>
        <span className="text-2xs text-ink-500">
          {selectedCount} of {allSchools.length}
        </span>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Find a school" />

      <div className="flex gap-3 border-b border-ink-100 pb-3">
        <button
          type="button"
          onClick={selectAll}
          disabled={deselected.length === 0}
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

      <div className="max-h-[26rem] space-y-0.5 overflow-y-auto pr-1">
        {railSchools.length === 0 ? (
          <p className="py-2 text-2xs text-ink-500">No schools match that search.</p>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <div className="surface sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
            {rail}
          </div>
        </aside>

        {/* Mobile: same controls, collapsed above the chart */}
        <details className="surface p-5 lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-ink-900">
            Schools ({selectedCount} of {allSchools.length})
          </summary>
          <div className="mt-4">{rail}</div>
        </details>

        <div className="min-w-0">
          {loading && <LoadingState rows={3} label="Loading timeline" />}
          {error && <ErrorState error={error} onRetry={reloadSchools} />}

          {!loading && !error && grouped.length === 0 && (
            <EmptyState
              title="Nothing to plot yet"
              description={
                selectedCount === 0
                  ? 'Select at least one school to see its rounds.'
                  : 'None of the selected schools have an announced deadline yet.'
              }
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

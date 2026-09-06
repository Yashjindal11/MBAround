import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { countdownLabel, daysUntil, formatDate, parseDate, verificationState } from '../lib/dates';
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
    { name: 'Calendar view', path: '/timeline/v2' },
  ]),
];

/** Monday-first, matching the academic calendars this product describes. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface MonthCell {
  /** ISO date, or null for a leading pad cell before the 1st. */
  iso: string | null;
  day: number | null;
  rows: DeadlineRow[];
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

interface MonthBlock {
  key: string;
  label: string;
  rows: DeadlineRow[];
  cells: MonthCell[];
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Timeline v2 - the calendar. This is the primary timeline view.
 *
 * The track view scales one axis to the whole span, which answers "how far
 * apart are these?" but not "how bad is my October?" - two deadlines a day
 * apart are two dots a pixel apart, and a month with six deadlines occupies
 * the same width as a month with one. Applicants plan in months, so this view
 * gives every month equal space and lets workload show up as density.
 *
 * Months are derived from the data, never a fixed calendar year, and months
 * with nothing due are still rendered so quiet stretches stay legible.
 */
export default function TimelineV2Page() {
  const [deselected, setDeselected] = useState<string[]>([]);
  const [density, setDensity] = useState<'grid' | 'list'>('grid');
  const { schools, rows, loading, error, reload, isDemo } = useTimelineData();

  const scope = useSchoolScope(schools, rows);

  useSeo({
    title: 'MBA Deadline Calendar - Month by Month',
    description:
      'MBA application deadlines arranged as a month-by-month calendar, so crowded months and quiet ones are obvious before you commit to a plan.',
    path: '/timeline/v2',
    // Same data as /timeline in a different layout. Indexing all three would
    // split ranking signals between pages that compete with each other.
    // Remove this once one layout is chosen and becomes /timeline.
    noindex: true,
    jsonLd: JSONLD,
  });

  const railSchools = scope.schools;
  const selectedCount = railSchools.filter((s) => !deselected.includes(s.slug)).length;

  const toggle = (slug: string) =>
    setDeselected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
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

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /**
   * Every month between the first and last deadline, as a real day grid.
   *
   * Empty months are kept: skipping them would compress a three-month gap into
   * a thin border and misrepresent the shape of the cycle, which is precisely
   * what this view exists to show.
   */
  const months = useMemo<MonthBlock[]>(() => {
    if (dated.length === 0) return [];

    const byDay = new Map<string, DeadlineRow[]>();
    for (const r of dated) byDay.set(r.deadline!, [...(byDay.get(r.deadline!) ?? []), r]);

    const first = parseDate(dated[0].deadline)!;
    const last = parseDate(dated[dated.length - 1].deadline)!;

    const out: MonthBlock[] = [];
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1, 12));
    const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1, 12));

    while (cursor.getTime() <= end.getTime()) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const key = monthKey(cursor);

      const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
      // getUTCDay is Sunday-0; shift so Monday is column 0.
      const lead = (new Date(Date.UTC(year, month, 1, 12)).getUTCDay() + 6) % 7;

      const cells: MonthCell[] = [];
      for (let i = 0; i < lead; i += 1) {
        cells.push({
          iso: null,
          day: null,
          rows: [],
          isToday: false,
          isPast: false,
          isWeekend: false,
        });
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const weekday = (new Date(Date.UTC(year, month, day, 12)).getUTCDay() + 6) % 7;
        cells.push({
          iso,
          day,
          rows: byDay.get(iso) ?? [],
          isToday: iso === todayIso,
          isPast: iso < todayIso,
          isWeekend: weekday >= 5,
        });
      }

      out.push({
        key,
        label: cursor.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        rows: dated.filter((r) => r.deadline!.startsWith(key)),
        cells,
      });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return out;
  }, [dated, todayIso]);

  const busiest = useMemo(
    () => months.reduce((max, m) => Math.max(max, m.rows.length), 0),
    [months],
  );

  const nextUp = useMemo(
    () => dated.find((r) => (daysUntil(r.deadline) ?? -1) >= 0) ?? null,
    [dated],
  );

  const upcomingCount = useMemo(
    () => dated.filter((r) => (daysUntil(r.deadline) ?? -1) >= 0).length,
    [dated],
  );

  const currentKey = monthKey(new Date());

  const stats = useMemo(
    () => [
      { label: 'Schools', value: String(selectedCount) },
      { label: 'Upcoming', value: String(upcomingCount) },
      {
        label: 'Next deadline',
        value: nextUp ? countdownLabel(nextUp.deadline).replace(' remaining', '') : '—',
      },
    ],
    [selectedCount, upcomingCount, nextUp],
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
        title="Deadline calendar"
        intro="Every month gets equal space, so a crowded month looks crowded. Months with nothing due are still shown - the quiet stretches are part of the plan too."
        current="/timeline/v2"
        stats={dated.length > 0 ? stats : undefined}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_1fr]">
        <ScopeRail activeCount={scope.activeCount} onClear={scope.clearAll}>
          {rail}
        </ScopeRail>

        <div className="min-w-0">
          {isDemo && <DemoBanner />}

          {loading && <LoadingState rows={3} label="Loading calendar" />}
          {error && <ErrorState error={error} onRetry={reload} />}

          {!loading && !error && months.length === 0 && (
            <TimelineEmpty hasSelection={selectedCount > 0} anyRowsAtAll={rows.length > 0} />
          )}

          {months.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-2xs text-ink-500">
                  {months.length} month{months.length === 1 ? '' : 's'} &middot; {dated.length}{' '}
                  deadline{dated.length === 1 ? '' : 's'}
                </p>
                {/* The grid is spatial; the list is scannable and reads better
                    with a screen reader. Neither suits everyone, so both are
                    one click apart. */}
                <div className="segmented">
                  <button
                    type="button"
                    onClick={() => setDensity('grid')}
                    aria-pressed={density === 'grid'}
                    className={
                      'segmented-item ' + (density === 'grid' ? 'segmented-item-active' : '')
                    }
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensity('list')}
                    aria-pressed={density === 'list'}
                    className={
                      'segmented-item ' + (density === 'list' ? 'segmented-item-active' : '')
                    }
                  >
                    List
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {months.map((month) => {
                  const isCurrent = month.key === currentKey;
                  const load = busiest > 0 ? (month.rows.length / busiest) * 100 : 0;

                  return (
                    <section
                      key={month.key}
                      className={
                        'panel overflow-hidden ' + (isCurrent ? 'ring-1 ring-accent-400/70' : '')
                      }
                    >
                      <div className="panel-head">
                        <div className="flex items-baseline gap-2.5">
                          <h2 className="font-display text-base font-semibold text-ink-900">
                            {month.label}
                          </h2>
                          {isCurrent && <span className="pill-accent">This month</span>}
                        </div>
                        {month.rows.length === 0 ? (
                          <span className="shrink-0 text-2xs text-ink-400">Nothing due</span>
                        ) : (
                          <span className="pill-neutral tabular shrink-0">
                            {month.rows.length} due
                          </span>
                        )}
                      </div>

                      {/* Load bar, scaled against the busiest month in view. */}
                      <div className="h-0.5 w-full bg-ink-100">
                        <div
                          className="h-full bg-accent-400 transition-[width] duration-500"
                          style={{ width: `${load}%` }}
                        />
                      </div>

                      {month.rows.length === 0 ? (
                        <p className="px-5 py-6 text-center text-2xs text-ink-400">
                          No announced deadlines this month.
                        </p>
                      ) : density === 'grid' ? (
                        <MonthGrid month={month} />
                      ) : (
                        <MonthList month={month} />
                      )}
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

/** True day grid: position within the month carries meaning. */
function MonthGrid({ month }: { month: MonthBlock }) {
  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-3xs font-medium uppercase tracking-wide text-ink-400"
          >
            {d}
          </div>
        ))}

        {month.cells.map((cell, i) => {
          if (!cell.iso) return <div key={`pad-${i}`} />;

          const count = cell.rows.length;
          const has = count > 0;

          return (
            <div
              key={cell.iso}
              className={
                'group relative min-h-[3.9rem] rounded-lg border p-1.5 transition-colors ' +
                (has
                  ? 'border-accent-200 bg-accent-50/60 hover:border-accent-300'
                  : cell.isWeekend
                    ? 'border-transparent bg-ink-50/40'
                    : 'border-transparent') +
                (cell.isToday ? ' ring-1 ring-accent-500' : '') +
                (cell.isPast && !has ? ' opacity-50' : '')
              }
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    'tabular text-2xs ' +
                    (cell.isToday
                      ? 'font-semibold text-accent-700'
                      : has
                        ? 'font-medium text-ink-800'
                        : 'text-ink-400')
                  }
                >
                  {cell.day}
                </span>
                {count > 1 && (
                  <span className="tabular rounded-full bg-accent-600 px-1.5 text-3xs font-semibold text-white">
                    {count}
                  </span>
                )}
              </div>

              <div className="mt-1 space-y-0.5">
                {cell.rows.slice(0, 2).map((r) => (
                  <p
                    key={r.roundId}
                    title={`${r.schoolName} - ${r.programName} - ${r.roundName}`}
                    className={
                      'truncate text-3xs leading-tight ' +
                      (cell.isPast ? 'text-ink-400' : 'text-ink-700')
                    }
                  >
                    {r.schoolName.split(' ')[0]}
                  </p>
                ))}
                {count > 2 && <p className="text-3xs text-ink-500">+{count - 2} more</p>}
              </div>

              {/* Full detail on hover: a grid cell is far too small to carry
                  school, programme and round names legibly. */}
              {has && (
                <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-56 -translate-x-1/2 translate-y-1 rounded-lg bg-ink-900 p-2.5 text-left shadow-lift group-hover:block">
                  <p className="text-3xs font-medium text-white/60">{formatDate(cell.iso)}</p>
                  {cell.rows.map((r) => (
                    <p key={r.roundId} className="mt-1 text-2xs leading-snug text-white">
                      {r.schoolName}
                      <span className="text-white/60"> - {r.roundName}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The same month as rows: better for detail, and for screen readers. */
function MonthList({ month }: { month: MonthBlock }) {
  return (
    <ul className="divide-y divide-ink-100">
      {month.rows.map((r) => {
        const past = (daysUntil(r.deadline) ?? 0) < 0;
        const date = parseDate(r.deadline)!;
        return (
          <li
            key={r.roundId}
            className={
              'flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-ink-50/60 ' +
              (past ? 'opacity-60' : '')
            }
          >
            <div className="w-11 shrink-0 text-center">
              <div className="tabular font-display text-xl font-semibold leading-none text-ink-900">
                {date.getUTCDate()}
              </div>
              <div className="mt-0.5 text-3xs uppercase tracking-wide text-ink-400">
                {date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {r.schoolSlug.startsWith('demo-') ? (
                  r.schoolName
                ) : (
                  <Link to={`/schools/${r.schoolSlug}`} className="hover:underline">
                    {r.schoolName}
                  </Link>
                )}
              </p>
              <p className="truncate text-2xs text-ink-500">
                {r.programName} &middot; {r.roundName}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={'whitespace-nowrap text-2xs ' + (past ? 'text-ink-400' : 'text-ink-600')}
              >
                {countdownLabel(r.deadline)}
              </span>
              <VerificationBadge state={verificationState(r)} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

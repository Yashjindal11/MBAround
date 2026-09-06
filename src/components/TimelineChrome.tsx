import { Link, useLocation } from 'react-router-dom';

/**
 * Chrome shared by the three timeline layouts.
 *
 * The layouts are alternative presentations of identical data, so anything
 * that is not presentation lives here: the demo warning, the switcher, and the
 * empty state that explains an empty database rather than implying the user
 * filtered everything away.
 */

/**
 * The three layouts, in switcher order.
 *
 * Calendar leads because it is the primary view: applicants plan in months,
 * and it is the only layout where workload density is legible at a glance.
 */
export const TIMELINE_VIEWS = [
  { path: '/timeline/v2', label: 'Calendar', hint: 'Month by month' },
  { path: '/timeline/v3', label: 'Agenda', hint: 'By urgency' },
  { path: '/timeline', label: 'Track', hint: 'Proportional axis' },
] as const;

/**
 * Loud, unmissable, and never conditional on anything but demo mode.
 *
 * Sample data that looks like real data is the failure this project is built
 * to avoid, so the warning is not a subtle footnote.
 */
export function DemoBanner() {
  const { pathname } = useLocation();
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <svg
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="M10 2.75 18 17.25H2L10 2.75Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M10 8v3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="10" cy="14.25" r="0.9" fill="currentColor" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Sample data &mdash; not real deadlines
        </p>
        <p className="mt-1 text-2xs leading-relaxed text-amber-800 dark:text-amber-300/90">
          These schools are invented and these dates are generated for previewing
          the layout. Nothing here is stored in the database or reflects any real
          programme.
        </p>
      </div>
      <Link
        to={pathname}
        className="shrink-0 rounded-lg border border-amber-400/70 px-2.5 py-1.5 text-2xs font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/15"
      >
        Exit
      </Link>
    </div>
  );
}

/** Links to the same data in the other layouts, preserving demo mode. */
export function TimelineViewSwitcher({ current }: { current: string }) {
  const { search } = useLocation();
  return (
    <nav aria-label="Timeline layout" className="segmented">
      {TIMELINE_VIEWS.map((view) => {
        const active = view.path === current;
        return (
          <Link
            key={view.path}
            to={{ pathname: view.path, search }}
            aria-current={active ? 'page' : undefined}
            title={view.hint}
            className={
              'segmented-item ' + (active ? 'segmented-item-active' : '')
            }
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Shared masthead. Keeping it here means the three layouts cannot drift into
 * different heading hierarchies, which would matter for both SEO and
 * screen-reader navigation.
 */
export function TimelineHeader({
  eyebrow,
  title,
  intro,
  current,
  stats,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  current: string;
  stats?: { label: string; value: string }[];
}) {
  return (
    <header className="border-b border-ink-100 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="max-w-xl">
          <p className="label-caps text-accent-700">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-600">{intro}</p>
        </div>
        <TimelineViewSwitcher current={current} />
      </div>

      {stats && stats.length > 0 && (
        <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="label-caps">{s.label}</dt>
              <dd className="tabular mt-1 font-display text-2xl font-semibold text-ink-900">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

/**
 * Distinguishes "you filtered everything out" from "the database has no
 * rounds yet", because the second is not the user's fault and the remedy is
 * completely different.
 */
export function TimelineEmpty({
  hasSelection,
  anyRowsAtAll,
}: {
  hasSelection: boolean;
  anyRowsAtAll: boolean;
}) {
  const { pathname } = useLocation();

  if (!anyRowsAtAll) {
    return (
      <div className="panel px-8 py-14 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink-100">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect
              x="2.75"
              y="4.25"
              width="14.5"
              height="13"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.4"
              className="text-ink-400"
            />
            <path
              d="M2.75 8.25h14.5M6.75 2.75v3M13.25 2.75v3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              className="text-ink-400"
            />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold text-ink-900">
          No deadlines recorded yet
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
          No application rounds have been published to the database, so there is
          nothing to plot. This is a gap in the data, not a filter you have
          applied.
        </p>
        <Link
          to={{ pathname, search: '?demo=1' }}
          className="btn-secondary mt-5 !py-2 text-2xs"
        >
          Preview this layout with sample data
        </Link>
      </div>
    );
  }

  return (
    <div className="panel px-8 py-14 text-center">
      <h2 className="font-display text-lg font-semibold text-ink-900">Nothing to plot</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
        {hasSelection
          ? 'None of the selected schools have an announced deadline yet.'
          : 'Select at least one school to see its rounds.'}
      </p>
    </div>
  );
}

/**
 * Rounds that exist without a date, listed rather than dropped.
 *
 * Every layout shows this. Omitting an unannounced round would make an absent
 * date read as "no deadline", which is precisely the wrong inference.
 */
export function UnannouncedList({
  rows,
}: {
  rows: { roundId: string; schoolName: string; programName: string; roundName: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="panel mt-6 overflow-hidden">
      <div className="panel-head">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Not yet announced</h2>
          <p className="mt-0.5 text-2xs text-ink-500">
            These rounds exist but have no published date, so they aren&rsquo;t plotted.
          </p>
        </div>
        <span className="pill-neutral tabular shrink-0">{rows.length}</span>
      </div>
      <ul className="divide-y divide-ink-100">
        {rows.map((r) => (
          <li
            key={r.roundId}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
          >
            <span className="text-sm text-ink-800">{r.schoolName}</span>
            <span className="text-2xs text-ink-500">
              {r.programName} &middot; {r.roundName}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

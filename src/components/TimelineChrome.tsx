import { Link, useLocation } from 'react-router-dom';

/**
 * Chrome shared by the three timeline layouts.
 *
 * The layouts are alternative presentations of identical data, so anything
 * that is not presentation lives here: the demo warning, the switcher, and the
 * empty state that explains an empty database rather than implying the user
 * filtered everything away.
 */

/** The three layouts, in the order they appear in the switcher. */
export const TIMELINE_VIEWS = [
  { path: '/timeline', label: 'Track', hint: 'Proportional time axis' },
  { path: '/timeline/v2', label: 'Calendar', hint: 'Month-by-month grid' },
  { path: '/timeline/v3', label: 'Agenda', hint: 'Chronological list' },
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
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10"
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Sample data — not real deadlines
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-amber-800 dark:text-amber-300/90">
        These schools are invented and these dates are generated for previewing
        the layout. Nothing here is stored in the database or reflects any real
        programme.{' '}
        <Link to={pathname} className="font-medium underline">
          Exit sample mode
        </Link>
      </p>
    </div>
  );
}

/** Links to the same data in the other two layouts, preserving demo mode. */
export function TimelineViewSwitcher({ current }: { current: string }) {
  const { search } = useLocation();
  return (
    <nav aria-label="Timeline layout" className="flex flex-wrap gap-1.5">
      {TIMELINE_VIEWS.map((view) => {
        const active = view.path === current;
        return (
          <Link
            key={view.path}
            to={{ pathname: view.path, search }}
            aria-current={active ? 'page' : undefined}
            title={view.hint}
            className={
              'rounded-full border px-3 py-1.5 text-2xs font-medium transition-colors ' +
              (active
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:text-ink-900')
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
      <div className="surface p-8 text-center">
        <h2 className="text-sm font-semibold text-ink-900">No deadlines recorded yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
          No application rounds have been published to the database, so there is
          nothing to plot. This is a gap in the data, not a filter you have
          applied.
        </p>
        <Link
          to={{ pathname, search: '?demo=1' }}
          className="mt-4 inline-block rounded-full border border-ink-200 px-4 py-2 text-2xs font-medium text-ink-700 hover:border-ink-300 hover:text-ink-900"
        >
          Preview this layout with sample data
        </Link>
      </div>
    );
  }

  return (
    <div className="surface p-8 text-center">
      <h2 className="text-sm font-semibold text-ink-900">Nothing to plot</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
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
export function UnannouncedList({ rows }: { rows: { roundId: string; schoolName: string; programName: string; roundName: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="surface mt-6 p-5">
      <h2 className="text-sm font-semibold text-ink-900">Not yet announced</h2>
      <p className="mt-1 text-2xs text-ink-500">
        These rounds exist but the school hasn&rsquo;t published a date, so they
        aren&rsquo;t placed on the timeline.
      </p>
      <ul className="mt-3 divide-y divide-ink-100">
        {rows.map((r) => (
          <li key={r.roundId} className="py-2.5 text-sm text-ink-700">
            {r.schoolName} — {r.programName} — {r.roundName}
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useMemo, useState } from 'react';
import type { School } from '../lib/types';

/**
 * School checklist for the filter rail.
 *
 * Extracted because four pages had near-identical copies of this markup, each
 * carrying the same bug: a `max-h` + `overflow-y-auto` on the list *inside*
 * the already-scrolling rail, producing two nested scrollbars.
 *
 * This renders at natural height and lets `ScopeRail` own the single scroll
 * container. The list is virtualisation-free on purpose - 46 schools is a
 * trivial amount of DOM, and virtualising would break in-page find.
 *
 * Selection is expressed as the set of *deselected* slugs so that a school
 * added in the admin panel is visible immediately without anyone opting in.
 */
export function SchoolPicker({
  schools,
  deselected,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  schools: School[];
  deselected: string[];
  onToggle: (slug: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const [query, setQuery] = useState('');

  const selectedCount = useMemo(
    () => schools.filter((s) => !deselected.includes(s.slug)).length,
    [schools, deselected],
  );

  /**
   * A local filter for the list only - it narrows what is *shown*, never what
   * is selected. Typing must not silently deselect a school the user already
   * chose, so this is kept separate from the facet search in `useSchoolScope`.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) =>
      [s.name, s.shortName, s.city, s.country]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [schools, query]);

  const allSelected = selectedCount === schools.length && schools.length > 0;

  return (
    <section className="border-t border-ink-100 pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="label-caps">Schools</h3>
        <span className="tabular text-2xs text-ink-500">
          {selectedCount}/{schools.length}
        </span>
      </div>

      {/* A progress hint: at 46 schools "42 of 46" is hard to feel. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-accent-400 transition-[width] duration-300"
          style={{ width: schools.length ? `${(selectedCount / schools.length) * 100}%` : '0%' }}
        />
      </div>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={allSelected}
          className="text-2xs font-medium text-accent-700 hover:underline disabled:cursor-default disabled:text-ink-300 disabled:no-underline"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={onSelectNone}
          disabled={selectedCount === 0}
          className="text-2xs font-medium text-accent-700 hover:underline disabled:cursor-default disabled:text-ink-300 disabled:no-underline"
        >
          Clear
        </button>
      </div>

      {/* Only offered when the list is long enough to be worth filtering. */}
      {schools.length > 10 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter this list"
          aria-label="Filter the school list"
          className="field mt-3 py-1.5 text-2xs"
        />
      )}

      <div className="mt-2 space-y-0.5">
        {visible.length === 0 ? (
          <p className="py-3 text-2xs text-ink-500">
            {schools.length === 0
              ? 'No schools match these filters.'
              : `No school matches “${query}”.`}
          </p>
        ) : (
          visible.map((s) => {
            const checked = !deselected.includes(s.slug);
            return (
              <label
                key={s.id}
                className={
                  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ' +
                  'transition-colors duration-100 hover:bg-ink-50 ' +
                  (checked ? 'text-ink-800' : 'text-ink-500')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(s.slug)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
                />
                <span className="truncate" title={s.name}>
                  {s.shortName ?? s.name}
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}

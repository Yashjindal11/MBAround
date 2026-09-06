import { useMemo, useState } from 'react';
import { FilterGroup, SearchInput } from './Filters';
import type { DeadlineRow, School } from '../lib/types';

/**
 * Shared school-scoping filters for the Compare and Timeline pages.
 *
 * Every option is derived from the schools and rounds actually loaded, so a
 * new country or round name appears the moment it exists in the database.
 * Nothing here is hardcoded.
 *
 * Options cascade: choosing a region narrows the countries on offer, and both
 * narrow the school list. This prevents dead-end combinations that would
 * return nothing.
 */
export interface SchoolScope {
  /** Schools passing the current facet + search filters. */
  schools: School[];
  /** Number of active facet selections, for the "clear all" affordance. */
  activeCount: number;
  clearAll: () => void;
  /** The facet controls, rendered by the page inside its own rail. */
  controls: React.ReactNode;
}

const uniq = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) =>
    a.localeCompare(b),
  );

export function useSchoolScope(
  allSchools: School[],
  rows: DeadlineRow[],
): SchoolScope {
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [programTypes, setProgramTypes] = useState<string[]>([]);
  const [cycleNames, setCycleNames] = useState<string[]>([]);
  const [roundNames, setRoundNames] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );

  /** Rounds grouped by school, so programme-level facets can filter schools. */
  const rowsBySchool = useMemo(() => {
    const map = new Map<string, DeadlineRow[]>();
    for (const r of rows) {
      map.set(r.schoolId, [...(map.get(r.schoolId) ?? []), r]);
    }
    return map;
  }, [rows]);

  /** Region is the top of the cascade, so its options are never narrowed. */
  const regionOptions = useMemo(
    () => uniq(allSchools.map((s) => s.region)),
    [allSchools],
  );

  /** Countries are limited to the chosen regions. */
  const countryOptions = useMemo(
    () =>
      uniq(
        allSchools
          .filter((s) => regions.length === 0 || regions.includes(s.region))
          .map((s) => s.country),
      ),
    [allSchools, regions],
  );

  /** Schools surviving the location facets, used to scope programme facets. */
  const locationScoped = useMemo(
    () =>
      allSchools.filter(
        (s) =>
          (regions.length === 0 || regions.includes(s.region)) &&
          (countries.length === 0 || countries.includes(s.country)),
      ),
    [allSchools, regions, countries],
  );

  const scopedRows = useMemo(() => {
    const ids = new Set(locationScoped.map((s) => s.id));
    return rows.filter((r) => ids.has(r.schoolId));
  }, [rows, locationScoped]);

  const programTypeOptions = useMemo(
    () => uniq(scopedRows.map((r) => r.programType)),
    [scopedRows],
  );
  const cycleOptions = useMemo(
    () => uniq(scopedRows.map((r) => r.cycleName)),
    [scopedRows],
  );
  const roundOptions = useMemo(
    () => uniq(scopedRows.map((r) => r.roundName)),
    [scopedRows],
  );

  /**
   * A school passes a programme-level facet if ANY of its rounds match. A
   * school with no rounds at all is only excluded once such a facet is used,
   * so an incomplete dataset never silently hides schools.
   */
  const schools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locationScoped.filter((s) => {
      const own = rowsBySchool.get(s.id) ?? [];

      if (programTypes.length && !own.some((r) => programTypes.includes(r.programType)))
        return false;
      if (cycleNames.length && !own.some((r) => cycleNames.includes(r.cycleName)))
        return false;
      if (roundNames.length && !own.some((r) => roundNames.includes(r.roundName)))
        return false;

      if (q) {
        const haystack = [s.name, s.shortName, s.city, s.country, s.region]
          .filter((v): v is string => Boolean(v))
          .map((v) => v.toLowerCase());
        if (!haystack.some((v) => v.includes(q))) return false;
      }
      return true;
    });
  }, [
    locationScoped,
    rowsBySchool,
    programTypes,
    cycleNames,
    roundNames,
    query,
  ]);

  const activeCount =
    regions.length +
    countries.length +
    programTypes.length +
    cycleNames.length +
    roundNames.length +
    (query.trim() ? 1 : 0);

  const clearAll = () => {
    setRegions([]);
    setCountries([]);
    setProgramTypes([]);
    setCycleNames([]);
    setRoundNames([]);
    setQuery('');
  };

  const controls = (
    <>
      <div className="pb-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a school" />
      </div>
      <FilterGroup
        label="Region"
        options={regionOptions}
        selected={regions}
        onToggle={toggle(setRegions)}
      />
      <FilterGroup
        label="Country"
        options={countryOptions}
        selected={countries}
        onToggle={toggle(setCountries)}
      />
      <FilterGroup
        label="Programme type"
        options={programTypeOptions}
        selected={programTypes}
        onToggle={toggle(setProgramTypes)}
      />
      <FilterGroup
        label="Application cycle"
        options={cycleOptions}
        selected={cycleNames}
        onToggle={toggle(setCycleNames)}
      />
      <FilterGroup
        label="Round"
        options={roundOptions}
        selected={roundNames}
        onToggle={toggle(setRoundNames)}
      />
    </>
  );

  return { schools, activeCount, clearAll, controls };
}

/**
 * Sticky sidebar wrapper shared by Compare and Timeline.
 *
 * The rail itself is the ONLY scroll container. It previously capped its own
 * height *and* contained a school list with its own `max-h`, so on a long list
 * two scrollbars sat side by side - one nested inside the other, each
 * scrolling a different amount of the same column. Callers must therefore
 * render their lists at natural height and let the rail do the scrolling.
 */
export function ScopeRail({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <aside className="hidden lg:block">
        <div className="panel sticky top-24 flex max-h-[calc(100vh-7.5rem)] flex-col overflow-hidden">
          {/* Header is outside the scroll area so "Clear all" never scrolls
              away while the user is deep in a long list of schools. */}
          <div className="panel-head shrink-0">
            <h2 className="text-sm font-semibold text-ink-900">Filters</h2>
            {activeCount > 0 && (
              <button
                onClick={onClear}
                className="text-2xs font-medium text-accent-700 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>
        </div>
      </aside>

      <details className="panel group p-5 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink-900">
          <span>Filters{activeCount > 0 ? ` (${activeCount})` : ''}</span>
          <svg
            className="text-ink-400 transition-transform duration-200 group-open:rotate-180"
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 7.5 10 12.5 15 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    </>
  );
}

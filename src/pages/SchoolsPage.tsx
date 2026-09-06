import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync, useDebounced } from '../lib/useAsync';
import { getDeadlines, getFilterFacets, getSchools } from '../lib/queries/public';
import { nextUpcoming } from '../lib/dates';
import { SchoolCard } from '../components/Cards';
import { FilterBar, FilterGroup, SearchInput } from '../components/Filters';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

type Sort = 'default' | 'name' | 'country' | 'deadline';

export default function SchoolsPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>(
    params.get('region') ? [params.get('region')!] : [],
  );
  const [sort, setSort] = useState<Sort>('default');
  const debouncedSearch = useDebounced(search);

  const { data: facets } = useAsync(() => getFilterFacets(), []);

  const { data: schools, loading, error, reload } = useAsync(
    () => getSchools({ search: debouncedSearch || undefined, countries, regions }),
    [debouncedSearch, countries, regions],
  );

  // One extra query gives us "next deadline" + programme counts for all cards,
  // rather than N queries per school.
  const { data: rows } = useAsync(() => getDeadlines({ includePast: false }), []);

  const byScool = useMemo(() => {
    const map = new Map<string, { count: number; programs: Set<string> }>();
    for (const r of rows ?? []) {
      const entry = map.get(r.schoolId) ?? { count: 0, programs: new Set<string>() };
      entry.programs.add(r.programId);
      map.set(r.schoolId, entry);
    }
    return map;
  }, [rows]);

  const sorted = useMemo(() => {
    const list = [...(schools ?? [])];
    switch (sort) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'country':
        return list.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
      case 'deadline':
        return list.sort((a, b) => {
          const da = nextUpcoming((rows ?? []).filter((r) => r.schoolId === a.id))?.deadline;
          const db = nextUpcoming((rows ?? []).filter((r) => r.schoolId === b.id))?.deadline;
          if (!da && !db) return a.name.localeCompare(b.name);
          if (!da) return 1;
          if (!db) return -1;
          return da < db ? -1 : 1;
        });
      default:
        return list;
    }
  }, [schools, sort, rows]);

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );

  const activeCount = countries.length + regions.length;

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="label-caps">Directory</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Schools
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Every published school in the database. MBAround does not rank schools —
          this directory is ordered for browsing, not merit.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterBar
          activeCount={activeCount}
          onClear={() => { setCountries([]); setRegions([]); }}
        >
          <FilterGroup label="Region" options={facets?.regions ?? []} selected={regions} onToggle={toggle(setRegions)} />
          <FilterGroup label="Country" options={facets?.countries ?? []} selected={countries} onToggle={toggle(setCountries)} />
        </FilterBar>

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search schools, cities or countries…" />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="field sm:w-52"
              aria-label="Sort schools"
            >
              <option value="default">Default order</option>
              <option value="name">Name (A–Z)</option>
              <option value="country">Country</option>
              <option value="deadline">Next deadline</option>
            </select>
          </div>

          {sorted.length > 0 && (
            <p className="mb-4 text-2xs text-ink-500">
              {sorted.length} {sorted.length === 1 ? 'school' : 'schools'}
            </p>
          )}

          {loading && <LoadingState rows={3} />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && sorted.length === 0 && (
            <EmptyState
              title="No schools found"
              description="Try a different search term or clear your filters."
            />
          )}
          {sorted.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((s) => (
                <SchoolCard
                  key={s.id}
                  school={s}
                  programCount={byScool.get(s.id)?.programs.size}
                  nextDeadline={nextUpcoming((rows ?? []).filter((r) => r.schoolId === s.id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync, useDebounced } from '../lib/useAsync';
import { getDeadlines, getFilterFacets, type DeadlineFilters } from '../lib/queries/public';
import { DeadlineCard } from '../components/Cards';
import { FilterBar, FilterGroup, SearchInput } from '../components/Filters';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';

const DEADLINES_JSONLD = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Deadlines', path: '/deadlines' },
  ]),
];

type Sort = NonNullable<DeadlineFilters['sort']>;

const SORTS: { value: Sort; label: string }[] = [
  { value: 'nearest', label: 'Nearest deadline' },
  { value: 'latest', label: 'Latest deadline' },
  { value: 'school', label: 'School name' },
  { value: 'round', label: 'Round' },
];

export default function DeadlinesPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [programTypes, setProgramTypes] = useState<string[]>([]);
  const [cycleNames, setCycleNames] = useState<string[]>([]);
  const [roundNames, setRoundNames] = useState<string[]>(
    params.get('round') ? [params.get('round')!] : [],
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [sort, setSort] = useState<Sort>('nearest');

  const debouncedSearch = useDebounced(search);

  const { data: facets } = useAsync(() => getFilterFacets(), []);

  const filters: DeadlineFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      countries, regions, programTypes, cycleNames, roundNames,
      from: from || undefined,
      to: to || undefined,
      includePast,
      sort,
    }),
    [debouncedSearch, countries, regions, programTypes, cycleNames, roundNames, from, to, includePast, sort],
  );

  const { data, loading, error, reload } = useAsync(
    () => getDeadlines(filters),
    [filters],
  );

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );

  const activeCount =
    countries.length + regions.length + programTypes.length +
    cycleNames.length + roundNames.length + (from ? 1 : 0) + (to ? 1 : 0);
  const clearAll = () => {
    setCountries([]); setRegions([]); setProgramTypes([]);
    setCycleNames([]); setRoundNames([]); setFrom(''); setTo('');
  };

  // Filtered permutations are noindex/follow: same content, re-sliced. See
  // SchoolsPage for the reasoning.
  useSeo({
    title: 'MBA Application Deadlines by Round',
    description:
      'Every upcoming MBA application deadline in one place, with the round it belongs to and a link to the official source. Filter by country, region, programme type and round.',
    path: '/deadlines',
    noindex: activeCount > 0 || debouncedSearch.length > 0,
    jsonLd: DEADLINES_JSONLD,
  });

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="label-caps">Every round, every school</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          Deadlines
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Search and filter application deadlines. Each date links back to the
          school&rsquo;s official admissions page where one has been recorded.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <FilterBar activeCount={activeCount} onClear={clearAll}>
          <FilterGroup label="Region" options={facets?.regions ?? []} selected={regions} onToggle={toggle(setRegions)} />
          <FilterGroup label="Country" options={facets?.countries ?? []} selected={countries} onToggle={toggle(setCountries)} />
          <FilterGroup label="Programme type" options={facets?.programTypes ?? []} selected={programTypes} onToggle={toggle(setProgramTypes)} />
          <FilterGroup label="Application cycle" options={facets?.cycleNames ?? []} selected={cycleNames} onToggle={toggle(setCycleNames)} />
          <FilterGroup label="Round" options={facets?.roundNames ?? []} selected={roundNames} onToggle={toggle(setRoundNames)} />

          <fieldset className="border-t border-ink-100 py-4">
            <legend className="label-caps mb-2.5">Date range</legend>
            <div className="space-y-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" aria-label="From date" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field" aria-label="To date" />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
              />
              Include past deadlines
            </label>
          </fieldset>
        </FilterBar>

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search school, programme or round…" />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="field sm:w-52"
              aria-label="Sort deadlines"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {data && (
            <p className="mb-4 text-2xs text-ink-500">
              {data.length} {data.length === 1 ? 'result' : 'results'}
            </p>
          )}

          {loading && <LoadingState rows={4} />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && data.length === 0 && (
            <EmptyState
              title="No deadlines match those filters"
              description="Try widening your search, clearing filters, or including past deadlines."
              action={<button onClick={clearAll} className="btn-secondary">Clear filters</button>}
            />
          )}
          {data && data.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.map((row) => <DeadlineCard key={row.roundId} row={row} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

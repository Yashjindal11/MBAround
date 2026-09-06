import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { getDeadlines, getSchools } from '../lib/queries/public';
import { compareRounds, formatDateShort } from '../lib/dates';
import { EmptyState } from '../components/States';
import { VerificationBadge } from '../components/VerificationBadge';
import { ScopeRail, useSchoolScope } from '../components/SchoolScope';
import { verificationState } from '../lib/dates';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';
import type { DeadlineRow, School } from '../lib/types';

const COMPARE_JSONLD = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Compare', path: '/compare' },
  ]),
];

const MAX = 4;

/**
 * Comparison is generated entirely from database fields. There is no
 * per-school comparison component — adding a school or a round changes this
 * page automatically.
 */
export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('schools')?.split(',').filter(Boolean) ?? [];
  const [slugs, setSlugs] = useState<string[]>(initial);
  const { data: schools } = useAsync(() => getSchools(), []);
  const { data: rows } = useAsync(() => getDeadlines({ includePast: true }), []);

  const allSchools = useMemo<School[]>(() => schools ?? [], [schools]);
  const allRows = useMemo<DeadlineRow[]>(() => rows ?? [], [rows]);

  /** Region / country / programme facets, shared with the timeline page. */
  const scope = useSchoolScope(allSchools, allRows);

  const selected = useMemo(
    () => allSchools.filter((s) => slugs.includes(s.slug)),
    [allSchools, slugs],
  );

  const update = (next: string[]) => {
    setSlugs(next);
    if (next.length) setParams({ schools: next.join(',') });
    else setParams({});
  };
  const toggle = (slug: string) =>
    update(
      slugs.includes(slug)
        ? slugs.filter((s) => s !== slug)
        : slugs.length < MAX
          ? [...slugs, slug]
          : slugs,
    );

  // ?schools=a,b is user-specific state, not a distinct page worth indexing.
  useSeo({
    title: 'Compare MBA Programmes Side by Side',
    description:
      'Compare MBA programmes across business schools — application rounds, deadlines, decision dates and locations, side by side in one table.',
    path: '/compare',
    noindex: slugs.length > 0,
    jsonLd: COMPARE_JSONLD,
  });

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="label-caps">Side by side</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Compare
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Choose up to {MAX} schools to compare their programmes, application
          rounds and decision dates. Narrow the list on the left by region,
          country or programme.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <ScopeRail activeCount={scope.activeCount} onClear={scope.clearAll}>
          <div className="space-y-3">
            {scope.controls}

            <div className="border-t border-ink-100 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="label-caps">Schools</h3>
                <span className="text-2xs text-ink-500">
                  {slugs.length}/{MAX} selected
                </span>
              </div>

              {slugs.length > 0 && (
                <button
                  type="button"
                  onClick={() => update([])}
                  className="mt-2 text-2xs font-medium text-accent-700 hover:underline"
                >
                  Clear selection
                </button>
              )}

              {/* Natural height: ScopeRail owns the single scroll container,
                  so a `max-h` here would nest two scrollbars. */}
              <div className="mt-2 space-y-0.5">
                {scope.schools.length === 0 ? (
                  <p className="py-2 text-2xs text-ink-500">
                    No schools match these filters.
                  </p>
                ) : (
                  scope.schools.map((s) => {
                    const on = slugs.includes(s.slug);
                    const atLimit = !on && slugs.length >= MAX;
                    return (
                      <label
                        key={s.id}
                        className={
                          'flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm ' +
                          (atLimit
                            ? 'cursor-not-allowed text-ink-400'
                            : 'cursor-pointer text-ink-700 hover:bg-ink-50')
                        }
                        title={atLimit ? 'Deselect a school first' : s.name}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={atLimit}
                          onChange={() => toggle(s.slug)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-ink-300 text-accent-600 focus:ring-accent-500 disabled:opacity-40"
                        />
                        <span className="truncate">{s.shortName ?? s.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ScopeRail>

        <div className="min-w-0">
          {selected.length === 0 ? (
            <EmptyState
              title="Nothing selected yet"
              description="Pick two or more schools from the list to see them side by side."
            />
          ) : (
            <CompareTable schools={selected} rows={allRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function CompareTable({ schools, rows }: { schools: School[]; rows: DeadlineRow[] }) {
  const forSchool = (id: string) => rows.filter((r) => r.schoolId === id);
  /** Union of round names across the selection — never a fixed R1/R2/R3 list. */
  const roundNames = useMemo(() => {
    const names = new Map<string, number>();
    for (const s of schools) {
      for (const r of rows.filter((row) => row.schoolId === s.id)) {
        if (!names.has(r.roundName)) names.set(r.roundName, r.roundOrder);
      }
    }
    return [...names.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [schools, rows]);

  const cell = 'border-l border-ink-100 px-4 py-3 align-top text-sm';

  const rowsSpec: { label: string; render: (s: School) => React.ReactNode }[] = [
    { label: 'Location', render: (s) => [s.city, s.country].filter(Boolean).join(', ') },
    {
      label: 'Programmes',
      render: (s) => {
        const names = [...new Set(forSchool(s.id).map((r) => r.programName))];
        return names.length ? names.join(', ') : '—';
      },
    },    {
      label: 'Application cycle',
      render: (s) => {
        const names = [...new Set(forSchool(s.id).map((r) => r.cycleName))];
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      label: 'Official links',
      render: (s) => (
        <div className="space-y-1">
          {s.websiteUrl && (
            <a href={s.websiteUrl} target="_blank" rel="noreferrer"
              className="block text-accent-700 underline underline-offset-2">Website →</a>
          )}
          {s.admissionsUrl && (
            <a href={s.admissionsUrl} target="_blank" rel="noreferrer"
              className="block text-accent-700 underline underline-offset-2">Admissions →</a>
          )}
          {!s.websiteUrl && !s.admissionsUrl && '—'}
        </div>
      ),
    },
  ];

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[40rem]">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/60">
            <th className="w-40 px-4 py-3 text-left label-caps">Attribute</th>
            {schools.map((s) => (
              <th key={s.id} className="border-l border-ink-100 px-4 py-3 text-left">
                <span className="text-sm font-semibold text-ink-900">{s.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rowsSpec.map((spec) => (
            <tr key={spec.label}>
              <th className="px-4 py-3 text-left align-top label-caps">{spec.label}</th>
              {schools.map((s) => (
                <td key={s.id} className={cell}>{spec.render(s)}</td>
              ))}
            </tr>
          ))}

          {roundNames.map((name) => (
            <tr key={name}>
              <th className="px-4 py-3 text-left align-top label-caps">{name}</th>
              {schools.map((s) => {
                const r = forSchool(s.id)
                  .filter((x) => x.roundName === name)
                  .sort(compareRounds)[0];
                return (
                  <td key={s.id} className={cell}>
                    {!r ? (
                      <span className="text-ink-400">Not offered</span>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-medium text-ink-900">
                          {r.deadline ? formatDateShort(r.deadline) : 'Not announced'}
                        </p>
                        {r.decisionDate && (
                          <p className="text-2xs text-ink-500">
                            Decision {formatDateShort(r.decisionDate)}
                          </p>
                        )}
                        <VerificationBadge state={verificationState(r)} />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

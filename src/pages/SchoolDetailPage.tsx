import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../lib/useAsync';
import {
  getDeadlinesForSchool,
  getProgramsForSchool,
  getSchoolBySlug,
} from '../lib/queries/public';
import { countdownLabel, formatDate, formatDateShort, verificationState } from '../lib/dates';
import { ProvenanceLine, VerificationBadge } from '../components/VerificationBadge';
import { LocationLine } from '../components/Cards';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import type { DeadlineRow } from '../lib/types';

/**
 * Reusable information-display primitives. Adding a new school attribute later
 * (tuition, GMAT median, class size…) means rendering another
 * `InformationField` — not redesigning the page.
 */
export function InformationSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink-200/70 py-10 first:border-t-0">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
      {description && <p className="mt-1.5 text-sm text-ink-500">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function InformationField({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">{value ?? '—'}</dd>
      {hint && <p className="mt-0.5 text-2xs text-ink-500">{hint}</p>}
    </div>
  );
}

function useDocumentTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }
  }, [title, description]);
}

function RoundsTable({ rows }: { rows: DeadlineRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No rounds recorded"
        description="No application rounds have been added for this programme yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.roundId} className="surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">{row.roundName}</p>
              <p className="mt-0.5 text-2xs text-ink-500">{row.cycleName}</p>
            </div>
            <VerificationBadge state={verificationState(row)} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InformationField
              label="Deadline"
              value={row.deadline ? formatDate(row.deadline) : 'Not announced'}
              hint={row.deadline ? countdownLabel(row.deadline) : undefined}
            />
            <InformationField
              label="Decision"
              value={row.decisionDate ? formatDateShort(row.decisionDate) : '—'}
            />
          </dl>

          {row.notes && <p className="mt-3 text-xs leading-relaxed text-ink-500">{row.notes}</p>}

          <div className="mt-4 border-t border-ink-100 pt-3">
            <ProvenanceLine record={row} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SchoolDetailPage() {
  const { slug = '' } = useParams();

  const { data: school, loading, error, reload } = useAsync(
    () => getSchoolBySlug(slug),
    [slug],
  );
  const { data: programs } = useAsync(
    () => (school ? getProgramsForSchool(school.id) : Promise.resolve([])),
    [school?.id],
  );  const { data: rows } = useAsync(
    () => (school ? getDeadlinesForSchool(school.id) : Promise.resolve([])),
    [school?.id],
  );

  /**
   * Rounds belong to a programme, not to a school: a one-year MBA and a
   * two-year MBA run entirely different calendars. Showing them in one list
   * would imply a school has more rounds than it really does, so the page
   * scopes rounds to a single selected programme.
   */
  const [programId, setProgramId] = useState<string | null>(null);

  /**
   * Programmes that actually have rounds recorded, derived from the rounds
   * themselves. Ordered to match the school's published programme list, with
   * any programme appearing only in the rounds data appended rather than
   * dropped.
   */
  const programTabs = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; type: string }>();
    for (const r of rows ?? []) {
      if (!byId.has(r.programId)) {
        byId.set(r.programId, {
          id: r.programId,
          name: r.programName,
          type: r.programType,
        });
      }
    }
    const ordered: { id: string; name: string; type: string }[] = [];
    for (const p of programs ?? []) {
      const hit = byId.get(p.id);
      if (hit) {
        ordered.push(hit);
        byId.delete(p.id);
      }
    }
    return [...ordered, ...byId.values()];
  }, [rows, programs]);

  /**
   * Default to the first programme once data arrives, and recover if the
   * selected programme disappears (e.g. unpublished in admin) so the page
   * never renders an empty round list for a stale selection.
   */
  const activeProgramId =
    programId && programTabs.some((p) => p.id === programId)
      ? programId
      : (programTabs[0]?.id ?? null);

  const visibleRows = useMemo(
    () => (rows ?? []).filter((r) => r.programId === activeProgramId),
    [rows, activeProgramId],
  );

  useDocumentTitle(
    school ? `${school.name} — MBA deadlines | MBAround` : 'School | MBAround',
    school?.description ?? undefined,
  );

  if (loading) return <div className="container-page py-12"><LoadingState rows={3} /></div>;
  if (error) return <div className="container-page py-12"><ErrorState error={error} onRetry={reload} /></div>;
  if (!school) {
    return (
      <div className="container-page py-20">
        <EmptyState
          title="School not found"
          description="This school may be unpublished or the link may be out of date."
          action={<Link to="/schools" className="btn-secondary">Back to schools</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <Link to="/schools" className="text-2xs font-medium text-ink-500 hover:text-ink-900">
        ← All schools
      </Link>

      <header className="mt-4 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            {school.name}
          </h1>
          {school.shortName && (
            <span className="rounded-md bg-ink-100 px-2 py-1 text-2xs font-semibold text-ink-600">
              {school.shortName}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-500"><LocationLine school={school} /></p>
        {school.description && (
          <p className="mt-4 text-base leading-relaxed text-ink-600">{school.description}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {school.websiteUrl && (
            <a href={school.websiteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-2 text-xs">
              Official website →
            </a>
          )}
          {school.admissionsUrl && (
            <a href={school.admissionsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-2 text-xs">
              Admissions page →
            </a>
          )}
          <Link to={`/compare?schools=${school.slug}`} className="btn-ghost text-xs">
            Add to comparison
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <InformationSection
          title="Programmes"
          description="All published programmes offered by this school."
        >
          {programs && programs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {programs.map((p) => (
                <div key={p.id} className="surface p-4">
                  <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="mt-0.5 text-2xs text-ink-500">{p.programType}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <InformationField
                      label="Duration"
                      value={p.durationMonths ? `${p.durationMonths} months` : '—'}
                    />
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No programmes published" />
          )}
        </InformationSection>        <InformationSection
          title="Application rounds"
          description="Rounds exactly as published by the school — MBAround does not assume a fixed number of rounds."
        >
          {programTabs.length > 1 && (
            <div className="mb-5">
              <p className="label-caps mb-2">Programme</p>
              <div
                role="tablist"
                aria-label="Select a programme"
                className="flex flex-wrap gap-2"
              >
                {programTabs.map((p) => {
                  const on = p.id === activeProgramId;
                  return (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setProgramId(p.id)}
                      className={
                        'rounded-lg border px-3 py-2 text-left text-xs transition-colors ' +
                        (on
                          ? 'border-ink-900 bg-ink-900 text-white'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400')
                      }
                    >
                      <span className="block font-medium">{p.name}</span>
                      <span
                        className={
                          'block text-2xs ' + (on ? 'text-white/70' : 'text-ink-500')
                        }
                      >
                        {p.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {programTabs.length === 1 && (
            <p className="mb-4 text-2xs text-ink-500">
              Showing rounds for {programTabs[0].name}.
            </p>
          )}

          <RoundsTable rows={visibleRows} />
        </InformationSection>

        <InformationSection title="Data &amp; verification">
          <dl className="grid gap-5 sm:grid-cols-3">
            <InformationField
              label="School record"
              value={school.isVerified ? 'Verified' : 'Needs review'}
            />
            <InformationField
              label="Official admissions source"
              value={school.admissionsUrl ? 'Recorded' : 'Not recorded'}
            />
            <InformationField
              label="Found an error?"
              value={
                <Link to="/suggest" className="text-accent-700 underline underline-offset-2">
                  Suggest a correction
                </Link>
              }
            />
          </dl>
        </InformationSection>
      </div>
    </div>
  );
}

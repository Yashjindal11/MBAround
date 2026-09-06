import { useMemo, useState } from 'react';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { adminListSchools, bulkUpdateRounds, updateRound } from '../../lib/queries/admin';
import { getDeadlines, getFilterFacets } from '../../lib/queries/public';
import { InlineEditor, useToast } from '../../components/admin/AdminUI';
import { SearchInput } from '../../components/Filters';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { VerificationBadge } from '../../components/VerificationBadge';
import { verificationState } from '../../lib/dates';

/**
 * The primary maintenance screen: find a school, change a deadline, done.
 *
 * Rows come from the same `deadline_rows` view the public site uses, so what
 * an editor sees here is exactly what visitors see.
 */
export default function AdminRounds() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [country, setCountry] = useState('');
  const [verified, setVerified] = useState('');
  const [announced, setAnnounced] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  const debounced = useDebounced(search);
  const { data: facets } = useAsync(() => getFilterFacets(), []);
  const { data: schools } = useAsync(() => adminListSchools({ sort: 'name' }), []);

  const { data: rows, loading, error, reload } = useAsync(
    () =>
      getDeadlines({
        search: debounced || undefined,
        schoolIds: schoolId ? [schoolId] : undefined,
        countries: country ? [country] : undefined,
        includePast: true,
        sort: 'school',
      }),
    [debounced, schoolId, country, version],
  );

  const filtered = useMemo(() => {
    let out = rows ?? [];
    if (verified) out = out.filter((r) => String(r.isVerified) === verified);
    if (announced) out = out.filter((r) => String(r.isAnnounced) === announced);
    return out;
  }, [rows, verified, announced]);

  const refresh = () => setVersion((v) => v + 1);

  const save = async (id: string, patch: Parameters<typeof updateRound>[1], label: string) => {
    try {
      await updateRound(id, patch);
      toast(`${label} updated`);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  };

  const bulk = async (patch: Parameters<typeof bulkUpdateRounds>[1], label: string) => {
    try {
      await bulkUpdateRounds(selected, patch);
      toast(`${selected.length} rounds marked ${label}`);
      setSelected([]);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Bulk update failed', 'error');
    }
  };

  const toggleSel = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search school…" />
        </div>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="field" aria-label="School">
          <option value="">All schools</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="field" aria-label="Country">
          <option value="">All countries</option>
          {(facets?.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select value={verified} onChange={(e) => setVerified(e.target.value)} className="field" aria-label="Verified">
            <option value="">Any</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select value={announced} onChange={(e) => setAnnounced(e.target.value)} className="field" aria-label="Announced">
            <option value="">Any</option>
            <option value="true">Announced</option>
            <option value="false">Not announced</option>
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-4 py-2.5">
          <span className="text-xs font-medium text-accent-900">{selected.length} selected</span>
          <button onClick={() => bulk({ isVerified: true }, 'verified')} className="btn-secondary !py-1.5 text-2xs">
            Mark verified
          </button>
          <button onClick={() => bulk({ isVerified: false }, 'needs review')} className="btn-secondary !py-1.5 text-2xs">
            Mark needs review
          </button>
          <button onClick={() => setSelected([])} className="ml-auto text-2xs text-accent-800 hover:underline">
            Clear
          </button>
        </div>
      )}

      {loading && <LoadingState rows={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && filtered.length === 0 && (
        <EmptyState title="No rounds found" description="Adjust the filters, or add a round to a cycle." />
      )}

      {filtered.length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50/60 text-left">
              <tr className="label-caps">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5">School</th>
                <th className="px-3 py-2.5">Program</th>
                <th className="px-3 py-2.5">Round</th>
                <th className="px-3 py-2.5">Deadline</th>
                <th className="px-3 py-2.5">Decision</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((r) => (
                <tr key={r.roundId} className="hover:bg-ink-50/50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.roundId)}
                      onChange={() => toggleSel(r.roundId)}
                      aria-label={`Select ${r.schoolName} ${r.roundName}`}
                      className="h-3.5 w-3.5 rounded border-ink-300 text-accent-600"
                    />
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 font-medium text-ink-900">
                    {r.schoolName}
                  </td>
                  <td className="px-3 py-2 text-ink-600">{r.programName}</td>
                  <td className="px-3 py-2 text-ink-600">{r.roundName}</td>
                  <td className="px-2 py-1.5">
                    <InlineEditor
                      value={r.deadline}
                      type="date"
                      placeholder="Not announced"
                      ariaLabel={`${r.schoolName} ${r.roundName} deadline`}
                      onSave={(next) =>
                        save(
                          r.roundId,
                          // Setting a date implies the school has announced it.
                          next ? { deadline: next, isAnnounced: true } : { deadline: null },
                          'Deadline',
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <InlineEditor
                      value={r.decisionDate}
                      type="date"
                      ariaLabel={`${r.schoolName} ${r.roundName} decision date`}
                      onSave={(next) => save(r.roundId, { decisionDate: next }, 'Decision date')}
                    />
                  </td>
                  <td className="max-w-[12rem] px-2 py-1.5">
                    <InlineEditor
                      value={r.sourceUrl}
                      placeholder="No source"
                      ariaLabel={`${r.schoolName} ${r.roundName} source URL`}
                      onSave={(next) => save(r.roundId, { sourceUrl: next }, 'Source')}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <VerificationBadge state={verificationState(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-2xs text-ink-500">
        A round can only be marked verified once it has both a deadline and an
        official source URL — the database enforces this.
      </p>
    </div>
  );
}

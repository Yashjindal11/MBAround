import { useState } from 'react';
import { useAsync } from '../../lib/useAsync';
import {
  adminListCycles, adminListPrograms, adminListRounds, adminListSchools,
  createCycle, createRound, setCurrentCycle,
} from '../../lib/queries/admin';
import { useToast } from '../../components/admin/AdminUI';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { formatDateShort } from '../../lib/dates';

/**
 * Drill-down: school → programme → cycle → rounds.
 * Mirrors the mental model of "open Harvard, open MBA, open 2026-27".
 */
export default function AdminCycles() {
  const toast = useToast();
  const [schoolId, setSchoolId] = useState('');
  const [programId, setProgramId] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const { data: schools } = useAsync(() => adminListSchools({ sort: 'name' }), []);
  const { data: programs } = useAsync(
    () => (schoolId ? adminListPrograms({ schoolId }) : Promise.resolve([])),
    [schoolId],
  );
  const { data, loading, error, reload } = useAsync(
    () => adminListCycles(programId || undefined),
    [programId, version],
  );

  const refresh = () => setVersion((v) => v + 1);

  const addCycle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const start = Number(fd.get('startYear'));
    try {
      await createCycle({
        programId: String(fd.get('programId')),
        cycleName: String(fd.get('cycleName')),
        startYear: start,
        endYear: start + 1,
        status: 'UPCOMING',
        isCurrent: false,
      });
      toast('Cycle created');
      refresh();
      e.currentTarget.reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select
          value={schoolId}
          onChange={(e) => { setSchoolId(e.target.value); setProgramId(''); }}
          className="field sm:w-64" aria-label="School"
        >
          <option value="">All schools</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={programId} onChange={(e) => setProgramId(e.target.value)}
          className="field sm:w-56" disabled={!schoolId} aria-label="Program"
        >
          <option value="">All programmes</option>
          {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {programId && (
        <form onSubmit={addCycle} className="surface mb-4 grid gap-3 p-4 sm:grid-cols-4">
          <input type="hidden" name="programId" value={programId} />
          <input name="cycleName" required placeholder="Cycle name (e.g. 2027–28)" className="field sm:col-span-2" />
          <input name="startYear" type="number" required defaultValue={2027} placeholder="Start year" className="field" />
          <button type="submit" className="btn-primary !py-2 text-xs">Add cycle</button>
        </form>
      )}

      {loading && <LoadingState rows={3} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && (data ?? []).length === 0 && (
        <EmptyState title="No cycles" description="Select a programme to add an application cycle." />
      )}

      <div className="space-y-3">
        {(data ?? []).map((c) => (
          <CycleRow
            key={c.id}
            cycle={c}
            expanded={expanded === c.id}
            onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            onChanged={refresh}
            onSetCurrent={async () => {
              try {
                await setCurrentCycle(c.programId, c.id);
                toast('Set as current cycle');
                refresh();
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Failed', 'error');
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CycleRow({
  cycle, expanded, onToggle, onSetCurrent, onChanged,
}: {
  cycle: import('../../lib/types').ApplicationCycle;
  expanded: boolean;
  onToggle: () => void;
  onSetCurrent: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data: rounds } = useAsync(
    () => (expanded ? adminListRounds(cycle.id) : Promise.resolve([])),
    [expanded, cycle.id],
  );

  const addRound = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const deadline = String(fd.get('deadline') || '');
    try {
      await createRound({
        applicationCycleId: cycle.id,
        name: String(fd.get('name')),
        // No date means the school has not announced it — never invent one.
        deadline: deadline || null,
        isAnnounced: Boolean(deadline),
        isVerified: false,
        displayOrder: (rounds?.length ?? 0) + 1,
      });
      toast('Round created');
      onChanged();
      e.currentTarget.reset();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  };

  return (
    <div className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onToggle} className="text-left">
          <p className="text-sm font-semibold text-ink-900">
            {cycle.cycleName}
            {cycle.isCurrent && (
              <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-2xs text-accent-800">
                Current
              </span>
            )}
          </p>
          <p className="mt-0.5 text-2xs text-ink-500">{cycle.status}</p>
        </button>
        <div className="flex gap-2">
          {!cycle.isCurrent && (
            <button onClick={onSetCurrent} className="btn-secondary !py-1.5 text-2xs">Set current</button>
          )}
          <button onClick={onToggle} className="btn-ghost text-2xs">
            {expanded ? 'Hide rounds' : 'Show rounds'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <ul className="space-y-1.5">
            {(rounds ?? []).map((r) => (
              <li key={r.id} className="flex justify-between text-sm">
                <span className="text-ink-800">{r.name}</span>
                <span className="text-ink-500">
                  {r.deadline ? formatDateShort(r.deadline) : 'Not announced'}
                </span>
              </li>
            ))}
            {(rounds ?? []).length === 0 && (
              <li className="text-sm text-ink-400">No rounds yet.</li>
            )}
          </ul>

          <form onSubmit={addRound} className="mt-3 flex flex-wrap gap-2">
            <input name="name" required placeholder="Round name" className="field flex-1" />
            <input name="deadline" type="date" className="field w-40" aria-label="Deadline" />
            <button type="submit" className="btn-secondary !py-2 text-xs">Add round</button>
          </form>
          <p className="mt-2 text-2xs text-ink-500">
            Leave the date blank if the school has not announced it.
          </p>
        </div>
      )}
    </div>
  );
}

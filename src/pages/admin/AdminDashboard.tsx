import { Link } from 'react-router-dom';
import { useAsync } from '../../lib/useAsync';
import { getAuditLog, getDataHealth } from '../../lib/queries/admin';
import { ErrorState, LoadingState } from '../../components/States';
import { formatDateShort } from '../../lib/dates';

function Stat({
  label, value, tone = 'default', to,
}: {
  label: string;
  value: number | undefined;
  tone?: 'default' | 'warn' | 'good';
  to?: string;
}) {
  const toneClass =
    tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-accent-700' : 'text-ink-900';
  const body = (
    <>
      <p className="label-caps">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${toneClass}`}>
        {value ?? '—'}
      </p>
    </>
  );
  return to ? (
    <Link to={to} className="surface p-4 transition-colors hover:border-accent-300">{body}</Link>
  ) : (
    <div className="surface p-4">{body}</div>
  );
}

export default function AdminDashboard() {
  const { data: health, loading, error, reload } = useAsync(() => getDataHealth(), []);
  const { data: recent } = useAsync(() => getAuditLog({ limit: 8 }), []);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          <Link to="/admin/schools?new=1" className="btn-primary !py-2 text-xs">Add school</Link>
          <Link to="/admin/programs" className="btn-secondary !py-2 text-xs">Add program</Link>
          <Link to="/admin/cycles" className="btn-secondary !py-2 text-xs">Add cycle</Link>
          <Link to="/admin/rounds" className="btn-secondary !py-2 text-xs">Add round</Link>
          <Link to="/admin/suggestions" className="btn-secondary !py-2 text-xs">
            Review suggestions
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Data health</h2>
        {loading && <LoadingState rows={2} />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {health && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Schools" value={health.totalSchools} to="/admin/schools" />
            <Stat label="Published" value={health.publishedSchools} tone="good" />
            <Stat label="Programmes" value={health.totalPrograms} to="/admin/programs" />
            <Stat label="Current cycles" value={health.currentCycles} to="/admin/cycles" />
            <Stat label="Upcoming deadlines" value={health.upcomingDeadlines} to="/admin/rounds" />
            <Stat label="Needs review" value={health.needsReview} tone="warn" to="/admin/rounds?verified=false" />
            <Stat label="Missing official source" value={health.missingOfficialSource} tone="warn" />
            <Stat label="Not announced" value={health.unannouncedRounds} />
            <Stat label="Pending suggestions" value={health.pendingSuggestions} tone="warn" to="/admin/suggestions" />
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Recent changes</h2>
          <Link to="/admin/audit" className="text-2xs font-medium text-accent-700 hover:underline">
            Full audit log →
          </Link>
        </div>
        <div className="surface divide-y divide-ink-100">
          {(recent ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-400">No changes recorded yet.</p>
          )}
          {(recent ?? []).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-ink-400"> · {entry.entityType}</span>
                </p>
                <p className="truncate text-2xs text-ink-500">{entry.actor ?? 'system'}</p>
              </div>
              <span className="shrink-0 text-2xs text-ink-400">
                {formatDateShort(entry.createdAt.slice(0, 10))}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

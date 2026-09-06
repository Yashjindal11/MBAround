import { useState } from 'react';
import { useAsync } from '../../lib/useAsync';
import { getAuditLog } from '../../lib/queries/admin';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';

/** Shows only the fields that actually changed, rather than two JSON blobs. */
function Diff({
  before, after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before || !after) return null;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => k !== 'updated_at' && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  if (keys.length === 0) return null;

  return (
    <dl className="mt-2 space-y-1">
      {keys.map((k) => (
        <div key={k} className="flex flex-wrap gap-x-2 text-2xs">
          <dt className="font-medium text-ink-600">{k}</dt>
          <dd className="text-red-600 line-through">{String(before[k] ?? '—')}</dd>
          <dd className="text-accent-700">{String(after[k] ?? '—')}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminAudit() {
  const [entityType, setEntityType] = useState('');
  const { data, loading, error, reload } = useAsync(
    () => getAuditLog({ entityType: entityType || undefined, limit: 200 }),
    [entityType],
  );

  return (
    <div>
      <select
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        className="field mb-4 sm:w-52"
        aria-label="Filter by entity type"
      >
        <option value="">All entities</option>
        {['SCHOOL', 'PROGRAM', 'CYCLE', 'ROUND', 'SUGGESTION'].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {loading && <LoadingState rows={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && (data ?? []).length === 0 && (
        <EmptyState title="No audit entries" description="Changes made through the admin panel appear here." />
      )}

      <div className="surface divide-y divide-ink-100">
        {(data ?? []).map((e) => (
          <div key={e.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                <span className="font-medium text-ink-900">{e.action}</span>
                <span className="text-ink-400"> · {e.entityType}</span>
              </p>
              <p className="text-2xs text-ink-400">
                {new Date(e.createdAt).toLocaleString()} · {e.actor ?? 'system'}
              </p>
            </div>
            <Diff before={e.beforeData} after={e.afterData} />
          </div>
        ))}
      </div>
    </div>
  );
}

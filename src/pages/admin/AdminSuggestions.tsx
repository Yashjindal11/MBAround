import { useState } from 'react';
import { useAsync } from '../../lib/useAsync';
import { adminListSuggestions, reviewSuggestion } from '../../lib/queries/admin';
import { useToast } from '../../components/admin/AdminUI';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { formatDateShort } from '../../lib/dates';

export default function AdminSuggestions() {
  const toast = useToast();
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [version, setVersion] = useState(0);

  const { data, loading, error, reload } = useAsync(
    () => adminListSuggestions(status),
    [status, version],
  );

  const review = async (id: string, approve: boolean) => {
    try {
      await reviewSuggestion(id, approve);
      toast(approve ? 'Suggestion approved' : 'Suggestion rejected');
      setVersion((v) => v + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Review failed', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              status === s ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading && <LoadingState rows={3} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && (data ?? []).length === 0 && (
        <EmptyState title={`No ${status.toLowerCase()} suggestions`} />
      )}

      <div className="space-y-3">
        {(data ?? []).map((s) => (
          <article key={s.id} className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {s.fieldName ? `Field: ${s.fieldName}` : 'General correction'}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">
                  Submitted {formatDateShort(s.createdAt.slice(0, 10))}
                  {s.email && ` · ${s.email}`}
                </p>
              </div>
              {s.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={() => review(s.id, true)} className="btn-primary !py-1.5 text-2xs">Approve</button>
                  <button onClick={() => review(s.id, false)} className="btn-secondary !py-1.5 text-2xs">Reject</button>
                </div>
              )}
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div>
                <dt className="label-caps">What is wrong</dt>
                <dd className="mt-0.5 text-ink-800">{s.issue}</dd>
              </div>
              {s.suggestedValue && (
                <div>
                  <dt className="label-caps">Suggested value</dt>
                  <dd className="mt-0.5 text-ink-800">{s.suggestedValue}</dd>
                </div>
              )}
              {s.sourceUrl && (
                <div>
                  <dt className="label-caps">Official source</dt>
                  <dd className="mt-0.5">
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer nofollow"
                      className="break-all text-accent-700 underline underline-offset-2">
                      {s.sourceUrl}
                    </a>
                  </dd>
                </div>
              )}
              {s.notes && (
                <div>
                  <dt className="label-caps">Notes</dt>
                  <dd className="mt-0.5 text-ink-600">{s.notes}</dd>
                </div>
              )}
            </dl>

            {s.status === 'PENDING' && (
              <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-2xs leading-relaxed text-ink-600">
                Approving records the decision and writes an audit entry. It does not
                overwrite canonical data automatically — verify the official source,
                then edit the record so the change carries a source and timestamp.
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

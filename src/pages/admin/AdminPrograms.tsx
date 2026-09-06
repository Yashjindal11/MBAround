import { useState } from 'react';
import { useAsync } from '../../lib/useAsync';
import {
  adminListPrograms, adminListSchools, createProgram, updateProgram,
} from '../../lib/queries/admin';
import { ToggleCell, useToast } from '../../components/admin/AdminUI';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { slugify } from '../../lib/slug';

export default function AdminPrograms() {
  const toast = useToast();
  const [schoolId, setSchoolId] = useState('');
  const [published, setPublished] = useState('');
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);

  const { data: schools } = useAsync(() => adminListSchools({ sort: 'name' }), []);
  const { data, loading, error, reload } = useAsync(
    () =>
      adminListPrograms({
        schoolId: schoolId || undefined,
        published: published === '' ? undefined : published === 'true',
      }),
    [schoolId, published, version],
  );

  const refresh = () => setVersion((v) => v + 1);
  const schoolName = (id: string) => schools?.find((s) => s.id === id)?.name ?? '—';

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name'));
    try {
      await createProgram({
        schoolId: String(fd.get('schoolId')),
        name,
        slug: slugify(name),
        programType: String(fd.get('programType')),
        durationMonths: fd.get('duration') ? Number(fd.get('duration')) : null,
        isPublished: false,
      });
      toast('Program created');
      setAdding(false);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Create failed', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="field sm:w-64" aria-label="School">
          <option value="">All schools</option>
          {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={published} onChange={(e) => setPublished(e.target.value)} className="field sm:w-40" aria-label="Published">
          <option value="">Any status</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <button onClick={() => setAdding((v) => !v)} className="btn-primary !py-2 text-xs sm:ml-auto">
          {adding ? 'Cancel' : 'Add program'}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="surface mb-4 grid gap-3 p-4 sm:grid-cols-4">
          <select name="schoolId" required className="field" aria-label="School">
            <option value="">Select school…</option>
            {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input name="name" required placeholder="Program name" className="field" />
          <input name="programType" required defaultValue="Full-time MBA" placeholder="Type" className="field" />
          <div className="flex gap-2">
            <input name="duration" type="number" placeholder="Months" className="field" />
            <button type="submit" className="btn-primary !py-2 text-xs">Create</button>
          </div>
        </form>
      )}

      {loading && <LoadingState rows={3} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && (data ?? []).length === 0 && <EmptyState title="No programmes found" />}

      {(data ?? []).length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50/60 text-left">
              <tr className="label-caps">
                <th className="px-3 py-2.5">Program</th>
                <th className="px-3 py-2.5">School</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Duration</th>
                <th className="px-3 py-2.5">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(data ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/50">
                  <td className="px-3 py-2 font-medium text-ink-900">{p.name}</td>
                  <td className="px-3 py-2 text-ink-600">{schoolName(p.schoolId)}</td>
                  <td className="px-3 py-2 text-ink-600">{p.programType}</td>
                  <td className="px-3 py-2 text-ink-600">
                    {p.durationMonths ? `${p.durationMonths} mo` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <ToggleCell
                      label={`Publish ${p.name}`} checked={p.isPublished}
                      onChange={async (v) => {
                        try {
                          await updateProgram(p.id, { isPublished: v });
                          toast(v ? 'Published' : 'Unpublished');
                          refresh();
                        } catch (err) {
                          toast(err instanceof Error ? err.message : 'Failed', 'error');
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

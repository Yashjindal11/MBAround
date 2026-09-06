import { useState } from 'react';
import { useAsync, useDebounced } from '../../lib/useAsync';
import {
  adminListSchools, bulkUpdateSchools, createSchool, deleteSchool, updateSchool,
} from '../../lib/queries/admin';
import { getFilterFacets } from '../../lib/queries/public';
import { ConfirmDialog, ToggleCell, useToast } from '../../components/admin/AdminUI';
import { SearchInput } from '../../components/Filters';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { slugify } from '../../lib/slug';
import type { School } from '../../lib/types';

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-2xs text-ink-500">{hint}</p>}
    </label>
  );
}

function SchoolEditor({
  school, onClose, onSaved,
}: {
  school: Partial<School> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = !school?.id;
  const [form, setForm] = useState<Partial<School>>(
    school ?? {
      name: '', slug: '', country: '', region: '', city: '',
      isPublished: false, isVerified: false, isFeatured: false, displayOrder: 0,
    },
  );
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof School>(key: K, value: School[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name ?? '') };
      if (isNew) await createSchool(payload);
      else await updateSchool(school!.id!, payload);
      toast(isNew ? 'School created' : 'Changes saved');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <form onSubmit={submit} className="surface relative mx-auto max-w-2xl p-6">
        <h2 className="font-display text-xl font-semibold">
          {isNew ? 'New school' : 'Edit school'}
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="School name">
              <input
                required value={form.name ?? ''} className="field"
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f, name,
                    // Auto-slug only while creating, so existing URLs never break.
                    slug: isNew ? slugify(name) : f.slug,
                  }));
                }}
              />
            </Field>
          </div>
          <Field label="Short name">
            <input value={form.shortName ?? ''} className="field"
              onChange={(e) => set('shortName', e.target.value)} />
          </Field>
          <Field label="Slug" hint="Used in the public URL.">
            <input required value={form.slug ?? ''} className="field"
              onChange={(e) => set('slug', slugify(e.target.value))} />
          </Field>
          <Field label="Country">
            <input required value={form.country ?? ''} className="field"
              onChange={(e) => set('country', e.target.value)} />
          </Field>
          <Field label="Region" hint="Becomes a filter option automatically.">
            <input required value={form.region ?? ''} className="field"
              onChange={(e) => set('region', e.target.value)} />
          </Field>
          <Field label="State / province">
            <input value={form.state ?? ''} className="field"
              onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="City">
            <input required value={form.city ?? ''} className="field"
              onChange={(e) => set('city', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea rows={4} value={form.description ?? ''} className="field"
                onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
          <Field label="Website URL">
            <input type="url" value={form.websiteUrl ?? ''} className="field"
              onChange={(e) => set('websiteUrl', e.target.value)} />
          </Field>
          <Field label="Admissions URL">
            <input type="url" value={form.admissionsUrl ?? ''} className="field"
              onChange={(e) => set('admissionsUrl', e.target.value)} />
          </Field>
          <Field label="Display order">
            <input type="number" value={form.displayOrder ?? 0} className="field"
              onChange={(e) => set('displayOrder', Number(e.target.value))} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap gap-6 border-t border-ink-100 pt-4">
          {([
            ['Published', 'isPublished'],
            ['Featured', 'isFeatured'],
            ['Verified', 'isVerified'],
          ] as const).map(([label, key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <ToggleCell
                label={label}
                checked={Boolean(form[key])}
                onChange={(v) => set(key, v)}
              />
              <span className="text-sm text-ink-700">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary !py-2 text-xs">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminSchools() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [published, setPublished] = useState('');
  const [editing, setEditing] = useState<Partial<School> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  const debounced = useDebounced(search);
  const { data: facets } = useAsync(() => getFilterFacets(), []);
  const { data, loading, error, reload } = useAsync(
    () =>
      adminListSchools({
        search: debounced || undefined,
        countries: country ? [country] : undefined,
        published: published === '' ? undefined : published === 'true',
        sort: 'name',
      }),
    [debounced, country, published, version],
  );

  const refresh = () => setVersion((v) => v + 1);

  const patch = async (id: string, p: Partial<School>, label: string) => {
    try {
      await updateSchool(id, p);
      toast(label);
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search schools…" /></div>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="field sm:w-44" aria-label="Country">
          <option value="">All countries</option>
          {(facets?.countries ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={published} onChange={(e) => setPublished(e.target.value)} className="field sm:w-40" aria-label="Published">
          <option value="">Any status</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <button onClick={() => setEditing({})} className="btn-primary !py-2 text-xs">Add school</button>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-4 py-2.5">
          <span className="text-xs font-medium text-accent-900">{selected.length} selected</span>
          {([['Publish', true], ['Unpublish', false]] as const).map(([label, value]) => (
            <button
              key={label}
              onClick={async () => {
                await bulkUpdateSchools(selected, { isPublished: value });
                toast(`${selected.length} schools ${label.toLowerCase()}ed`);
                setSelected([]); refresh();
              }}
              className="btn-secondary !py-1.5 text-2xs"
            >
              {label} selected
            </button>
          ))}
          <button onClick={() => setSelected([])} className="ml-auto text-2xs text-accent-800 hover:underline">Clear</button>
        </div>
      )}

      {loading && <LoadingState rows={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && (data ?? []).length === 0 && (
        <EmptyState title="No schools" description="Add your first school, or run the import script." />
      )}

      {(data ?? []).length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-ink-200 bg-ink-50/60 text-left">
              <tr className="label-caps">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5">School</th>
                <th className="px-3 py-2.5">Country</th>
                <th className="px-3 py-2.5">Published</th>
                <th className="px-3 py-2.5">Featured</th>
                <th className="px-3 py-2.5">Verified</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(data ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-ink-50/50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox" checked={selected.includes(s.id)}
                      aria-label={`Select ${s.name}`}
                      onChange={() => setSelected((sel) =>
                        sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id])}
                      className="h-3.5 w-3.5 rounded border-ink-300 text-accent-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink-900">{s.name}</p>
                    <p className="text-2xs text-ink-500">{s.city}</p>
                  </td>
                  <td className="px-3 py-2 text-ink-600">{s.country}</td>
                  <td className="px-3 py-2">
                    <ToggleCell label={`Publish ${s.name}`} checked={s.isPublished}
                      onChange={(v) => patch(s.id, { isPublished: v }, v ? 'Published' : 'Unpublished')} />
                  </td>
                  <td className="px-3 py-2">
                    <ToggleCell label={`Feature ${s.name}`} checked={s.isFeatured}
                      onChange={(v) => patch(s.id, { isFeatured: v }, 'Updated')} />
                  </td>
                  <td className="px-3 py-2">
                    <ToggleCell label={`Verify ${s.name}`} checked={s.isVerified}
                      onChange={(v) => patch(s.id, { isVerified: v }, 'Updated')} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button onClick={() => setEditing(s)} className="text-2xs font-medium text-accent-700 hover:underline">Edit</button>
                    <a href={`/schools/${s.slug}`} target="_blank" rel="noreferrer"
                      className="ml-3 text-2xs font-medium text-ink-500 hover:underline">View</a>
                    <button onClick={() => setConfirmDelete(s)} className="ml-3 text-2xs font-medium text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SchoolEditor school={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete school?"
        message={`This permanently deletes ${confirmDelete?.name} along with its programmes, cycles and rounds. Consider unpublishing instead.`}
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          try {
            await deleteSchool(confirmDelete!.id);
            toast('School deleted');
            refresh();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Delete failed', 'error');
          } finally {
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
}

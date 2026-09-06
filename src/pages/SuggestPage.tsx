import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { getSchools } from '../lib/queries/public';
import { useSeo } from '../lib/seo';
import { breadcrumbSchema } from '../lib/structuredData';

const SUGGEST_JSONLD = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Suggest an update', path: '/suggest' },
  ]),
];

/**
 * Public correction form. Anonymous users may INSERT a PENDING suggestion
 * (enforced by RLS) but can never read or approve them.
 */
export default function SuggestPage() {
  const { data: schools } = useAsync(() => getSchools(), []);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) {
      setError('Suggestions require a database connection, which is not configured.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('suggestions').insert({
        school_id: fd.get('schoolId') || null,
        field_name: String(fd.get('fieldName') || '') || null,
        issue: String(fd.get('issue')),
        suggested_value: String(fd.get('suggestedValue') || '') || null,
        source_url: String(fd.get('sourceUrl') || '') || null,
        notes: String(fd.get('notes') || '') || null,
        email: String(fd.get('email') || '') || null,
        status: 'PENDING',
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Declared before the `sent` early return: hooks must run in the same order
  // on every render, and a return above this would skip it.
  useSeo({
    title: 'Suggest a Deadline Correction',
    description:
      'Spotted a missing or out-of-date MBA deadline? Send the official admissions page it appears on and an editor will verify it against the source.',
    path: '/suggest',
    jsonLd: SUGGEST_JSONLD,
  });

  if (sent) {
    return (
      <div className="container-page py-20">
        <div className="surface mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Thank you</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            Your suggestion has been submitted for review. An editor will check it
            against the school&rsquo;s official source before anything changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-xl">
        <p className="label-caps">Help us stay accurate</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
          Suggest a correction
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Found a deadline that doesn&rsquo;t match the school&rsquo;s official page?
          Tell us. Including an official source URL makes verification much faster.
        </p>

        <form onSubmit={submit} className="surface mt-8 space-y-4 p-6">
          <label className="block">
            <span className="label-caps">School</span>
            <select name="schoolId" className="field mt-1.5">
              <option value="">Not specific to one school</option>
              {(schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="label-caps">Which field?</span>
            <input name="fieldName" placeholder="e.g. Round 1 deadline" className="field mt-1.5" />
          </label>

          <label className="block">
            <span className="label-caps">What is wrong? *</span>
            <textarea name="issue" required rows={3} maxLength={2000}
              placeholder="Describe the problem…" className="field mt-1.5" />
          </label>

          <label className="block">
            <span className="label-caps">Suggested value</span>
            <input name="suggestedValue" placeholder="e.g. September 18, 2026" className="field mt-1.5" />
          </label>

          <label className="block">
            <span className="label-caps">Official source URL</span>
            <input name="sourceUrl" type="url" placeholder="https://school.edu/mba/deadlines"
              className="field mt-1.5" />
            <span className="mt-1 block text-2xs text-ink-500">
              Must be the school&rsquo;s own site — we don&rsquo;t use forums or aggregators as canonical sources.
            </span>
          </label>

          <label className="block">
            <span className="label-caps">Additional notes</span>
            <textarea name="notes" rows={2} className="field mt-1.5" />
          </label>

          <label className="block">
            <span className="label-caps">Your email (optional)</span>
            <input name="email" type="email" className="field mt-1.5" />
          </label>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Submitting…' : 'Submit suggestion'}
          </button>
        </form>
      </div>
    </div>
  );
}

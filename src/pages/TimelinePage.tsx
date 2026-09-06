import { useMemo, useState } from 'react';
import { useAsync } from '../lib/useAsync';
import { getDeadlines, getSchools } from '../lib/queries/public';
import { countdownLabel, daysUntil, formatDateShort, parseDate } from '../lib/dates';
import { EmptyState } from '../components/States';
import { VerificationBadge } from '../components/VerificationBadge';
import { verificationState } from '../lib/dates';
import type { DeadlineRow } from '../lib/types';

/**
 * Timeline built from whatever rounds exist — any number, any names.
 * Desktop renders a proportional horizontal track; mobile renders a vertical
 * list, rather than a shrunken version of the desktop chart.
 */
export default function TimelinePage() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const { data: schools } = useAsync(() => getSchools(), []);
  const { data: rows } = useAsync(() => getDeadlines({ includePast: true }), []);

  const selectedIds = useMemo(
    () => (schools ?? []).filter((s) => slugs.includes(s.slug)).map((s) => s.id),
    [schools, slugs],
  );

  const visible = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => selectedIds.includes(r.schoolId) && r.deadline)
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [rows, selectedIds],
  );

  /** Scale the track to the actual span of the selected deadlines. */
  const bounds = useMemo(() => {
    if (visible.length === 0) return null;
    const times = visible.map((r) => parseDate(r.deadline)!.getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const pad = Math.max((max - min) * 0.06, 5 * 86_400_000);
    return { min: min - pad, max: max + pad };
  }, [visible]);

  const pct = (iso: string) => {
    if (!bounds) return 0;
    const t = parseDate(iso)!.getTime();
    return ((t - bounds.min) / (bounds.max - bounds.min)) * 100;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, DeadlineRow[]>();
    for (const r of visible) {
      const key = `${r.schoolName} · ${r.programName}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <p className="label-caps">Plan ahead</p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Timeline
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Select programmes to see their announced rounds laid out in time.
          Rounds without an announced date are listed separately rather than guessed at.
        </p>
      </header>

      <div className="surface mt-8 p-5">
        <p className="label-caps mb-3">Select schools</p>
        <div className="flex flex-wrap gap-2">
          {(schools ?? []).map((s) => {
            const on = slugs.includes(s.slug);
            return (
              <button
                key={s.id}
                onClick={() =>
                  setSlugs(on ? slugs.filter((x) => x !== s.slug) : [...slugs, s.slug])
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400'
                }`}
              >
                {s.shortName ?? s.name}
              </button>
            );
          })}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No timeline yet"
            description="Select at least one school with an announced deadline."
          />
        </div>
      ) : (
        <>
          {/* Desktop: proportional horizontal track */}
          <div className="mt-8 hidden lg:block">
            <div className="surface overflow-hidden p-6">
              {grouped.map(([label, items]) => (
                <div key={label} className="border-t border-ink-100 py-6 first:border-t-0 first:pt-0">
                  <p className="mb-4 text-sm font-semibold text-ink-900">{label}</p>
                  <div className="relative h-16">
                    <div className="absolute inset-x-0 top-6 h-px bg-ink-200" />
                    {items.map((r) => (
                      <div
                        key={r.roundId}
                        className="group absolute top-0 -translate-x-1/2"
                        style={{ left: `${pct(r.deadline!)}%` }}
                      >
                        <div className="flex flex-col items-center">
                          <span className="whitespace-nowrap text-2xs font-medium text-ink-700">
                            {r.roundName}
                          </span>
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-sand ${
                              (daysUntil(r.deadline) ?? 0) < 0 ? 'bg-ink-300' : 'bg-accent-500'
                            }`}
                          />
                          <span className="mt-1.5 whitespace-nowrap text-2xs text-ink-500">
                            {formatDateShort(r.deadline)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="mt-8 lg:hidden">
            {grouped.map(([label, items]) => (
              <div key={label} className="surface mb-4 p-5">
                <p className="mb-4 text-sm font-semibold text-ink-900">{label}</p>
                <ol className="relative border-l border-ink-200 pl-5">
                  {items.map((r) => (
                    <li key={r.roundId} className="relative pb-5 last:pb-0">
                      <span
                        className={`absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                          (daysUntil(r.deadline) ?? 0) < 0 ? 'bg-ink-300' : 'bg-accent-500'
                        }`}
                      />
                      <p className="text-sm font-medium text-ink-900">{r.roundName}</p>
                      <p className="text-sm text-ink-700">{formatDateShort(r.deadline)}</p>
                      <p className="text-2xs text-ink-500">{countdownLabel(r.deadline)}</p>
                      <div className="mt-1.5">
                        <VerificationBadge state={verificationState(r)} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

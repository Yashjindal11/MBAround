import { useState } from 'react';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden
      >
        <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field pl-9"
      />
    </div>
  );
}

/**
 * A multi-select filter whose options come from the database.
 * No option list is ever hardcoded in the UI.
 */
export function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;
  const visible = expanded ? options : options.slice(0, 6);

  return (
    <fieldset className="border-t border-ink-100 py-4 first:border-t-0 first:pt-0">
      <legend className="label-caps mb-2.5">{label}</legend>
      <div className="space-y-1.5">
        {visible.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-accent-600 focus:ring-accent-500"
            />
            <span className="truncate">{opt}</span>
          </label>
        ))}
      </div>
      {options.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-2xs font-medium text-accent-700 hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${options.length}`}
        </button>
      )}
    </fieldset>
  );
}

/** Desktop sidebar / mobile drawer wrapper for a set of filters. */
export function FilterBar({
  children,
  activeCount,
  onClear,
}: {
  children: React.ReactNode;
  activeCount: number;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-full lg:hidden"
        aria-haspopup="dialog"
      >
        Filters{activeCount > 0 && ` (${activeCount})`}
      </button>

      <aside className="hidden lg:block">
        <div className="surface sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Filters</h2>
            {activeCount > 0 && (
              <button onClick={onClear} className="text-2xs font-medium text-accent-700 hover:underline">
                Clear all
              </button>
            )}
          </div>
          {children}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              <div className="flex items-center gap-3">
                {activeCount > 0 && (
                  <button onClick={onClear} className="text-xs font-medium text-accent-700">
                    Clear all
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="btn-ghost !p-1.5" aria-label="Close filters">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            {children}
            <button onClick={() => setOpen(false)} className="btn-primary mt-5 w-full">
              Show results
            </button>
          </div>
        </div>
      )}
    </>
  );
}

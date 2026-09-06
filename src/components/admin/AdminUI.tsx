import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';

/* --------------------------------------------------------------- toasts */

interface Toast { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<((m: string, t?: 'success' | 'error') => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const push = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = next.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fade-up rounded-lg px-4 py-2.5 text-sm font-medium shadow-lift ${
              t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-ink-900 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/* -------------------------------------------------------- confirm dialog */

/** Destructive actions always require explicit confirmation. */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onCancel} />
      <div className="surface relative w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary !py-2 text-xs">Cancel</button>
          <button
            onClick={onConfirm}
            className="btn !bg-red-600 !px-4 !py-2 text-xs text-white hover:!bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- inline editor */

/**
 * Click-to-edit cell used in admin tables. Enter saves, Escape cancels.
 * Keeps "find the school, change the date, done" to three interactions.
 */
export function InlineEditor({
  value, type = 'text', placeholder = '—', onSave, ariaLabel,
}: {
  value: string | null;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
  ariaLabel: string;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Block bodies: a concise arrow returns its expression's value, which React
  // would misinterpret as an effect cleanup function.
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const nextValue = draft.trim() === '' ? null : draft.trim();
    if (nextValue === value) { setEditing(false); return; }
    setBusy(true);
    try {
      await onSave(nextValue);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        aria-label={`Edit ${ariaLabel}`}
        className="w-full rounded px-1.5 py-1 text-left text-sm hover:bg-ink-100"
      >
        {value ? (
          <span className="text-ink-900">{value}</span>
        ) : (
          <span className="text-ink-400">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      disabled={busy}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); void commit(); }
        if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); }
      }}
      className="field !py-1 !text-sm"
    />
  );
}

/* -------------------------------------------------------------- toggles */

export function ToggleCell({
  checked, onChange, label,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-accent-600' : 'bg-ink-300'
      }`}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.15rem]'
        }`}
      />
    </button>
  );
}

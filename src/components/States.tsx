import type { ReactNode } from 'react';

export function LoadingState({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-xl border border-ink-200/70 bg-white p-5"
        >
          <div className="h-3 w-1/3 rounded bg-ink-100" />
          <div className="mt-3 h-3 w-1/2 rounded bg-ink-100" />
          <div className="mt-3 h-3 w-1/4 rounded bg-ink-100" />
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink-50 to-transparent" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          {/* currentColor, not a hex literal: a fixed grey would stay dark-on-dark
              once the theme flips and the icon would vanish. */}
          <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    // role="alert" so the failure is announced rather than silently replacing
    // content a screen-reader user was already reading. Danger colours use the
    // dark: variant because Tailwind's red-50/red-900 are fixed values and do
    // not participate in the CSS-variable theme.
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/50 dark:bg-red-950/40"
    >
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
        Something went wrong
      </h3>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-3 !py-1.5 text-xs">
          Try again
        </button>
      )}
    </div>
  );
}

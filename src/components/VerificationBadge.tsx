import type { ReactNode } from 'react';
import { verificationState } from '../lib/dates';
import { formatRelativeVerified } from '../lib/dates';
import type { VerificationState } from '../lib/types';

const STYLES: Record<
  VerificationState,
  { label: string; className: string; dot: string }
> = {
  VERIFIED: {
    label: 'Verified',
    className: 'bg-accent-50 text-accent-700 border-accent-200',
    dot: 'bg-accent-500',
  },  NEEDS_REVIEW: {
    label: 'Needs review',
    // amber-* are fixed Tailwind values outside the CSS-variable theme, so the
    // dark variants are explicit. This badge marks unverified data, so it has
    // to stay legible in both themes - a warning nobody can read is no warning.
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50',
    dot: 'bg-amber-500',
  },
  NOT_ANNOUNCED: {
    label: 'Not announced',
    className: 'bg-ink-100 text-ink-600 border-ink-200',
    dot: 'bg-ink-400',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    className: 'bg-ink-100 text-ink-600 border-ink-200',
    dot: 'bg-ink-400',
  },
};

/**
 * Communicates how much we trust a piece of data. Missing information is
 * always shown honestly rather than hidden or invented.
 */
export function VerificationBadge({
  state,
  className = '',
}: {
  state: VerificationState;
  className?: string;
}) {
  const style = STYLES[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium ${style.className} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

export interface SourceLike {
  deadline: string | null;
  isAnnounced: boolean;
  isVerified: boolean;
  sourceUrl: string | null;
  sourceName: string | null;
  lastVerified: string | null;
}

/** Badge + official-source link + last-verified line for a round. */
export function ProvenanceLine({
  record,
  children,
}: {
  record: SourceLike;
  children?: ReactNode;
}) {
  const state = verificationState(record);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-ink-500">
      <VerificationBadge state={state} />
      {record.sourceUrl ? (
        <a
          href={record.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-ink-600 underline decoration-ink-300 underline-offset-2 hover:text-accent-700 hover:decoration-accent-400"
        >
          {record.sourceName ?? 'Official source'} →
        </a>
      ) : (
        <span className="text-ink-400">No official source recorded</span>
      )}
      {record.lastVerified && (
        <span>{formatRelativeVerified(record.lastVerified)}</span>
      )}
      {children}
    </div>
  );
}

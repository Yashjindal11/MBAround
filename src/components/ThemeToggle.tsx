import { useTheme, type ThemePreference } from '../lib/theme';

/**
 * A three-way segmented control rather than a two-state switch, because
 * "follow my system" is a distinct preference from "always light". A toggle
 * would force users to abandon system-following the first time they touched
 * it, and give them no way back.
 */

const OPTIONS: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="10" cy="10" r="3.6" />
        <path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3" />
      </>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <>
        <rect x="2.6" y="3.6" width="14.8" height="10" rx="1.6" />
        <path d="M7.2 16.4h5.6" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <path d="M16 11.4A6.6 6.6 0 0 1 8.6 4a6.6 6.6 0 1 0 7.4 7.4Z" />,
  },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-white p-0.5 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            // The visible label is an icon, so the accessible name has to come
            // from here or the control is unusable with a screen reader.
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setPreference(opt.value)}
            className={`rounded-md p-1.5 transition-colors ${
              active
                ? 'bg-ink-100 text-ink-900'
                : 'text-ink-500 hover:bg-ink-100/60 hover:text-ink-800'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {opt.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

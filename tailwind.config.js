/** @type {import('tailwindcss').Config} */

/**
 * Colours resolve through CSS variables holding raw RGB channels, so a single
 * `.dark` class on <html> re-themes the whole product. The alternative -
 * adding `dark:` variants beside ~240 existing colour classes - would mean
 * every future component could silently forget one and break only in dark
 * mode. Here there is nothing to forget: `bg-white` and `text-ink-900` are
 * already theme-aware.
 *
 * The <alpha-value> placeholder keeps opacity modifiers (`border-ink-200/70`)
 * working, which plain `var(--x)` colours would otherwise break.
 */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

const inkScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
    n,
    withAlpha(`--ink-${n}`),
  ]),
);
const accentScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
    n,
    withAlpha(`--accent-${n}`),
  ]),
);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: inkScale,
        accent: accentScale,
        sand: withAlpha('--sand'),
        // Overridden deliberately: `bg-white` reads as "the raised surface
        // colour" throughout this codebase, which in dark mode is a light
        // panel, not #fff.
        white: withAlpha('--surface'),
        canvas: withAlpha('--sand'),
      },
fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Source Serif 4', 'Charter', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,19,25,0.04), 0 1px 3px rgba(15,19,25,0.06)',
        lift: '0 4px 12px -2px rgba(15,19,25,0.08), 0 2px 6px -2px rgba(15,19,25,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.2,0.7,0.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

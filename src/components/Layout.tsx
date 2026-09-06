import { NavLink, Link } from 'react-router-dom';
import { useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/deadlines', label: 'Deadlines' },
  { to: '/schools', label: 'Schools' },
  { to: '/compare', label: 'Compare' },
  { to: '/timeline', label: 'Timeline' },
];

function Wordmark() {
  return (
    <Link to="/" className="group flex items-center gap-2">
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-[1.5px] border-ink-900" />
        <span className="absolute h-2 w-2 -translate-y-[9px] rounded-full bg-accent-500 transition-transform duration-500 group-hover:rotate-[360deg]" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-ink-900">
        MBAround
      </span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-sand/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink-100 text-ink-900'
                    : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/admin" className="hidden text-sm font-medium text-ink-600 hover:text-ink-900 sm:block">
            Sign in
          </Link>
          <button
            className="btn-ghost md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d={open ? 'M5 5l10 10M15 5L5 15' : 'M3 6h14M3 10h14M3 14h14'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-ink-200/70 bg-sand px-5 py-3 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-ink-100 text-ink-900' : 'text-ink-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600"
          >
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-200/70 bg-white">
      <div className="container-page py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Application deadlines are collected from official school admissions
              pages. Where a school has not published a date, we say so rather
              than guess.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-2">
            {[
              { to: '/about', label: 'About' },
              { to: '/data-sources', label: 'Data sources' },
              { to: '/suggest', label: 'Suggest a correction' },
              { to: '/privacy', label: 'Privacy' },
              { to: '/terms', label: 'Terms' },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-ink-600 transition-colors hover:text-ink-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-ink-100 pt-6 text-2xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MBAround. Not affiliated with any school.</p>
          <p>MBAround does not publish its own ranking.</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Shown when no Supabase project is connected. There is deliberately no
 * placeholder-data fallback behind this: an unconfigured build shows an error,
 * not invented deadlines.
 */
export function ConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-2xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      Supabase is not connected — no school data can be loaded.
    </div>
  );
}

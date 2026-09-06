import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/schools', label: 'Schools' },
  { to: '/admin/programs', label: 'Programs' },
  { to: '/admin/cycles', label: 'Cycles' },
  { to: '/admin/rounds', label: 'Rounds' },
  { to: '/admin/suggestions', label: 'Suggestions' },
  { to: '/admin/audit', label: 'Audit Log' },
];

/**
 * Extracts an OAuth failure from a callback URL's query string and fragment.
 *
 * Exported for testing: the fragment case in particular is easy to get wrong
 * and impossible to notice, because the symptom is a sign-in form that looks
 * completely normal.
 */
export function parseOAuthError(search: string, hash: string): string | null {
  const q = new URLSearchParams(search.replace(/^\?/, ''));
  // Implicit-flow errors arrive in the fragment, not the query string.
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const code = q.get('error') ?? h.get('error');
  if (!code) return null;
  const description = q.get('error_description') ?? h.get('error_description');
  // URLSearchParams decodes %20 but leaves '+' alone, and Supabase encodes
  // spaces as '+' here.
  return (description ?? code).replace(/\+/g, ' ');
}

/**
 * Reads an OAuth failure out of the callback URL.
 *
 * A failed OAuth round-trip redirects back to /admin with the reason in the
 * query string or the hash fragment, then the app renders a plain sign-in form
 * as though nothing happened. Without this the most common setup mistakes -
 * an unlisted redirect URI, a disabled provider - are completely silent.
 */
function useOAuthError(): string | null {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const found = parseOAuthError(window.location.search, window.location.hash);
    if (!found) return;
    setError(found);
    // Clear it so a reload does not resurrect a stale error.
    window.history.replaceState({}, '', window.location.pathname);
  }, []);
  return error;
}

function SignIn() {
  const { signInWithGoogle, signInWithEmail, signInWithPassword, googleEnabled } = useAuth();
  const oauthError = useOAuthError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Password is the default because the project-wide auth mail rate limit
  // makes magic links unreliable, and hitting it locks you out of the admin
  // panel entirely rather than just delaying you.
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="surface w-full max-w-sm p-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>        <p className="mt-2 text-sm text-ink-500">
          MBAround content management. Access is granted per-user in the database.
        </p>

        {/* Only offered when the project really has the provider enabled.
            Showing it otherwise sends the user to "Unsupported provider",
            which reads as an application bug rather than a missing setting. */}
        {googleEnabled !== false && (
          <>
            <button
              onClick={() => run(signInWithGoogle)}
              disabled={busy || googleEnabled === null}
              className="btn-secondary mt-6 w-full"
            >
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-2xs text-ink-400">
              <span className="h-px flex-1 bg-ink-200" /> or{' '}
              <span className="h-px flex-1 bg-ink-200" />
            </div>
          </>
        )}

        {sent ? (
          <p className="rounded-lg bg-accent-50 px-3 py-2.5 text-sm text-accent-800">
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (mode === 'password') {
                  await signInWithPassword(email, password);
                } else {
                  await signInWithEmail(email);
                  setSent(true);
                }
              });
            }}
          >
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field"
            />
            {mode === 'password' && (
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="field mt-3"
              />
            )}
            <button type="submit" disabled={busy} className="btn-primary mt-3 w-full">
              {mode === 'password' ? 'Sign in' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        {!sent && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'password' ? 'link' : 'password');
              setError(null);
            }}
            className="mt-4 w-full text-center text-2xs text-ink-500 hover:text-ink-900"
          >
            {mode === 'password'
              ? 'Use an email sign-in link instead'
              : 'Sign in with a password instead'}
          </button>
        )}        {error && (
          <p role="alert" className="mt-4 text-xs text-red-600 dark:text-red-400">
            {error}
            {/* The rate limit is per project, not per address, so retrying
                with a different email fails identically. */}
            {error.toLowerCase().includes('rate limit') && (
              <span className="mt-1 block text-ink-500">
                This limit applies to the whole project. Use password sign-in instead.
              </span>
            )}
          </p>
        )}        {oauthError && !error && (
          <p role="alert" className="mt-4 text-xs text-red-600 dark:text-red-400">
            Google sign-in failed: {oauthError}
            <span className="mt-1 block text-ink-500">
              {/* "not enabled" comes from Supabase before Google is contacted,
                  so pointing at redirect URLs would send the reader to the
                  wrong dashboard entirely. */}
              {oauthError.toLowerCase().includes('not enabled')
                ? 'Enable the Google provider in Supabase → Authentication → Providers.'
                : `Check that ${window.location.origin}/admin is listed as a redirect URL in Supabase.`}
            </span>
          </p>
        )}

        <Link to="/" className="mt-6 block text-center text-2xs text-ink-500 hover:text-ink-900">
          ← Back to MBAround
        </Link>
      </div>
    </div>
  );
}

function NotAuthorised() {
  const { user, signOut } = useAuth();
  const provider = user?.app_metadata?.provider ?? 'unknown';
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="surface w-full max-w-md p-7 text-center">
        <h1 className="font-display text-xl font-semibold">Not authorised</h1>
        <p className="mt-2 text-sm text-ink-600">
          You are signed in as <strong>{user?.email}</strong> via {provider}, but
          this account has no MBAround admin role.
        </p>
        <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2.5 text-left text-2xs leading-relaxed text-ink-600 dark:bg-ink-100">
          A super admin must add this user ID to the <code>admin_users</code> table.
          Signing in with Google alone does not grant access.
        </p>
        {/* The ID is shown because the grant is keyed on it, and looking it up
            otherwise means digging through the Supabase dashboard. Signing in
            with a different provider creates a different ID, so an account that
            was granted access under one provider is not authorised under
            another - showing both makes that mismatch visible. */}
        <code className="mt-2 block select-all break-all rounded-lg bg-ink-100 px-3 py-2 text-left text-2xs text-ink-700">
          {user?.id}
        </code>
        <button onClick={signOut} className="btn-secondary mt-5 w-full">Sign out</button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, role, loading, isEditor, signOut } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return (
      <div className="container-page flex min-h-[70vh] items-center justify-center">
        <div className="surface max-w-md p-7">
          <h1 className="font-display text-xl font-semibold">Supabase not connected</h1>
          <p className="mt-2 text-sm text-ink-600">
            The admin panel writes to the database, so it needs a live connection.
            Copy <code>.env.example</code> to <code>.env</code>, add your project URL
            and anon key, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container-page py-20 text-sm text-ink-500">Loading…</div>;
  }
  if (!user) return <SignIn />;
  if (!isEditor) return <NotAuthorised />;

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            MBAround admin
          </h1>
          <p className="mt-0.5 text-2xs text-ink-500">
            {user.email} · {role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost text-xs">View site</Link>
          <button onClick={signOut} className="btn-secondary !py-2 text-xs">Sign out</button>
        </div>
      </div>

      <nav className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
        {ADMIN_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div key={location.pathname}>
        <Outlet />
      </div>
    </div>
  );
}

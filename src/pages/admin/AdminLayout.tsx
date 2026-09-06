import { useState } from 'react';
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

function SignIn() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
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
        <h1 className="font-display text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm text-ink-500">
          MBAround content management. Access is granted per-user in the database.
        </p>

        <button
          onClick={() => run(signInWithGoogle)}
          disabled={busy}
          className="btn-secondary mt-6 w-full"
        >
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-2xs text-ink-400">
          <span className="h-px flex-1 bg-ink-200" /> or <span className="h-px flex-1 bg-ink-200" />
        </div>

        {sent ? (
          <p className="rounded-lg bg-accent-50 px-3 py-2.5 text-sm text-accent-800">
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await signInWithEmail(email);
                setSent(true);
              });
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field"
            />
            <button type="submit" disabled={busy} className="btn-primary mt-3 w-full">
              Email me a sign-in link
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-xs text-red-600">{error}</p>}

        <Link to="/" className="mt-6 block text-center text-2xs text-ink-500 hover:text-ink-900">
          ← Back to MBAround
        </Link>
      </div>
    </div>
  );
}

function NotAuthorised() {
  const { user, signOut } = useAuth();
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <div className="surface w-full max-w-md p-7 text-center">
        <h1 className="font-display text-xl font-semibold">Not authorised</h1>
        <p className="mt-2 text-sm text-ink-600">
          You are signed in as <strong>{user?.email}</strong>, but this account has
          no MBAround admin role.
        </p>
        <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2.5 text-left text-2xs leading-relaxed text-ink-600">
          A super admin must add your user ID to the <code>admin_users</code> table.
          Signing in with Google alone does not grant access.
        </p>
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

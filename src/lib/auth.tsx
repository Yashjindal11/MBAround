import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import type { AdminRole } from './types';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AdminRole | null;
  loading: boolean;
  /** True only when the DB confirms a row in `admin_users`. */
  isEditor: boolean;  isAdmin: boolean;
  isSuperAdmin: boolean;
  /**
   * Whether the Google provider is actually enabled on the Supabase project.
   *
   * Null while unknown. Offering a button that redirects straight to
   * "Unsupported provider: provider is not enabled" is worse than not offering
   * it, because the failure looks like a bug in the app rather than a setting
   * that was never switched on.
   */
  googleEnabled: boolean | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  /**
   * Password sign-in. Sends no email, so it is unaffected by the project-wide
   * auth mail rate limit that makes magic links unusable during development.
   * Requires the email provider to have password sign-in enabled.
   */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  // Supabase publishes which providers are enabled on an anon-readable
  // endpoint, so the UI can reflect the project's real configuration instead
  // of advertising a provider that will reject the redirect.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    let active = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active) setGoogleEnabled(j?.external?.google ?? false);
      })
      // A failed probe must not hide a working button, so leave it unknown.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  // The role always comes from the database. A Google login on its own grants
  // nothing — the user must have a row in `admin_users`.
  //
  // Keyed on the user id alone (not the whole session) so that background token
  // refreshes, which produce a new session object for the same user, don't
  // trigger a redundant role re-fetch.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) {
      setRole(null);
      return;
    }
    let active = true;
    supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setRole((data?.role as AdminRole) ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<AuthState>(() => {
    const redirectTo = `${window.location.origin}/admin`;
    return {
      user: session?.user ?? null,
      session,
      role,
      loading,
      isEditor: role !== null,
      isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
      isSuperAdmin: role === 'SUPER_ADMIN',
      googleEnabled,
      signInWithGoogle: async () => {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (error) throw error;
      },
      signInWithEmail: async (email: string) => {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
      },
      signInWithPassword: async (email: string, password: string) => {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setRole(null);
      },
    };
  }, [session, role, loading, googleEnabled]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

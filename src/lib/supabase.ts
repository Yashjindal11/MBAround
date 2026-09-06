import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when real Supabase credentials are configured.
 *
 * When false the data-access layer falls back to the local development
 * fixture (`src/lib/queries/fixture.ts`) so the UI can be built and reviewed
 * before a Supabase project is connected. The fixture is dev-only scaffolding
 * and is never the source of truth in production.
 */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('your-project-ref'),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Narrowing helper for query modules that require a live connection. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and set ' +
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

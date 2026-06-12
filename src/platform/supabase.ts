// Supabase client, created lazily from public env vars (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY). When those aren't set the whole backend layer stays
// dormant and the app keeps using the local mock — so the platform runs with or
// without a server, and wiring the real backend is just dropping keys into .env.
//
// The anon key is meant to be public; security is enforced server-side by
// Row-Level Security policies (see supabase/schema.sql) and the score-validation
// Edge Function. The service_role key must NEVER reach the frontend.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function isConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function supabase(): SupabaseClient {
  if (!client) {
    if (!isConfigured()) throw new Error('Supabase is not configured (missing VITE_SUPABASE_* env vars)');
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

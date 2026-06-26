// @ts-nocheck — Deno Edge Function (Supabase).
//
// subscribe — server-authoritative subscription activation / cancellation.
//   { period, method }  → activates a Daily/Weekly/Monthly plan. The server
//                         computes the expiry and applies the one-time free trial
//                         (+1 day) only if the player has never used it.
//   { cancel: true }    → expires the player's active subscription now.
//
// Like buy-coins, the airtime/TeleBirr charge is the operator's billing rail;
// this records the entitlement server-side (the single source of truth). Returns
// the created subscription row.
//
// Deploy: supabase functions deploy subscribe

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Mirrors src/platform/subscription.ts SUB_PLANS (access length per plan, days).
const PLAN_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { period?: string; method?: string; cancel?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- cancel: expire the active subscription now ---
  if (body.cancel) {
    const nowIso = new Date().toISOString();
    await admin.from('subscriptions')
      .update({ expires_at: nowIso })
      .eq('user_id', user.id).gt('expires_at', nowIso);
    return json({ ok: true });
  }

  // --- activate a plan ---
  const period = String(body.period ?? '');
  const days = PLAN_DAYS[period];
  if (!days) return json({ error: 'unknown plan' }, 400);
  const method = body.method === 'topup' ? 'topup' : 'telebirr';

  // One-time trial: granted only if the player has never claimed it.
  const { data: priorTrial } = await admin
    .from('subscriptions').select('id').eq('user_id', user.id).eq('trial', true).limit(1);
  const trial = (priorTrial ?? []).length === 0;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + (days + (trial ? 1 : 0)) * 864e5);

  const { data, error } = await admin.from('subscriptions').insert({
    user_id: user.id, period, method,
    started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString(), trial,
  }).select('period, method, started_at, expires_at, trial').single();
  if (error) return json({ error: error.message }, 500);

  return json({ subscription: data });
});

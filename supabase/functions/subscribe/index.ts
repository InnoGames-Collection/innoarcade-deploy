// @ts-nocheck — Deno Edge Function (Supabase).
//
// subscribe — activation only (demo free-grant or portal pending CTA).
//
// When PORTAL_ENABLED=true:
//   { period, method } → does NOT free-grant. Returns pending; tell user to text OK.
//   Entitlement arrives on portal subscription webhook (OpenAPI).
//
// Cancel is NEVER in-app: { cancel: true } → 403. Unsubscribe = STOP / unsubscription.
//
// When PORTAL_ENABLED is unset/false (local/demo only):
//   Legacy free grant for TeleBirr/topup demos.
//
// Deploy: supabase functions deploy subscribe

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  portalEnabled,
  normalizeMsisdn,
  shortcodeHint,
  serviceIdForPeriod,
} from '../_shared/portal.ts';

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
  const phone = normalizeMsisdn(user.phone ?? '');

  if (body.cancel) {
    return json({
      error: 'cancel_via_sms',
      message: `Unsubscribe by texting STOP to ${shortcodeHint()}`,
    }, 403);
  }

  const period = String(body.period ?? '');
  const days = PLAN_DAYS[period];
  if (!days) return json({ error: 'unknown plan' }, 400);
  const method = body.method === 'topup' ? 'topup' : body.method === 'portal' ? 'portal' : 'telebirr';

  if (portalEnabled()) {
    const serviceId = serviceIdForPeriod(period as 'daily' | 'weekly' | 'monthly');
    const hint = shortcodeHint();
    return json({
      pending: true,
      message: `Text OK to ${hint} to activate. Your plan starts after the portal confirms subscription.`,
      period,
      method: 'portal',
      serviceId: serviceId ?? null,
    });
  }

  const { data: priorTrial } = await admin
    .from('subscriptions').select('id').eq('user_id', user.id).eq('trial', true).limit(1);
  const trial = (priorTrial ?? []).length === 0;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + (days + (trial ? 1 : 0)) * 864e5);

  const { data, error } = await admin.from('subscriptions').insert({
    user_id: user.id, period, method,
    started_at: startedAt.toISOString(), expires_at: expiresAt.toISOString(), trial,
    source: 'app',
    msisdn: phone || null,
  }).select('period, method, started_at, expires_at, trial, source').single();
  if (error) return json({ error: error.message }, 500);

  return json({ subscription: data });
});

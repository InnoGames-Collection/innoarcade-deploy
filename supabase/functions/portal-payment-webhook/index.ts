// @ts-nocheck — Deno Edge Function (Supabase).
//
// portal-payment-webhook — Portal → Game charge / renew / fail events (if separate
// from subscription opt-in). Public (no user JWT). Idempotent on event_id.
//
// Stub payload keys:
//   eventId | event_id | id
//   status | result → success|paid|failed|renewed
//   msisdn | phone
//   period | plan
//   coins | coinAmount (optional → credit wallet)
//   subscriptionId | orderId
//
// Deploy: supabase functions deploy portal-payment-webhook

import {
  adminClient, portalCors, portalJson, verifyPortalWebhook, pickString,
  normalizeMsisdn, mapPeriod, recordPortalEvent,
} from '../_shared/portal.ts';

const SUCCESS = new Set(['success', 'paid', 'renewed', 'renew', 'settled', 'ok']);
const FAIL = new Set(['failed', 'fail', 'declined', 'cancelled', 'error']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portalCors });
  if (req.method !== 'POST') return portalJson({ error: 'method not allowed' }, 405);

  // Dormant until a payment OpenAPI exists. Reuses subscription notify HMAC if enabled.
  const raw = await req.text();
  if (!verifyPortalWebhook(req, raw)) {
    return portalJson({ error: 'unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return portalJson({ error: 'bad json' }, 400); }

  const eventId = pickString(body, ['eventId', 'event_id', 'id', 'paymentId'])
    || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const statusRaw = pickString(body, ['status', 'result', 'paymentStatus', 'state']).toLowerCase();
  const msisdn = normalizeMsisdn(pickString(body, ['msisdn', 'phone', 'MSISDN']));
  const externalId = pickString(body, ['subscriptionId', 'subscription_id', 'orderId', 'order_id', 'externalId']) || null;
  const period = mapPeriod(pickString(body, ['period', 'plan', 'offer'])) ?? 'monthly';
  const coins = Number(pickString(body, ['coins', 'coinAmount', 'coin_amount', 'amountCoins']) || 0);

  const ok = SUCCESS.has(statusRaw) || statusRaw.includes('success') || statusRaw.includes('paid');
  const failed = FAIL.has(statusRaw) || statusRaw.includes('fail');

  const admin = adminClient();
  const { inserted } = await recordPortalEvent(
    admin,
    eventId,
    ok ? 'payment.success' : failed ? 'payment.failed' : 'payment.unknown',
    msisdn,
    body,
  );
  if (!inserted) return portalJson({ ok: true, duplicate: true });

  if (!ok) {
    return portalJson({ ok: true, status: 'failed' });
  }

  let userId: string | null = null;
  if (msisdn) {
    const { data } = await admin.rpc('user_id_for_msisdn', { p_msisdn: msisdn });
    userId = data ?? null;
  }

  // Optional coin credit (portal coin packs).
  if (userId && coins > 0) {
    await admin.rpc('apply_coins', {
      p_user: userId,
      p_delta: coins,
      p_reason: 'portal_purchase',
      p_ref: eventId,
    });
  }

  // Renew / activate subscription if we have a user + period.
  if (userId && period) {
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const started = new Date();
    const expires = new Date(started.getTime() + days * 864e5);
    await admin.from('subscriptions').insert({
      user_id: userId,
      period,
      method: 'portal',
      started_at: started.toISOString(),
      expires_at: expires.toISOString(),
      trial: false,
      source: 'portal',
      external_id: externalId,
      msisdn: msisdn || null,
    });
  } else if (!userId && msisdn) {
    // Cold renew → pending entitlement.
    await admin.from('portal_pending_entitlements').insert({
      msisdn,
      period,
      external_id: externalId,
      payload: body,
    });
  }

  return portalJson({ ok: true, status: 'paid', userId, coins: coins || undefined });
});

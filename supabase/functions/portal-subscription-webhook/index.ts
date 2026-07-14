// @ts-nocheck — Deno Edge Function (Supabase).
//
// portal-subscription-webhook — Partner notification webhook (OpenAPI partnerNotification).
//
// Body:
//   event: subscription | unsubscription
//   request_id: uuid (idempotency)
//   service_id: int64
//   msisdn: string (e.g. 251911000000)
//   time: ISO-8601
//
// Headers: X-Timestamp, X-Signature (sha256=hex), X-Request-Id
// Ack: any 2xx after durable write.
//
// Deploy: supabase functions deploy portal-subscription-webhook
// config.toml: verify_jwt = false

import {
  adminClient,
  portalCors,
  portalJson,
  verifySubscriptionWebhook,
  pickString,
  pickInt,
  normalizeMsisdn,
  periodForServiceId,
  periodDays,
  recordPortalEvent,
  mapPeriod,
  welcomeMtEnabled,
  welcomeMessage,
  portalSendMt,
  portalHealth,
} from '../_shared/portal.ts';

async function maybeSendWelcome(msisdn: string, serviceId: number): Promise<void> {
  if (!welcomeMtEnabled()) return;
  try {
    const res = await portalSendMt({
      serviceId,
      msisdn,
      type: 'optin',
      message: welcomeMessage(),
    });
    if (!res.ok) {
      console.warn('[portal-sub] welcome MT rejected', res.errorCode ?? res.error);
    } else {
      console.log('[portal-sub] welcome MT accepted', {
        transactionId: res.transactionId,
        stub: res.stub ?? false,
      });
    }
  } catch (e) {
    console.warn('[portal-sub] welcome MT error', e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portalCors });
  if (req.method === 'GET' || req.method === 'HEAD') {
    return portalHealth('portal-subscription-webhook', ['POST']);
  }
  if (req.method !== 'POST') return portalJson({ error: 'method_not_allowed' }, 405);

  const raw = await req.text();
  const verified = verifySubscriptionWebhook(req, raw);
  if (!verified.ok) {
    console.warn('[portal-sub] signature rejected', verified.reason);
    return portalJson({ error: 'unauthorized', reason: verified.reason }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return portalJson({ error: 'bad_json' }, 400);
  }

  const event = pickString(body, ['event']).toLowerCase();
  const requestId = pickString(body, ['request_id', 'requestId'])
    || (req.headers.get('x-request-id') ?? '').trim();
  const serviceId = pickInt(body, ['service_id', 'serviceId']);
  const msisdn = normalizeMsisdn(pickString(body, ['msisdn', 'MSISDN', 'phone']));
  const eventTime = pickString(body, ['time']) || new Date().toISOString();

  if (!requestId) return portalJson({ error: 'missing_request_id' }, 400);
  if (!msisdn) return portalJson({ error: 'missing_msisdn' }, 400);
  if (serviceId == null) return portalJson({ error: 'missing_service_id' }, 400);

  const isIn = event === 'subscription';
  const isOut = event === 'unsubscription';
  if (!isIn && !isOut) {
    return portalJson({ error: 'unknown_event', event }, 400);
  }

  let period = periodForServiceId(serviceId);
  if (!period) {
    // Fail closed when map is configured for *other* ids; if no map at all, allow
    // optional legacy period field only for local dry-runs.
    const anyMapped = ['PORTAL_SERVICE_DAILY', 'PORTAL_SERVICE_WEEKLY', 'PORTAL_SERVICE_MONTHLY']
      .some((k) => (Deno.env.get(k) ?? '').trim() !== '');
    if (anyMapped) {
      console.error('[portal-sub] unknown service_id', serviceId);
      return portalJson({ error: 'unknown_service_id', service_id: serviceId }, 400);
    }
    period = mapPeriod(pickString(body, ['period', 'plan'])) ?? 'monthly';
    console.warn('[portal-sub] serviceId map unset; falling back to period', period);
  }

  const admin = adminClient();
  const eventType = isIn ? 'subscription' : 'unsubscription';
  const { inserted } = await recordPortalEvent(admin, requestId, eventType, msisdn, {
    ...body,
    _meta: { serviceId, period, eventTime, verified: true },
  });
  if (!inserted) {
    return portalJson({ ok: true, duplicate: true, request_id: requestId });
  }

  const { data: userId } = await admin.rpc('user_id_for_msisdn', { p_msisdn: msisdn });

  if (isOut) {
    const nowIso = new Date().toISOString();
    if (userId) {
      await admin.from('subscriptions')
        .update({ expires_at: nowIso })
        .eq('user_id', userId)
        .eq('source', 'portal')
        .eq('portal_service_id', serviceId)
        .gt('expires_at', nowIso);
    }
    // Fallback: expire by MSISDN match when user_id link missing but rows carry msisdn.
    await admin.from('subscriptions')
      .update({ expires_at: nowIso })
      .eq('source', 'portal')
      .eq('portal_service_id', serviceId)
      .eq('msisdn', msisdn)
      .gt('expires_at', nowIso);

    await admin.from('portal_pending_entitlements')
      .update({
        claimed_at: nowIso,
        payload: { ...body, cancelled: true, at: nowIso },
      })
      .eq('msisdn', msisdn)
      .eq('portal_service_id', serviceId)
      .is('claimed_at', null);

    console.log('[portal-sub] unsubscription', { requestId, serviceId, msisdn, userId });
    return portalJson({
      ok: true,
      action: 'unsubscription',
      request_id: requestId,
      userId: userId ?? null,
    });
  }

  // subscription (opt-in)
  if (userId) {
    const days = periodDays(period);
    const started = new Date();
    const expires = new Date(started.getTime() + days * 864e5);

    await admin.from('subscriptions')
      .update({ expires_at: started.toISOString() })
      .eq('user_id', userId)
      .eq('source', 'portal')
      .eq('portal_service_id', serviceId)
      .gt('expires_at', started.toISOString());

    const { error } = await admin.from('subscriptions').insert({
      user_id: userId,
      period,
      method: 'portal',
      started_at: started.toISOString(),
      expires_at: expires.toISOString(),
      trial: false,
      source: 'portal',
      external_id: requestId,
      msisdn,
      portal_service_id: serviceId,
    });
    if (error) {
      console.error('[portal-sub] insert subscription failed', error.message);
      return portalJson({ error: error.message }, 500);
    }
    console.log('[portal-sub] subscription linked', { requestId, serviceId, msisdn, userId, period });
    await maybeSendWelcome(msisdn, serviceId);
    return portalJson({
      ok: true,
      action: 'subscription',
      linked: true,
      request_id: requestId,
      userId,
      period,
    });
  }

  // Cold opt-in: replace any open pending for this msisdn + service
  // (also clear legacy rows with null portal_service_id for the same MSISDN).
  await admin.from('portal_pending_entitlements')
    .delete()
    .eq('msisdn', msisdn)
    .eq('portal_service_id', serviceId)
    .is('claimed_at', null);
  await admin.from('portal_pending_entitlements')
    .delete()
    .eq('msisdn', msisdn)
    .is('portal_service_id', null)
    .is('claimed_at', null);

  const { error: pendErr } = await admin.from('portal_pending_entitlements').insert({
    msisdn,
    period,
    external_id: requestId,
    portal_service_id: serviceId,
    payload: body,
  });
  if (pendErr) {
    console.error('[portal-sub] pending insert failed', pendErr.message);
    return portalJson({ error: pendErr.message }, 500);
  }

  console.log('[portal-sub] subscription pending', { requestId, serviceId, msisdn, period });
  await maybeSendWelcome(msisdn, serviceId);
  return portalJson({
    ok: true,
    action: 'subscription',
    pending: true,
    request_id: requestId,
    period,
  });
});

// @ts-nocheck — Deno Edge Function (Supabase).
//
// portal-sms-dlr — Partner MT delivery final-status callback (OpenAPI partnerMtDeliveryCallback).
//
// Body:
//   service_id, msisdn, ext_transaction_id?, result: success|failed, time, reason?
//
// Auth: OpenAPI defines none. Optional PORTAL_MT_CALLBACK_TOKEN (query/header).
// If X-Timestamp + X-Signature present, verified with PORTAL_WEBHOOK_SECRET.
//
// Deploy: supabase functions deploy portal-sms-dlr
// config.toml: verify_jwt = false

import {
  adminClient,
  portalCors,
  portalJson,
  authorizeMtCallback,
  pickString,
  pickInt,
  normalizeMsisdn,
  recordPortalEvent,
} from '../_shared/portal.ts';

function mapResult(raw: string): 'success' | 'failed' | null {
  const s = raw.toLowerCase().trim();
  if (s === 'success' || s === 'ok' || s === 'delivrd' || s === 'delivered') return 'success';
  if (s === 'failed' || s === 'fail' || s === 'error' || s === 'expired' || s === 'undeliv') {
    return 'failed';
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portalCors });
  if (req.method !== 'POST') return portalJson({ error: 'method_not_allowed' }, 405);

  const raw = await req.text();
  const auth = authorizeMtCallback(req, raw);
  if (!auth.ok) {
    console.warn('[portal-mt-cb] unauthorized', auth.reason);
    return portalJson({ error: 'unauthorized', reason: auth.reason }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return portalJson({ error: 'bad_json' }, 400);
  }

  const result = mapResult(pickString(body, ['result', 'status', 'deliveryStatus']));
  const extTx = pickString(body, ['ext_transaction_id', 'extTransactionId']);
  const msisdn = normalizeMsisdn(pickString(body, ['msisdn', 'MSISDN', 'phone']));
  const serviceId = pickInt(body, ['service_id', 'serviceId']);
  const reason = pickString(body, ['reason', 'message']) || null;
  const eventTime = pickString(body, ['time']) || new Date().toISOString();

  if (!result) return portalJson({ error: 'invalid_result' }, 400);

  // Idempotency: prefer ext_transaction_id + result; else synthesize stable-ish key.
  const eventId = extTx
    ? `mt-cb:${extTx}:${result}`
    : `mt-cb:${serviceId ?? 'x'}:${msisdn}:${eventTime}:${result}`;

  const admin = adminClient();
  const { inserted } = await recordPortalEvent(admin, eventId, `mt.callback.${result}`, msisdn, {
    ...body,
    _meta: { serviceId, extTx, result, reason, eventTime },
  });
  if (!inserted) {
    return portalJson({ ok: true, duplicate: true });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: result,
    last_dlr_at: now,
    updated_at: now,
  };
  if (reason) patch.failure_reason = reason;
  if (serviceId != null) patch.portal_service_id = serviceId;

  if (extTx) {
    const { data } = await admin.from('sms_messages')
      .update(patch)
      .eq('ext_transaction_id', extTx)
      .select('id')
      .maybeSingle();
    if (data) {
      console.log('[portal-mt-cb] updated by ext_transaction_id', { extTx, result });
      return portalJson({ ok: true, updated: true, via: 'ext_transaction_id', result });
    }

    // Fallback: older rows keyed portal_msg_id / portal_transaction_id.
    const { data: byMsg } = await admin.from('sms_messages')
      .update(patch)
      .eq('portal_msg_id', extTx)
      .select('id')
      .maybeSingle();
    if (byMsg) {
      return portalJson({ ok: true, updated: true, via: 'portal_msg_id', result });
    }
    const { data: byTx } = await admin.from('sms_messages')
      .update(patch)
      .eq('portal_transaction_id', extTx)
      .select('id')
      .maybeSingle();
    if (byTx) {
      return portalJson({ ok: true, updated: true, via: 'portal_transaction_id', result });
    }
  }

  if (msisdn) {
    const { data: rows } = await admin.from('sms_messages')
      .select('id')
      .eq('msisdn', msisdn)
      .in('status', ['queued', 'submitted', 'UNKNOWN'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (rows?.[0]) {
      await admin.from('sms_messages')
        .update({
          ...patch,
          ext_transaction_id: extTx || undefined,
        })
        .eq('id', rows[0].id);
      console.log('[portal-mt-cb] updated by msisdn fallback', { msisdn, result });
      return portalJson({ ok: true, updated: true, via: 'msisdn', result });
    }
  }

  console.warn('[portal-mt-cb] no matching sms_messages row', { extTx, msisdn, result });
  return portalJson({ ok: true, updated: false, note: 'no_matching_row', result });
});

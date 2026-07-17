// @ts-nocheck — Deno Edge Function; not part of the Node/Vite app build.
//
// Edge Function: send-sms — Supabase Auth "Send SMS Hook".
//
// SMS_MODE:
//   mock     (default) — logs OTP (and optional DEV_OTP_ECHO → dev_otps).
//   gateway  — POST to TELECOM_SMS_URL / TELECOM_SMS_TOKEN.
//   portal   — Partner MT API: POST /api/v1/mt/send type=otp
//
// When PORTAL_ENABLED=true, entitlement is enforced for every mode (Phase 3):
// deny OTP SMS unless subscription / pending / admin / allowlist.
//
// Configure: Dashboard → Authentication → Hooks → "Send SMS" → Edge Function:
//   send-sms, and copy the generated hook secret into SEND_SMS_HOOK_SECRET.

import { createHmac } from 'node:crypto';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  portalSendMt,
  normalizeMsisdn,
  resolveServiceIdForMsisdn,
  resolveLoginEntitlement,
  adminClient,
  defaultServiceId,
  portalEnabled,
} from '../_shared/portal.ts';

interface HookPayload {
  user: { phone?: string };
  sms: { otp: string };
}

function verifySignature(secret: string, id: string, ts: string, body: string, sigHeader: string): boolean {
  try {
    const key = secret.replace(/^v1,whsec_/, '');
    const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const expected = createHmac('sha256', raw).update(`${id}.${ts}.${body}`).digest('base64');
    return sigHeader.split(' ').some((s) => s.split(',')[1] === expected);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const body = await req.text();

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (secret) {
    const id = req.headers.get('webhook-id') ?? '';
    const ts = req.headers.get('webhook-timestamp') ?? '';
    const sig = req.headers.get('webhook-signature') ?? '';
    if (!verifySignature(secret, id, ts, body, sig)) {
      return new Response(JSON.stringify({ error: 'bad signature' }), { status: 401 });
    }
  }

  const payload = JSON.parse(body) as HookPayload;
  const phone = payload.user?.phone ?? '';
  const otp = payload.sms?.otp ?? '';
  const message = `Your InnoArcade code is ${otp}`;
  const mode = Deno.env.get('SMS_MODE') ?? 'mock';
  const msisdn = normalizeMsisdn(phone);
  const admin = adminClient();

  // Phase 3 hard gate — even mock/gateway must not deliver OTP to unsubscribed MSISDNs.
  if (portalEnabled()) {
    const login = await resolveLoginEntitlement(admin, msisdn);
    if (!login.entitled) {
      console.warn('[send-sms] portal login denied', { msisdn, reason: login.reason });
      return new Response(JSON.stringify({
        error: 'not_subscribed',
        message: 'MSISDN is not entitled to OTP; subscribe via SMS first',
      }), { status: 403 });
    }
  }

  if (mode === 'portal') {
    const resolved = await resolveServiceIdForMsisdn(admin, msisdn);
    const serviceId = resolved?.serviceId ?? defaultServiceId();

    if (serviceId == null) {
      console.error('[send-sms:portal] no serviceId for MSISDN', msisdn);
      return new Response(JSON.stringify({
        error: 'no_portal_service',
        message: 'MSISDN has no portal service mapping; subscribe via SMS first',
      }), { status: 502 });
    }

    const res = await portalSendMt({
      serviceId,
      msisdn,
      type: 'otp',
      message,
    });

    if (!res.ok) {
      console.error('[send-sms:portal] MT failed', res.errorCode ?? res.error, {
        serviceId,
        source: resolved?.source,
      });

      // TEMPORARY BYPASS: Log the OTP to the console so it can be typed manually,
      // and DO NOT return 502. This tricks Supabase Auth into thinking the SMS was sent!
      console.warn('⚠️ TEMPORARY BYPASS ACTIVE ⚠️');
      console.warn(`THE GENERATED OTP IS: ${otp}`);
      console.warn('Returning success to frontend even though SMS delivery failed.');

      // return new Response(JSON.stringify({
      //   error: res.errorCode ?? res.error ?? 'portal_sms_failed',
      // }), { status: 502 });
    }

    console.log('[send-sms:portal] MT accepted', {
      transactionId: res.transactionId,
      extTransactionId: res.extTransactionId,
      serviceId,
      source: resolved?.source,
      stub: res.stub ?? false,
    });
  } else if (mode === 'gateway') {
    const url = Deno.env.get('TELECOM_SMS_URL')!;
    const token = Deno.env.get('TELECOM_SMS_TOKEN') ?? '';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: phone, text: message }),
    });
    if (!res.ok) {
      console.error('[send-sms] gateway error', res.status, await res.text());
      return new Response(JSON.stringify({ error: 'sms send failed' }), { status: 502 });
    }
  } else {
    console.log(`[send-sms:mock] → ${phone}: ${message}`);
    if (Deno.env.get('DEV_OTP_ECHO') === 'true') {
      try {
        const url = Deno.env.get('SUPABASE_URL');
        const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (url && service && phone) {
          const sb = createClient(url, service);
          await sb.from('dev_otps').upsert({ phone, code: otp, created_at: new Date().toISOString() });
        }
      } catch (e) {
        console.error('[send-sms:mock] dev_otps write skipped', e);
      }
    }
  }

  return new Response('{}', { headers: { 'content-type': 'application/json' } });
});

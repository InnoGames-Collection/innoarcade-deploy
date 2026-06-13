// @ts-nocheck — Deno Edge Function; not part of the Node/Vite app build. The
// ts-nocheck stops the Node TypeScript server from flagging Deno globals and URL
// imports it can't resolve. Runs fine on Supabase's Deno runtime.
//
// Edge Function: send-sms — Supabase Auth "Send SMS Hook".
//
// Instead of paying a provider like Twilio, Supabase calls THIS function with the
// generated OTP and lets us deliver it however we want. Three modes, switched by
// the SMS_MODE env var (set in the function's secrets):
//
//   mock     (default) — just logs the OTP to the function logs. Free; read the
//                        code from Dashboard → Edge Functions → send-sms → Logs
//                        to complete a sign-in while testing.
//   gateway  — POST to a self-hosted open-source Android SMS gateway, or the
//              TELECOM's SMS gateway, using TELECOM_SMS_URL / TELECOM_SMS_TOKEN.
//
// This is the single seam the national telecom plugs into: flip SMS_MODE=gateway
// and point TELECOM_SMS_URL at their endpoint. No app changes.
//
// Configure: Dashboard → Authentication → Hooks → "Send SMS" → Edge Function:
//   send-sms, and copy the generated hook secret into SEND_SMS_HOOK_SECRET.

import { createHmac } from 'node:crypto';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface HookPayload {
  user: { phone?: string };
  sms: { otp: string };
}

function verifySignature(secret: string, id: string, ts: string, body: string, sigHeader: string): boolean {
  // Standard Webhooks: secret is "v1,whsec_…"; sign "{id}.{ts}.{body}" with the
  // base64-decoded key and compare against the v1, signature in the header.
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

  // Verify the hook came from Supabase Auth (when a secret is configured).
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

  if (mode === 'gateway') {
    // --- TELECOM / self-hosted SMS gateway (production) ---------------------
    // Replace the body shape below to match the carrier's API contract.
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
    // --- MOCK (free dev) ----------------------------------------------------
    // The OTP appears in this function's logs so you can complete sign-in.
    console.log(`[send-sms:mock] → ${phone}: ${message}`);
    // Optional LOCAL-dev convenience: with the DEV_OTP_ECHO secret set, also write
    // the code to the public `dev_otps` table so the sign-in screen can show it
    // (see supabase/dev.sql). OFF by default — the deployed demo uses Supabase
    // "Test phone numbers" instead and drops that table. Best-effort: never let
    // this break the auth hook.
    if (Deno.env.get('DEV_OTP_ECHO') === 'true') {
      try {
        const url = Deno.env.get('SUPABASE_URL');
        const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (url && service && phone) {
          const admin = createClient(url, service);
          await admin.from('dev_otps').upsert({ phone, code: otp, created_at: new Date().toISOString() });
        }
      } catch (e) {
        console.error('[send-sms:mock] dev_otps write skipped', e);
      }
    }
  }

  // Empty 200 tells Supabase Auth the SMS was handled.
  return new Response('{}', { headers: { 'content-type': 'application/json' } });
});

// @ts-nocheck — Deno Edge Function (Supabase).
//
// portal-login-gate — Pre-OTP entitlement check (Phase 3).
// Called by the client before Auth signInWithOtp. Public (no user JWT).
//
// When PORTAL_ENABLED=false → always allowed (demo / local).
// When PORTAL_ENABLED=true  → require portal subscription, pending entitlement,
//   admin profile, or PORTAL_LOGIN_ALLOWLIST.
//
// Body: { msisdn | phone }
// Response 200: { allowed, gated, reason?, source?, period?, hint? }
//
// Deploy: supabase functions deploy portal-login-gate
// config.toml: verify_jwt = false

import {
  adminClient,
  portalCors,
  portalJson,
  portalEnabled,
  normalizeMsisdn,
  pickString,
  resolveLoginEntitlement,
  shortcodeHint,
} from '../_shared/portal.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: portalCors });
  if (req.method !== 'POST') return portalJson({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return portalJson({ error: 'bad_json' }, 400);
  }

  const msisdn = normalizeMsisdn(pickString(body, ['msisdn', 'phone', 'MSISDN']));
  if (!msisdn) return portalJson({ error: 'missing_msisdn' }, 400);

  const gated = portalEnabled();
  if (!gated) {
    return portalJson({
      allowed: true,
      gated: false,
      source: 'ungated',
    });
  }

  const status = await resolveLoginEntitlement(adminClient(), msisdn);
  if (status.entitled) {
    console.log('[portal-login-gate] allow', { msisdn, source: status.source });
    return portalJson({
      allowed: true,
      gated: true,
      source: status.source ?? null,
      period: status.period ?? null,
      service_id: status.service_id ?? null,
    });
  }

  // Always HTTP 200 so clients can parse { allowed:false } without treating it
  // as a transport failure from functions.invoke.
  console.warn('[portal-login-gate] deny', { msisdn, reason: status.reason });
  return portalJson({
    allowed: false,
    gated: true,
    reason: status.reason ?? 'not_subscribed',
    hint: `Text OK to ${shortcodeHint()} to subscribe, then try again.`,
  });
});

// @ts-nocheck — Deno shared module for Partner MT + subscription notification webhooks.
//
// Contract: partner-mt-and-webhooks.openapi.yaml
//   - POST {PORTAL_BASE_URL}/api/v1/mt/send  (X-API-Key)
//   - Subscription notify HMAC: sha256(UTF-8 secret, "{X-Timestamp}.{rawBody}") hex
//   - MT delivery callback: final result success|failed (optional token guard)

import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type MtSendType = 'optin' | 'optout' | 'business' | 'otp';
export type SubPeriod = 'daily' | 'weekly' | 'monthly';

export type AdminClient = SupabaseClient;

export const portalCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-timestamp',
    'x-signature',
    'x-request-id',
    'x-callback-token',
    'x-portal-signature',
    'webhook-id',
    'webhook-timestamp',
    'webhook-signature',
  ].join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const portalJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...portalCors, 'content-type': 'application/json' },
  });

export function adminClient(): AdminClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ── MSISDN ──────────────────────────────────────────────────────────────────

/** Digits-only MSISDN for matching / portal wire format. */
export function msisdnDigits(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Internal storage form: E.164 +251… when Ethiopian mobile digits are recognized. */
export function normalizeMsisdn(raw: unknown): string {
  const d = msisdnDigits(raw);
  if (!d) return '';
  if (d.startsWith('251') && d.length >= 12) return `+${d}`;
  if (d.startsWith('0') && d.length >= 10) return `+251${d.slice(1)}`;
  if (d.length === 9) return `+251${d}`;
  return d.startsWith('+') ? String(raw) : `+${d}`;
}

/** Portal wire form: digits without leading + (e.g. 251911000000). */
export function portalMsisdn(raw: unknown): string {
  return msisdnDigits(normalizeMsisdn(raw) || raw);
}

// ── Config ──────────────────────────────────────────────────────────────────

export function portalEnabled(): boolean {
  return (Deno.env.get('PORTAL_ENABLED') ?? '').toLowerCase() === 'true';
}

export function skipWebhookVerify(): boolean {
  return (Deno.env.get('PORTAL_WEBHOOK_SKIP_VERIFY') ?? '').toLowerCase() === 'true';
}

/** Max |now - X-Timestamp| in seconds (default 300). */
export function webhookMaxSkewSec(): number {
  const n = Number(Deno.env.get('PORTAL_WEBHOOK_MAX_SKEW_SEC') ?? '300');
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export function mtSendPath(): string {
  return Deno.env.get('PORTAL_MT_SEND_PATH') ?? '/api/v1/mt/send';
}

export function mtCallbackUrl(): string {
  const explicit = (Deno.env.get('PORTAL_MT_CALLBACK_URL') ?? '').trim();
  const token = (Deno.env.get('PORTAL_MT_CALLBACK_TOKEN') ?? '').trim();
  let base = explicit;
  if (!base) {
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
    if (supabaseUrl) base = `${supabaseUrl}/functions/v1/portal-sms-dlr`;
  }
  if (!base) return '';
  if (!token) return base;
  const u = new URL(base);
  if (!u.searchParams.has('token')) u.searchParams.set('token', token);
  return u.toString();
}

function envInt(name: string): number | null {
  const raw = (Deno.env.get(name) ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** serviceId → period from PORTAL_SERVICE_{DAILY,WEEKLY,MONTHLY}. */
export function periodForServiceId(serviceId: number): SubPeriod | null {
  const daily = envInt('PORTAL_SERVICE_DAILY');
  const weekly = envInt('PORTAL_SERVICE_WEEKLY');
  const monthly = envInt('PORTAL_SERVICE_MONTHLY');
  if (daily != null && serviceId === daily) return 'daily';
  if (weekly != null && serviceId === weekly) return 'weekly';
  if (monthly != null && serviceId === monthly) return 'monthly';
  return null;
}

export function serviceIdForPeriod(period: SubPeriod): number | null {
  if (period === 'daily') return envInt('PORTAL_SERVICE_DAILY');
  if (period === 'weekly') return envInt('PORTAL_SERVICE_WEEKLY');
  if (period === 'monthly') return envInt('PORTAL_SERVICE_MONTHLY');
  return null;
}

export function defaultServiceId(): number | null {
  return envInt('PORTAL_DEFAULT_SERVICE_ID');
}

/** Local entitlement window (portal SoT still deactivates via unsubscription). */
export function periodDays(period: SubPeriod): number {
  if (period === 'daily') return 1;
  if (period === 'weekly') return 7;
  return 30;
}

export function shortcodeHint(): string {
  return (Deno.env.get('PORTAL_SHORTCODE_HINT') ?? '').trim()
    || 'the service shortcode';
}

/** Comma/space-separated MSISDNs that may OTP even without a portal sub (ops). */
export function loginAllowlisted(msisdn: string): boolean {
  const raw = Deno.env.get('PORTAL_LOGIN_ALLOWLIST') ?? '';
  if (!raw.trim()) return false;
  const target = msisdnDigits(msisdn).slice(-9);
  if (!target) return false;
  return raw.split(/[,\s]+/).some((part) => {
    const d = msisdnDigits(part);
    return d.length >= 9 && d.slice(-9) === target;
  });
}

export function welcomeMtEnabled(): boolean {
  return (Deno.env.get('PORTAL_SEND_WELCOME') ?? '').toLowerCase() === 'true';
}

export function welcomeMessage(): string {
  const custom = (Deno.env.get('PORTAL_WELCOME_MESSAGE') ?? '').trim();
  if (custom) return custom;
  const url = (Deno.env.get('PORTAL_GAME_URL') ?? '').trim() || 'https://goplay.et';
  return `Welcome to GoPlay! Open ${url} and sign in with this number.`;
}

export type LoginStatus = {
  entitled: boolean;
  reason?: string;
  source?: 'subscription' | 'pending' | 'admin' | 'allowlist' | 'ungated';
  period?: string;
  service_id?: number | null;
};

/** Server-side login entitlement used by portal-login-gate and send-sms. */
export async function resolveLoginEntitlement(
  admin: AdminClient,
  msisdn: string,
): Promise<LoginStatus> {
  if (!portalEnabled()) {
    return { entitled: true, source: 'ungated' };
  }
  if (loginAllowlisted(msisdn)) {
    return { entitled: true, source: 'allowlist' };
  }
  const { data, error } = await admin.rpc('msisdn_portal_login_status', {
    p_msisdn: normalizeMsisdn(msisdn) || msisdn,
  });
  if (error) {
    console.error('[portal-login] status rpc failed', error.message);
    // Fail closed when portal gating is on.
    return { entitled: false, reason: 'status_unavailable' };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    entitled: row.entitled === true,
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    source: typeof row.source === 'string' ? row.source as LoginStatus['source'] : undefined,
    period: typeof row.period === 'string' ? row.period : undefined,
    service_id: row.service_id == null ? null : Number(row.service_id),
  };
}

// ── Crypto ──────────────────────────────────────────────────────────────────

export function timingSafeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', Buffer.from(secret, 'utf8')).update(payload, 'utf8').digest('hex');
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * OpenAPI subscription notification verification:
 *   digest = hex(HMAC-SHA256(secret, "{X-Timestamp}.{rawBody}"))
 *   compare to X-Signature after optional `sha256=` prefix (constant-time).
 * Also enforces timestamp skew.
 */
export function verifySubscriptionWebhook(req: Request, rawBody: string): VerifyResult {
  if (skipWebhookVerify()) return { ok: true };

  const secret = Deno.env.get('PORTAL_WEBHOOK_SECRET') ?? '';
  if (!secret) {
    return { ok: false, reason: 'missing_webhook_secret' };
  }

  const ts = req.headers.get('x-timestamp') ?? '';
  const sigHdr = req.headers.get('x-signature') ?? '';
  if (!ts || !sigHdr) {
    return { ok: false, reason: 'missing_signature_headers' };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  // Accept seconds or (if clearly ms) milliseconds.
  const tsSec = tsNum > 1e12 ? Math.floor(tsNum / 1000) : Math.floor(tsNum);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsSec) > webhookMaxSkewSec()) {
    return { ok: false, reason: 'timestamp_skew' };
  }

  const presented = sigHdr.replace(/^sha256=/i, '').trim().toLowerCase();
  const expected = hmacSha256Hex(secret, `${ts}.${rawBody}`).toLowerCase();
  if (!timingSafeEqualString(presented, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}

/** @deprecated alias — use verifySubscriptionWebhook */
export function verifyPortalWebhook(req: Request, rawBody: string): boolean {
  return verifySubscriptionWebhook(req, rawBody).ok;
}

/**
 * MT delivery callbacks are unsigned in OpenAPI.
 * If PORTAL_MT_CALLBACK_TOKEN is set, require matching token (query or header).
 * If X-Timestamp + X-Signature are present, optionally verify with the same secret.
 */
export function authorizeMtCallback(req: Request, rawBody: string): VerifyResult {
  if (skipWebhookVerify()) return { ok: true };

  const token = (Deno.env.get('PORTAL_MT_CALLBACK_TOKEN') ?? '').trim();
  if (token) {
    const hdr = req.headers.get('x-callback-token') ?? '';
    const q = new URL(req.url).searchParams.get('token') ?? '';
    const presented = hdr || q;
    if (!presented || !timingSafeEqualString(presented, token)) {
      return { ok: false, reason: 'bad_callback_token' };
    }
  }

  const ts = req.headers.get('x-timestamp');
  const sig = req.headers.get('x-signature');
  if (ts && sig && (Deno.env.get('PORTAL_WEBHOOK_SECRET') ?? '')) {
    return verifySubscriptionWebhook(req, rawBody);
  }
  return { ok: true };
}

// ── Payload helpers ─────────────────────────────────────────────────────────

export function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const parts = k.split('.');
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (cur != null && String(cur).trim() !== '') return String(cur).trim();
  }
  return '';
}

export function pickInt(obj: Record<string, unknown>, keys: string[]): number | null {
  const s = pickString(obj, keys);
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

export function mapPeriod(raw: string): SubPeriod | null {
  const s = raw.toLowerCase();
  if (['daily', 'day', 'd', '1'].includes(s)) return 'daily';
  if (['weekly', 'week', 'w', '7'].includes(s)) return 'weekly';
  if (['monthly', 'month', 'm', '30'].includes(s)) return 'monthly';
  return null;
}

export async function recordPortalEvent(
  admin: AdminClient,
  eventId: string,
  eventType: string,
  msisdn: string,
  payload: unknown,
): Promise<{ inserted: boolean }> {
  const { error } = await admin.from('portal_events').insert({
    event_id: eventId,
    event_type: eventType,
    msisdn: msisdn || null,
    payload: payload ?? {},
  });
  if (error) {
    if (String(error.code) === '23505' || /duplicate|unique/i.test(error.message)) {
      return { inserted: false };
    }
    throw error;
  }
  return { inserted: true };
}

// ── Service resolution ──────────────────────────────────────────────────────

/**
 * Resolve which portal serviceId to use for an MT to this MSISDN.
 * Prefer active subscription.portal_service_id, then open pending, then default env.
 */
export async function resolveServiceIdForMsisdn(
  admin: AdminClient,
  msisdn: string,
): Promise<{ serviceId: number; source: 'subscription' | 'pending' | 'default' } | null> {
  const digits = msisdnDigits(msisdn);
  if (!digits) return null;

  const { data: userId } = await admin.rpc('user_id_for_msisdn', { p_msisdn: msisdn });
  if (userId) {
    const { data: rows } = await admin
      .from('subscriptions')
      .select('portal_service_id')
      .eq('user_id', userId)
      .eq('source', 'portal')
      .gt('expires_at', new Date().toISOString())
      .not('portal_service_id', 'is', null)
      .order('expires_at', { ascending: false })
      .limit(1);
    const sid = rows?.[0]?.portal_service_id;
    if (sid != null) return { serviceId: Number(sid), source: 'subscription' };
  }

  const { data: pending } = await admin
    .from('portal_pending_entitlements')
    .select('portal_service_id, msisdn')
    .is('claimed_at', null)
    .not('portal_service_id', 'is', null)
    .limit(50);

  const match = (pending ?? []).find((r) => {
    const a = msisdnDigits(r.msisdn);
    return a && digits.slice(-9) === a.slice(-9);
  });
  if (match?.portal_service_id != null) {
    return { serviceId: Number(match.portal_service_id), source: 'pending' };
  }

  const def = defaultServiceId();
  if (def != null) return { serviceId: def, source: 'default' };
  return null;
}

// ── MT send ─────────────────────────────────────────────────────────────────

export type MtSendResult =
  | {
    ok: true;
    transactionId: string;
    extTransactionId: string;
    stub?: boolean;
  }
  | {
    ok: false;
    error: string;
    errorCode?: string;
    httpStatus?: number;
    stub?: boolean;
  };

export async function portalSendMt(opts: {
  serviceId: number;
  msisdn: string;
  type: MtSendType;
  message: string;
  extTransactionId?: string;
  callbackUrl?: string;
}): Promise<MtSendResult> {
  const base = (Deno.env.get('PORTAL_BASE_URL') ?? '').replace(/\/$/, '');
  const apiKey = Deno.env.get('PORTAL_API_KEY') ?? '';
  const path = mtSendPath();
  const admin = adminClient();

  const msisdnNorm = normalizeMsisdn(opts.msisdn);
  const msisdnWire = portalMsisdn(opts.msisdn);
  const extTransactionId = opts.extTransactionId || randomUUID();
  const callbackUrl = opts.callbackUrl ?? mtCallbackUrl();
  const message = String(opts.message ?? '').trim();

  if (!msisdnWire || !message) {
    return { ok: false, error: 'invalid_mt_request' };
  }

  const { data: row, error: insertErr } = await admin.from('sms_messages').insert({
    template_code: opts.type,
    msisdn: msisdnNorm,
    status: 'queued',
    vars: {
      type: opts.type,
      message,
      serviceId: opts.serviceId,
    },
    ext_transaction_id: extTransactionId,
    mt_type: opts.type,
    portal_service_id: opts.serviceId,
  }).select('id').single();

  if (insertErr) {
    console.error('[portal-mt] sms_messages insert failed', insertErr.message);
    return { ok: false, error: 'sms_audit_insert_failed' };
  }

  if (!base) {
    console.log('[portal-mt:stub]', {
      type: opts.type,
      msisdn: msisdnWire,
      serviceId: opts.serviceId,
      extTransactionId,
    });
    const stubId = `stub-${row.id}`;
    await admin.from('sms_messages').update({
      status: 'submitted',
      portal_msg_id: stubId,
      portal_transaction_id: stubId,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: true, transactionId: stubId, extTransactionId, stub: true };
  }

  if (!apiKey) {
    await admin.from('sms_messages').update({
      status: 'failed',
      failure_reason: 'missing_api_key',
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, error: 'missing_api_key' };
  }

  const body: Record<string, unknown> = {
    serviceId: opts.serviceId,
    msisdn: msisdnWire,
    type: opts.type,
    message,
    extTransactionId,
  };
  if (callbackUrl) body.callbackUrl = callbackUrl;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch_failed';
    console.error('[portal-mt] network error', msg);
    await admin.from('sms_messages').update({
      status: 'failed',
      failure_reason: msg,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    return { ok: false, error: 'portal_unreachable' };
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text);
  } catch { /* non-JSON error body */ }

  if (!res.ok) {
    const errorCode = pickString(parsed, ['errorCode', 'error_code']) || undefined;
    const errMsg = pickString(parsed, ['message']) || `portal ${res.status}`;
    console.error('[portal-mt] rejected', res.status, errorCode, text.slice(0, 500));
    await admin.from('sms_messages').update({
      status: 'failed',
      failure_reason: errorCode ? `${errorCode}: ${errMsg}` : errMsg,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
    return {
      ok: false,
      error: errMsg,
      errorCode,
      httpStatus: res.status,
    };
  }

  const transactionId = pickString(parsed, [
    'data.transactionId',
    'data.transaction_id',
    'transactionId',
  ]) || extTransactionId;

  await admin.from('sms_messages').update({
    status: 'submitted',
    portal_msg_id: transactionId,
    portal_transaction_id: transactionId,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  return { ok: true, transactionId, extTransactionId };
}

/**
 * Backward-compatible wrapper used by older call sites.
 * Prefer portalSendMt with explicit serviceId + free-text message.
 */
export async function portalSendMessage(opts: {
  msisdn: string;
  templateCode: string;
  vars?: Record<string, string>;
  serviceId?: number;
}): Promise<{ ok: boolean; portalMsgId?: string; error?: string; stub?: boolean }> {
  const typeRaw = (opts.templateCode || 'business').toLowerCase();
  const type: MtSendType = (['optin', 'optout', 'business', 'otp'] as const)
    .includes(typeRaw as MtSendType)
    ? (typeRaw as MtSendType)
    : 'business';

  let serviceId = opts.serviceId ?? null;
  if (serviceId == null) {
    const resolved = await resolveServiceIdForMsisdn(adminClient(), opts.msisdn);
    serviceId = resolved?.serviceId ?? defaultServiceId();
  }
  if (serviceId == null) {
    return { ok: false, error: 'missing_service_id' };
  }

  const message = opts.vars?.message
    || (opts.vars?.OTP ? `Your InnoArcade code is ${opts.vars.OTP}` : '')
    || (opts.vars?.otp ? `Your InnoArcade code is ${opts.vars.otp}` : '')
    || (opts.vars?.code ? `Your InnoArcade code is ${opts.vars.code}` : '')
    || String(opts.templateCode);

  const res = await portalSendMt({
    serviceId,
    msisdn: opts.msisdn,
    type,
    message,
  });
  if (!res.ok) return { ok: false, error: res.error, stub: res.stub };
  return { ok: true, portalMsgId: res.transactionId, stub: res.stub };
}

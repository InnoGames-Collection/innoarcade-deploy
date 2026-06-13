// @ts-nocheck — Deno Edge Function (Supabase).
//
// payment-callback — the TeleBirr webhook (and sandbox completer). The provider
// POSTs here when a hosted payment finishes; we verify it, then credit the coins
// and flip the order to `paid`. Idempotent: a duplicate notification for an
// already-paid order is a no-op, so coins are never double-credited.
//
// SECURITY: this endpoint is public (the provider calls it server-to-server with
// no user JWT), so the signature/ref check below is the trust boundary — wire it
// to TeleBirr's real notification verification before going live.
//
// Deploy: supabase functions deploy payment-callback --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { providerRef?: string; orderId?: string; status?: string; signature?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  // TODO: verify body.signature against TeleBirr's public key before trusting it.
  // For now we accept the notification and rely on the unguessable provider_ref.
  const ref = String(body.providerRef ?? '');
  const orderId = String(body.orderId ?? '');
  if (!ref && !orderId) return json({ error: 'missing reference' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let q = admin.from('payment_orders').select('id, user_id, coins, status');
  q = ref ? q.eq('provider_ref', ref) : q.eq('id', orderId);
  const { data: order } = await q.maybeSingle();
  if (!order) return json({ error: 'order not found' }, 404);

  // Idempotency: only the first 'paid' transition credits coins.
  if (order.status === 'paid') return json({ ok: true, already: true });

  const success = (body.status ?? 'success').toLowerCase() === 'success';
  if (!success) {
    await admin.from('payment_orders').update({ status: 'failed' }).eq('id', order.id);
    return json({ ok: true, status: 'failed' });
  }

  await admin.rpc('apply_coins', { p_user: order.user_id, p_delta: order.coins, p_reason: 'purchase', p_ref: order.id });
  await admin.from('payment_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id);
  return json({ ok: true, status: 'paid' });
});

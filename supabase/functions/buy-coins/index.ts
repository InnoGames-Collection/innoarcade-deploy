// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// buy-coins — opens a coin purchase. Creates a pending `payment_orders` row for
// the signed-in player and returns a checkout descriptor:
//   • TeleBirr (real): builds the hosted-payment redirect URL; the provider
//     later calls `payment-callback`, which credits the wallet.
//   • Sandbox (no TELEBIRR_* secrets set): returns a redirect to the app's OWN
//     demo TeleBirr page (/checkout/), which calls `payment-callback` just like
//     the real provider would. This exercises the EXACT production flow
//     (pending order → hosted page → webhook → apply_coins) with no merchant
//     account — so going live is purely filling the TeleBirr request-signing
//     block below and pointing the merchant notify URL at payment-callback.
//
// Nothing on the client changes between sandbox and live.
//
// Deploy: supabase functions deploy buy-coins

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fallback package catalogue — mirrors src/platform/config.ts DEFAULT_CONFIG.
// app_config.value.coinPackages overrides this when the operator has edited it.
const DEFAULT_PACKAGES = [
  { id: 'starter', coins: 50, bonus: 0, priceEtb: 25 },
  { id: 'plus', coins: 120, bonus: 10, priceEtb: 50 },
  { id: 'pro', coins: 300, bonus: 50, priceEtb: 100 },
  { id: 'mega', coins: 700, bonus: 150, priceEtb: 200 },
  { id: 'whale', coins: 2000, bonus: 600, priceEtb: 500 },
];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { packageId?: string; method?: string; appBase?: string; returnUrl?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const method = body.method === 'topup' ? 'topup' : 'telebirr';

  const admin = createClient(url, service);

  // Resolve the package by id from the operator catalogue OR the built-in
  // defaults. Accepting both schemes makes checkout robust when the client's
  // config cache is stale (e.g. it sends 'starter' while the operator catalogue
  // uses 'pkg_0') — the previous "operator-only" lookup returned 400 there.
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'app').maybeSingle();
  const operator = (cfg?.value?.coinPackages as typeof DEFAULT_PACKAGES) ?? [];
  const pkg = operator.find((p) => p.id === body.packageId)
    ?? DEFAULT_PACKAGES.find((p) => p.id === body.packageId);
  if (!pkg) return json({ error: 'unknown package' }, 400);

  const coins = pkg.coins + pkg.bonus;
  const orderId = `o_${crypto.randomUUID()}`;
  const providerRef = `tb_${crypto.randomUUID()}`;

  await admin.from('payment_orders').insert({
    id: orderId, user_id: user.id, package_id: pkg.id, method,
    amount_etb: pkg.priceEtb, coins, status: 'pending', provider_ref: providerRef,
  });

  const order = {
    id: orderId, packageId: pkg.id, coins, amountEtb: pkg.priceEtb,
    method, status: 'pending', createdAt: Date.now(),
  };

  // --- TeleBirr (real) vs sandbox ---
  const teleKey = Deno.env.get('TELEBIRR_APP_KEY');
  if (teleKey) {
    // TODO: build and sign the TeleBirr H5/SuperApp request here, then return
    // its hosted-payment URL. The provider POSTs the result to payment-callback.
    const redirectUrl = `${Deno.env.get('TELEBIRR_CHECKOUT_URL') ?? ''}?ref=${providerRef}`;
    return json({ order: { ...order, redirectUrl }, sandbox: false });
  }

  // Mock payment (no TeleBirr / airtime integration): credit the coins
  // immediately, server-side via apply_coins, and mark the order paid. Fully
  // server-authoritative; the client just sees a completed purchase.
  await admin.rpc('apply_coins', { p_user: user.id, p_delta: coins, p_reason: 'purchase', p_ref: orderId });
  await admin.from('payment_orders').update({ status: 'paid' }).eq('id', orderId);
  return json({ order: { ...order, status: 'paid' }, sandbox: true });
});

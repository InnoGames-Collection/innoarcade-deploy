// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// redeem-referral — link the signed-in player to a friend's referral code and
// pay both sides in coins (one-time). All validation + crediting lives in the
// SECURITY DEFINER SQL function redeem_referral(); this is the auth'd wrapper.
//
// Deploy: supabase functions deploy redeem-referral

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const code = String(body.code ?? '').trim();
  if (!code) return json({ status: 'invalid' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: status, error } = await admin.rpc('redeem_referral', { p_user: user.id, p_code: code });
  if (error) return json({ error: error.message }, 500);

  const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
  return json({ status: String(status), coins: Number(prof?.coins ?? 0) });
});

// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// claim-challenge — award daily challenge coins when all tasks are complete.
// Idempotent per day via claim_daily_challenge() SQL (service role).
//
// Deploy: supabase functions deploy claim-challenge

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

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: award, error } = await admin.rpc('claim_daily_challenge', { p_user: user.id });
  if (error) return json({ error: error.message }, 500);

  const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
  const { data: progress } = await admin.rpc('get_daily_challenge_progress', { p_user: user.id });
  return json({
    award: Number(award ?? 0),
    coins: Number(prof?.coins ?? 0),
    challenge: progress ?? null,
  });
});

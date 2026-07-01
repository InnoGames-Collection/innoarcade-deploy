// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// hub-bootstrap — single round-trip to hydrate the hub on load: app config,
// live tournaments + prize pools, and (when signed in) profile balances,
// unlocks, and tournament entries.
//
// Deploy: supabase functions deploy hub-bootstrap

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

const TOURNAMENT_SELECT =
  'id, game_id, title_en, title_am, type, entry_fee_coins, attempts, prize_model, sponsored_prize, prize_tiers, starts_at, ends_at, state';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: u } = await userClient.auth.getUser();
  const user = u.user;

  const [configRes, tourRes, poolRes] = await Promise.all([
    admin.from('app_config').select('value').eq('key', 'app').maybeSingle(),
    admin.from('tournaments').select(TOURNAMENT_SELECT).eq('state', 'live').order('starts_at', { ascending: false }),
    admin.from('tournament_pools').select('tournament_id, entrants, fees_total, pool'),
  ]);

  let userPayload = null;
  if (user) {
    const [profRes, entriesRes] = await Promise.all([
      admin.from('profiles').select('coins, xp, xp_lifetime, unlocks').eq('id', user.id).maybeSingle(),
      admin
        .from('tournament_entries')
        .select('tournament_id, fee_paid, prize_won, entered_at, attempts_purchased, attempts_used')
        .eq('user_id', user.id),
    ]);
    userPayload = {
      coins: Number(profRes.data?.coins ?? 0),
      xp: Number(profRes.data?.xp ?? 0),
      lifetime: Number(profRes.data?.xp_lifetime ?? 0),
      unlocks: Array.isArray(profRes.data?.unlocks) ? profRes.data.unlocks : [],
      entries: entriesRes.data ?? [],
    };
  }

  return json({
    config: configRes.data?.value ?? {},
    tournaments: tourRes.data ?? [],
    pools: poolRes.data ?? [],
    user: userPayload,
  });
});

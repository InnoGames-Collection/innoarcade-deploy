// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// runner-enter — pay the Ethiopian Runner tournament entry fee (global coins via
// apply_coins) and bank a block of attempts. One fee buys `attempts` runs whose
// best score counts (doc §4). Re-entering buys another block. Server-authoritative:
// the fee/attempts come from the runner_tournaments row, never the client.
//
// Deploy: supabase functions deploy runner-enter

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

  // Make sure a live window exists, then read it (authoritative fee + attempts).
  const { data: tid } = await admin.rpc('ensure_runner_tournament');
  const { data: tour } = await admin
    .from('runner_tournaments')
    .select('id, entry_fee_coins, attempts, ends_at, state')
    .eq('id', String(tid)).maybeSingle();
  if (!tour) return json({ error: 'no tournament' }, 404);
  if (tour.state !== 'live' || new Date(tour.ends_at).getTime() <= Date.now()) {
    return json({ error: 'tournament closed' }, 409);
  }

  const fee = Number(tour.entry_fee_coins);
  const attempts = Number(tour.attempts);

  // Debit the fee from the global coin wallet (refuses to overdraw -> 402).
  let coins = 0;
  if (fee > 0) {
    const { data: bal, error } = await admin.rpc('apply_coins', {
      p_user: user.id, p_delta: -fee, p_reason: 'runner_entry', p_ref: tour.id,
    });
    if (error) return json({ error: 'insufficient coins' }, 402);
    coins = Number(bal);
  } else {
    const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
    coins = Number(prof?.coins ?? 0);
  }

  // Bank the attempts (accumulate on re-entry).
  const { data: existing } = await admin
    .from('runner_entries')
    .select('attempts_purchased, attempts_used, fee_paid')
    .eq('user_id', user.id).eq('tournament_id', tour.id).maybeSingle();
  const purchased = Number(existing?.attempts_purchased ?? 0) + attempts;
  const used = Number(existing?.attempts_used ?? 0);
  const feePaid = Number(existing?.fee_paid ?? 0) + fee;
  await admin.from('runner_entries').upsert({
    user_id: user.id, tournament_id: tour.id,
    attempts_purchased: purchased, attempts_used: used, fee_paid: feePaid,
  });

  return json({
    tournamentId: tour.id, coins,
    attemptsPurchased: purchased, attemptsUsed: used, attemptsLeft: purchased - used, feePaid,
  });
});

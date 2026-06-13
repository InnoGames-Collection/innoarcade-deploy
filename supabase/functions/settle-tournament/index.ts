// @ts-nocheck — Deno Edge Function (Supabase).
//
// settle-tournament — pay out a finished tournament. Computes the prize pool
// (sponsored = fixed; pool = collected entry fees minus the house rake), ranks
// the eligible players, splits the pool by the tournament's prize tiers, credits
// each winner's wallet (apply_coins) and records prize_won, then marks the
// tournament `settled`. Idempotent: a tournament is settled at most once.
//
// Authorised either by an admin JWT (the console's Settle button) or a matching
// x-cron-secret header (a scheduled job). Eligible players for a PAID tournament
// are only those who entered; a FREE tournament ranks everyone who scored.
//
// Deploy: supabase functions deploy settle-tournament

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, service);

  // --- authorise: admin JWT or cron secret ---
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret');
  let authorised = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);
  if (!authorised) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (u.user) {
      const { data: prof } = await admin.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
      authorised = prof?.role === 'admin';
    }
  }
  if (!authorised) return json({ error: 'forbidden' }, 403);

  let body: { tournamentId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const tournamentId = String(body.tournamentId ?? '');
  if (!tournamentId) return json({ error: 'missing tournament' }, 400);

  const { data: tour } = await admin
    .from('tournaments')
    .select('id, type, prize_model, sponsored_prize, prize_tiers, state')
    .eq('id', tournamentId).maybeSingle();
  if (!tour) return json({ error: 'unknown tournament' }, 404);
  if (tour.state === 'settled') return json({ ok: true, already: true });

  // Mark settling first to fence concurrent runs.
  await admin.from('tournaments').update({ state: 'settling' }).eq('id', tournamentId);

  // --- prize pool ---
  let pool = Number(tour.sponsored_prize);
  if (tour.prize_model === 'pool') {
    const { data: entries } = await admin
      .from('tournament_entries').select('fee_paid').eq('tournament_id', tournamentId);
    const gross = (entries ?? []).reduce((s, e) => s + Number(e.fee_paid), 0);
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'app').maybeSingle();
    const rake = Number(cfg?.value?.houseRakePct ?? 10) / 100;
    pool = Math.round((gross * (1 - rake)) / 10) * 10;
  }

  // --- eligible, ranked players ---
  const { data: scoreRows } = await admin
    .from('scores').select('user_id, best')
    .eq('tournament_id', tournamentId).order('best', { ascending: false });
  let ranked = scoreRows ?? [];
  if (tour.type === 'paid') {
    const { data: entered } = await admin
      .from('tournament_entries').select('user_id').eq('tournament_id', tournamentId);
    const set = new Set((entered ?? []).map((e) => e.user_id));
    ranked = ranked.filter((r) => set.has(r.user_id));
  }

  // --- split + pay ---
  const tiers = (tour.prize_tiers as Array<{ rank: number; pct: number }>) ?? [];
  const payouts: Array<{ userId: string; rank: number; coins: number }> = [];
  for (const tier of tiers) {
    const winner = ranked[tier.rank - 1];
    if (!winner) continue;
    const coins = Math.round((pool * tier.pct) / 100);
    if (coins <= 0) continue;
    await admin.rpc('apply_coins', { p_user: winner.user_id, p_delta: coins, p_reason: 'prize', p_ref: tournamentId });
    await admin.from('tournament_entries')
      .update({ prize_won: coins }).eq('tournament_id', tournamentId).eq('user_id', winner.user_id);
    payouts.push({ userId: winner.user_id, rank: tier.rank, coins });
  }

  await admin.from('tournaments').update({ state: 'settled' }).eq('id', tournamentId);
  return json({ ok: true, pool, payouts });
});

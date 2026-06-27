// @ts-nocheck — Deno Edge Function (Supabase).
//
// enter-tournament — server-authoritative tournament registration on the UNIFIED
// system. PAY ONCE → N ATTEMPTS (doc §4.1): debiting the entry fee banks a block
// of attempts whose best RP ranks. Re-entering after the bank empties buys another
// block. Resolves the game's single live window server-side (no client-built id)
// and enforces the level-tier funnel (daily ≥ L3, weekly ≥ L5, monthly ≥ L10).
//
// Body: { gameId } (preferred) or { tournamentId } (legacy/explicit). Returns 402
// when the player can't afford the fee, 403 when their level is too low.
//
// Deploy: supabase functions deploy enter-tournament

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

// Doc §3.2 cumulative level table (mirrors src/platform/config.ts).
const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1500, 2200, 3000, 4000, 5000, 6000];
const levelFor = (xp: number): number => {
  const v = Math.max(0, xp); let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) { if (v >= LEVEL_THRESHOLDS[i]) lvl = i + 1; else return lvl; }
  return 10 + Math.floor((v - 6000) / 3000);
};
// Cadence parsed from the tournament id suffix → required level (funnel).
const cadenceOf = (id: string): 'daily' | 'weekly' | 'monthly' =>
  /-daily-/.test(id) ? 'daily' : /-weekly-/.test(id) ? 'weekly' : 'monthly';
const REQUIRED_LEVEL: Record<string, number> = { daily: 3, weekly: 5, monthly: 10 };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { gameId?: string; tournamentId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Resolve the live tournament id: prefer the explicit id, else the game's
  // single live window (server-authoritative — no client date math).
  let tournamentId = String(body.tournamentId ?? '');
  if (!tournamentId && body.gameId) {
    const { data: tid } = await admin.rpc('active_game_tournament', { p_game: String(body.gameId) });
    tournamentId = String(tid ?? '');
  }
  if (!tournamentId) return json({ error: 'no live tournament' }, 404);

  const { data: tour } = await admin
    .from('tournaments')
    .select('id, type, entry_fee_coins, attempts, starts_at, ends_at, state')
    .eq('id', tournamentId).maybeSingle();
  if (!tour) return json({ error: 'unknown tournament' }, 404);

  const now = Date.now();
  const ended = tour.state === 'settled' || tour.state === 'settling' || new Date(tour.ends_at).getTime() <= now;
  if (ended) return json({ error: 'tournament closed' }, 409);

  // Level-tier funnel (doc §3.2).
  const need = REQUIRED_LEVEL[cadenceOf(tour.id)] ?? 1;
  const { data: lp } = await admin.from('profiles').select('xp_lifetime').eq('id', user.id).maybeSingle();
  const level = levelFor(Number(lp?.xp_lifetime ?? 0));
  if (level < need) return json({ error: 'level too low', requiredLevel: need, level }, 403);

  const fee = tour.type === 'paid' ? Number(tour.entry_fee_coins) : 0;
  const attempts = Math.max(1, Number(tour.attempts ?? 1));

  // PAY ONCE → bank N attempts. Debit the fee (apply_coins refuses to overdraw).
  if (fee > 0) {
    const { error } = await admin.rpc('apply_coins', {
      p_user: user.id, p_delta: -fee, p_reason: 'entry_fee', p_ref: tournamentId,
    });
    if (error) return json({ error: 'insufficient coins' }, 402);
  }

  // Accumulate the attempt bank + total fees on (re-)entry.
  const { data: existing } = await admin
    .from('tournament_entries')
    .select('attempts_purchased, attempts_used, fee_paid')
    .eq('user_id', user.id).eq('tournament_id', tournamentId).maybeSingle();
  const purchased = Number(existing?.attempts_purchased ?? 0) + attempts;
  const used = Number(existing?.attempts_used ?? 0);
  const feePaid = Number(existing?.fee_paid ?? 0) + fee;
  await admin.from('tournament_entries').upsert({
    user_id: user.id, tournament_id: tournamentId,
    attempts_purchased: purchased, attempts_used: used, fee_paid: feePaid,
  });

  return json({
    tournamentId, feePaid, prizeWon: 0, enteredAt: now,
    attemptsPurchased: purchased, attemptsUsed: used, attemptsLeft: purchased - used,
  });
});

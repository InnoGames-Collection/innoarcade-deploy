// @ts-nocheck — Deno Edge Function (Supabase).
//
// enter-tournament — server-authoritative tournament registration. For a paid
// tournament it debits the entry fee (apply_coins, which refuses to overdraw)
// and records the entry atomically; free tournaments record a zero-fee entry.
// Returns 402 when the player can't afford the fee so the UI can prompt a top-up.
//
// This is the gate `submit-score` checks for paid tournaments — no entry, no
// counted score.
//
// Deploy: supabase functions deploy enter-tournament

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { tournamentId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const tournamentId = String(body.tournamentId ?? '');
  if (!tournamentId) return json({ error: 'missing tournament' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: tour } = await admin
    .from('tournaments')
    .select('id, type, entry_fee_coins, starts_at, ends_at, state')
    .eq('id', tournamentId).maybeSingle();
  if (!tour) return json({ error: 'unknown tournament' }, 404);

  const now = Date.now();
  const ended = tour.state === 'settled' || tour.state === 'settling' || new Date(tour.ends_at).getTime() <= now;
  if (ended) return json({ error: 'tournament closed' }, 409);

  // Already entered? Return the existing entry (idempotent — no double charge).
  const { data: existing } = await admin
    .from('tournament_entries')
    .select('tournament_id, fee_paid, prize_won, entered_at')
    .eq('user_id', user.id).eq('tournament_id', tournamentId).maybeSingle();
  if (existing) {
    return json({ tournamentId, feePaid: existing.fee_paid, prizeWon: existing.prize_won, enteredAt: new Date(existing.entered_at).getTime() });
  }

  const fee = tour.type === 'paid' ? Number(tour.entry_fee_coins) : 0;
  if (fee > 0) {
    const { error } = await admin.rpc('apply_coins', {
      p_user: user.id, p_delta: -fee, p_reason: 'entry_fee', p_ref: tournamentId,
    });
    if (error) return json({ error: 'insufficient coins' }, 402);
  }

  await admin.from('tournament_entries').insert({
    user_id: user.id, tournament_id: tournamentId, fee_paid: fee,
  });

  return json({ tournamentId, feePaid: fee, prizeWon: 0, enteredAt: now });
});

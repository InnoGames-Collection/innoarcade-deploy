// @ts-nocheck — Deno Edge Function; not part of the Node/Vite app build. The
// ts-nocheck stops the Node TypeScript server from flagging Deno globals and URL
// imports it can't resolve. Runs fine on Supabase's Deno runtime.
//
// Edge Function: submit-score — the server-authoritative score gate.
//
// The frontend NEVER writes the scores table directly. It calls this function,
// which (1) identifies the player from their JWT, (2) validates the score against
// per-game bounds, (3) rate-limits submissions, and (4) keeps only the best.
// Because it runs with the service role it can write past RLS — but only after
// these checks pass. This is what makes a prize tournament defensible.
//
// Deploy:  supabase functions deploy submit-score
// Runtime: Deno (Supabase Edge Functions).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Per-game sane ceilings — a score above this is rejected as impossible. Tune as
// the games' real maxima become known; keys are catalog game ids.
const MAX_SCORE: Record<string, number> = {
  'orbit-blast': 100_000,
  'temple-dash': 1_000_000,
  'merge-2048': 5_000_000,
  _default: 2_000_000,
};
const MIN_SECONDS_BETWEEN = 3; // basic flood protection per (user, tournament)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their JWT (anon client scoped to their token).
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { tournamentId?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const tournamentId = String(body.tournamentId ?? '');
  const score = Number(body.score);

  // --- validation ---
  if (!tournamentId || !Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return json({ error: 'invalid score' }, 400);
  }
  const gameId = tournamentId.replace(/-(monthly|weekly)$/, '');
  const ceiling = MAX_SCORE[gameId] ?? MAX_SCORE._default;
  if (score > ceiling) return json({ error: 'score out of range' }, 422);

  // Service-role client for the privileged read/write.
  const admin = createClient(url, serviceKey);

  const { data: existing } = await admin
    .from('scores')
    .select('best, plays, updated_at')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  // Rate limit.
  if (existing?.updated_at) {
    const since = (Date.now() - new Date(existing.updated_at).getTime()) / 1000;
    if (since < MIN_SECONDS_BETWEEN) return json({ error: 'too fast' }, 429);
  }

  const prevBest = existing?.best ?? 0;
  const isRecord = score > prevBest;
  const best = Math.max(prevBest, score);

  const { error: upErr } = await admin.from('scores').upsert({
    user_id: user.id,
    tournament_id: tournamentId,
    best,
    plays: (existing?.plays ?? 0) + 1,
    updated_at: new Date().toISOString(),
  });
  if (upErr) return json({ error: 'write failed' }, 500);

  // Compute the player's rank and the field size from the ranked view.
  const { data: board } = await admin
    .from('leaderboard')
    .select('user_id, rank')
    .eq('tournament_id', tournamentId);
  const total = board?.length ?? 1;
  const rank = board?.find((r: { user_id: string; rank: number }) => r.user_id === user.id)?.rank ?? total;

  return json({ best, isRecord, rank, total });
});

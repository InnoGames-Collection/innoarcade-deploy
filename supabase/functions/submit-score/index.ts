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
// Runtime: Deno (Supabase Edge Functions). This is the anti-cheat boundary for prize tournaments.
//
// The frontend NEVER writes the scores table directly. It calls this function,
// which (1) identifies the player from their JWT, (2) validates the score against
// per-game bounds, (3) rate-limits submissions, and (4) keeps only the best.
// Because it runs with the service role it can write past RLS — but only after
// these checks pass. This is what makes a prize tournament defensible.
//
// Deploy:  supabase functions deploy submit-score
// Runtime: Deno (Supabase Edge Functions). This is the anti-cheat boundary for prize tournaments.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Per-game sane ceilings — a score above this is rejected as impossible. Tune as
// the games' real maxima become known; keys are catalog game ids.
const MAX_SCORE: Record<string, number> = {
  'orbit-blast': 100_000,
  'temple-dash': 1_000_000,
  'merge-2048': 5_000_000,
  _default: 2_000_000,
};
// Server-authoritative ceiling on points a single finished round can award, per
// game id. The client proposes points (its win reward / skill formula); the
// server clamps to this so a tampered client can't mint unlimited points.
const MAX_POINTS: Record<string, number> = {
  'ethiopian-quiz': 100,
  'memory-match': 180,
  'tap-game': 150,
  'popblast': 150,
  'spin-wheel': 120,
  'lucky-box': 100,
  'luckyslot': 100,
  'dice-roll': 90,
  'scratch-card': 80,
  'crash-game': 50,
  _default: 300,
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

// --- anti-cheat round-token helpers (mirror start-round signing) ---
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}
async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(mac));
}
// Verify a round token is well-signed, fresh, bound to this (user, game), and
// not already used — then burn it (single-use). Returns false on any failure.
async function verifyAndBurnToken(admin, token: string, uid: string, gid: string, secret: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (sig !== (await hmac(payload, secret))) return false;
  let p: { uid?: string; gid?: string; iat?: number; jti?: string };
  try { p = JSON.parse(b64urlDecode(payload)); } catch { return false; }
  if (p.uid !== uid || p.gid !== gid) return false;
  if (typeof p.iat !== 'number' || Date.now() - p.iat > 15 * 60 * 1000) return false;
  if (!p.jti) return false;
  const { error } = await admin.from('used_nonces').insert({ jti: p.jti, user_id: uid });
  return !error; // unique-violation (replay) → error → reject
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

  let body: { gameId?: string; tournamentId?: string; score?: number; points?: number; leaderboard?: boolean; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const token = String(body.token ?? '');
  // Accept either the new {gameId} contract or the legacy {tournamentId}.
  const gameId = String(body.gameId ?? String(body.tournamentId ?? '').replace(/-(monthly|weekly)$/, ''));
  const score = Number(body.score);
  const proposedPoints = Number(body.points ?? 0);
  // Whether this round should count on a leaderboard. Free games pass false →
  // points only, no leaderboard row. Defaults to true for the legacy contract.
  const wantsLeaderboard = body.leaderboard ?? (body.tournamentId != null);

  // --- validation ---
  if (!gameId || !Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return json({ error: 'invalid score' }, 400);
  }
  const ceiling = MAX_SCORE[gameId] ?? MAX_SCORE._default;
  if (score > ceiling) return json({ error: 'score out of range' }, 422);
  const tournamentId = `${gameId}-monthly`;

  // Service-role client for the privileged read/write.
  const admin = createClient(url, serviceKey);

  // Points to award (clamped server-side). NOT applied until all validation /
  // anti-cheat gates have passed — a rejected submission must never credit points.
  const pointsCeiling = MAX_POINTS[gameId] ?? MAX_POINTS._default;
  const award = Math.max(0, Math.min(Math.floor(Number.isFinite(proposedPoints) ? proposedPoints : 0), pointsCeiling));
  let points = 0;
  const grantPoints = async (): Promise<void> => {
    try {
      const { data: pbal } = await admin.rpc('apply_points', { p_user: user.id, p_delta: award });
      points = Number(pbal ?? 0);
    } catch { /* best-effort; never blocks the response */ }
  };

  // Free games: points only, no leaderboard, no token required.
  if (!wantsLeaderboard) {
    await grantPoints();
    return json({ points });
  }

  // --- anti-cheat: leaderboard scores require a valid single-use round token ---
  // Enforced only when ROUND_SIGNING_SECRET is set; the token ties the score to a
  // round that actually started on the server and blocks replays. Checked BEFORE
  // any points are credited.
  const signingSecret = Deno.env.get('ROUND_SIGNING_SECRET');
  if (signingSecret) {
    const ok = await verifyAndBurnToken(admin, token, user.id, gameId, signingSecret);
    if (!ok) return json({ error: 'invalid round token' }, 403);
  }

  // Tournament gate: if this id is a configured tournament, it must be live, and
  // a PAID tournament only counts scores from players who entered (paid the fee).
  // Unknown ids (e.g. the derived/local tournaments) skip the gate so the
  // existing flow keeps working before any rows exist in the tournaments table.
  const { data: tour } = await admin
    .from('tournaments')
    .select('type, starts_at, ends_at, state')
    .eq('id', tournamentId).maybeSingle();
  if (tour) {
    const now = Date.now();
    const live = tour.state === 'live' ||
      (now >= new Date(tour.starts_at).getTime() && now < new Date(tour.ends_at).getTime()
        && tour.state !== 'ended' && tour.state !== 'settled' && tour.state !== 'settling');
    if (!live) return json({ error: 'tournament not live' }, 409);
    if (tour.type === 'paid') {
      const { data: entry } = await admin
        .from('tournament_entries').select('user_id')
        .eq('user_id', user.id).eq('tournament_id', tournamentId).maybeSingle();
      if (!entry) return json({ error: 'not entered' }, 402);
    }
  }

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

  // All gates passed — now (and only now) credit the points for this round.
  await grantPoints();

  // Compute the player's rank and the field size from the ranked view.
  const { data: board } = await admin
    .from('leaderboard')
    .select('user_id, rank')
    .eq('tournament_id', tournamentId);
  const total = board?.length ?? 1;
  const rank = board?.find((r: { user_id: string; rank: number }) => r.user_id === user.id)?.rank ?? total;

  return json({ best, isRecord, rank, total, points });
});

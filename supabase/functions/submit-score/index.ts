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
  'memory-match': 5_000,
  _default: 2_000_000,
};

// Per-game scoring config for the uniform matrix (target-based normalization).
//   par       = a "great round" raw score → 100 RP when raw ≥ par (via rp_for baseline)
//   timeWeight/parTime = speed bonus for time-relevant games (others: no time)
//   difficulty = tier multiplier (default 1)
// Tunable; the server is the single source of truth.
interface ScoreCfg { par: number; timeWeight?: number; parTime?: number; difficulty?: number }
const GAME_SCORING: Record<string, ScoreCfg> = {
  'orbit-blast': { par: 3000 }, 'merge-2048': { par: 5000 }, 'temple-dash': { par: 1500 },
  'metro-rush': { par: 1500 }, 'candy-crunch': { par: 300 }, 'dot-link': { par: 200 },
  'brick-blitz': { par: 300 }, 'fruit-slice': { par: 1200 }, 'sky-hopper': { par: 100 },
  'bubble-pop': { par: 300 }, 'memory-match': { par: 3600 }, 'tap-game': { par: 50 },
  'dice-roll': { par: 300 }, 'scratch-card': { par: 100 }, 'lucky-box': { par: 300 },
  'spin-wheel': { par: 300 }, 'luckyslot': { par: 300 }, 'popblast': { par: 200 },
  'crash-game': { par: 300 },
  'ethiopian-quiz': { par: 100, timeWeight: 0.5, parTime: 60000 },
  'sudoku': { par: 30 }, 'crosssum': { par: 10 }, 'logic': { par: 5 }, 'rhyme': { par: 10 },
  'spell': { par: 100, timeWeight: 0.3, parTime: 60000 },
  'vocab': { par: 100, timeWeight: 0.3, parTime: 60000 },
  'target24': { par: 6, timeWeight: 0.4, parTime: 90000 },
  'sequence': { par: 8, timeWeight: 0.4, parTime: 90000 },
  _default: { par: 100 },
};
// XP difficulty multiplier per game (doc §3.1: Easy 1.0 / Medium 1.5 / Hard 2.0).
// Drives normal-game XP = 10 × difficulty. Default 1.0 (Easy/casual).
const XP_DIFFICULTY: Record<string, number> = {
  // Hard — skill/brain games
  'sudoku': 2, 'crosssum': 2, 'logic': 2, 'target24': 2, 'sequence': 2,
  'merge-2048': 2, 'orbit-blast': 2, 'ethiopian-quiz': 2,
  // Medium — reflex/word games
  'temple-dash': 1.5, 'metro-rush': 1.5, 'dot-link': 1.5, 'brick-blitz': 1.5,
  'sky-hopper': 1.5, 'fruit-slice': 1.5, 'spell': 1.5, 'vocab': 1.5, 'rhyme': 1.5,
  'candy-crunch': 1.5, 'bubble-pop': 1.5, 'memory-match': 1.5,
  // Easy/chance — everything else defaults to 1.0
};
const MIN_SECONDS_BETWEEN = 3; // basic flood protection per (user, tournament)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  let body: { gameId?: string; tournamentId?: string; score?: number; win?: boolean; timeMs?: number; leaderboard?: boolean; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const token = String(body.token ?? '');
  // Accept either the new {gameId} contract or the legacy {tournamentId}. Strip
  // the cadence suffix (bare or dated, e.g. -monthly, -daily-2026-06-27) to recover the game id.
  const gameId = String(body.gameId ?? String(body.tournamentId ?? '').replace(/-(daily|weekly|monthly)(-[0-9-]+)?$/, ''));
  const score = Number(body.score);
  // New clients send {win}; older deployed clients sent {points>0 on a win}.
  // Accept either so a function deploy can't strand the live frontend at 0 pts.
  const win = body.win !== undefined ? Boolean(body.win) : Number((body as { points?: number }).points ?? 0) > 0;
  // Whether this round should count on a leaderboard. Free games pass false →
  // points only, no leaderboard row. Defaults to true for the legacy contract.
  const wantsLeaderboard = body.leaderboard ?? (body.tournamentId != null);

  // --- validation ---
  if (!gameId || !Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return json({ error: 'invalid score' }, 400);
  }
  const ceiling = MAX_SCORE[gameId] ?? MAX_SCORE._default;
  if (score > ceiling) return json({ error: 'score out of range' }, 422);

  // Service-role client for the privileged read/write.
  const admin = createClient(url, serviceKey);

  // XP earning — doc §3.1: a NORMAL (free) game session earns a flat
  // 10 XP × difficulty, capped at 3 rewarded sessions/day/game (unlimited play,
  // just no XP past the cap). TOURNAMENT play earns NO XP — it earns Score→Rank
  // (doc §1/§2). The client never proposes an amount.
  const XP_BASE = 10;
  const difficulty = XP_DIFFICULTY[gameId] ?? 1;
  let points = 0;   // spendable XP balance (response key kept as `points` for back-compat)
  let lifetime = 0; // lifetime XP -> level
  // Apply a delta (>0) then read the authoritative balances for the response.
  const applyXpAndRead = async (delta: number): Promise<void> => {
    try {
      if (delta > 0) await admin.rpc('apply_xp', { p_user: user.id, p_delta: delta });
      const { data: prof } = await admin.from('profiles').select('xp, xp_lifetime').eq('id', user.id).maybeSingle();
      points = Number(prof?.xp ?? 0);
      lifetime = Number(prof?.xp_lifetime ?? 0);
    } catch { /* best-effort; never blocks the response */ }
  };

  // Free games: XP only (capped), no leaderboard, no token required.
  if (!wantsLeaderboard) {
    let award = 0;
    try {
      const { data: rewardable } = await admin.rpc('claim_xp_session', { p_user: user.id, p_game: gameId, p_cap: 3 });
      if (rewardable) award = Math.round(XP_BASE * difficulty);
    } catch { /* if the cap check fails, default to no award */ }
    await applyXpAndRead(award);
    let best = 0;
    let isRecord = false;
    try {
      const { data: row } = await admin.rpc('upsert_free_game_best', {
        p_user: user.id, p_game: gameId, p_score: score,
      });
      const r = Array.isArray(row) ? row[0] : row;
      best = Number(r?.best ?? score);
      isRecord = Boolean(r?.is_record);
    } catch { /* best-effort */ }
    return json({ points, lifetime, xp: points, award, best, isRecord });
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

  // Resolve the game's single LIVE tournament window server-side (no client-built
  // id). If none is live, treat this as a practice run: award capped XP, unranked.
  const { data: tid } = await admin.rpc('active_game_tournament', { p_game: gameId });
  const tournamentId = String(tid ?? '');
  if (!tournamentId) {
    let award = 0;
    try {
      const { data: rewardable } = await admin.rpc('claim_xp_session', { p_user: user.id, p_game: gameId, p_cap: 3 });
      if (rewardable) award = Math.round(XP_BASE * difficulty);
    } catch { /* default no award */ }
    await applyXpAndRead(award);
    let best = 0;
    let isRecord = false;
    try {
      const { data: row } = await admin.rpc('upsert_free_game_best', {
        p_user: user.id, p_game: gameId, p_score: score,
      });
      const r = Array.isArray(row) ? row[0] : row;
      best = Number(r?.best ?? score);
      isRecord = Boolean(r?.is_record);
    } catch { /* best-effort */ }
    return json({ points, lifetime, xp: points, award, best, isRecord, ranked: false, attemptsLeft: 0 });
  }

  // Tournament gate: window must be live; attempt was consumed at start-round.
  let attemptsLeft = 0;
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
        .from('tournament_entries').select('attempts_purchased, attempts_used')
        .eq('user_id', user.id).eq('tournament_id', tournamentId).maybeSingle();
      if (!entry) return json({ error: 'not entered' }, 402);
      const purchased = Number(entry.attempts_purchased), used = Number(entry.attempts_used);
      attemptsLeft = Math.max(0, purchased - used);
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

  // Normalize raw → RP (doc §4.2); refresh p95 baseline then rank by best RP.
  await admin.rpc('refresh_game_stats');
  const { data: rpVal } = await admin.rpc('rp_for', { p_game: gameId, p_raw: best });
  const { error: upErr } = await admin.from('scores').upsert({
    user_id: user.id,
    tournament_id: tournamentId,
    best,
    rp: Number(rpVal ?? 0),
    plays: (existing?.plays ?? 0) + 1,
    updated_at: new Date().toISOString(),
  });
  if (upErr) return json({ error: 'write failed' }, 500);

  // Tournament play earns NO XP (doc §1/§2: it earns Score→Rank, not XP). Just
  // read the current balances for the response.
  await applyXpAndRead(0);

  // Compute the player's rank and the field size from the ranked view.
  const { data: board } = await admin
    .from('leaderboard')
    .select('user_id, rank')
    .eq('tournament_id', tournamentId);
  const total = board?.length ?? 1;
  const rank = board?.find((r: { user_id: string; rank: number }) => r.user_id === user.id)?.rank ?? total;

  return json({ best, isRecord, rank, total, points, lifetime, xp: points, attemptsLeft, ranked: true, award: 0 });
});

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

const MAX_SCORE: Record<string, number> = {
  'orbit-blast': 100_000,
  'temple-dash': 1_000_000,
  'merge-2048': 5_000_000,
  'memory-match': 5_000,
  _default: 2_000_000,
};

// Per-game scoring config.
//   par = a "great round" raw score used for XP/coin normalization
interface ScoreCfg { par: number; timeWeight?: number; parTime?: number; difficulty?: number }
const GAME_SCORING: Record<string, ScoreCfg> = {
  'orbit-blast': { par: 3000 }, 'merge-2048': { par: 5000 }, 'temple-dash': { par: 1500 },
  'candy-crunch': { par: 300 },
  'brick-blitz': { par: 300 }, 'fruit-slice': { par: 1200 }, 'sky-hopper': { par: 100 },
  'bubble-pop': { par: 300 }, 'memory-match': { par: 3600 }, 'tap-game': { par: 50 },
  'lucky-box': { par: 300 },
  'spin-wheel': { par: 300 }, 'luckyslot': { par: 300 }, 'popblast': { par: 200 },
  'ethiopian-quiz': { par: 100, timeWeight: 0.5, parTime: 60000 },
  'sudoku': { par: 30 }, 'crosssum': { par: 10 }, 'logic': { par: 5 }, 'rhyme': { par: 10 },
  'spell': { par: 100, timeWeight: 0.3, parTime: 60000 },
  'vocab': { par: 100, timeWeight: 0.3, parTime: 60000 },
  'target24': { par: 6, timeWeight: 0.4, parTime: 90000 },
  'sequence': { par: 8, timeWeight: 0.4, parTime: 90000 },
  _default: { par: 100 },
};
// XP difficulty multiplier per game.
const XP_DIFFICULTY: Record<string, number> = {
  'sudoku': 2, 'crosssum': 2, 'logic': 2, 'target24': 2, 'sequence': 2,
  'merge-2048': 2, 'orbit-blast': 2, 'ethiopian-quiz': 2,
  'temple-dash': 1.5, 'brick-blitz': 1.5,
  'sky-hopper': 1.5, 'fruit-slice': 1.5, 'spell': 1.5, 'vocab': 1.5, 'rhyme': 1.5,
  'candy-crunch': 1.5, 'bubble-pop': 1.5, 'memory-match': 1.5,
};

// XP from score: xp = max(1, floor(score / par × XP_BASE × difficulty))
// No session cap — every completed round earns XP proportional to performance.
const XP_BASE = 10;

// Coins from score: coins = min(5, max(1, floor(score / par)))
// Every completed round earns coins too — no session cap.
const COIN_CAP_PER_ROUND = 5;

const MIN_SECONDS_BETWEEN = 3;

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
  return !error;
}

function computeXp(score: number, gameId: string): number {
  const cfg = GAME_SCORING[gameId] ?? GAME_SCORING._default;
  const difficulty = XP_DIFFICULTY[gameId] ?? 1;
  return Math.max(1, Math.floor((score / cfg.par) * XP_BASE * difficulty));
}

function computeCoinAward(score: number, gameId: string): number {
  const par = (GAME_SCORING[gameId] ?? GAME_SCORING._default).par;
  return Math.min(COIN_CAP_PER_ROUND, Math.max(1, Math.floor(score / par)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

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
  const gameId = String(body.gameId ?? String(body.tournamentId ?? '').replace(/-(daily|weekly|monthly)(-[0-9-]+)?$/, ''));
  const score = Number(body.score);
  const win = body.win !== undefined ? Boolean(body.win) : Number((body as { points?: number }).points ?? 0) > 0;
  const wantsLeaderboard = body.leaderboard ?? (body.tournamentId != null);

  if (!gameId || !Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    return json({ error: 'invalid score' }, 400);
  }
  const ceiling = MAX_SCORE[gameId] ?? MAX_SCORE._default;
  if (score > ceiling) return json({ error: 'score out of range' }, 422);

  const admin = createClient(url, serviceKey);

  let points = 0;
  let lifetime = 0;
  const applyXpAndRead = async (delta: number): Promise<void> => {
    try {
      if (delta > 0) await admin.rpc('apply_xp', { p_user: user.id, p_delta: delta });
      const { data: prof } = await admin.from('profiles').select('xp, xp_lifetime').eq('id', user.id).maybeSingle();
      points = Number(prof?.xp ?? 0);
      lifetime = Number(prof?.xp_lifetime ?? 0);
    } catch { /* best-effort */ }
  };

  // ------------------------------------------------------------------
  // FREE GAMES: XP + coins from score (no cap), no leaderboard
  // ------------------------------------------------------------------
  if (!wantsLeaderboard) {
    const award = computeXp(score, gameId);
    const coinAward = computeCoinAward(score, gameId);
    await applyXpAndRead(award);

    let coins = 0;
    if (coinAward > 0) {
      try {
        await admin.rpc('apply_coins', { p_user: user.id, p_delta: coinAward, p_reason: 'score_reward', p_ref: gameId });
      } catch { /* best-effort */ }
    }
    try {
      const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
      coins = Number(prof?.coins ?? 0);
    } catch { /* best-effort */ }

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
    return json({ points, lifetime, xp: points, award, coinAward, coins, best, isRecord });
  }

  // ------------------------------------------------------------------
  // TOURNAMENT: leaderboard scores require a valid round token
  // ------------------------------------------------------------------
  const signingSecret = Deno.env.get('ROUND_SIGNING_SECRET');
  if (signingSecret) {
    const ok = await verifyAndBurnToken(admin, token, user.id, gameId, signingSecret);
    if (!ok) return json({ error: 'invalid round token' }, 403);
  }

  const { data: tid } = await admin.rpc('active_game_tournament', { p_game: gameId });
  const tournamentId = String(tid ?? '');
  if (!tournamentId) {
    // No live tournament — treat as practice, still earn XP + coins
    const award = computeXp(score, gameId);
    const coinAward = computeCoinAward(score, gameId);
    await applyXpAndRead(award);
    let coins = 0;
    if (coinAward > 0) {
      try { await admin.rpc('apply_coins', { p_user: user.id, p_delta: coinAward, p_reason: 'score_reward', p_ref: gameId }); } catch {}
    }
    try {
      const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
      coins = Number(prof?.coins ?? 0);
    } catch {}
    let best = 0;
    let isRecord = false;
    try {
      const { data: row } = await admin.rpc('upsert_free_game_best', { p_user: user.id, p_game: gameId, p_score: score });
      const r = Array.isArray(row) ? row[0] : row;
      best = Number(r?.best ?? score);
      isRecord = Boolean(r?.is_record);
    } catch {}
    return json({ points, lifetime, xp: points, award, coinAward, coins, best, isRecord, ranked: false, attemptsLeft: 0 });
  }

  // Tournament gate: window must be live.
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
    const { data: entry } = await admin
      .from('tournament_entries').select('attempts_purchased, attempts_used')
      .eq('user_id', user.id).eq('tournament_id', tournamentId).maybeSingle();
    if (entry) {
      attemptsLeft = Math.max(0, Number(entry.attempts_purchased) - Number(entry.attempts_used));
    }
  }

  const { data: existing } = await admin
    .from('scores')
    .select('best, plays, updated_at')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)
    .maybeSingle();

  if (existing?.updated_at) {
    const since = (Date.now() - new Date(existing.updated_at).getTime()) / 1000;
    if (since < MIN_SECONDS_BETWEEN) return json({ error: 'too fast' }, 429);
  }

  const prevBest = existing?.best ?? 0;
  const isRecord = score > prevBest;
  const best = Math.max(prevBest, score);

  // RP is purely score-based — independent of coins, XP, or attempts.
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

  // Tournament rounds also earn XP + coins from score (same formula as free).
  const award = computeXp(score, gameId);
  const coinAward = computeCoinAward(score, gameId);
  await applyXpAndRead(award);
  let coins = 0;
  if (coinAward > 0) {
    try { await admin.rpc('apply_coins', { p_user: user.id, p_delta: coinAward, p_reason: 'score_reward', p_ref: gameId }); } catch {}
  }
  try {
    const { data: prof } = await admin.from('profiles').select('coins').eq('id', user.id).maybeSingle();
    coins = Number(prof?.coins ?? 0);
  } catch {}

  const { data: board } = await admin
    .from('leaderboard')
    .select('user_id, rank')
    .eq('tournament_id', tournamentId);
  const total = board?.length ?? 1;
  const rank = board?.find((r: { user_id: string; rank: number }) => r.user_id === user.id)?.rank ?? total;

  return json({ best, isRecord, rank, total, points, lifetime, xp: points, attemptsLeft, ranked: true, award, coinAward, coins, rp: Number(rpVal ?? 0) });
});

// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// runner-submit — the Ethiopian Runner score gate (server-authoritative, no
// client-proposed amounts). Every finished run:
//   1. awards XP per doc §3.1 — a flat 10 × difficulty, capped at 3 rewarded
//      sessions/day/game (claim_xp_session) — into the UNIFIED global XP wallet
//      (apply_xp on profiles → the single platform level), not a separate counter;
//   2. if the player has a live tournament entry (for the chosen period) with
//      attempts remaining, consumes one attempt, keeps the RAW best, normalizes it
//      to RP (doc §4.2, rp_for) and ranks the leaderboard by best RP.
// Free runs (no entry/attempts) still earn XP but don't rank — the doc's two
// tracks merged on one game. Anti-cheat: an optional single-use round token
// (start-round) ties the score to a real session.
//
// Deploy: supabase functions deploy runner-submit

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GAME_ID = 'temple-dash';
const MAX_SCORE = 1_000_000; // sane ceiling; runner score is distance-based

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

// --- anti-cheat round-token helpers (mirror start-round signing) ---
function b64urlDecode(s: string): string { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); }
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
  return !error; // unique-violation (replay) -> reject
}

// Doc §3.2 cumulative level table (mirrors src/platform/config.ts).
const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1500, 2200, 3000, 4000, 5000, 6000];
const levelFor = (xp: number): number => {
  const v = Math.max(0, xp); let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) { if (v >= LEVEL_THRESHOLDS[i]) lvl = i + 1; else return lvl; }
  return 10 + Math.floor((v - 6000) / 3000);
};

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

  let body: { score?: number; timeMs?: number; token?: string; period?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const period = ['daily', 'weekly', 'monthly'].includes(String(body.period)) ? String(body.period) : 'monthly';
  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0) return json({ error: 'invalid score' }, 400);
  if (score > MAX_SCORE) return json({ error: 'score out of range' }, 422);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Anti-cheat: require a valid single-use token when the secret is configured.
  const secret = Deno.env.get('ROUND_SIGNING_SECRET');
  if (secret) {
    const ok = await verifyAndBurnToken(admin, String(body.token ?? ''), user.id, GAME_ID, secret);
    if (!ok) return json({ error: 'invalid round token' }, 403);
  }

  // 1) Award XP (free track) — doc §3.1: a normal session earns a flat
  // 10 XP × difficulty, capped at 3 rewarded sessions/day. UNIFIED ECONOMY: the
  // runner feeds the SAME global XP wallet as every other game (profiles via
  // apply_xp → the single platform level), not a separate runner_xp counter.
  const XP_BASE = 10, DIFFICULTY = 1.5; // temple-dash = Medium
  let award = 0;
  try {
    const { data: rewardable } = await admin.rpc('claim_xp_session', { p_user: user.id, p_game: GAME_ID, p_cap: 3 });
    if (rewardable) award = Math.round(XP_BASE * DIFFICULTY);
  } catch { /* no award if the cap check fails */ }
  if (award > 0) await admin.rpc('apply_xp', { p_user: user.id, p_delta: award });
  const { data: xpRow } = await admin
    .from('profiles').select('xp_lifetime, xp_season').eq('id', user.id).maybeSingle();
  const xp = Number(xpRow?.xp_lifetime ?? 0);        // lifetime XP → level
  const xpSeason = Number(xpRow?.xp_season ?? 0);

  // 2) Ranked track — only if entered with attempts left in the live tournament.
  let ranked = false, best = 0, bestRp = 0, rank = 0, total = 0, attemptsLeft = 0;
  const { data: tid } = await admin.rpc('active_runner_tournament_period', { p_period: period });
  if (tid) {
    const { data: entry } = await admin
      .from('runner_entries')
      .select('attempts_purchased, attempts_used')
      .eq('user_id', user.id).eq('tournament_id', String(tid)).maybeSingle();
    if (entry && Number(entry.attempts_used) < Number(entry.attempts_purchased)) {
      // Consume one attempt.
      await admin.from('runner_entries')
        .update({ attempts_used: Number(entry.attempts_used) + 1 })
        .eq('user_id', user.id).eq('tournament_id', String(tid));
      attemptsLeft = Number(entry.attempts_purchased) - Number(entry.attempts_used) - 1;

      // Keep the best raw score.
      const { data: prev } = await admin
        .from('runner_scores').select('best, plays')
        .eq('user_id', user.id).eq('tournament_id', String(tid)).maybeSingle();
      best = Math.max(Number(prev?.best ?? 0), score);
      // Normalize raw → RP (doc §4.2); refresh p95 baseline then rank by best RP.
      await admin.rpc('refresh_game_stats');
      const { data: rpVal } = await admin.rpc('rp_for', { p_game: GAME_ID, p_raw: best });
      bestRp = Number(rpVal ?? 0);
      await admin.from('runner_scores').upsert({
        user_id: user.id, tournament_id: String(tid),
        best, rp: bestRp, plays: Number(prev?.plays ?? 0) + 1, updated_at: new Date().toISOString(),
      });

      // Rank + field size from the ranked view.
      const { data: board } = await admin
        .from('runner_leaderboard').select('user_id, rank').eq('tournament_id', String(tid));
      total = board?.length ?? 1;
      rank = board?.find((r: { user_id: string; rank: number }) => r.user_id === user.id)?.rank ?? total;
      ranked = true;
    } else if (entry) {
      attemptsLeft = Math.max(0, Number(entry.attempts_purchased) - Number(entry.attempts_used));
    }
  }

  return json({ award, xp, xpSeason, level: levelFor(xp), ranked, best, rp: bestRp, rank, total, attemptsLeft });
});

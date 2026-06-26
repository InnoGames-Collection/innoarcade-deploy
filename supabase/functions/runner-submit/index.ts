// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// runner-submit — the Ethiopian Runner score gate (server-authoritative, no
// client-proposed amounts). Every finished run:
//   1. awards XP from the uniform matrix (BASE x performance), driving level +
//      season rank (runner_apply_xp);
//   2. if the player has a live tournament entry with attempts remaining, also
//      consumes one attempt and records the RAW best for the leaderboard.
// Free runs (no entry/attempts) still earn XP but don't rank — the doc's two
// tracks merged on one game. Anti-cheat: an optional single-use round token
// (start-round) ties the score to a real session.
//
// Deploy: supabase functions deploy runner-submit

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GAME_ID = 'temple-dash';
const MAX_SCORE = 1_000_000; // sane ceiling; runner score is distance-based
const PAR = 1500;            // a "great run" -> performance 1.0 (full XP)
const BASE = 100;            // XP for a perfect run

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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

const levelFor = (xp: number): number => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));

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

  let body: { score?: number; timeMs?: number; token?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
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

  // 1) Award XP (free track) — every run, server-computed.
  const performance = Math.max(0, Math.min(1, score / PAR));
  const award = Math.round(BASE * performance);
  await admin.rpc('runner_apply_xp', { p_user: user.id, p_delta: award });
  const { data: xpRow } = await admin
    .from('runner_xp').select('xp, xp_season').eq('user_id', user.id).maybeSingle();
  const xp = Number(xpRow?.xp ?? award);
  const xpSeason = Number(xpRow?.xp_season ?? award);

  // 2) Ranked track — only if entered with attempts left in the live tournament.
  let ranked = false, best = 0, rank = 0, total = 0, attemptsLeft = 0;
  const { data: tid } = await admin.rpc('active_runner_tournament');
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
      await admin.from('runner_scores').upsert({
        user_id: user.id, tournament_id: String(tid),
        best, plays: Number(prev?.plays ?? 0) + 1, updated_at: new Date().toISOString(),
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

  return json({ award, xp, xpSeason, level: levelFor(xp), ranked, best, rank, total, attemptsLeft });
});

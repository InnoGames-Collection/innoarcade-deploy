// @ts-nocheck — Deno Edge Function (Supabase runtime), not part of the Vite build.
//
// Edge Function: start-round — anti-cheat round token + tournament attempt consume.
// One attempt is deducted when a ranked run STARTS (Play / Play again).
// Pause/resume does not call this again.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(mac));
}

async function consumeAttempt(admin: ReturnType<typeof createClient>, userId: string, tournamentId: string) {
  const { data: entry } = await admin
    .from('tournament_entries').select('attempts_purchased, attempts_used')
    .eq('user_id', userId).eq('tournament_id', tournamentId).maybeSingle();
  if (!entry) return { ok: false, status: 402, attemptsLeft: 0, error: 'not entered' };
  const purchased = Number(entry.attempts_purchased), used = Number(entry.attempts_used);
  if (used >= purchased) return { ok: false, status: 402, attemptsLeft: 0, error: 'no attempts left' };
  const { data: upd } = await admin
    .from('tournament_entries')
    .update({ attempts_used: used + 1 })
    .eq('user_id', userId).eq('tournament_id', tournamentId).eq('attempts_used', used)
    .select('attempts_used');
  if (!upd?.length) return { ok: false, status: 402, attemptsLeft: 0, error: 'no attempts left' };
  return { ok: true, attemptsLeft: purchased - (used + 1) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { gameId?: string; ranked?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const gameId = String(body.gameId ?? '');
  if (!gameId) return json({ error: 'gameId required' }, 400);
  const ranked = body.ranked !== false;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let attemptsLeft: number | undefined;

  if (ranked) {
    const { data: tid } = await admin.rpc('active_game_tournament', { p_game: gameId });
    const tournamentId = String(tid ?? '');
    if (tournamentId) {
      const { data: tour } = await admin
        .from('tournaments').select('type, starts_at, ends_at, state')
        .eq('id', tournamentId).maybeSingle();
      if (tour) {
        const now = Date.now();
        const live = tour.state === 'live' ||
          (now >= new Date(tour.starts_at).getTime() && now < new Date(tour.ends_at).getTime()
            && tour.state !== 'ended' && tour.state !== 'settled' && tour.state !== 'settling');
        if (live && tour.type === 'paid') {
          const res = await consumeAttempt(admin, user.id, tournamentId);
          if (!res.ok) return json({ error: res.error, attemptsLeft: res.attemptsLeft }, res.status);
          attemptsLeft = res.attemptsLeft;
        }
      }
    }
  }

  const secret = Deno.env.get('ROUND_SIGNING_SECRET');
  if (!secret) return json({ token: '', attemptsLeft });

  const jti = crypto.randomUUID();
  const payloadObj = { uid: user.id, gid: gameId, iat: Date.now(), jti };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const sig = await sign(payload, secret);
  return json({ token: `${payload}.${sig}`, attemptsLeft });
});

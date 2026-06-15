// @ts-nocheck — Deno Edge Function (Supabase runtime), not part of the Vite build.
//
// Edge Function: start-round — anti-cheat round token issuer.
//
// A score only counts if it corresponds to a round that actually STARTED on the
// server. This function, called when a round begins, returns a short-lived,
// HMAC-signed token bound to {userId, gameId}. The client passes it back to
// submit-score, which verifies the signature + freshness and burns the token
// (single-use via used_nonces) so a captured token can't be replayed or forged.
//
// Enforcement is keyed on the ROUND_SIGNING_SECRET function secret: set it and
// submit-score requires a valid token for leaderboard submissions. Without it
// the platform stays in the pre-hardening (token-optional) mode.
//
// Deploy: supabase functions deploy start-round

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
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

  let body: { gameId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const gameId = String(body.gameId ?? '');
  if (!gameId) return json({ error: 'gameId required' }, 400);

  const secret = Deno.env.get('ROUND_SIGNING_SECRET');
  // Token-optional mode: no secret configured → issue an empty token; submit-score
  // won't require one. Lets the platform run before the secret is rolled out.
  if (!secret) return json({ token: '' });

  const jti = crypto.randomUUID();
  const payloadObj = { uid: user.id, gid: gameId, iat: Date.now(), jti };
  const payload = b64url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const sig = await sign(payload, secret);
  return json({ token: `${payload}.${sig}` });
});

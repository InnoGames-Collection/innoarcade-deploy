// @ts-nocheck — Deno Edge Function (Supabase). Not part of the Vite/Node build.
//
// unlock-game — unlock a level-gated game early by spending coins. The cost is
// server-owned (clients can't propose it); coins move via apply_coins (no
// overdraw), and the gameId is appended to profiles.unlocks. Idempotent: an
// already-unlocked game returns success without charging again.
//
// Deploy: supabase functions deploy unlock-game

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server-authoritative gate (mirror of GATE in src/platform/catalog.ts).
const GATE: Record<string, { minLevel: number; unlockCost: number }> = {
  'luckyslot': { minLevel: 2, unlockCost: 50 },
  'spin-wheel': { minLevel: 2, unlockCost: 50 },
  'target24': { minLevel: 2, unlockCost: 50 },
  'logic': { minLevel: 2, unlockCost: 50 },
  'crash-game': { minLevel: 3, unlockCost: 100 },
  'sequence': { minLevel: 3, unlockCost: 100 },
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: { gameId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const gameId = String(body.gameId ?? '');
  const gate = GATE[gameId];
  if (!gate) return json({ error: 'not a gated game' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: prof } = await admin.from('profiles').select('coins, unlocks').eq('id', user.id).maybeSingle();
  const unlocks: string[] = Array.isArray(prof?.unlocks) ? prof!.unlocks : [];
  if (unlocks.includes(gameId)) return json({ coins: Number(prof?.coins ?? 0), unlocks });

  // Charge the unlock cost (refuses to overdraw).
  const { data: bal, error } = await admin.rpc('apply_coins', {
    p_user: user.id, p_delta: -gate.unlockCost, p_reason: 'unlock', p_ref: gameId,
  });
  if (error) return json({ error: 'insufficient coins' }, 402);

  const next = [...unlocks, gameId];
  await admin.from('profiles').update({ unlocks: next }).eq('id', user.id);
  return json({ coins: Number(bal), unlocks: next });
});

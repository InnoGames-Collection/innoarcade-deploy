// @ts-nocheck — Deno Edge Function (Supabase runtime), not part of the Vite build.
//
// Edge Function: enter-draw — buy one draw ticket by SPENDING POINTS.
//
// The points-spend path for the lottery draws: it debits the ticket cost from
// the player's server-side points balance (apply_points, which refuses to
// overdraw) and records the ticket in draw_entries — atomically and
// server-authoritatively, so the client can never grant itself tickets or spend
// points it doesn't have. The cost is derived from the draw period on the
// server, never trusted from the client.
//
// Deploy: supabase functions deploy enter-draw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server-owned ticket prices by draw period (mirror of SPEC in draws.ts).
const COST: Record<string, number> = { daily: 50, weekly: 120, monthly: 300 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
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

  let body: { drawId?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const drawId = String(body.drawId ?? '');
  const period = drawId.split('-')[0];
  const cost = COST[period];
  if (!drawId || !cost) return json({ error: 'invalid draw' }, 400);

  const admin = createClient(url, serviceKey);

  // Debit points first (raises check_violation if the balance can't cover it).
  let points: number;
  try {
    const { data: pbal, error } = await admin.rpc('apply_points', { p_user: user.id, p_delta: -cost });
    if (error) throw error;
    points = Number(pbal);
  } catch {
    return json({ error: 'not enough points' }, 402);
  }

  // Record the ticket (upsert tickets += 1).
  const { data: existing } = await admin
    .from('draw_entries').select('tickets').eq('user_id', user.id).eq('draw_id', drawId).maybeSingle();
  const tickets = (existing?.tickets ?? 0) + 1;
  await admin.from('draw_entries').upsert({
    user_id: user.id, draw_id: drawId, tickets, updated_at: new Date().toISOString(),
  });

  return json({ points, tickets });
});

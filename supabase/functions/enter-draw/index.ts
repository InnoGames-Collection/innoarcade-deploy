// @ts-nocheck — Deno Edge Function (Supabase runtime), not part of the Vite build.
//
// Edge Function: enter-draw — buy one draw ticket by SPENDING POINTS.
//
// The points-spend path for the lottery draws: it debits the ticket cost from
// the player's server-side points balance (apply_points, which refuses to
// overdraw) and records the ticket in draw_entries — atomically and
// server-authoritatively, so the client can never grant itself tickets or spend
// points it doesn't have. The ticket cost AND the per-user ticket cap are read
// from the authoritative `draws` row (never trusted from the client), and the
// draw must still be open.
//
// Deploy: supabase functions deploy enter-draw

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (!drawId) return json({ error: 'invalid draw' }, 400);

  const admin = createClient(url, serviceKey);

  // Make sure the current windows exist, then read the authoritative draw row
  // (cost, cap, state, window) — never trust the client for any of these.
  await admin.rpc('ensure_active_draws');
  const { data: draw } = await admin
    .from('draws')
    .select('ticket_cost_points, max_tickets_per_user, state, ends_at')
    .eq('id', drawId).maybeSingle();
  if (!draw) return json({ error: 'unknown draw' }, 404);

  const closed = draw.state !== 'open' || new Date(draw.ends_at).getTime() <= Date.now();
  if (closed) return json({ error: 'draw closed' }, 409);

  const cost = Number(draw.ticket_cost_points);

  // Enforce the per-user ticket cap so no single spender can dominate the pool.
  const { data: existing } = await admin
    .from('draw_entries').select('tickets').eq('user_id', user.id).eq('draw_id', drawId).maybeSingle();
  const held = Number(existing?.tickets ?? 0);
  if (held >= Number(draw.max_tickets_per_user)) return json({ error: 'ticket cap reached' }, 409);

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
  const tickets = held + 1;
  await admin.from('draw_entries').upsert({
    user_id: user.id, draw_id: drawId, tickets, updated_at: new Date().toISOString(),
  });

  return json({ points, tickets });
});

// @ts-nocheck — Deno Edge Function (Supabase).
//
// admin-action — the single guarded entry point for operator mutations. It
// re-checks is_admin() server-side (the client's role claim is never trusted),
// then dispatches on `action`:
//   saveTournament    — upsert a tournament row
//   adjustCoins       — credit/debit a player's wallet (apply_coins → ledgered)
//   setRole           — promote/demote a player (player | admin)
//   saveConfig        — merge operator config into app_config('app')
//   saveDraw          — tune a draw's operator fields (prize/cost/cap/window/title)
//   fulfillDrawWinner — mark an ETB-airtime prize paid/failed for a winner
//
// Tournament settlement is its own function (settle-tournament), and draw
// settlement is settle-draws, because a cron job calls them too.
//
// Deploy: supabase functions deploy admin-action

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  const user = u.user;
  if (!user) return json({ error: 'not signed in' }, 401);

  const admin = createClient(url, service);
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (prof?.role !== 'admin') return json({ error: 'forbidden' }, 403);

  let body: { action?: string; [k: string]: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  switch (body.action) {
    case 'saveTournament': {
      const t = body.tournament as Record<string, unknown>;
      if (!t?.id || !t?.gameId) return json({ error: 'invalid tournament' }, 400);
      const { error } = await admin.from('tournaments').upsert({
        id: t.id, game_id: t.gameId, title_en: t.titleEn, title_am: t.titleAm,
        type: t.type, entry_fee_coins: t.entryFeeCoins, prize_model: t.prizeModel,
        sponsored_prize: t.sponsoredPrize, prize_tiers: t.prizeTiers,
        starts_at: new Date(Number(t.startsAt)).toISOString(),
        ends_at: new Date(Number(t.endsAt)).toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'adjustCoins': {
      const userId = String(body.userId ?? '');
      const delta = Number(body.delta);
      if (!userId || !Number.isFinite(delta)) return json({ error: 'invalid' }, 400);
      const { error } = await admin.rpc('apply_coins', {
        p_user: userId, p_delta: delta, p_reason: String(body.reason ?? 'admin_adjust'), p_ref: 'admin',
      });
      if (error) return json({ error: 'apply failed (insufficient?)' }, 422);
      return json({ ok: true });
    }

    case 'setRole': {
      const userId = String(body.userId ?? '');
      const role = body.role === 'admin' ? 'admin' : 'player';
      if (!userId) return json({ error: 'invalid' }, 400);
      const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'saveConfig': {
      const cfg = body.config as Record<string, unknown>;
      const { data: existing } = await admin.from('app_config').select('value').eq('key', 'app').maybeSingle();
      const merged = { ...(existing?.value ?? {}), ...cfg };
      const { error } = await admin.from('app_config')
        .upsert({ key: 'app', value: merged, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'saveDraw': {
      // Tune operator-controlled fields only. Draw WINDOWS (and their committed
      // seeds) are created automatically by ensure_active_draws — never here —
      // so the commit-reveal commitment can't be tampered with from the console.
      const d = body.draw as Record<string, unknown>;
      if (!d?.id) return json({ error: 'invalid draw' }, 400);
      const patch: Record<string, unknown> = {};
      if (d.titleEn !== undefined) patch.title_en = String(d.titleEn);
      if (d.titleAm !== undefined) patch.title_am = String(d.titleAm);
      if (d.prizeEtb !== undefined) patch.prize_etb = Math.max(0, Math.floor(Number(d.prizeEtb)));
      if (d.ticketCostPoints !== undefined) patch.ticket_cost_points = Math.max(0, Math.floor(Number(d.ticketCostPoints)));
      if (d.maxTicketsPerUser !== undefined) patch.max_tickets_per_user = Math.max(1, Math.floor(Number(d.maxTicketsPerUser)));
      if (d.minTickets !== undefined) patch.min_tickets = Math.max(0, Math.floor(Number(d.minTickets)));
      if (d.winnerCount !== undefined) patch.winner_count = Math.max(1, Math.floor(Number(d.winnerCount)));
      if (!Object.keys(patch).length) return json({ error: 'nothing to update' }, 400);
      const { error } = await admin.from('draws').update(patch).eq('id', String(d.id));
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    case 'fulfillDrawWinner': {
      // Operator confirms the ETB airtime prize was disbursed (or failed). The
      // airtime gateway integration is external; this records the outcome so the
      // winners list reconciles. Pending → paid | failed.
      const drawId = String(body.drawId ?? '');
      const rank = Number(body.rank);
      const status = body.status === 'failed' ? 'failed' : 'paid';
      if (!drawId || !Number.isInteger(rank)) return json({ error: 'invalid' }, 400);
      const { error } = await admin.from('draw_winners')
        .update({ fulfillment_status: status }).eq('draw_id', drawId).eq('rank', rank);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});

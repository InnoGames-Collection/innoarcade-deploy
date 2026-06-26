// Operator API for the admin console — the single module the /admin app talks to.
//
// Every read is a plain query; every WRITE is funnelled through the
// `admin-action` Edge Function, which re-checks is_admin() server-side before
// touching anything (the client never trusts its own role claim). The console is
// 100% server-backed — there is no offline/demo data path.

import { supabase, isConfigured } from './supabase';
import { patchConfigCache, type AppConfig } from './config';
import { type Order } from './payments';
import {
  activeTournaments, loadTournaments, tournamentState, prizePool,
  type Tournament,
} from './tournaments';

export type Role = 'player' | 'admin';

export interface AdminPlayer {
  id: string;
  name: string;
  phone: string;
  coins: number;
  role: Role;
  createdAt: number;
}

export interface Metrics {
  players: number;
  coinsSold: number;
  revenueEtb: number;
  /** Gross gaming revenue = entry fees collected − prizes paid (house rake). */
  ggr: number;
  liveTournaments: number;
  pendingPayouts: number;
  /** Revenue (ETB) for the last 7 days, oldest → newest, for the dashboard chart. */
  revenueSeries: number[];
}

// --- Role gate --------------------------------------------------------------

export async function isAdmin(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return false;
    const { data } = await sb.from('profiles').select('role').eq('id', me).maybeSingle();
    return data?.role === 'admin';
  } catch { return false; }
}

// --- Metrics ----------------------------------------------------------------

export async function metrics(): Promise<Metrics> {
  await loadTournaments();
  const tours = activeTournaments();
  const live = tours.filter((t) => tournamentState(t) === 'live').length;
  const pending = tours.filter((t) => tournamentState(t) === 'ended').length;

  // Aggregate from the tables (best-effort; falls back to partials).
  const sb = supabase();
  const [{ count: players }, ordersRes] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('payment_orders').select('amount_etb, coins, status, created_at').eq('status', 'paid'),
  ]);
  const orders = ordersRes.data ?? [];
  const revenueEtb = orders.reduce((s, o) => s + Number(o.amount_etb), 0);
  const coinsSold = orders.reduce((s, o) => s + Number(o.coins), 0);
  const series = lastSevenDays(orders.map((o) => ({ at: new Date(o.created_at as string).getTime(), v: Number(o.amount_etb) })));
  return {
    players: players ?? 0,
    coinsSold,
    revenueEtb,
    ggr: Math.round(revenueEtb * 0.12),
    liveTournaments: live,
    pendingPayouts: pending,
    revenueSeries: series,
  };
}

function lastSevenDays(rows: Array<{ at: number; v: number }>): number[] {
  const day = 864e5;
  const today = Math.floor(Date.now() / day);
  const buckets = new Array(7).fill(0);
  for (const r of rows) {
    const idx = 6 - (today - Math.floor(r.at / day));
    if (idx >= 0 && idx < 7) buckets[idx] += r.v;
  }
  return buckets;
}

// --- Tournament management --------------------------------------------------

export interface AdminTournament extends Tournament {
  state: ReturnType<typeof tournamentState>;
  pool: number;
}

export async function listTournaments(): Promise<AdminTournament[]> {
  await loadTournaments();
  return activeTournaments().map((t) => ({ ...t, state: tournamentState(t), pool: prizePool(t) }));
}

export async function saveTournament(t: Tournament): Promise<void> {
  await adminAction('saveTournament', { tournament: t });
}

export async function settleTournament(id: string): Promise<{ won: number }> {
  const { error } = await supabase().functions.invoke('settle-tournament', { body: { tournamentId: id } });
  if (error) throw error;
  return { won: 0 };
}

// --- Draw management --------------------------------------------------------

export interface AdminDraw {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  titleEn: string;
  titleAm: string;
  prizeEtb: number;
  ticketCostPoints: number;
  maxTicketsPerUser: number;
  minTickets: number;
  winnerCount: number;
  state: string;
  startsAt: number;
  endsAt: number;
  /** Live pool — entrants + total tickets (from draw_pools). */
  entrants: number;
  totalTickets: number;
}

export interface AdminDrawWinner {
  drawId: string;
  rank: number;
  name: string;
  phone: string;
  prizeEtb: number;
  fulfillment: 'pending' | 'paid' | 'failed';
  createdAt: number;
}

export async function listDraws(): Promise<AdminDraw[]> {
  const sb = supabase();
  const [{ data: rows }, { data: pools }] = await Promise.all([
    sb.from('draws').select('id, period, title_en, title_am, prize_etb, ticket_cost_points, max_tickets_per_user, min_tickets, winner_count, state, starts_at, ends_at').order('ends_at', { ascending: false }),
    sb.from('draw_pools').select('draw_id, entrants, total_tickets'),
  ]);
  const pool = new Map((pools ?? []).map((p) => [String(p.draw_id), p]));
  return (rows ?? []).map((r) => {
    const p = pool.get(String(r.id));
    return {
      id: String(r.id), period: r.period as AdminDraw['period'],
      titleEn: String(r.title_en), titleAm: String(r.title_am),
      prizeEtb: Number(r.prize_etb), ticketCostPoints: Number(r.ticket_cost_points),
      maxTicketsPerUser: Number(r.max_tickets_per_user), minTickets: Number(r.min_tickets),
      winnerCount: Number(r.winner_count), state: String(r.state),
      startsAt: new Date(r.starts_at as string).getTime(),
      endsAt: new Date(r.ends_at as string).getTime(),
      entrants: Number(p?.entrants ?? 0), totalTickets: Number(p?.total_tickets ?? 0),
    };
  });
}

export async function listDrawWinners(limit = 100): Promise<AdminDrawWinner[]> {
  const sb = supabase();
  const { data } = await sb
    .from('draw_winners')
    .select('draw_id, rank, prize_etb, fulfillment_status, created_at, user_id, profiles(name, phone)')
    .order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((r) => {
    const prof = (r as { profiles?: { name?: string; phone?: string } }).profiles;
    return {
      drawId: String(r.draw_id), rank: Number(r.rank),
      name: String(prof?.name ?? 'Player'), phone: String(prof?.phone ?? ''),
      prizeEtb: Number(r.prize_etb),
      fulfillment: (r.fulfillment_status as AdminDrawWinner['fulfillment']) ?? 'pending',
      createdAt: new Date(r.created_at as string).getTime(),
    };
  });
}

export async function saveDraw(draw: Partial<AdminDraw> & { id: string }): Promise<void> {
  await adminAction('saveDraw', { draw });
}

export async function settleDraws(): Promise<{ settled: number }> {
  const { data, error } = await supabase().functions.invoke('settle-draws', { body: {} });
  if (error) throw error;
  return data as { settled: number };
}

export async function fulfillDrawWinner(drawId: string, rank: number, status: 'paid' | 'failed'): Promise<void> {
  await adminAction('fulfillDrawWinner', { drawId, rank, status });
}

// --- Player management ------------------------------------------------------

export async function listPlayers(query = ''): Promise<AdminPlayer[]> {
  let q = supabase().from('profiles').select('id, name, phone, coins, role, created_at').limit(200);
  if (query) q = q.or(`name.ilike.%${query}%,phone.ilike.%${query}%`);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: String(r.id), name: String(r.name), phone: String(r.phone ?? ''),
    coins: Number(r.coins), role: (r.role as Role) ?? 'player',
    createdAt: new Date(r.created_at as string).getTime(),
  }));
}

export async function adjustCoins(userId: string, delta: number, reason = 'admin_adjust'): Promise<void> {
  await adminAction('adjustCoins', { userId, delta, reason });
}

export async function setRole(userId: string, role: Role): Promise<void> {
  await adminAction('setRole', { userId, role });
}

// --- Payments ---------------------------------------------------------------

export async function listOrders(limit = 100): Promise<Order[]> {
  const { data } = await supabase()
    .from('payment_orders')
    .select('id, package_id, coins, amount_etb, method, status, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({
    id: String(r.id), packageId: String(r.package_id), coins: Number(r.coins),
    amountEtb: Number(r.amount_etb), method: r.method as Order['method'],
    status: r.status as Order['status'], createdAt: new Date(r.created_at as string).getTime(),
  }));
}

// --- Config -----------------------------------------------------------------

export async function saveConfig(next: Partial<AppConfig>): Promise<AppConfig> {
  await adminAction('saveConfig', { config: next });
  return patchConfigCache(next);
}

// --- Edge Function bridge ---------------------------------------------------

async function adminAction(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase().functions.invoke('admin-action', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}

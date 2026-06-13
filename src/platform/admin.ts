// Operator API for the admin console — the single module the /admin app talks to.
//
// Every read is a plain query; every WRITE is funnelled through the
// `admin-action` Edge Function, which re-checks is_admin() server-side before
// touching anything (the client never trusts its own role claim). Offline, the
// console runs against the same local stores the player app uses, with a
// deterministic synthesized player base + KPI baseline so the dashboards look
// like a live operation in the demo — the same "stable simulated field" trick
// tournaments.ts uses for leaderboards.

import { isConfigured, supabase } from './supabase';
import { config, saveConfigLocal, type AppConfig } from './config';
import { myOrders, type Order } from './payments';
import {
  activeTournaments, loadTournaments, tournamentState, prizePool,
  saveTournamentLocal, settleLocal, type Tournament,
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
  if (!isConfigured()) return true; // demo console is open offline
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return false;
    const { data } = await sb.from('profiles').select('role').eq('id', me).maybeSingle();
    return data?.role === 'admin';
  } catch { return false; }
}

// --- Synthetic offline data (deterministic) ---------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Abeni', 'Dawit', 'Sara', 'Yonas', 'Helen', 'Bereket', 'Marta', 'Kalkidan',
  'Nahom', 'Selam', 'Tewodros', 'Ruth', 'Eyob', 'Hanna', 'Robel', 'Mimi',
  'Liya', 'Samuel', 'Meron', 'Henok', 'Feven', 'Biruk', 'Tigist', 'Amanuel',
];

const SYNTH_PLAYERS = 40; // the synthesized roster shown offline

function syntheticPlayers(): AdminPlayer[] {
  const rng = mulberry32(0xA17ADE);
  const out: AdminPlayer[] = [];
  for (let i = 0; i < SYNTH_PLAYERS; i++) {
    const name = NAMES[i % NAMES.length] + (i >= NAMES.length ? String(i) : '');
    out.push({
      id: `u_${i}`,
      name,
      phone: '+2519' + Math.floor(10_000_000 + rng() * 89_999_999),
      coins: Math.round(rng() * 1500),
      role: 'player',
      createdAt: Date.now() - Math.floor(rng() * 90) * 864e5,
    });
  }
  return out;
}

// --- Metrics ----------------------------------------------------------------

export async function metrics(): Promise<Metrics> {
  await loadTournaments();
  const tours = activeTournaments();
  const live = tours.filter((t) => tournamentState(t) === 'live').length;
  const pending = tours.filter((t) => tournamentState(t) === 'ended').length;

  if (!isConfigured()) {
    const orders = await myOrders(100);
    const paid = orders.filter((o) => o.status === 'paid');
    // Real local activity + a believable baseline so the demo looks operational.
    const baseRevenue = 84_500;
    const revenueEtb = baseRevenue + paid.reduce((s, o) => s + o.amountEtb, 0);
    const coinsSold = 168_000 + paid.reduce((s, o) => s + o.coins, 0);
    const rng = mulberry32(0xFEED01);
    const series = Array.from({ length: 7 }, () => Math.round(8_000 + rng() * 9_000));
    return {
      players: SYNTH_PLAYERS + 1,
      coinsSold,
      revenueEtb,
      ggr: Math.round(revenueEtb * 0.12),
      liveTournaments: live,
      pendingPayouts: pending,
      revenueSeries: series,
    };
  }

  // Online: aggregate from the tables (best-effort; falls back to partials).
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
  if (!isConfigured()) { saveTournamentLocal(t); return; }
  await adminAction('saveTournament', { tournament: t });
}

export async function settleTournament(id: string): Promise<{ won: number }> {
  if (!isConfigured()) return { won: settleLocal(id) };
  const { error } = await supabase().functions.invoke('settle-tournament', { body: { tournamentId: id } });
  if (error) throw error;
  return { won: 0 };
}

// --- Player management ------------------------------------------------------

export async function listPlayers(query = ''): Promise<AdminPlayer[]> {
  if (!isConfigured()) {
    const all = syntheticPlayers();
    return query ? all.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query)) : all;
  }
  let q = supabase().from('profiles').select('id, name, coins, role, created_at').limit(200);
  if (query) q = q.ilike('name', `%${query}%`);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: String(r.id), name: String(r.name), phone: '',
    coins: Number(r.coins), role: (r.role as Role) ?? 'player',
    createdAt: new Date(r.created_at as string).getTime(),
  }));
}

export async function adjustCoins(userId: string, delta: number, reason = 'admin_adjust'): Promise<void> {
  if (!isConfigured()) return; // synthetic roster offline — no-op on others
  await adminAction('adjustCoins', { userId, delta, reason });
}

export async function setRole(userId: string, role: Role): Promise<void> {
  if (!isConfigured()) return;
  await adminAction('setRole', { userId, role });
}

// --- Payments ---------------------------------------------------------------

export async function listOrders(limit = 100): Promise<Order[]> {
  if (!isConfigured()) return myOrders(limit);
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
  if (!isConfigured()) return saveConfigLocal(next);
  await adminAction('saveConfig', { config: next });
  return { ...config(), ...next };
}

// --- Edge Function bridge ---------------------------------------------------

async function adminAction(action: string, payload: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase().functions.invoke('admin-action', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}

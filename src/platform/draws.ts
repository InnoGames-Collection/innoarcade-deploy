// Scheduled prize draws (the telecom-portal lottery layer).
//
// Three live windows — a Daily, a Weekly and a Monthly draw — each with an ETB
// prize and a Points entry fee per ticket. More tickets = more chances. The
// windows are now SERVER-AUTHORITATIVE: loadDraws() reads the `draws` registry
// (which also holds the committed seed hash) and we fall back to calendar-derived
// defaults only when the backend is unconfigured. Winners are REAL — selected by
// the settle-draws function from the revealed seed — and read via fetchDrawWinners.

import { setBalance } from './currency';
import {
  enterDrawRemote, fetchDrawTickets, fetchDraws, fetchDrawPools, fetchDrawWinners,
} from './backend';

export type DrawPeriod = 'daily' | 'weekly' | 'monthly';

export interface Draw {
  id: string;
  period: DrawPeriod;
  titleEn: string;
  titleAm: string;
  /** Headline cash prize in ETB. */
  prizeEtb: number;
  /** Points charged per ticket. */
  ticketCostPoints: number;
  /** Per-user ticket cap (server-enforced). */
  maxTicketsPerUser: number;
  /** Epoch ms. */
  startsAt: number;
  endsAt: number;
}

export interface Winner {
  /** Masked phone, e.g. +2519****1234. */
  phone: string;
  prizeEtb: number;
  period: DrawPeriod;
}

const DEFAULT_MAX_TICKETS = 50;

// --- window math ------------------------------------------------------------
function endOfDay(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}
function endOfWeek(now: number): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 7).getTime();
}
function endOfMonth(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
function startOfDay(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// A stable id per window so tickets + the winner seed roll over automatically.
function windowId(period: DrawPeriod, now: number): string {
  const d = new Date(now);
  if (period === 'daily') return `daily-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (period === 'weekly') return `weekly-${d.getFullYear()}-${Math.floor(endOfWeek(now) / 6048e5)}`;
  return `monthly-${d.getFullYear()}-${d.getMonth() + 1}`;
}

const SPEC: Record<DrawPeriod, { titleEn: string; titleAm: string; prizeEtb: number; ticketCostPoints: number }> = {
  daily: { titleEn: 'Daily Draw', titleAm: 'ዕለታዊ ዕጣ', prizeEtb: 20_000, ticketCostPoints: 50 },
  weekly: { titleEn: 'Weekly Draw', titleAm: 'ሳምንታዊ ዕጣ', prizeEtb: 50_000, ticketCostPoints: 120 },
  monthly: { titleEn: 'Monthly Draw', titleAm: 'ወርሃዊ ዕጣ', prizeEtb: 250_000, ticketCostPoints: 300 },
};

// Server-sourced windows (filled by loadDraws). When null we use the calendar
// derivation so the hub renders instantly / offline.
let remoteCache: Draw[] | null = null;

function derivedDraws(now: number): Draw[] {
  const make = (period: DrawPeriod, startsAt: number, endsAt: number): Draw => ({
    id: windowId(period, now), period, ...SPEC[period],
    maxTicketsPerUser: DEFAULT_MAX_TICKETS, startsAt, endsAt,
  });
  return [
    make('daily', startOfDay(now), endOfDay(now)),
    make('weekly', endOfWeek(now) - 6048e5, endOfWeek(now)),
    make('monthly', new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime(), endOfMonth(now)),
  ];
}

export function activeDraws(now = Date.now()): Draw[] {
  return remoteCache ?? derivedDraws(now);
}

// Refresh the authoritative draw windows + their live pools from the backend.
// Best-effort: a server error keeps the calendar-derived defaults.
export async function loadDraws(): Promise<Draw[]> {
  const [rows] = await Promise.all([fetchDraws(), hydratePools()]);
  remoteCache = rows.length
    ? rows.filter((r) => r.state === 'open').map((r) => ({
        id: r.id, period: r.period, titleEn: r.titleEn, titleAm: r.titleAm,
        prizeEtb: r.prizeEtb, ticketCostPoints: r.ticketCostPoints,
        maxTicketsPerUser: r.maxTicketsPerUser, startsAt: r.startsAt, endsAt: r.endsAt,
      }))
    : null;
  return activeDraws();
}

// --- tickets (server-authoritative; in-memory cache, NO localStorage) --------
const ticketCache: Record<string, number> = {};

/** Hydrate the ticket cache from the server (call on load / after auth change). */
export async function hydrateTickets(): Promise<void> {
  const t = await fetchDrawTickets();
  for (const k of Object.keys(ticketCache)) delete ticketCache[k];
  Object.assign(ticketCache, t);
}

export function myTickets(drawId: string): number {
  return ticketCache[drawId] ?? 0;
}

// --- live pools / odds (server aggregate; in-memory cache) ------------------
const poolCache: Record<string, { entrants: number; totalTickets: number }> = {};

/** Hydrate the per-draw pool totals (entrants + total tickets) from the server. */
export async function hydratePools(): Promise<void> {
  const p = await fetchDrawPools();
  for (const k of Object.keys(poolCache)) delete poolCache[k];
  Object.assign(poolCache, p);
}

/** Total tickets sold into a draw (0 until anyone enters). */
export function drawTotalTickets(drawId: string): number {
  return poolCache[drawId]?.totalTickets ?? 0;
}

/** The player's win probability for a draw as a 0–1 fraction (0 when no pool). */
export function myOdds(drawId: string): number {
  const total = drawTotalTickets(drawId);
  return total > 0 ? myTickets(drawId) / total : 0;
}

export class NotEnoughPointsError extends Error {
  constructor() { super('not enough points'); this.name = 'NotEnoughPointsError'; }
}

/** Buy one ticket into a draw on the server (spends points via enter-draw). */
export async function enterDraw(draw: Draw): Promise<number> {
  try {
    const res = await enterDrawRemote(draw.id);
    setBalance('points', res.points);
    ticketCache[draw.id] = res.tickets;
    // Keep the live odds fresh after a purchase (best-effort).
    void hydratePools();
    return res.tickets;
  } catch (e) {
    // 402 from the function (apply_points overdraw guard) → not enough points.
    throw new NotEnoughPointsError();
  }
}

// --- real winners -----------------------------------------------------------
// The recent winners board is now sourced from the server `draw_winners_public`
// view (masked phone + prize + period), selected by the settle-draws function
// from the revealed seed. Cached in memory so the UI can render synchronously;
// loadWinners() refreshes it.
let winnersCache: Winner[] = [];

/** Hydrate the recent-winners cache from the server. */
export async function loadWinners(count = 24): Promise<void> {
  winnersCache = await fetchDrawWinners(count);
}

/** The most recent real draw winners (empty until draws settle). */
export function recentWinners(count = 24): Winner[] {
  return winnersCache.slice(0, count);
}

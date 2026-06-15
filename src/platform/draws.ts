// Scheduled prize draws (the telecom-portal lottery layer).
//
// Three live windows are derived from the calendar — a Daily, a Weekly and a
// Monthly draw — each with an ETB prize and a Points entry fee per ticket. More
// tickets = more chances. Winners are a *deterministic* seeded field (mulberry32
// over the window id) so the recent-winners board is stable across reloads, the
// same approach tournaments.ts uses. Everything is local-first; a real backend
// drops in behind these signatures later (the points debit becomes an Edge
// Function, the draw results a table).

import { setBalance } from './currency';
import { enterDrawRemote, fetchDrawTickets } from './backend';

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

export function activeDraws(now = Date.now()): Draw[] {
  const make = (period: DrawPeriod, startsAt: number, endsAt: number): Draw => ({
    id: windowId(period, now), period, ...SPEC[period], startsAt, endsAt,
  });
  return [
    make('daily', startOfDay(now), endOfDay(now)),
    make('weekly', endOfWeek(now) - 6048e5, endOfWeek(now)),
    make('monthly', new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime(), endOfMonth(now)),
  ];
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

export class NotEnoughPointsError extends Error {
  constructor() { super('not enough points'); this.name = 'NotEnoughPointsError'; }
}

/** Buy one ticket into a draw on the server (spends points via enter-draw). */
export async function enterDraw(draw: Draw): Promise<number> {
  try {
    const res = await enterDrawRemote(draw.id);
    setBalance('points', res.points);
    ticketCache[draw.id] = res.tickets;
    return res.tickets;
  } catch (e) {
    // 402 from the function (apply_points overdraw guard) → not enough points.
    throw new NotEnoughPointsError();
  }
}

// --- seeded recent winners --------------------------------------------------
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// A stable, plausible set of recent winners across the three periods.
export function recentWinners(now = Date.now(), count = 6): Winner[] {
  const periods: DrawPeriod[] = ['monthly', 'weekly', 'daily'];
  const out: Winner[] = [];
  let pi = 0;
  for (let i = 0; i < count; i++) {
    const period = periods[pi % periods.length];
    const rnd = mulberry32(seedFrom(windowId(period, now) + ':' + i));
    const head = 90 + Math.floor(rnd() * 10);
    const tail = String(1000 + Math.floor(rnd() * 9000));
    const prize = Math.round((SPEC[period].prizeEtb * (0.2 + rnd() * 0.8)) / 1000) * 1000;
    out.push({ phone: `+2519${head}****${tail.slice(-2)}`, prizeEtb: prize, period });
    pi++;
  }
  return out;
}

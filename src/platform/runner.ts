// Ethiopian Runner (temple-dash) — clean, server-only economy/scoring client.
//
// Built from scratch per the proposed game mechanics doc and isolated from the
// legacy shared economy. There are NO caches here: every call reads live from
// the server (the single source of truth) or invokes a runner-* Edge Function.
//
//   • XP        — earned by every run (runner-submit), drives level + season.
//   • Coins     — the global wallet; one entry fee (runner-enter) buys N attempts.
//   • Score     — per-tournament raw best; ranks on the runner leaderboard.

import { isConfigured, supabase } from './supabase';
import { currentUser } from './auth';
import { startRoundRemote } from './backend';
import { SignInRequiredError } from './payments';
import { levelFor } from './config';

export const RUNNER_GAME_ID = 'temple-dash';

export type RunnerPeriod = 'daily' | 'weekly' | 'monthly';

export interface RunnerTournament {
  id: string;
  period: RunnerPeriod;
  titleEn: string;
  titleAm: string;
  entryFeeCoins: number;
  attempts: number;
  startsAt: number;
  endsAt: number;
  state: string;
}

export interface RunnerEntry {
  attemptsPurchased: number;
  attemptsUsed: number;
  attemptsLeft: number;
}

export interface RunnerXp { xp: number; xpSeason: number; level: number; }

export interface RunnerSubmitResult {
  award: number;
  xp: number;
  xpSeason: number;
  level: number;
  ranked: boolean;
  best: number;
  rp: number;
  rank: number;
  total: number;
  attemptsLeft: number;
}

export interface RunnerLeaderRow { rank: number; name: string; score: number; isPlayer: boolean; }
export interface RunnerSeasonRow { rank: number; name: string; xpSeason: number; isPlayer: boolean; }

/** Player level from lifetime XP — the SINGLE platform curve (doc §3.2). The
 *  runner shows the same level as the hub. */
export function levelForXp(xp: number): number {
  return levelFor(xp);
}

export class InsufficientCoinsError extends Error {
  constructor() { super('insufficient coins'); this.name = 'InsufficientCoinsError'; }
}

export class LevelTooLowError extends Error {
  constructor(public requiredLevel: number) { super('level too low'); this.name = 'LevelTooLowError'; }
}

/** Doc §3.2 level funnel: minimum player level to enter each tournament period. */
export const REQUIRED_LEVEL: Record<RunnerPeriod, number> = { daily: 3, weekly: 5, monthly: 10 };

// --- reads (live, no cache) -------------------------------------------------

/** The currently-live Runner tournament for a period (default monthly), or null. */
export async function getRunnerTournament(period: RunnerPeriod = 'daily'): Promise<RunnerTournament | null> {
  if (!isConfigured()) return null;
  try {
    const now = new Date().toISOString();
    const { data } = await supabase()
      .from('runner_tournaments')
      .select('id, period, title_en, title_am, entry_fee_coins, attempts, starts_at, ends_at, state')
      .eq('state', 'live').eq('period', period).lte('starts_at', now).gt('ends_at', now)
      .order('ends_at', { ascending: true }).limit(1).maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id), period: data.period as RunnerPeriod,
      titleEn: String(data.title_en), titleAm: String(data.title_am),
      entryFeeCoins: Number(data.entry_fee_coins), attempts: Number(data.attempts),
      startsAt: new Date(data.starts_at as string).getTime(),
      endsAt: new Date(data.ends_at as string).getTime(),
      state: String(data.state),
    };
  } catch { return null; }
}

/** The signed-in player's entry (attempts bought/used) for a tournament. */
export async function getMyEntry(tournamentId: string): Promise<RunnerEntry | null> {
  if (!isConfigured()) return null;
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return null;
    const { data } = await sb
      .from('runner_entries')
      .select('attempts_purchased, attempts_used')
      .eq('user_id', me).eq('tournament_id', tournamentId).maybeSingle();
    if (!data) return null;
    const purchased = Number(data.attempts_purchased), used = Number(data.attempts_used);
    return { attemptsPurchased: purchased, attemptsUsed: used, attemptsLeft: Math.max(0, purchased - used) };
  } catch { return null; }
}

export interface RunnerPool { pool: number; entrants: number; }

/** Live prize pool + entrant count for a tournament (doc §4.3/§4.4: 65% of fees
 *  + per-period top-up). Read from the public runner_pools aggregate view. */
export async function getRunnerPool(tournamentId: string): Promise<RunnerPool> {
  if (!isConfigured()) return { pool: 0, entrants: 0 };
  try {
    const { data } = await supabase()
      .from('runner_pools').select('pool, entrants').eq('tournament_id', tournamentId).maybeSingle();
    return { pool: Number(data?.pool ?? 0), entrants: Number(data?.entrants ?? 0) };
  } catch { return { pool: 0, entrants: 0 }; }
}

/** The signed-in player's server-authoritative best score for a tournament
 *  (live from runner_scores). 0 if they've never posted a ranked run. This is the
 *  real Best — the leaderboard authority — not a session value. */
export async function getMyBest(tournamentId: string): Promise<number> {
  if (!isConfigured()) return 0;
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return 0;
    const { data } = await sb
      .from('runner_scores').select('best')
      .eq('user_id', me).eq('tournament_id', tournamentId).maybeSingle();
    return Number(data?.best ?? 0);
  } catch { return 0; }
}

/** The signed-in player's XP + level. UNIFIED ECONOMY: read the SAME global XP
 *  wallet as the hub (profiles.xp_lifetime/xp_season), so the runner
 *  shows ONE level identical to the hub — not a separate runner_xp counter. */
export async function getMyXp(): Promise<RunnerXp> {
  if (!isConfigured()) return { xp: 0, xpSeason: 0, level: 1 };
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return { xp: 0, xpSeason: 0, level: 1 };
    const { data } = await sb.from('profiles').select('xp_lifetime, xp_season').eq('id', me).maybeSingle();
    const xp = Number(data?.xp_lifetime ?? 0);
    return { xp, xpSeason: Number(data?.xp_season ?? 0), level: levelForXp(xp) };
  } catch { return { xp: 0, xpSeason: 0, level: 1 }; }
}

/** Top-N tournament leaderboard rows (live from runner_leaderboard). */
export async function runnerLeaderboard(tournamentId: string, limit = 10): Promise<RunnerLeaderRow[]> {
  if (!isConfigured()) return [];
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    const { data } = await sb
      .from('runner_leaderboard')
      .select('rank, name, score, user_id')
      .eq('tournament_id', tournamentId)
      .order('rank', { ascending: true }).limit(limit);
    return (data ?? []).map((r) => ({
      rank: Number(r.rank), name: String(r.name ?? 'Player'),
      score: Number(r.score), isPlayer: r.user_id === me,
    }));
  } catch { return []; }
}

/** Season leaderboard (live from runner_season_leaderboard). */
export async function runnerSeasonLeaderboard(limit = 10): Promise<RunnerSeasonRow[]> {
  if (!isConfigured()) return [];
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    const { data } = await sb
      .from('runner_season_leaderboard')
      .select('rank, name, xp_season, user_id')
      .order('rank', { ascending: true }).limit(limit);
    return (data ?? []).map((r) => ({
      rank: Number(r.rank), name: String(r.name ?? 'Player'),
      xpSeason: Number(r.xp_season), isPlayer: r.user_id === me,
    }));
  } catch { return []; }
}

// --- writes (Edge Functions) ------------------------------------------------

/** Buy a block of attempts for a period's tournament (pays the entry fee in coins). */
export async function enterRunnerTournament(period: RunnerPeriod = 'daily'): Promise<RunnerEntry> {
  await currentUser(); // hydrate the session (game pages skip the hub sign-in flow)
  const { data, error } = await supabase().functions.invoke('runner-enter', { body: { period } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) throw new InsufficientCoinsError();
    if (status === 401) throw new SignInRequiredError();
    if (status === 403) throw new LevelTooLowError(REQUIRED_LEVEL[period]);
    throw error;
  }
  const d = data as { attemptsPurchased: number; attemptsUsed: number; attemptsLeft: number };
  return { attemptsPurchased: d.attemptsPurchased, attemptsUsed: d.attemptsUsed, attemptsLeft: d.attemptsLeft };
}

/** Submit a finished run: awards XP and (if entered in `period`) records the ranked score. */
export async function submitRunnerRun(score: number, timeMs = 0, period: RunnerPeriod = 'daily'): Promise<RunnerSubmitResult | null> {
  if (!isConfigured()) return null;
  await currentUser();
  const { token } = await startRoundRemote(RUNNER_GAME_ID);
  const { data, error } = await supabase().functions.invoke('runner-submit', {
    body: { score: Math.max(0, Math.floor(score)), timeMs: Math.max(0, Math.floor(timeMs)), token, period },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) throw new SignInRequiredError();
    throw error;
  }
  return data as RunnerSubmitResult;
}

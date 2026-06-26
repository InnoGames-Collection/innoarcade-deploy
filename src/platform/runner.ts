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

export const RUNNER_GAME_ID = 'temple-dash';

export interface RunnerTournament {
  id: string;
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
  rank: number;
  total: number;
  attemptsLeft: number;
}

export interface RunnerLeaderRow { rank: number; name: string; score: number; isPlayer: boolean; }
export interface RunnerSeasonRow { rank: number; name: string; xpSeason: number; isPlayer: boolean; }

/** Player level from lifetime XP (gentle sqrt curve; mirrors the server). */
export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export class InsufficientCoinsError extends Error {
  constructor() { super('insufficient coins'); this.name = 'InsufficientCoinsError'; }
}

// --- reads (live, no cache) -------------------------------------------------

/** The currently-live Runner tournament, or null. */
export async function getRunnerTournament(): Promise<RunnerTournament | null> {
  if (!isConfigured()) return null;
  try {
    const now = new Date().toISOString();
    const { data } = await supabase()
      .from('runner_tournaments')
      .select('id, title_en, title_am, entry_fee_coins, attempts, starts_at, ends_at, state')
      .eq('state', 'live').lte('starts_at', now).gt('ends_at', now)
      .order('ends_at', { ascending: true }).limit(1).maybeSingle();
    if (!data) return null;
    return {
      id: String(data.id), titleEn: String(data.title_en), titleAm: String(data.title_am),
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

/** The signed-in player's XP + level (live from runner_xp). */
export async function getMyXp(): Promise<RunnerXp> {
  if (!isConfigured()) return { xp: 0, xpSeason: 0, level: 1 };
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return { xp: 0, xpSeason: 0, level: 1 };
    const { data } = await sb.from('runner_xp').select('xp, xp_season').eq('user_id', me).maybeSingle();
    const xp = Number(data?.xp ?? 0);
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

/** Buy a block of attempts (pays the entry fee in coins). */
export async function enterRunnerTournament(): Promise<RunnerEntry> {
  await currentUser(); // hydrate the session (game pages skip the hub sign-in flow)
  const { data, error } = await supabase().functions.invoke('runner-enter', { body: {} });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 402) throw new InsufficientCoinsError();
    if (status === 401) throw new SignInRequiredError();
    throw error;
  }
  const d = data as { attemptsPurchased: number; attemptsUsed: number; attemptsLeft: number };
  return { attemptsPurchased: d.attemptsPurchased, attemptsUsed: d.attemptsUsed, attemptsLeft: d.attemptsLeft };
}

/** Submit a finished run: awards XP and (if entered) records the ranked score. */
export async function submitRunnerRun(score: number, timeMs = 0): Promise<RunnerSubmitResult | null> {
  if (!isConfigured()) return null;
  await currentUser();
  const token = await startRoundRemote(RUNNER_GAME_ID);
  const { data, error } = await supabase().functions.invoke('runner-submit', {
    body: { score: Math.max(0, Math.floor(score)), timeMs: Math.max(0, Math.floor(timeMs)), token },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) throw new SignInRequiredError();
    throw error;
  }
  return data as RunnerSubmitResult;
}

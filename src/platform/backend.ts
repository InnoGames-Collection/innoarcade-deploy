// Server-backed scores + leaderboards. These mirror the synchronous mock in
// tournaments.ts but talk to Supabase, so the UI can adopt them incrementally
// (e.g. a tournament game calls submitScoreRemote() after its instant local
// update to persist an authoritative score). Everything here no-ops gracefully
// when Supabase isn't configured, so nothing breaks before the keys are set.
//
// Score submission goes through the `submit-score` Edge Function — never a raw
// table insert — so the server is the authority on what counts (bounds checks,
// rate limits, best-only). That's the anti-cheat boundary for prize tournaments.

import { isConfigured, supabase } from './supabase';
import { leaderboard as localBoard, type LeaderEntry } from './tournaments';

export function backendReady(): boolean {
  return isConfigured();
}

// Result of a finished round: server-awarded points balance, plus leaderboard
// standing when the game is a tournament (free games return points only).
export interface PlayResult {
  points: number;
  best?: number;
  isRecord?: boolean;
  rank?: number;
  total?: number;
}

// Submit a finished round to the server (the ONLY economy authority): awards
// points and, for tournament games, writes the authoritative leaderboard score.
// Requires a session (the portal is sign-in gated).
export async function submitPlayRemote(
  gameId: string, score: number, points: number, leaderboard: boolean, token = '',
): Promise<PlayResult> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke('submit-score', {
    body: { gameId, score, points, leaderboard, token },
  });
  if (error) throw error;
  return data as PlayResult;
}

// Anti-cheat: ask the server to open a round and return a single-use signed
// token to hand back to submit-score. Empty string when unconfigured or when
// the signing secret isn't set (token-optional mode) — never throws.
export async function startRoundRemote(gameId: string): Promise<string> {
  if (!isConfigured()) return '';
  try {
    const { data, error } = await supabase().functions.invoke('start-round', { body: { gameId } });
    if (error) return '';
    return (data?.token as string) ?? '';
  } catch { return ''; }
}

// Read the signed-in player's authoritative points balance from their profile.
export async function fetchPoints(): Promise<number | null> {
  if (!isConfigured()) return null;
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return null;
  const { data, error } = await sb.from('profiles').select('points').eq('id', me).maybeSingle();
  if (error || !data) return null;
  return Number(data.points);
}

// Buy one draw ticket by spending points (server-authoritative). Returns the new
// points balance and the player's ticket count for that draw.
export interface DrawEnterResult { points: number; tickets: number }
export async function enterDrawRemote(drawId: string): Promise<DrawEnterResult> {
  const { data, error } = await supabase().functions.invoke('enter-draw', { body: { drawId } });
  if (error) throw error;
  return data as DrawEnterResult;
}

// The signed-in player's ticket holdings, keyed by draw window id.
export async function fetchDrawTickets(): Promise<Record<string, number>> {
  if (!isConfigured()) return {};
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return {};
  const { data } = await sb.from('draw_entries').select('draw_id, tickets').eq('user_id', me);
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: { draw_id: string; tickets: number }) => { out[r.draw_id] = Number(r.tickets); });
  return out;
}

// Top-N leaderboard from the server view. Falls back to an empty list when
// unconfigured so callers can merge with the local simulated board if they like.
export async function leaderboardRemote(tournamentId: string, limit = 50): Promise<LeaderEntry[]> {
  if (!isConfigured()) return [];
  const sb = supabase();
  const { data, error } = await sb
    .from('leaderboard')
    .select('rank, name, score, user_id')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })
    .limit(limit);
  if (error) throw error;
  const me = (await sb.auth.getUser()).data.user?.id;
  return (data ?? []).map((r) => ({
    rank: r.rank as number,
    name: (r.name as string) ?? 'Player',
    score: r.score as number,
    isPlayer: r.user_id === me,
  }));
}

// Real scores blended in front of the simulated "seed" field, so the ladder
// looks populated while the real player base grows and real players always
// outrank simulated rivals at equal score. Signed-in players appear with their
// real standing; signed-out players keep their local (anonymous) rank.
export async function mergedLeaderboard(tournamentId: string): Promise<LeaderEntry[]> {
  const local = localBoard(tournamentId);
  let real: LeaderEntry[] = [];
  if (isConfigured()) {
    try { real = await leaderboardRemote(tournamentId, 200); } catch { /* offline → seed only */ }
  }
  const signedIn = real.some((e) => e.isPlayer);
  const sim = local.filter((e) => !e.isPlayer); // simulated rivals
  const localYou = signedIn ? [] : local.filter((e) => e.isPlayer); // anon local rank
  const combined = [...real, ...localYou, ...sim];
  combined.sort((a, b) => b.score - a.score);
  return combined.map((e, i) => ({ rank: i + 1, name: e.name, score: e.score, isPlayer: e.isPlayer }));
}

// The signed-in player's own row (even outside the visible top-N).
export async function playerStandingRemote(tournamentId: string): Promise<LeaderEntry | undefined> {
  if (!isConfigured()) return undefined;
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return undefined;
  const { data, error } = await sb
    .from('leaderboard')
    .select('rank, name, score, user_id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', me)
    .maybeSingle();
  if (error || !data) return undefined;
  return { rank: data.rank as number, name: (data.name as string) ?? 'You', score: data.score as number, isPlayer: true };
}

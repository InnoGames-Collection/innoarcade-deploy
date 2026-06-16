// Server-backed scores, leaderboards, points/gold and draw tickets — the read/
// submit layer over Supabase. The economy is server-only, so this is the single
// authority; reads no-op gracefully (empty/null) when Supabase isn't configured.
//
// Score submission goes through the `submit-score` Edge Function — never a raw
// table insert — so the server is the authority on what counts (bounds checks,
// rate limits, best-only). That's the anti-cheat boundary for prize tournaments.

import { isConfigured, supabase } from './supabase';
import { type LeaderEntry } from './tournaments';

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

// Submit a finished round to the server (the ONLY economy authority). The server
// decides the points (flat WIN_POINTS on a win, 0 otherwise) — the client only
// reports {score, win}; it cannot propose an amount. Tournament games also get
// their authoritative leaderboard score written. Requires a session.
export async function submitPlayRemote(
  gameId: string, score: number, win: boolean, leaderboard: boolean, token = '',
): Promise<PlayResult> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke('submit-score', {
    body: { gameId, score, win, leaderboard, token },
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

// Per-game cosmetic skin selection, persisted on the player's profile (the only
// client-writable profile columns are name + skins; coins/points are locked to
// service-role functions). Read map of gameId -> skinId.
export async function fetchSkins(): Promise<Record<string, string>> {
  if (!isConfigured()) return {};
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return {};
  const { data } = await sb.from('profiles').select('skins').eq('id', me).maybeSingle();
  return (data?.skins as Record<string, string>) ?? {};
}

export async function setSkinRemote(gameId: string, skinId: string): Promise<void> {
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return;
  const cur = await fetchSkins();
  cur[gameId] = skinId;
  await sb.from('profiles').update({ skins: cur }).eq('id', me);
}

// Read the signed-in player's authoritative points + gold balances from their
// profile (both server-sourced; the client never writes them).
export async function fetchWallets(): Promise<{ points: number; gold: number } | null> {
  if (!isConfigured()) return null;
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return null;
  const { data, error } = await sb.from('profiles').select('points, gold').eq('id', me).maybeSingle();
  if (error || !data) return null;
  return { points: Number(data.points ?? 0), gold: Number(data.gold ?? 0) };
}

/** @deprecated use fetchWallets — kept for callers that only need points. */
export async function fetchPoints(): Promise<number | null> {
  const w = await fetchWallets();
  return w ? w.points : null;
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

// The real, server-only leaderboard for a tournament (the `leaderboard` view).
// Empty until real players post scores — there is no simulated field.
export async function mergedLeaderboard(tournamentId: string): Promise<LeaderEntry[]> {
  if (!isConfigured()) return [];
  try { return await leaderboardRemote(tournamentId, 200); }
  catch { return []; }
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

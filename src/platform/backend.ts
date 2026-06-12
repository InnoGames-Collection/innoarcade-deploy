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
import type { LeaderEntry, SubmitResult } from './tournaments';

export function backendReady(): boolean {
  return isConfigured();
}

// Persist an authoritative score for the signed-in player. Requires a session
// (phone-OTP login); throws if called while signed out or unconfigured.
export async function submitScoreRemote(tournamentId: string, score: number): Promise<SubmitResult> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke('submit-score', {
    body: { tournamentId, score },
  });
  if (error) throw error;
  return data as SubmitResult;
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

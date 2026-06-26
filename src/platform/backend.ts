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

// Result of a finished round: server-awarded points balance + lifetime total,
// plus leaderboard standing when the game is a tournament.
export interface PlayResult {
  points: number;
  lifetime?: number;
  best?: number;
  isRecord?: boolean;
  rank?: number;
  total?: number;
}

// Submit a finished round to the server (the ONLY economy authority). The server
// computes the points via the uniform scoring matrix from {score, win, timeMs} —
// the client cannot propose an amount. Tournament games also get their
// authoritative leaderboard score written. Requires a session.
export async function submitPlayRemote(
  gameId: string, score: number, win: boolean, leaderboard: boolean, token = '', timeMs = 0,
): Promise<PlayResult> {
  const sb = supabase();
  const { data, error } = await sb.functions.invoke('submit-score', {
    body: { gameId, score, win, timeMs, leaderboard, token },
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

// Read the signed-in player's authoritative points balance + lifetime total from
// their profile (server-sourced; the client never writes them).
export async function fetchWallets(): Promise<{ points: number; lifetime: number } | null> {
  if (!isConfigured()) return null;
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return null;
  const { data, error } = await sb.from('profiles').select('points, points_lifetime').eq('id', me).maybeSingle();
  if (error || !data) return null;
  return { points: Number(data.points ?? 0), lifetime: Number(data.points_lifetime ?? 0) };
}

// The signed-in player's unlocked games (level-gated games bought with coins).
export async function fetchUnlocks(): Promise<string[]> {
  if (!isConfigured()) return [];
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return [];
  const { data } = await sb.from('profiles').select('unlocks').eq('id', me).maybeSingle();
  return Array.isArray(data?.unlocks) ? (data!.unlocks as string[]) : [];
}

// Unlock a level-gated game by spending coins (server-validated). Returns the
// new coin balance + the updated unlock list.
export async function unlockGameRemote(gameId: string): Promise<{ coins: number; unlocks: string[] }> {
  const { data, error } = await supabase().functions.invoke('unlock-game', { body: { gameId } });
  if (error) throw error;
  return data as { coins: number; unlocks: string[] };
}

// Global leaderboard (top players by lifetime points). Powers the landing widget.
export interface GlobalRow { rank: number; name: string; lifetime: number; season?: number; isPlayer: boolean }
export async function fetchGlobalLeaderboard(limit = 5): Promise<GlobalRow[]> {
  if (!isConfigured()) return [];
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  const { data, error } = await sb
    .from('global_leaderboard')
    .select('rank, name, points_lifetime, user_id')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    rank: Number(r.rank), name: (r.name as string) ?? 'Player',
    lifetime: Number(r.points_lifetime), isPlayer: r.user_id === me,
  }));
}

// The signed-in player's referral state: their own shareable code + whether
// they've already redeemed someone else's (one-time).
export async function fetchReferral(): Promise<{ code: string; redeemed: boolean } | null> {
  if (!isConfigured()) return null;
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return null;
  const { data } = await sb.from('profiles').select('ref_code, referred_by').eq('id', me).maybeSingle();
  if (!data) return null;
  return { code: String(data.ref_code ?? ''), redeemed: data.referred_by != null };
}

// Redeem a friend's referral code (pays both sides in coins, server-validated).
// Returns a status: 'ok' | 'already' | 'invalid' | 'self'.
export async function redeemReferralRemote(code: string): Promise<{ status: string; coins: number }> {
  const { data, error } = await supabase().functions.invoke('redeem-referral', { body: { code } });
  if (error) throw error;
  return data as { status: string; coins: number };
}

// The current open season (name + end time) for the competition header.
export interface Season { id: number; name: string; endsAt: number }
export async function fetchActiveSeason(): Promise<Season | null> {
  if (!isConfigured()) return null;
  const { data } = await supabase()
    .from('seasons').select('id, name, ends_at').eq('status', 'active')
    .order('ends_at', { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { id: Number(data.id), name: String(data.name), endsAt: new Date(data.ends_at as string).getTime() };
}

// Seasonal competition leaderboard (ranked by season points). Drives the global
// board widget; level is still derived from lifetime points.
export async function fetchSeasonLeaderboard(limit = 5): Promise<GlobalRow[]> {
  if (!isConfigured()) return [];
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  const { data, error } = await sb
    .from('season_leaderboard')
    .select('rank, name, points_season, points_lifetime, user_id')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    rank: Number(r.rank), name: (r.name as string) ?? 'Player',
    lifetime: Number(r.points_lifetime), season: Number(r.points_season),
    isPlayer: r.user_id === me,
  }));
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

// The authoritative draw windows (the server `draws` registry). Empty when
// unconfigured so the client falls back to its calendar-derived defaults.
export interface DrawRow {
  id: string; period: 'daily' | 'weekly' | 'monthly';
  titleEn: string; titleAm: string;
  prizeEtb: number; ticketCostPoints: number;
  maxTicketsPerUser: number; minTickets: number; winnerCount: number;
  startsAt: number; endsAt: number; state: string;
}
export async function fetchDraws(): Promise<DrawRow[]> {
  if (!isConfigured()) return [];
  try {
    const { data, error } = await supabase()
      .from('draws')
      .select('id, period, title_en, title_am, prize_etb, ticket_cost_points, max_tickets_per_user, min_tickets, winner_count, starts_at, ends_at, state')
      .order('ends_at', { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({
      id: String(r.id), period: r.period as DrawRow['period'],
      titleEn: String(r.title_en), titleAm: String(r.title_am),
      prizeEtb: Number(r.prize_etb), ticketCostPoints: Number(r.ticket_cost_points),
      maxTicketsPerUser: Number(r.max_tickets_per_user), minTickets: Number(r.min_tickets),
      winnerCount: Number(r.winner_count),
      startsAt: new Date(r.starts_at as string).getTime(),
      endsAt: new Date(r.ends_at as string).getTime(),
      state: String(r.state),
    }));
  } catch { return []; }
}

// Live pool totals per draw (entrants + total tickets) from the public aggregate
// view, used to show the player's real odds. Keyed by draw id.
export async function fetchDrawPools(): Promise<Record<string, { entrants: number; totalTickets: number }>> {
  if (!isConfigured()) return {};
  try {
    const { data } = await supabase().from('draw_pools').select('draw_id, entrants, total_tickets');
    const out: Record<string, { entrants: number; totalTickets: number }> = {};
    (data ?? []).forEach((r: { draw_id: string; entrants: number; total_tickets: number }) => {
      out[String(r.draw_id)] = { entrants: Number(r.entrants), totalTickets: Number(r.total_tickets) };
    });
    return out;
  } catch { return {}; }
}

// The real, masked draw winners (the `draw_winners_public` view). Replaces the
// former simulated field — empty until a draw actually settles.
export interface DrawWinnerRow { phone: string; prizeEtb: number; period: 'daily' | 'weekly' | 'monthly' }
export async function fetchDrawWinners(limit = 24): Promise<DrawWinnerRow[]> {
  if (!isConfigured()) return [];
  try {
    const { data, error } = await supabase()
      .from('draw_winners_public')
      .select('phone_masked, prize_etb, period, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      phone: String(r.phone_masked ?? '+2519****'),
      prizeEtb: Number(r.prize_etb),
      period: r.period as DrawWinnerRow['period'],
    }));
  } catch { return []; }
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

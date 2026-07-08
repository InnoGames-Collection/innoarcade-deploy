// Server-backed scores, leaderboards, points/gold and draw tickets — the read/
// submit layer over Supabase. The economy is server-only, so this is the single
// authority; reads no-op gracefully (empty/null) when Supabase isn't configured.
//
// Score submission goes through the `submit-score` Edge Function — never a raw
// table insert — so the server is the authority on what counts (bounds checks,
// rate limits, best-only). That's the anti-cheat boundary for prize tournaments.

import { isConfigured, getSupabase } from './supabase';
import { userId } from './auth';
import { type LeaderEntry } from './tournaments';
import { setBalanceFromServer } from './wallet';
import { applyPortalBootstrap, type RecentGameRow } from './portalState';

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
  /** Tournament attempts remaining after this ranked run consumed one. */
  attemptsLeft?: number;
  /** Whether the run counted on the leaderboard (false = free/practice). */
  ranked?: boolean;
  /** XP awarded this round (0 for ranked tournament play). */
  award?: number;
  /** Coins earned from score this round (free games only). */
  coinAward?: number;
  /** Server coin balance after the round. */
  coins?: number;
  /** RP for this tournament (returned after ranked play). */
  rp?: number;
}

// Submit a finished round to the server (the ONLY economy authority). The server
// computes the points via the uniform scoring matrix from {score, win, timeMs} —
// the client cannot propose an amount. Tournament games also get their
// authoritative leaderboard score written. Requires a session.
export async function freeGameBestRemote(gameId: string): Promise<number> {
  if (!isConfigured()) return 0;
  const uid = await userId();
  if (!uid) return 0;
  try {
    const sb = await getSupabase();
    const { data } = await sb
      .from('free_game_bests')
      .select('best')
      .eq('user_id', uid)
      .eq('game_id', gameId)
      .maybeSingle();
    return Math.max(0, Number(data?.best ?? 0));
  } catch {
    return 0;
  }
}

export async function submitPlayRemote(
  gameId: string, score: number, win: boolean, leaderboard: boolean, token = '', timeMs = 0,
): Promise<PlayResult> {
  const sb = (await getSupabase());
  const { data, error } = await sb.functions.invoke('submit-score', {
    body: { gameId, score, win, timeMs, leaderboard, token },
  });
  if (error) throw error;
  return data as PlayResult;
}

// Anti-cheat: ask the server to open a round and return a single-use signed
// token to hand back to submit-score. Empty string when unconfigured or when
// the signing secret isn't set (token-optional mode) — never throws.
export interface StartRoundResult { token: string; attemptsLeft?: number; blocked?: boolean }

async function parseStartRoundError(error: unknown): Promise<Pick<StartRoundResult, 'attemptsLeft' | 'blocked'>> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (!ctx?.json) return { blocked: true };
    const body = await ctx.json() as { attemptsLeft?: number; error?: string };
    if (body.attemptsLeft != null) return { attemptsLeft: Number(body.attemptsLeft), blocked: true };
    if (body.error === 'no attempts left' || body.error === 'not entered') {
      return { attemptsLeft: 0, blocked: true };
    }
  } catch { /* ignore */ }
  return { blocked: true };
}

export async function startRoundRemote(gameId: string, ranked = true): Promise<StartRoundResult> {
  if (!isConfigured()) return { token: '' };
  try {
    const { data, error } = await (await getSupabase()).functions.invoke('start-round', {
      body: { gameId, ranked },
    });
    if (error) {
      const parsed = await parseStartRoundError(error);
      return { token: '', ...parsed };
    }
    return {
      token: (data?.token as string) ?? '',
      attemptsLeft: data?.attemptsLeft != null ? Number(data.attemptsLeft) : undefined,
    };
  } catch { return { token: '', blocked: true }; }
}

// Per-game cosmetic skin selection, persisted on the player's profile (the only
// client-writable profile columns are name + skins; coins/points are locked to
// service-role functions). Read map of gameId -> skinId.
export async function fetchSkins(): Promise<Record<string, string>> {
  if (!isConfigured()) return {};
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return {};
  const { data } = await sb.from('profiles').select('skins').eq('id', me).maybeSingle();
  return (data?.skins as Record<string, string>) ?? {};
}

export async function setSkinRemote(gameId: string, skinId: string): Promise<void> {
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return;
  const cur = await fetchSkins();
  cur[gameId] = skinId;
  await sb.from('profiles').update({ skins: cur }).eq('id', me);
}

// Read the signed-in player's authoritative XP balance + lifetime total from
// their profile (server-sourced; the client never writes them).
export async function fetchWallets(): Promise<{ xp: number; lifetime: number } | null> {
  if (!isConfigured()) return null;
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return null;
  const { data, error } = await sb.from('profiles').select('xp, xp_lifetime').eq('id', me).maybeSingle();
  if (error || !data) return null;
  return { xp: Number(data.xp ?? 0), lifetime: Number(data.xp_lifetime ?? 0) };
}

// Claim the daily-login XP streak (doc §3.1). Returns the XP awarded (0 if
// already claimed today) plus the refreshed XP balances. Best-effort.
export interface DailyClaim { award: number; xp: number; lifetime: number }
export async function claimDailyLogin(): Promise<DailyClaim | null> {
  if (!isConfigured()) return null;
  try {
    const { data, error } = await (await getSupabase()).functions.invoke('claim-daily', { body: {} });
    if (error || !data) return null;
    return { award: Number(data.award ?? 0), xp: Number(data.xp ?? 0), lifetime: Number(data.lifetime ?? 0) };
  } catch { return null; }
}

// The signed-in player's unlocked games (level-gated games bought with coins).
export async function fetchUnlocks(): Promise<string[]> {
  if (!isConfigured()) return [];
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return [];
  const { data } = await sb.from('profiles').select('unlocks').eq('id', me).maybeSingle();
  return Array.isArray(data?.unlocks) ? (data!.unlocks as string[]) : [];
}

// Unlock a level-gated game by spending coins (server-validated). Returns the
// new coin balance + the updated unlock list.
export async function unlockGameRemote(gameId: string): Promise<{ coins: number; unlocks: string[] }> {
  const { data, error } = await (await getSupabase()).functions.invoke('unlock-game', { body: { gameId } });
  if (error) throw error;
  return data as { coins: number; unlocks: string[] };
}

// Global leaderboard (top players by lifetime points). Powers the landing widget.
export interface GlobalRow { rank: number; name: string; lifetime: number; season?: number; isPlayer: boolean }
export async function fetchGlobalLeaderboard(limit = 5): Promise<GlobalRow[]> {
  if (!isConfigured()) return [];
  const sb = (await getSupabase());
  const me = await userId();
  const { data, error } = await sb
    .from('global_leaderboard')
    .select('rank, name, xp_lifetime, user_id')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    rank: Number(r.rank), name: (r.name as string) ?? 'Player',
    lifetime: Number(r.xp_lifetime), isPlayer: r.user_id === me,
  }));
}

// The signed-in player's referral state: their own shareable code + whether
// they've already redeemed someone else's (one-time).
export async function fetchReferral(): Promise<{ code: string; redeemed: boolean } | null> {
  if (!isConfigured()) return null;
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return null;
  const { data } = await sb.from('profiles').select('ref_code, referred_by').eq('id', me).maybeSingle();
  if (!data) return null;
  return { code: String(data.ref_code ?? ''), redeemed: data.referred_by != null };
}

// Redeem a friend's referral code (pays both sides in coins, server-validated).
// Returns a status: 'ok' | 'already' | 'invalid' | 'self'.
export async function redeemReferralRemote(code: string): Promise<{ status: string; coins: number }> {
  const { data, error } = await (await getSupabase()).functions.invoke('redeem-referral', { body: { code } });
  if (error) throw error;
  return data as { status: string; coins: number };
}

// The current open season (name + end time) for the competition header.
export interface Season { id: number; name: string; endsAt: number }
export async function fetchActiveSeason(): Promise<Season | null> {
  if (!isConfigured()) return null;
  const { data } = await (await getSupabase())
    .from('seasons').select('id, name, ends_at').eq('status', 'active')
    .order('ends_at', { ascending: true }).limit(1).maybeSingle();
  if (!data) return null;
  return { id: Number(data.id), name: String(data.name), endsAt: new Date(data.ends_at as string).getTime() };
}

// Seasonal competition leaderboard — ranked by the player's BEST tournament RP
// in the active season (each tournament RP comes from their best raw score).
export async function fetchSeasonLeaderboard(limit = 10): Promise<GlobalRow[]> {
  if (!isConfigured()) return [];
  const sb = (await getSupabase());
  const me = await userId();
  const { data, error } = await sb
    .from('season_rp_leaderboard')
    .select('rank, name, best_rp, entries, xp_lifetime, user_id')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    rank: Number(r.rank), name: (r.name as string) ?? 'Player',
    lifetime: Number(r.xp_lifetime), season: Number(r.best_rp),
    isPlayer: r.user_id === me,
  }));
}

/** @deprecated use fetchWallets — kept for callers that only need the XP balance. */
export async function fetchPoints(): Promise<number | null> {
  const w = await fetchWallets();
  return w ? w.xp : null;
}

// Buy one draw ticket (server-authoritative) using XP (per-draw price) or Coins
// (flat 20/ticket, doc §6.1). Returns the new XP + coin balances and ticket count.
export interface DrawEnterResult { points: number; coins: number; tickets: number }
export async function enterDrawRemote(drawId: string, pay: 'xp' | 'coins' = 'xp'): Promise<DrawEnterResult> {
  const { data, error } = await (await getSupabase()).functions.invoke('enter-draw', { body: { drawId, pay } });
  if (error) throw error;
  return data as DrawEnterResult;
}

// The signed-in player's ticket holdings, keyed by draw window id.
export async function fetchDrawTickets(): Promise<Record<string, number>> {
  if (!isConfigured()) return {};
  const sb = (await getSupabase());
  const me = await userId();
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
    const { data, error } = await (await getSupabase())
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
    const { data } = await (await getSupabase()).from('draw_pools').select('draw_id, entrants, total_tickets');
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
    const { data, error } = await (await getSupabase())
      .from('draw_winners_public')
      .select('phone_masked, prize_etb, period, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      phone: String(r.phone_masked ?? '+2519****00000'),
      prizeEtb: Number(r.prize_etb),
      period: r.period as DrawWinnerRow['period'],
    }));
  } catch { return []; }
}

export interface SeasonWinnerRow {
  rank: number; phone: string; name: string; lifetime: number; bestRp: number; seasonName: string; isPlayer: boolean;
}

/** Previous closed season — same RP ranking rules as fetchSeasonLeaderboard. */
export async function fetchPreviousSeasonLeaderboard(limit = 10): Promise<SeasonWinnerRow[]> {
  if (!isConfigured()) return [];
  try {
    const sb = (await getSupabase());
    const me = await userId();
    const { data, error } = await sb
      .from('previous_season_rp_leaderboard')
      .select('rank, phone_masked, name, best_rp, xp_lifetime, season_name, user_id')
      .order('rank', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      rank: Number(r.rank),
      phone: String(r.phone_masked ?? '+2519****00000'),
      name: String(r.name ?? 'Player'),
      lifetime: Number(r.xp_lifetime ?? 0),
      bestRp: Number(r.best_rp ?? 0),
      seasonName: String(r.season_name ?? ''),
      isPlayer: r.user_id === me,
    }));
  } catch { return []; }
}

export type PeriodCadence = 'daily' | 'weekly' | 'monthly';
export interface PeriodWinnerRow {
  rank: number; phone: string; name: string; rp: number; isPlayer: boolean;
}

/** Latest tournament window per cadence — top 10 by RP (Winners tab). */
export async function fetchTournamentPeriodWinners(
  cadence: PeriodCadence,
  limit = 10,
): Promise<PeriodWinnerRow[]> {
  if (!isConfigured()) return [];
  try {
    const sb = (await getSupabase());
    const me = await userId();
    const { data, error } = await sb
      .from('tournament_period_board')
      .select('rank, phone_masked, name, rp, user_id')
      .eq('cadence', cadence)
      .order('rank', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      rank: Number(r.rank),
      phone: String(r.phone_masked ?? r.name ?? '+2519****00000'),
      name: String(r.name ?? 'Player'),
      rp: Number(r.rp ?? 0),
      isPlayer: r.user_id === me,
    }));
  } catch { return []; }
}

/** @deprecated use fetchPreviousSeasonLeaderboard */
export const fetchPreviousSeasonWinners = fetchPreviousSeasonLeaderboard;

// Top-N leaderboard from the server view. Falls back to an empty list when
// unconfigured so callers can merge with the local simulated board if they like.
export async function leaderboardRemote(tournamentId: string, limit = 50): Promise<LeaderEntry[]> {
  if (!isConfigured()) return [];
  const sb = (await getSupabase());
  const { data, error } = await sb
    .from('leaderboard')
    .select('rank, name, score, rp, user_id')
    .eq('tournament_id', tournamentId)
    .order('rank', { ascending: true })
    .limit(limit);
  if (error) throw error;
  const me = await userId();
  return (data ?? []).map((r) => ({
    rank: r.rank as number,
    name: (r.name as string) ?? 'Player',
    score: r.score as number,
    rp: r.rp != null ? Number(r.rp) : undefined,
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
  const sb = (await getSupabase());
  const me = await userId();
  if (!me) return undefined;
  const { data, error } = await sb
    .from('leaderboard')
    .select('rank, name, score, rp, user_id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', me)
    .maybeSingle();
  if (error || !data) return undefined;
  return {
    rank: data.rank as number,
    name: (data.name as string) ?? 'You',
    score: data.score as number,
    rp: data.rp != null ? Number(data.rp) : undefined,
    isPlayer: true,
  };
}

/** Aggregate play counts per game — read-only, for hub catalog cards. */
export async function fetchGameStats(): Promise<Record<string, number>> {
  if (!isConfigured()) return {};
  try {
    const sb = await getSupabase();
    const { data } = await sb.from('game_stats').select('game_id, n');
    const out: Record<string, number> = {};
    for (const row of data ?? []) {
      const id = row.game_id as string;
      out[id] = Math.max(0, Number(row.n ?? 0));
    }
    return out;
  } catch {
    return {};
  }
}

/** Live activity feed for the hub ticker (public, anonymized). */
export async function fetchActivityFeed(limit = 20): Promise<unknown[]> {
  if (!isConfigured()) return [];
  try {
    const sb = await getSupabase();
    const { data } = await sb.rpc('get_public_activity_feed', { p_limit: limit });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Mark all or selected notifications as read. */
export async function markNotificationsRead(ids?: number[]): Promise<void> {
  if (!isConfigured()) return;
  try {
    const sb = await getSupabase();
    await sb.rpc('mark_my_notifications_read', {
      p_ids: ids?.length ? ids : null,
    });
  } catch { /* non-fatal */ }
}

/** Lightweight portal refresh (challenge, notifications, activity, coins). */
export async function refreshPortalRemote(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.functions.invoke('hub-bootstrap', { body: {} });
    if (error || !data) return false;
    const payload = data as {
      activity?: unknown;
      onlineCount?: number;
      trendingIds?: unknown;
      user?: { coins?: number; challenge?: unknown; notifications?: unknown; recentGames?: unknown };
    };
    if (payload.user?.coins != null) setBalanceFromServer(Number(payload.user.coins));
    applyPortalBootstrap({
      recentGames: Array.isArray(payload.user?.recentGames)
        ? payload.user.recentGames as RecentGameRow[]
        : undefined,
      challenge: payload.user?.challenge,
      activity: payload.activity,
      notifications: payload.user?.notifications,
      onlineCount: payload.onlineCount,
      trendingIds: payload.trendingIds,
    });
    return true;
  } catch {
    return false;
  }
}

/** Claim daily challenge reward when all tasks are complete. */
export async function claimChallengeRemote(): Promise<{
  award: number;
  coins: number;
  challenge: unknown;
} | null> {
  if (!isConfigured()) return null;
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.functions.invoke('claim-challenge', { body: {} });
    if (error || !data) return null;
    return data as { award: number; coins: number; challenge: unknown };
  } catch {
    return null;
  }
}

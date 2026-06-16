// Shared game host for every built-in game — one uniform economy/competition
// path, sourced entirely from the Supabase backend (no local storage/scoring).
// A game's catalog `mode` is the single switch:
//
//   free        → no entry fee. A finished round awards server-side points
//                 (submit-score) — no leaderboard.
//   tournament  → the game's monthly tournament is auto-derived from the catalog
//                 (see tournaments.ts). begin() enters it (entry fee debited via
//                 the server wallet) and opens an anti-cheat round token; a
//                 finished round awards points AND writes the leaderboard score,
//                 all server-authoritative.
//
// Flipping a game between casual and competitive is a one-line catalog change
// (`mode: 'free' | 'tournament'`) with no edit to the game itself.

import { getGame, type GameMode, type GameMeta } from './catalog';
import {
  getTournament, enterTournament, isEntered,
  countdown, InsufficientCoinsError,
  type Tournament, type LeaderEntry,
} from './tournaments';
import { SignInRequiredError } from './payments';
import { submitPlayRemote, startRoundRemote, leaderboardRemote, playerStandingRemote } from './backend';
import { setBalance } from './currency';
import { winRateOverride } from './config';

export type BeginBlock = 'coins' | 'auth';
export interface BeginResult {
  ok: boolean;
  /** Why entry was refused (tournament mode only). */
  reason?: BeginBlock;
}

export interface FinishResult {
  /** Best score this player has on record (local for free, tournament for paid). */
  best: number;
  isRecord: boolean;
  /** Present in tournament mode. */
  rank?: number;
  total?: number;
}

const DEFAULT_PLAY = { winPoints: 100, winRate: 50 };

export class GameHost {
  readonly meta: GameMeta;
  readonly mode: GameMode;
  /** Points a win awards (score units). */
  readonly winPoints: number;
  /** Configured base win chance 0–100; see `winRate` for the effective value. */
  private readonly baseWinRate: number;
  /** The monthly tournament backing this game, when in tournament mode. */
  readonly tournament?: Tournament;
  /** Anti-cheat: the server-issued single-use token for the current round. */
  private roundToken = '';
  /** Cached server leaderboard + standing (no local simulation). */
  private cachedBoard: LeaderEntry[] = [];
  private cachedStanding?: LeaderEntry;

  constructor(gameId: string) {
    const meta = getGame(gameId);
    if (!meta) throw new Error(`unknown game: ${gameId}`);
    this.meta = meta;
    this.mode = meta.mode;
    this.winPoints = meta.play?.winPoints ?? DEFAULT_PLAY.winPoints;
    this.baseWinRate = meta.play?.winRate ?? DEFAULT_PLAY.winRate;
    if (meta.mode === 'tournament') {
      this.tournament = getTournament(`${gameId}-monthly`);
    }
  }

  /** Effective base win chance 0–100 for chance games:
   *  the admin win-rate override (server config) or the catalog rate. */
  get winRate(): number {
    const override = winRateOverride();
    return override ?? this.baseWinRate;
  }

  /** True when this game runs a competitive leaderboard. */
  get isTournament(): boolean {
    return this.mode === 'tournament' && !!this.tournament;
  }

  /** Coins required to play one round (the tournament entry fee, or 0). */
  get costCoins(): number {
    return this.isTournament ? (this.tournament!.entryFeeCoins ?? 0) : 0;
  }

  /** Whether the player has already paid into this tournament window. */
  get entered(): boolean {
    return this.isTournament ? isEntered(this.tournament!.id) : true;
  }

  /** Open a round: fetch the anti-cheat token to hand back on finish(). */
  async startRound(): Promise<void> {
    this.roundToken = await startRoundRemote(this.meta.id);
  }

  // Charge for / authorise a round. Free games always pass. Tournament games
  // ensure the player is entered (entry fee debited once per window); a repeat
  // play in the same window is free because they already paid in. Always opens a
  // server round (anti-cheat token) first.
  async begin(): Promise<BeginResult> {
    await this.startRound();
    if (!this.isTournament) return { ok: true };
    const t = this.tournament!;
    if (isEntered(t.id)) return { ok: true };
    // Paid entry: join the tournament so the round counts toward the prize. A
    // missing account or an empty wallet is a real, recoverable state — report
    // it (`reason`) so the game can prompt the player to sign in / top up rather
    // than silently dropping them out of the competition.
    try {
      await enterTournament(t.id);
      return { ok: true };
    } catch (e) {
      if (e instanceof InsufficientCoinsError) return { ok: false, reason: 'coins' };
      if (e instanceof SignInRequiredError) return { ok: false, reason: 'auth' };
      // Unexpected error — don't block play over an infrastructure hiccup.
      console.warn('tournament entry skipped:', e);
      return { ok: true };
    }
  }

  // Points a finished round awards (the play-earned currency). Chance/awarded
  // games pay `winPoints` on a win; skill/engine games scale their run score.
  private pointsFor(score: number, isWin: boolean): number {
    if (this.meta.play) return isWin ? this.winPoints : 0;
    return Math.min(300, Math.floor(score / 50));
  }

  // Record a finished round on the SERVER (the only economy authority): awards
  // points and, for tournament games, writes the authoritative leaderboard
  // score. `score` is the run/competition score; points are derived here unless
  // `pointsOverride` is given (games with their own points formula). No local
  // storage — the returned points balance hydrates the currency cache.
  async finish(score: number, isWin: boolean, pointsOverride?: number): Promise<FinishResult> {
    const pts = pointsOverride ?? this.pointsFor(score, isWin);
    try {
      const res = await submitPlayRemote(this.meta.id, Math.max(0, Math.floor(score)), pts, this.isTournament, this.roundToken);
      if (typeof res.points === 'number') setBalance('points', res.points);
      // Cache the server standing so standing() reflects the latest real rank.
      if (this.isTournament && typeof res.rank === 'number') {
        this.cachedStanding = { rank: res.rank, name: 'You', score: res.best ?? 0, isPlayer: true };
      }
      return { best: res.best ?? 0, isRecord: res.isRecord ?? false, rank: res.rank, total: res.total };
    } catch (e) {
      console.warn('play submit failed', e);
      return { best: 0, isRecord: false };
    }
  }

  /** Refresh the cached server leaderboard + standing (tournament mode). Call
   *  before reading board()/standing() to show real data on the menu. */
  async refreshBoard(limit = 5): Promise<void> {
    if (!this.isTournament) return;
    try {
      const [board, me] = await Promise.all([
        leaderboardRemote(this.tournament!.id, limit),
        playerStandingRemote(this.tournament!.id),
      ]);
      this.cachedBoard = board;
      if (me) this.cachedStanding = me;
    } catch { /* keep last cache */ }
  }

  /** Cached server leaderboard rows (tournament mode). Empty until refreshBoard. */
  board(limit = 5): LeaderEntry[] {
    return this.isTournament ? this.cachedBoard.slice(0, limit) : [];
  }

  /** The player's cached server standing row, if any (tournament mode). */
  standing(): LeaderEntry | undefined {
    return this.isTournament ? this.cachedStanding : undefined;
  }

  /** "3d 4h 12m"-style remaining time for the tournament window. */
  countdownText(): string {
    if (!this.isTournament) return '';
    const c = countdown(this.tournament!.endsAt);
    return `${c.days}d ${c.hours}h ${c.minutes}m`;
  }

}

/** Convenience factory. */
export function createHost(gameId: string): GameHost {
  return new GameHost(gameId);
}

/** Record a finished engine-game run on the server (awards points, and writes the
 *  leaderboard score when the game is a tournament). For the engine games that
 *  don't use the host's HUD; best-effort and never throws. */
export async function recordEnginePlay(gameId: string, score: number): Promise<void> {
  try {
    const h = new GameHost(gameId);
    await h.startRound();
    await h.finish(score, true);
  } catch { /* best-effort */ }
}

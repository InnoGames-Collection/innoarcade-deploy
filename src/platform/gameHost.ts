// Shared game host for the ported awetar titles.
//
// Every ported game keeps its own DOM/art (the original awetar markup), but the
// economy and competition wiring is identical, so it lives here once. A game's
// catalog `mode` is the single switch:
//
//   free        → no entry fee. A finished round records a local best score
//                 (engine profile) and, on a win, mints the configured points
//                 into the player's in-game coin balance.
//   tournament  → the game's monthly tournament is auto-derived from the catalog
//                 (see tournaments.ts). begin() enters it — debiting the entry
//                 fee through the real-money wallet (TeleBirr top-ups) when the
//                 server economy is on, or the local mock wallet offline. A
//                 finished round submits the score to the leaderboard.
//
// Flipping a game between casual and competitive is therefore a one-line catalog
// change (`mode: 'free' | 'tournament'`) with no edit to the game itself — the
// "configurable slot" the product asked for.

import { getGame, type GameMode, type GameMeta } from './catalog';
import {
  getTournament, submitScore, leaderboard, enterTournament, isEntered,
  countdown, playerStanding, InsufficientCoinsError,
  type Tournament, type LeaderEntry,
} from './tournaments';
import { SignInRequiredError } from './payments';
import { backendReady, submitScoreRemote, leaderboardRemote } from './backend';
import { currentUser } from './auth';
import { profile } from '../engine/profile';
import { earn } from './currency';

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
  /** Base win chance 0–100 — for chance games to consult; skill games ignore it. */
  readonly winRate: number;
  /** The monthly tournament backing this game, when in tournament mode. */
  readonly tournament?: Tournament;

  constructor(gameId: string) {
    const meta = getGame(gameId);
    if (!meta) throw new Error(`unknown game: ${gameId}`);
    this.meta = meta;
    this.mode = meta.mode;
    this.winPoints = meta.play?.winPoints ?? DEFAULT_PLAY.winPoints;
    this.winRate = meta.play?.winRate ?? DEFAULT_PLAY.winRate;
    if (meta.mode === 'tournament') {
      this.tournament = getTournament(`${gameId}-monthly`);
    }
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

  // Charge for / authorise a round. Free games always pass. Tournament games
  // ensure the player is entered (entry fee debited once per window); a repeat
  // play in the same window is free because they already paid in.
  async begin(): Promise<BeginResult> {
    if (!this.isTournament) return { ok: true };
    const t = this.tournament!;
    if (isEntered(t.id)) return { ok: true };
    // Best-effort paid entry: try to join the tournament so the round counts
    // toward the prize, but NEVER block play if the player isn't signed in or
    // is short on coins — the game is always playable; only the competitive
    // entry is gated. (Score submission below is local-first regardless.)
    try {
      await enterTournament(t.id);
    } catch (e) {
      if (!(e instanceof InsufficientCoinsError) && !(e instanceof SignInRequiredError)) {
        // Unexpected error — swallow it so play still proceeds.
        console.warn('tournament entry skipped:', e);
      }
    }
    return { ok: true };
  }

  // Record a finished round. `score` is the points the round earned (0 on a
  // loss for chance games; the run score for skill games).
  finish(score: number, isWin: boolean): FinishResult {
    // A win mints portal Points — the currency spent on draw tickets and the
    // leaderboard — closing the play → earn → draw loop for every game.
    if (isWin && this.winPoints > 0) earn('points', this.winPoints);
    if (!this.isTournament) {
      const isRecord = profile.recordRun(this.meta.id, score);
      return { best: profile.stats(this.meta.id).best, isRecord };
    }
    const t = this.tournament!;
    const res = submitScore(t.id, score);
    void this.syncRemote(t.id, score);
    return { best: res.best, isRecord: res.isRecord, rank: res.rank, total: res.total };
  }

  /** Leaderboard rows for the menu/result strip (tournament mode). */
  board(limit = 5): LeaderEntry[] {
    return this.isTournament ? leaderboard(this.tournament!.id, limit) : [];
  }

  /** The player's current standing row, if any (tournament mode). */
  standing(): LeaderEntry | undefined {
    return this.isTournament ? playerStanding(this.tournament!.id) : undefined;
  }

  /** "3d 4h 12m"-style remaining time for the tournament window. */
  countdownText(): string {
    if (!this.isTournament) return '';
    const c = countdown(this.tournament!.endsAt);
    return `${c.days}d ${c.hours}h ${c.minutes}m`;
  }

  // Persist the authoritative score server-side when signed in; a no-op offline
  // or signed out, leaving the instant local standing on screen.
  private async syncRemote(tournamentId: string, score: number): Promise<void> {
    if (!backendReady() || !(await currentUser())) return;
    try {
      await submitScoreRemote(tournamentId, score);
      await leaderboardRemote(tournamentId);
    } catch {
      /* network/auth hiccup — local standing stays */
    }
  }
}

/** Convenience factory. */
export function createHost(gameId: string): GameHost {
  return new GameHost(gameId);
}

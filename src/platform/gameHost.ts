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
  getTournamentForGame, enterTournament, isEntered, myEntry, noteAttemptsLeft,
  countdown, prizePool, InsufficientCoinsError, LevelTooLowError,
  type Tournament, type LeaderEntry,
} from './tournaments';
import { SignInRequiredError } from './payments';
import { submitPlayRemote, startRoundRemote, leaderboardRemote, playerStandingRemote } from './backend';
import { setBalance, setLifetime } from './currency';
import { winRateOverride, BASE_POINTS } from './config';
import { currentUser } from './auth';

export type BeginBlock = 'coins' | 'auth' | 'level';
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
  /** XP awarded this round (0 for ranked tournament play; >0 for free/practice). */
  award?: number;
  /** Server XP balance + lifetime (for level display). */
  points?: number;
  lifetime?: number;
  /** Tournament attempts left after a ranked run; whether it counted. */
  attemptsLeft?: number;
  ranked?: boolean;
}

const DEFAULT_WIN_RATE = 50;

export class GameHost {
  readonly meta: GameMeta;
  readonly mode: GameMode;
  /** Configured base win chance 0–100; see `winRate` for the effective value. */
  private readonly baseWinRate: number;
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
    this.baseWinRate = meta.play?.winRate ?? DEFAULT_WIN_RATE;
  }

  /** The single live tournament backing this game (resolved live, so it reflects
   *  loadTournaments() even though the host was constructed earlier). */
  get tournament(): Tournament | undefined {
    return this.mode === 'tournament' ? getTournamentForGame(this.meta.id) : undefined;
  }

  /** Max points a great round can earn (for HUD hints; server computes actual). */
  get winPoints(): number { return BASE_POINTS; }

  /** Win threshold for skill/engine games (score ≥ this counts as a win). */
  get winScore(): number { return this.meta.play?.winScore ?? 1; }

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

  /** Coins required to BUY a block of attempts (the entry fee, or 0). */
  get costCoins(): number {
    return this.isTournament ? (this.tournament!.entryFeeCoins ?? 0) : 0;
  }

  /** Attempts banked per paid entry (e.g. daily 3, weekly 5, monthly 10). */
  get attemptsPerEntry(): number {
    return this.isTournament ? (this.tournament!.attempts ?? 1) : 0;
  }

  /** Attempts the player has left in the current window (0 if none/unentered). */
  get attemptsLeft(): number {
    return this.isTournament ? (myEntry(this.tournament!.id)?.left ?? 0) : 0;
  }

  /** Minimum player level to enter this tournament (the funnel; §3.2). */
  get requiredLevel(): number {
    return this.isTournament ? (this.tournament!.requiredLevel ?? 1) : 1;
  }

  /** This game's cadence ('daily' | 'weekly' | 'monthly'), or undefined when free. */
  get cadence(): Tournament['cadence'] | undefined {
    return this.tournament?.cadence;
  }

  /** Current pooled prize for the tournament window. */
  get prizePool(): number {
    return this.isTournament ? prizePool(this.tournament!) : 0;
  }

  /** Whether the player has already paid into this tournament window. */
  get entered(): boolean {
    return this.isTournament ? isEntered(this.tournament!.id) : true;
  }

  /** Open a round: fetch the anti-cheat token to hand back on finish(). */
  async startRound(): Promise<void> {
    this.roundToken = await startRoundRemote(this.meta.id);
  }

  // Authorise a round. Free games always pass. Tournament games use the PAY-ONCE
  // → N-ATTEMPTS model: if the player has a banked attempt left, the round is
  // authorised for free (the attempt is consumed server-side on submit); when the
  // bank is empty, buy another block (one fee → N attempts). A `reason` is
  // returned for recoverable refusals (coins / auth / level) so the game can
  // prompt accordingly. Always opens a server round (anti-cheat token) first.
  async begin(): Promise<BeginResult> {
    // Hydrate the auth cache from the persisted session — game pages don't run
    // the hub's sign-in flow, so isSignedIn() would otherwise read stale (null)
    // and wrongly report the player as signed out.
    await currentUser();
    await this.startRound();
    if (!this.isTournament) return { ok: true };
    const t = this.tournament!;
    // Banked attempt available → no charge (consumed on submit).
    if (this.attemptsLeft > 0) return { ok: true };
    // Bank empty → buy the next block (server gates level + debits the fee).
    try {
      await enterTournament(t.id);
      return { ok: true };
    } catch (e) {
      if (e instanceof InsufficientCoinsError) return { ok: false, reason: 'coins' };
      if (e instanceof SignInRequiredError) return { ok: false, reason: 'auth' };
      if (e instanceof LevelTooLowError) return { ok: false, reason: 'level' };
      // Unexpected error — don't block play over an infrastructure hiccup.
      console.warn('tournament entry skipped:', e);
      return { ok: true };
    }
  }

  // Record a finished round on the SERVER (the only economy authority). The
  // server computes points from the uniform scoring matrix (performance × time ×
  // difficulty); the client only reports {score, win, timeMs}. Tournament games
  // also get their authoritative leaderboard score written. No local storage.
  async finish(score: number, isWin: boolean, timeMs = 0, opts: { ranked?: boolean } = {}): Promise<FinishResult> {
    // `ranked` defaults to tournament mode; pass false for a free/practice run
    // (earns XP, doesn't consume an attempt or hit the leaderboard).
    const ranked = opts.ranked ?? this.isTournament;
    try {
      const res = await submitPlayRemote(this.meta.id, Math.max(0, Math.floor(score)), isWin, ranked, this.roundToken, timeMs);
      if (typeof res.points === 'number') setBalance('xp', res.points);
      if (typeof res.lifetime === 'number') setLifetime(res.lifetime);
      // Keep the local attempt bank in sync with the server's authoritative count.
      if (ranked && this.tournament && typeof res.attemptsLeft === 'number') {
        noteAttemptsLeft(this.tournament.id, res.attemptsLeft);
      }
      // Cache the server standing so standing() reflects the latest real rank.
      if (ranked && typeof res.rank === 'number') {
        this.cachedStanding = { rank: res.rank, name: 'You', score: res.best ?? 0, isPlayer: true };
      }
      return {
        best: res.best ?? 0, isRecord: res.isRecord ?? false, rank: res.rank, total: res.total,
        award: res.award, points: res.points, lifetime: res.lifetime,
        attemptsLeft: res.attemptsLeft, ranked: res.ranked,
      };
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

/** Record a finished engine-game run on the server. A "win" (→ flat points) is
 *  reaching the game's win threshold (catalog `play.winScore`); the leaderboard
 *  score is written for tournament games regardless. Best-effort, never throws. */
export async function recordEnginePlay(gameId: string, score: number): Promise<void> {
  try {
    const h = new GameHost(gameId);
    await h.startRound();
    await h.finish(score, score >= h.winScore);
  } catch { /* best-effort */ }
}

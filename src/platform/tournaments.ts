// Tournaments + leaderboards.
//
// A tournament is a time-boxed competition built on top of a catalog game: it
// has a live window (countdown), a coin prize and a ranked leaderboard. There
// is no server in this build, so the leaderboard is the player's real scores
// merged with a *deterministic* simulated field — the same seed always yields
// the same rivals and scores, so the board feels like a real, populated ladder
// across reloads instead of random noise. Every piece of player-facing data
// goes through `tournaments` (this module), so swapping the local store for a
// real backend later is a single-file change: keep the method signatures, move
// the bodies behind fetch().

import { getGame, tournamentGames, type GameMeta } from './catalog';

export interface Tournament {
  id: string;
  gameId: string;
  titleEn: string;
  titleAm: string;
  prizeCoins: number;
  /** Epoch ms. */
  startsAt: number;
  endsAt: number;
}

export interface LeaderEntry {
  rank: number;
  name: string;
  score: number;
  isPlayer: boolean;
}

export interface SubmitResult {
  best: number;
  isRecord: boolean;
  rank: number;
  total: number;
}

const PLAYER_KEY = 'innoarcade.tournament.scores.v1';
const NAME_KEY = 'innoarcade.player.name';

// --- Active tournament windows ---------------------------------------------
// Windows are derived from the calendar so a countdown is always live without
// anyone editing dates. The monthly event runs to the end of the current month;
// the weekly event runs to the end of the current ISO-ish week.

function endOfMonth(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}
function startOfMonth(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function endOfWeek(now = Date.now()): number {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return monday.getTime() + 7 * 864e5;
}

export function activeTournaments(now = Date.now()): Tournament[] {
  const list: Tournament[] = [];
  const flagship = tournamentGames();
  for (const game of flagship) {
    list.push({
      id: `${game.id}-monthly`,
      gameId: game.id,
      titleEn: 'Monthly Championship',
      titleAm: 'ወርሃዊ ሻምፒዮና',
      prizeCoins: 5000,
      startsAt: startOfMonth(now),
      endsAt: endOfMonth(now),
    });
    list.push({
      id: `${game.id}-weekly`,
      gameId: game.id,
      titleEn: 'Weekly Cup',
      titleAm: 'ሳምንታዊ ዋንጫ',
      prizeCoins: 1000,
      startsAt: endOfWeek(now) - 7 * 864e5,
      endsAt: endOfWeek(now),
    });
  }
  return list;
}

export function getTournament(id: string, now = Date.now()): Tournament | undefined {
  return activeTournaments(now).find((t) => t.id === id);
}

export function featuredTournament(now = Date.now()): Tournament | undefined {
  return activeTournaments(now)[0];
}

export function tournamentGame(t: Tournament): GameMeta | undefined {
  return getGame(t.gameId);
}

// --- Player identity --------------------------------------------------------

export function playerName(): string {
  return localStorage.getItem(NAME_KEY) || 'You';
}
export function setPlayerName(name: string): void {
  const clean = name.trim().slice(0, 16);
  if (clean) localStorage.setItem(NAME_KEY, clean);
}

// --- Simulated rival field (deterministic) ---------------------------------

// A tiny seeded PRNG (mulberry32) so a given tournament always generates the
// same rivals and scores — the ladder is stable across reloads and devices.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const RIVAL_NAMES = [
  'Abeni', 'Dawit', 'Sara', 'Yonas', 'Helen', 'Bereket', 'Marta', 'Kalkidan',
  'Nahom', 'Selam', 'Tewodros', 'Ruth', 'Eyob', 'Hanna', 'Robel', 'Mimi',
  'GuyZA', 'Blinter', 'NovaKing', 'ShadowFox', 'PixelPro', 'AceOne', 'ZenMode',
  'TurboT', 'LunaR', 'MaxOut', 'ByteMe', 'Falcon', 'Orbit99', 'Comet',
  'Liya', 'Samuel', 'Meron', 'Henok', 'Feven', 'Biruk', 'Tigist', 'Amanuel',
];

interface Rival { name: string; score: number; }

// Build a stable rival field for a tournament: ~36 named rivals with a
// believable score spread (a long tail with a few high performers).
function rivalsFor(tournamentId: string, topScore: number): Rival[] {
  const rng = mulberry32(hashString(tournamentId));
  const count = 32 + Math.floor(rng() * 10);
  const names = [...RIVAL_NAMES];
  // Deterministic shuffle.
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  const rivals: Rival[] = [];
  for (let i = 0; i < count; i++) {
    // Scores decay from topScore down a curve, with jitter.
    const frac = i / count;
    const base = topScore * (1 - frac * frac * 0.92);
    const jitter = (rng() - 0.5) * topScore * 0.06;
    const score = Math.max(10, Math.round((base + jitter) / 5) * 5);
    rivals.push({ name: names[i % names.length], score });
  }
  return rivals.sort((a, b) => b.score - a.score);
}

// A reference "top score" per tournament so the simulated ladder scales to the
// game. Tuned to the game's typical strong run; the player can beat it.
function topScoreFor(t: Tournament): number {
  const g = getGame(t.gameId);
  const base = g?.id === 'orbit-blast' ? 2400 : 1800;
  // Weekly cups have a lower bar than the monthly championship.
  return t.id.endsWith('weekly') ? Math.round(base * 0.6) : base;
}

// --- Player scores ----------------------------------------------------------

type ScoreStore = Record<string, number>; // tournamentId -> player best

function readScores(): ScoreStore {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_KEY) || '{}') as ScoreStore;
  } catch {
    return {};
  }
}
function writeScores(s: ScoreStore): void {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(s));
}

export function playerBest(tournamentId: string): number {
  return readScores()[tournamentId] ?? 0;
}

// Record a run against a tournament and return the player's new standing.
export function submitScore(tournamentId: string, score: number): SubmitResult {
  const t = getTournament(tournamentId);
  const scores = readScores();
  const prev = scores[tournamentId] ?? 0;
  const isRecord = score > prev;
  const best = Math.max(prev, score);
  if (isRecord) {
    scores[tournamentId] = best;
    writeScores(scores);
  }
  const board = buildLeaderboard(t, best);
  const me = board.find((e) => e.isPlayer);
  return { best, isRecord, rank: me?.rank ?? board.length + 1, total: board.length };
}

// Merge the player's best into the simulated field and rank everyone.
function buildLeaderboard(t: Tournament | undefined, playerScore: number): LeaderEntry[] {
  if (!t) return [];
  const top = topScoreFor(t);
  const rivals = rivalsFor(t.id, top);
  const rows: Array<Rival & { isPlayer: boolean }> = rivals.map((r) => ({ ...r, isPlayer: false }));
  if (playerScore > 0) rows.push({ name: playerName(), score: playerScore, isPlayer: true });
  rows.sort((a, b) => b.score - a.score || (a.isPlayer ? -1 : 1));
  return rows.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, isPlayer: r.isPlayer }));
}

export function leaderboard(tournamentId: string, limit?: number): LeaderEntry[] {
  const t = getTournament(tournamentId);
  const board = buildLeaderboard(t, playerBest(tournamentId));
  return limit ? board.slice(0, limit) : board;
}

// The player's row even when they're outside the visible top-N.
export function playerStanding(tournamentId: string): LeaderEntry | undefined {
  return buildLeaderboard(getTournament(tournamentId), playerBest(tournamentId))
    .find((e) => e.isPlayer);
}

// --- Countdown formatting ----------------------------------------------------

export interface Countdown { days: number; hours: number; minutes: number; seconds: number; done: boolean; }

export function countdown(endsAt: number, now = Date.now()): Countdown {
  let ms = Math.max(0, endsAt - now);
  const days = Math.floor(ms / 864e5); ms -= days * 864e5;
  const hours = Math.floor(ms / 36e5); ms -= hours * 36e5;
  const minutes = Math.floor(ms / 6e4); ms -= minutes * 6e4;
  const seconds = Math.floor(ms / 1000);
  return { days, hours, minutes, seconds, done: endsAt <= now };
}

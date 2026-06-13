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
import { isConfigured, supabase } from './supabase';
import { config, defaultEntryFee, economyOnline as online, economyNeedsAuth } from './config';
import { mockApply, balanceSync } from './wallet';
import { SignInRequiredError } from './payments';

/** free = open entry, prizes funded by the house; paid = coin entry fee, pooled. */
export type TournamentType = 'free' | 'paid';
/** sponsored = fixed prize set by the operator; pool = sum of entry fees (minus rake). */
export type PrizeModel = 'sponsored' | 'pool';
export type TournamentState = 'upcoming' | 'live' | 'ended' | 'settling' | 'settled';

/** How the prize pool is split, e.g. [{rank:1,pct:50},{rank:2,pct:30},{rank:3,pct:20}]. */
export interface PrizeTier { rank: number; pct: number; }

export interface Tournament {
  id: string;
  gameId: string;
  titleEn: string;
  titleAm: string;
  type: TournamentType;
  /** Coins to enter a paid tournament; 0 for free. */
  entryFeeCoins: number;
  prizeModel: PrizeModel;
  /** Fixed prize when prizeModel === 'sponsored'. */
  sponsoredPrize: number;
  prizeTiers: PrizeTier[];
  /** Headline prize coins (computed pool) — kept for back-compat with the hub. */
  prizeCoins: number;
  /** Epoch ms. */
  startsAt: number;
  endsAt: number;
}

export interface TournamentEntry {
  tournamentId: string;
  feePaid: number;
  prizeWon: number;
  enteredAt: number;
}

const DEFAULT_TIERS: PrizeTier[] = [
  { rank: 1, pct: 50 }, { rank: 2, pct: 30 }, { rank: 3, pct: 20 },
];

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

// Operator overrides keyed by tournament id (admin edits to the derived events),
// and fully custom tournaments the admin created. Offline both live in
// localStorage; online the `tournaments` table is the source (see loadTournaments).
const OVERRIDE_KEY = 'innoarcade.tournaments.overrides.v1';
const CUSTOM_KEY = 'innoarcade.tournaments.custom.v1';

type Override = Partial<Pick<Tournament,
  'type' | 'entryFeeCoins' | 'prizeModel' | 'sponsoredPrize' | 'prizeTiers' | 'titleEn' | 'titleAm'>>;

function readOverrides(): Record<string, Override> {
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); } catch { return {}; }
}
function readCustom(): Tournament[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
}

// A derived event's shipped defaults: the monthly is a paid, pooled championship;
// the weekly is a free, house-sponsored cup. Admin overrides layer on top.
function deriveDefaults(id: string): Override & { titleEn: string; titleAm: string } {
  if (id.endsWith('monthly')) {
    return {
      titleEn: 'Monthly Championship', titleAm: 'ወርሃዊ ሻምፒዮና',
      type: 'paid', entryFeeCoins: defaultEntryFee(), prizeModel: 'pool', prizeTiers: DEFAULT_TIERS,
    };
  }
  return {
    titleEn: 'Weekly Cup', titleAm: 'ሳምንታዊ ዋንጫ',
    type: 'free', entryFeeCoins: 0, prizeModel: 'sponsored', sponsoredPrize: 1000, prizeTiers: DEFAULT_TIERS,
  };
}

function buildTournament(id: string, gameId: string, startsAt: number, endsAt: number): Tournament {
  const d = deriveDefaults(id);
  const o = readOverrides()[id] ?? {};
  const type = o.type ?? d.type ?? 'free';
  const t: Tournament = {
    id, gameId,
    titleEn: o.titleEn ?? d.titleEn,
    titleAm: o.titleAm ?? d.titleAm,
    type,
    entryFeeCoins: o.entryFeeCoins ?? d.entryFeeCoins ?? 0,
    prizeModel: o.prizeModel ?? d.prizeModel ?? 'sponsored',
    sponsoredPrize: o.sponsoredPrize ?? d.sponsoredPrize ?? 0,
    prizeTiers: o.prizeTiers ?? d.prizeTiers ?? DEFAULT_TIERS,
    prizeCoins: 0,
    startsAt, endsAt,
  };
  t.prizeCoins = prizePool(t);
  return t;
}

// Online cache filled by loadTournaments(); when null we use the local derivation.
let remoteCache: Tournament[] | null = null;

function localTournaments(now: number): Tournament[] {
  const list: Tournament[] = [];
  for (const game of tournamentGames()) {
    list.push(buildTournament(`${game.id}-monthly`, game.id, startOfMonth(now), endOfMonth(now)));
    list.push(buildTournament(`${game.id}-weekly`, game.id, endOfWeek(now) - 7 * 864e5, endOfWeek(now)));
  }
  // Custom tournaments still in their window (or recently ended, for settlement).
  for (const c of readCustom()) {
    if (now < c.endsAt + 7 * 864e5) list.push({ ...c, prizeCoins: prizePool(c) });
  }
  return list;
}

export function activeTournaments(now = Date.now()): Tournament[] {
  return remoteCache ?? localTournaments(now);
}

// Refresh the tournament list from the backend (online) into the sync cache so
// the hub's instant render can be patched with authoritative config.
export async function loadTournaments(): Promise<Tournament[]> {
  if (!isConfigured()) { remoteCache = null; return activeTournaments(); }
  try {
    const { data, error } = await supabase()
      .from('tournaments')
      .select('id, game_id, title_en, title_am, type, entry_fee_coins, prize_model, sponsored_prize, prize_tiers, starts_at, ends_at')
      .order('starts_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    // An empty/absent tournaments table means the operator hasn't created any —
    // keep using the calendar-derived defaults (null) rather than blanking the
    // list, otherwise getTournament() can't resolve the visible cards.
    remoteCache = rows.length ? rows.map((r) => {
      const t: Tournament = {
        id: String(r.id), gameId: String(r.game_id),
        titleEn: String(r.title_en), titleAm: String(r.title_am),
        type: r.type as TournamentType,
        entryFeeCoins: Number(r.entry_fee_coins ?? 0),
        prizeModel: r.prize_model as PrizeModel,
        sponsoredPrize: Number(r.sponsored_prize ?? 0),
        prizeTiers: (r.prize_tiers as PrizeTier[]) ?? DEFAULT_TIERS,
        prizeCoins: 0,
        startsAt: new Date(r.starts_at as string).getTime(),
        endsAt: new Date(r.ends_at as string).getTime(),
      };
      t.prizeCoins = prizePool(t);
      return t;
    }) : null;
  } catch {
    remoteCache = null; // offline → fall back to local derivation
  }
  return activeTournaments();
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

// --- Prize pools ------------------------------------------------------------
// A sponsored tournament pays a fixed operator-funded prize. A pooled tournament
// pays out the collected entry fees minus the house rake. Offline there is no
// real entrant table, so the entrant count is estimated deterministically from
// the tournament id (stable across reloads, same trick as the rival field) — a
// believable, non-random pool that grows with the entry fee.
function estimatedEntrants(t: Tournament): number {
  const rng = mulberry32(hashString(t.id + ':entrants'));
  return 40 + Math.floor(rng() * 90); // 40–130 players
}

export function prizePool(t: Tournament): number {
  if (t.prizeModel === 'sponsored') return t.sponsoredPrize;
  const gross = t.entryFeeCoins * estimatedEntrants(t);
  const rake = config().houseRakePct / 100;
  return Math.round((gross * (1 - rake)) / 10) * 10;
}

export interface PrizeSlot { rank: number; pct: number; coins: number; }

export function prizeBreakdown(t: Tournament): PrizeSlot[] {
  const pool = prizePool(t);
  return t.prizeTiers.map((tier) => ({
    rank: tier.rank, pct: tier.pct, coins: Math.round((pool * tier.pct) / 100),
  }));
}

// --- Tournament state -------------------------------------------------------

const SETTLED_KEY = 'innoarcade.tournaments.settled.v1';
function readSettled(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SETTLED_KEY) || '{}'); } catch { return {}; }
}

export function tournamentState(t: Tournament, now = Date.now()): TournamentState {
  if (readSettled()[t.id]) return 'settled';
  if (now < t.startsAt) return 'upcoming';
  if (now < t.endsAt) return 'live';
  return 'ended';
}

export function isPaid(t: Tournament): boolean {
  return t.type === 'paid' && t.entryFeeCoins > 0;
}

// --- Entry / registration ---------------------------------------------------

const ENTRIES_KEY = 'innoarcade.tournament.entries.v1';

function readEntries(): Record<string, TournamentEntry> {
  try { return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '{}'); } catch { return {}; }
}
function writeEntries(e: Record<string, TournamentEntry>): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(e));
}

// A synchronous "am I in?" set for instant card rendering; seeded from local
// storage immediately and refreshed from the server by loadMyEntries().
const enteredCache = new Set<string>(Object.keys(readEntries()));

export function isEntered(tournamentId: string): boolean {
  return enteredCache.has(tournamentId);
}

export class InsufficientCoinsError extends Error {
  constructor() { super('insufficient coins'); this.name = 'InsufficientCoinsError'; }
}

// Register the player for a tournament, debiting the entry fee for paid events.
// Offline this moves local coins; online it calls the enter-tournament Edge
// Function (the server is authoritative over the fee debit and the entry row).
export async function enterTournament(tournamentId: string): Promise<TournamentEntry> {
  const t = getTournament(tournamentId);
  if (!t) throw new Error('unknown tournament');
  // Paid entry is account-bound when the economy is on — never debit a local
  // guest wallet while signed out (the same backstop the coin store has).
  if (isPaid(t) && economyNeedsAuth()) throw new SignInRequiredError();

  if (!online()) {
    const entries = readEntries();
    if (entries[tournamentId]) return entries[tournamentId];
    const fee = isPaid(t) ? t.entryFeeCoins : 0;
    if (fee > 0) {
      if (balanceSync() < fee) throw new InsufficientCoinsError();
      mockApply(-fee, 'entry_fee', tournamentId);
    }
    const entry: TournamentEntry = { tournamentId, feePaid: fee, prizeWon: 0, enteredAt: Date.now() };
    entries[tournamentId] = entry;
    writeEntries(entries);
    enteredCache.add(tournamentId);
    return entry;
  }

  const { data, error } = await supabase().functions.invoke('enter-tournament', {
    body: { tournamentId },
  });
  if (error) {
    // Surface the affordability case so the UI can prompt a top-up.
    const msg = (error as { context?: { status?: number } }).context?.status;
    if (msg === 402) throw new InsufficientCoinsError();
    throw error;
  }
  enteredCache.add(tournamentId);
  return data as TournamentEntry;
}

// The player's entries. Offline reads localStorage; online fetches the table and
// refreshes the sync cache used by isEntered().
export async function myEntries(): Promise<TournamentEntry[]> {
  if (!online()) return Object.values(readEntries());
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return [];
    const { data } = await sb
      .from('tournament_entries')
      .select('tournament_id, fee_paid, prize_won, entered_at')
      .eq('user_id', me);
    enteredCache.clear();
    const list = (data ?? []).map((r) => {
      enteredCache.add(String(r.tournament_id));
      return {
        tournamentId: String(r.tournament_id),
        feePaid: Number(r.fee_paid),
        prizeWon: Number(r.prize_won),
        enteredAt: new Date(r.entered_at as string).getTime(),
      };
    });
    return list;
  } catch { return []; }
}

/** Convenience: pre-warm the entered-set so cards render correctly online. */
export async function loadMyEntries(): Promise<void> {
  await myEntries();
}

// --- Settlement (offline demo path) -----------------------------------------
// Online, settlement is the settle-tournament Edge Function (admin/cron). Offline
// we settle the only wallet that exists — the local player's — crediting their
// prize if they placed in a paying rank. Returns the prize won (0 if none).
export function settleLocal(tournamentId: string): number {
  const t = getTournament(tournamentId);
  if (!t) return 0;
  const settled = readSettled();
  if (settled[tournamentId]) return 0;

  let won = 0;
  const me = playerStanding(tournamentId);
  if (me) {
    const slot = prizeBreakdown(t).find((s) => s.rank === me.rank);
    if (slot) {
      won = slot.coins;
      mockApply(won, 'prize', tournamentId);
      const entries = readEntries();
      if (entries[tournamentId]) { entries[tournamentId].prizeWon = won; writeEntries(entries); }
    }
  }
  settled[tournamentId] = Date.now();
  localStorage.setItem(SETTLED_KEY, JSON.stringify(settled));
  return won;
}

// --- Admin mutations (offline store) ----------------------------------------
// The admin module calls these in mock mode; online the equivalent goes through
// the admin-action Edge Function. Kept here because they touch the same stores.
export function saveTournamentLocal(t: Tournament): void {
  // Derived monthly/weekly ids store an override; everything else is custom.
  const isDerived = /-(monthly|weekly)$/.test(t.id);
  if (isDerived) {
    const ov = readOverrides();
    ov[t.id] = {
      type: t.type, entryFeeCoins: t.entryFeeCoins, prizeModel: t.prizeModel,
      sponsoredPrize: t.sponsoredPrize, prizeTiers: t.prizeTiers,
      titleEn: t.titleEn, titleAm: t.titleAm,
    };
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(ov));
  } else {
    const custom = readCustom().filter((c) => c.id !== t.id);
    custom.push(t);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  }
}

export function deleteCustomTournamentLocal(id: string): void {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(readCustom().filter((c) => c.id !== id)));
}

export function newCustomTournamentId(gameId: string): string {
  return `${gameId}-custom-${Date.now().toString(36)}`;
}

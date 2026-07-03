// Remote application config — the operator-tunable knobs of the platform:
// the coin-package catalogue (what players can buy and for how much), default
// tournament entry fee, which payment methods are live, and a maintenance flag.
//
// The economy is 100% server-sourced: a baked-in DEFAULT_CONFIG provides sane
// constants so prices/labels can render before the first network read, and the
// `app_config` table (edited via the admin-action Edge Function) overrides it.
// There is NO localStorage config — the server is the single source of truth.

import { isConfigured, getSupabase } from './supabase';
import { isSignedIn } from './auth';

// Base of the uniform scoring matrix: a "perfect" round (performance 1.0, no
// difficulty/time bonus) earns this many points. The server computes the actual
// award (BASE × performance × difficulty × time) — this constant is only for HUD
// hints. Mirrored in the submit-score Edge Function; keep in sync.
export const BASE_POINTS = 100;

// Player level from lifetime XP (only grows). Cumulative XP table from the Game
// Mechanics doc §3.2 (L6/L8/L9 interpolated). Drives status, game unlocks, and
// the tournament-tier funnel (L3 → Daily, L5 → Weekly, L10 → Monthly). Beyond
// L10 the curve continues at +3000 XP/level. Mirrored server-side (runner-submit)
// and in config — keep in sync with edge functions.
export const LEVEL_THRESHOLDS = [0, 150, 400, 800, 1500, 2200, 3000, 4000, 5000, 6000];

export function levelFor(lifetimeXp: number): number {
  const xp = Math.max(0, lifetimeXp);
  let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1; else return lvl;
  }
  // Past the table (L10 = 6000): +3000 XP per additional level.
  return 10 + Math.floor((xp - 6000) / 3000);
}

// The coin economy is server-only. Operations hit the backend whenever Supabase
// is configured AND the player is signed in — there is no local/offline economy.

/** True when the backend is present but the user must sign in first. The UI uses
 *  this to prompt sign-in before buying coins / paid tournament entry. */
export function economyNeedsAuth(): boolean {
  return isConfigured() && !isSignedIn();
}

export interface CoinPackage {
  id: string;
  /** Base coins granted. */
  coins: number;
  /** Bonus coins on top (marketing — "best value"). */
  bonus: number;
  /** Price in Ethiopian Birr. */
  priceEtb: number;
  /** Highlight in the store grid. */
  popular?: boolean;
}

export interface AppConfig {
  coinPackages: CoinPackage[];
  /** Which checkout rails are offered to players. */
  paymentMethods: { telebirr: boolean; topup: boolean };
  /** Fallback entry fee for a paid tournament that doesn't set its own. */
  defaultEntryFeeCoins: number;
  /** Platform rake on pooled-prize tournaments, in percent (0–40). */
  houseRakePct: number;
  /** When true, the store + paid entry are disabled and a banner shows. */
  maintenance: boolean;
  /** QA/operator override for chance-game win odds. `null` → each game uses its
   *  own catalog rate; a number 0–100 forces ALL chance games to that win rate
   *  (set 100 for an end-to-end "always win" test). Skill games are unaffected. */
  winRateOverride: number | null;
}

// Early-stage coin economy: ~4 ETB ≈ 1 coin at entry tier, bonus on larger packs.
export const DEFAULT_CONFIG: AppConfig = {
  coinPackages: [
    { id: 'starter', coins: 20, bonus: 0, priceEtb: 5 },
    { id: 'popular', coins: 60, bonus: 10, priceEtb: 15, popular: true },
    { id: 'value', coins: 150, bonus: 30, priceEtb: 40 },
    { id: 'pro', coins: 350, bonus: 100, priceEtb: 80 },
  ],
  paymentMethods: { telebirr: true, topup: true },
  defaultEntryFeeCoins: 1,
  houseRakePct: 10,
  maintenance: false,
  winRateOverride: null,
};

/** Top-3 season coin prizes — mirror the default store catalogue totals. */
export const SEASON_TOP_PRIZES: { rank: number; packId: string; label: string; coins: number }[] = [
  { rank: 1, packId: 'pro', label: 'Pro', coins: 450 },
  { rank: 2, packId: 'value', label: 'Value', coins: 180 },
  { rank: 3, packId: 'popular', label: 'Popular', coins: 70 },
];

export const SEASON_POT_COINS =
  SEASON_TOP_PRIZES.reduce((s, p) => s + p.coins, 0) + 100 + 100 + 50 * 5; // ranks 4–10

/** ETB cash prizes per tournament game (ranks 1–5). Real ETB — not coins. */
export const TOURNAMENT_ETB_PRIZES: Record<string, readonly number[]> = {
  'fruit-slice': [50_000, 20_000, 10_000, 5_000, 3_000],
};

/** ETB cash prizes for Winners tab by cadence (legacy daily kept for layout). */
export type WinnerCadence = 'daily' | 'weekly' | 'monthly';

export function formatEtbPrize(amount: number, lang: 'en' | 'am' = 'en'): string {
  if (amount <= 0) return '—';
  if (lang === 'am' && amount >= 1000) {
    const k = amount / 1000;
    const label = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `${label}ሺ ብር/ETB`;
  }
  return `${amount.toLocaleString()} ETB`;
}

export function etbPrizeForGame(gameId: string, rank: number): number {
  const prizes = TOURNAMENT_ETB_PRIZES[gameId];
  if (!prizes || rank < 1 || rank > prizes.length) return 0;
  return prizes[rank - 1];
}

export function etbPrizesForCadence(cadence: WinnerCadence): readonly number[] {
  if (cadence === 'weekly') return TOURNAMENT_ETB_PRIZES['fruit-slice'] ?? [];
  if (cadence === 'monthly') return TOURNAMENT_ETB_PRIZES['memory-match'] ?? [];
  return [];
}

/** @deprecated use etbPrizesForCadence — kept for any legacy imports */
export const WINNER_ETB_PRIZES: Record<WinnerCadence, readonly number[]> = {
  daily: [],
  weekly: TOURNAMENT_ETB_PRIZES['fruit-slice'],
  monthly: [],
};

// In-memory cache (NO localStorage) so synchronous UI (store grid, fee labels)
// can read instantly from the last server value; loadConfig() refreshes it from
// the `app_config` table. Starts from the baked-in defaults until first load.
let cache: AppConfig = { ...DEFAULT_CONFIG };

/** Current config — synchronous, from cache. Call loadConfig() to refresh. */
export function config(): AppConfig {
  return cache;
}

export function coinPackages(): CoinPackage[] {
  return cache.coinPackages;
}

export function packageById(id: string): CoinPackage | undefined {
  return cache.coinPackages.find((p) => p.id === id);
}

export function paymentMethodsEnabled(): AppConfig['paymentMethods'] {
  return cache.paymentMethods;
}

export function defaultEntryFee(): number {
  return cache.defaultEntryFeeCoins;
}

export function isMaintenance(): boolean {
  return cache.maintenance;
}

/** Operator win-rate override (0–100), or null when each game uses its own rate. */
export function winRateOverride(): number | null {
  const v = cache.winRateOverride;
  return typeof v === 'number' ? Math.min(100, Math.max(0, v)) : null;
}

// Pull operator overrides from `app_config` (key 'app', a single JSONB row) and
// merge over the defaults. Keeps the baked-in defaults when unconfigured or on
// a transient read error (last-known cache stays in place).
/** Hydrate the config cache from a server payload (bootstrap or admin write). */
export function applyConfigRemote(remote: Partial<AppConfig>): AppConfig {
  cache = { ...DEFAULT_CONFIG, ...remote };
  return cache;
}

export async function loadConfig(): Promise<AppConfig> {
  if (!isConfigured()) return cache;
  try {
    const { data, error } = await (await getSupabase())
      .from('app_config').select('value').eq('key', 'app').maybeSingle();
    if (error) throw error;
    applyConfigRemote((data?.value ?? {}) as Partial<AppConfig>);
  } catch { /* keep last-known cache */ }
  return cache;
}

/** Patch the in-memory cache after a server write so synchronous UI reflects the
 *  change immediately. The persistent write itself goes through the admin-action
 *  Edge Function (admin.saveConfig) — this never touches storage. */
export function patchConfigCache(next: Partial<AppConfig>): AppConfig {
  cache = { ...cache, ...next };
  return cache;
}

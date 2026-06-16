// Remote application config — the operator-tunable knobs of the platform:
// the coin-package catalogue (what players can buy and for how much), default
// tournament entry fee, which payment methods are live, and a maintenance flag.
//
// The economy is 100% server-sourced: a baked-in DEFAULT_CONFIG provides sane
// constants so prices/labels can render before the first network read, and the
// `app_config` table (edited via the admin-action Edge Function) overrides it.
// There is NO localStorage config — the server is the single source of truth.

import { isConfigured, supabase } from './supabase';
import { isSignedIn } from './auth';

// Uniform play reward: every game awards exactly this many points on a win, 0 on
// a loss — the single, flat, server-authoritative rule shared by ALL games so no
// game is a better "points farm". Mirrored in the submit-score Edge Function;
// keep the two in sync.
export const WIN_POINTS = 100;

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

// The shipped defaults. Coin pricing is tuned so ~2 ETB ≈ 1 coin at the entry
// tier, with escalating bonus at higher tiers — standard free-to-play curve.
export const DEFAULT_CONFIG: AppConfig = {
  coinPackages: [
    { id: 'starter', coins: 50, bonus: 0, priceEtb: 25 },
    { id: 'plus', coins: 120, bonus: 10, priceEtb: 50, popular: true },
    { id: 'pro', coins: 300, bonus: 50, priceEtb: 100 },
    { id: 'mega', coins: 700, bonus: 150, priceEtb: 200 },
    { id: 'whale', coins: 2000, bonus: 600, priceEtb: 500 },
  ],
  paymentMethods: { telebirr: true, topup: true },
  defaultEntryFeeCoins: 50,
  houseRakePct: 10,
  maintenance: false,
  winRateOverride: null,
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
export async function loadConfig(): Promise<AppConfig> {
  if (!isConfigured()) return cache;
  try {
    const { data, error } = await supabase()
      .from('app_config').select('value').eq('key', 'app').maybeSingle();
    if (error) throw error;
    const remote = (data?.value ?? {}) as Partial<AppConfig>;
    cache = { ...DEFAULT_CONFIG, ...remote };
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

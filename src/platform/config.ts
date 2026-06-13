// Remote application config — the operator-tunable knobs of the platform:
// the coin-package catalogue (what players can buy and for how much), default
// tournament entry fee, which payment methods are live, and a maintenance flag.
//
// Same dual-path philosophy as the rest of platform/: a full DEFAULT_CONFIG is
// baked in so the store and prices render with zero backend, and when Supabase
// is configured the `app_config` table overrides it. The admin console edits
// this (locally in mock mode, via the admin-action Edge Function when online),
// so prices and fees change without a redeploy.

import { isConfigured, supabase } from './supabase';

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
};

const LOCAL_KEY = 'innoarcade.config.v1';

// In-memory cache so synchronous UI (store grid, fee labels) can read instantly;
// loadConfig() refreshes it from the backend (or localStorage overrides offline).
let cache: AppConfig = readLocal();

function readLocal(): AppConfig {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

function writeLocal(c: AppConfig): void {
  cache = c;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

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

// Pull operator overrides from `app_config` (key 'app', a single JSONB row) and
// merge over the defaults. No-ops to the baked-in/local config when unconfigured.
export async function loadConfig(): Promise<AppConfig> {
  if (!isConfigured()) { cache = readLocal(); return cache; }
  try {
    const { data, error } = await supabase()
      .from('app_config').select('value').eq('key', 'app').maybeSingle();
    if (error) throw error;
    const remote = (data?.value ?? {}) as Partial<AppConfig>;
    cache = { ...DEFAULT_CONFIG, ...remote };
  } catch {
    cache = readLocal(); // offline → last known / defaults
  }
  return cache;
}

// Persist a config change. Offline this writes localStorage so the admin mock
// works end-to-end; online it routes through the admin-action Edge Function
// (which re-checks is_admin server-side) — the admin module owns that call.
export function saveConfigLocal(next: Partial<AppConfig>): AppConfig {
  const merged = { ...cache, ...next };
  writeLocal(merged);
  return merged;
}

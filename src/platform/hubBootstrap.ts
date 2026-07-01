// Single hub bootstrap call — replaces the startup fan-out of loadConfig,
// loadTournaments, loadPools, balance, fetchWallets, fetchUnlocks, and
// loadMyEntries with one Edge Function round-trip. Falls back to individual
// loaders when the function is unavailable (local dev, not yet deployed).

import { getSupabase, isConfigured } from './supabase';
import { applyConfigRemote, type AppConfig } from './config';
import { setBalance, setLifetime } from './currency';
import { setBalanceFromServer } from './wallet';
import {
  applyTournamentsBootstrap, applyMyEntriesBootstrap,
  type TournamentRow, type PoolRow, type EntryRow,
} from './tournaments';

export interface HubBootstrapUser {
  coins: number;
  xp: number;
  lifetime: number;
  unlocks: string[];
  entries: EntryRow[];
}

export interface HubBootstrapPayload {
  config?: Partial<AppConfig>;
  tournaments?: TournamentRow[];
  pools?: PoolRow[];
  user?: HubBootstrapUser | null;
}

export interface HubBootstrapResult {
  ok: boolean;
  hadUser: boolean;
  unlocks: string[];
}

function applyHubBootstrap(payload: HubBootstrapPayload): HubBootstrapResult {
  if (payload.config) applyConfigRemote(payload.config);
  applyTournamentsBootstrap(payload.tournaments ?? [], payload.pools ?? []);

  const user = payload.user;
  if (!user) {
    setBalanceFromServer(0);
    applyMyEntriesBootstrap([]);
    return { ok: true, hadUser: false, unlocks: [] };
  }

  setBalanceFromServer(user.coins);
  setBalance('xp', user.xp);
  setLifetime(user.lifetime);
  applyMyEntriesBootstrap(user.entries ?? []);
  const unlocks = Array.isArray(user.unlocks) ? user.unlocks : [];
  return { ok: true, hadUser: true, unlocks };
}

/** One round-trip to hydrate hub caches. Returns `{ ok: false }` on failure. */
export async function bootstrapHubData(): Promise<HubBootstrapResult> {
  if (!isConfigured()) return { ok: false, hadUser: false, unlocks: [] };
  try {
    const { data, error } = await (await getSupabase()).functions.invoke('hub-bootstrap', { body: {} });
    if (error || !data) throw error ?? new Error('empty bootstrap');
    return applyHubBootstrap(data as HubBootstrapPayload);
  } catch {
    return { ok: false, hadUser: false, unlocks: [] };
  }
}

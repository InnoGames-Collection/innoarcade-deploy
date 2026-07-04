// The progression + premium currency model used across the portal:
//   • XP    — earned by playing (doc §2/§3); spent on draw tickets, drives Level.
//   • Gold  — premium currency for spins / instant-win games.
//   • Coins — bought with real money (TeleBirr / airtime); lives in
//             platform/wallet.ts (server-authoritative).
//
// All are 100% server-sourced (profiles.xp / profiles.gold / profiles.coins).
// This module holds an in-memory cache only (NO localStorage): setBalance()
// hydrates it from the server on load and after every economy call, and
// earn()/spend() are optimistic updates the next hydrate overwrites.

export type Currency = 'xp' | 'gold';

// In-memory cache only — NO localStorage. The server (profiles.xp) is the single
// source of truth; `setBalance` hydrates this cache on load and after every
// server economy call. Reads are synchronous so the UI can render instantly.
const cache: Record<Currency, number> = { xp: 0, gold: 0 };
// Lifetime XP (only grows) — drives level + the global leaderboard. Separate
// from the spendable `xp` balance.
let cacheLifetime = 0;
let cacheRpWeekly = 0;
let cacheRpMonthly = 0;

const listeners = new Set<() => void>();
function emit(): void { for (const fn of listeners) fn(); }

export function xp(): number { return cache.xp; }
export function gold(): number { return cache.gold; }
export function balanceOf(c: Currency): number { return cache[c]; }
export function xpLifetime(): number { return cacheLifetime; }
export function rpWeekly(): number { return cacheRpWeekly; }
export function rpMonthly(): number { return cacheRpMonthly; }

/** Hydrate the cache from an authoritative (server) balance. */
export function setBalance(c: Currency, v: number): void {
  cache[c] = Math.max(0, Math.floor(v));
  emit();
}

/** Hydrate the lifetime XP total (server-authoritative). */
export function setLifetime(v: number): void {
  cacheLifetime = Math.max(0, Math.floor(v));
  emit();
}

/** Hydrate the player's per-cadence RP (server-authoritative). */
export function setRpWeekly(v: number): void {
  cacheRpWeekly = Math.max(0, Math.round(v * 10) / 10);
  emit();
}
export function setRpMonthly(v: number): void {
  cacheRpMonthly = Math.max(0, Math.round(v * 10) / 10);
  emit();
}

/** Optimistic local credit; the server value overwrites it on next hydrate. */
export function earn(c: Currency, n: number): void {
  if (n > 0) { cache[c] += n; emit(); }
}

/** Optimistic local debit; returns false when the cached balance can't cover it. */
export function spend(c: Currency, n: number): boolean {
  if (n <= 0) return true;
  if (cache[c] < n) return false;
  cache[c] -= n;
  emit();
  return true;
}

export function canAfford(c: Currency, n: number): boolean {
  return cache[c] >= n;
}

/** Subscribe to any xp/gold change; returns an unsubscribe. */
export function onCurrencyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

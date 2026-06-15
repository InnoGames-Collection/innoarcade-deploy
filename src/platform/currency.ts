// The three-tier currency model used across the portal:
//   • Points — earned by playing; spent on draw tickets and leaderboards.
//   • Gold   — premium currency for spins / instant-win games.
//   • Coins  — bought with real money (TeleBirr / airtime); lives in
//              platform/wallet.ts (server-authoritative when the economy is on).
//
// Points and Gold are local-first here, mirroring the wallet's offline mock: a
// localStorage balance plus an `earn`/`spend` API and a change event. Phase 3's
// server wiring will move these behind the same Edge-Function boundary the coin
// wallet already uses, keeping these signatures intact.

export type Currency = 'points' | 'gold';

// In-memory cache only — NO localStorage. The server (profiles.points) is the
// single source of truth; `setBalance` hydrates this cache from the server on
// load and after every server economy call. Reads are synchronous so the UI can
// render instantly from the last hydrated value.
const cache: Record<Currency, number> = { points: 0, gold: 0 };

const listeners = new Set<() => void>();
function emit(): void { for (const fn of listeners) fn(); }

export function points(): number { return cache.points; }
export function gold(): number { return cache.gold; }
export function balanceOf(c: Currency): number { return cache[c]; }

/** Hydrate the cache from an authoritative (server) balance. */
export function setBalance(c: Currency, v: number): void {
  cache[c] = Math.max(0, Math.floor(v));
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

/** Subscribe to any points/gold change; returns an unsubscribe. */
export function onCurrencyChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

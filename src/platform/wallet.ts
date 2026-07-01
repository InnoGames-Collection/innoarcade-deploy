// The coin wallet: a balance and an immutable ledger (one row per coin movement).
//
// 100% server-authoritative. Coins live in `profiles.coins`; the client NEVER
// writes them. Credits (coin purchases, prize payouts) and debits (tournament
// entry fees) all happen inside Edge Functions running with the service role,
// which write `profiles.coins` and append a `wallet_ledger` row atomically. This
// module only READS those. There is no localStorage and no offline wallet — an
// in-memory cache holds the last server value for instant synchronous rendering.

import { getSupabase, isConfigured } from './supabase';

export interface LedgerEntry {
  id: string;
  /** Signed coin change: +credit / -debit. */
  delta: number;
  /** Machine reason, e.g. 'purchase', 'entry_fee', 'prize', 'admin_adjust'. */
  reason: string;
  /** Free-form reference (order id, tournament id…). */
  ref: string;
  balanceAfter: number;
  createdAt: number;
}

// In-memory cache only — NO localStorage. `balance()` hydrates it from the server
// (profiles.coins); synchronous reads return the last hydrated value.
let cached = 0;
const listeners = new Set<(balance: number) => void>();

function emit(): void {
  for (const fn of listeners) fn(cached);
}

/** Last-known balance, synchronous — for instant chip render. */
export function balanceSync(): number {
  return cached;
}

/** Hydrate the coin cache from a server payload (bootstrap or economy call). */
export function setBalanceFromServer(coins: number): void {
  cached = Math.max(0, Math.floor(Number(coins) || 0));
  emit();
}

/** Authoritative balance, read from `profiles.coins` for the signed-in player. */
export async function balance(): Promise<number> {
  if (!isConfigured()) { cached = 0; emit(); return 0; }
  try {
    const sb = await getSupabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) { cached = 0; emit(); return 0; }
    const { data } = await sb.from('profiles').select('coins').eq('id', me).maybeSingle();
    cached = Number(data?.coins ?? 0);
  } catch { /* keep last cached */ }
  emit();
  return cached;
}

/** Recent ledger rows, newest first (server `wallet_ledger`). */
export async function ledger(limit = 20): Promise<LedgerEntry[]> {
  if (!isConfigured()) return [];
  try {
    const sb = await getSupabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) return [];
    const { data } = await sb
      .from('wallet_ledger')
      .select('id, delta, reason, ref, balance_after, created_at')
      .eq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      delta: Number(r.delta),
      reason: String(r.reason),
      ref: String(r.ref ?? ''),
      balanceAfter: Number(r.balance_after),
      createdAt: new Date(r.created_at as string).getTime(),
    }));
  } catch { return []; }
}

/** Subscribe to balance changes; returns an unsubscribe. */
export function onWalletChange(fn: (balance: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True if the last-known balance can cover a debit (the server re-checks). */
export function canAfford(cost: number): boolean {
  return cached >= cost;
}

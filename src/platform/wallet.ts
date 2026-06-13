// The coin wallet: a balance and an immutable ledger (one row per coin movement).
//
// Integrity boundary — the same one `scores` already draws: when Supabase is
// configured the client NEVER writes coins. Credits (coin purchases, prize
// payouts) and debits (tournament entry fees) all happen inside Edge Functions
// running with the service role, which write `profiles.coins` and append a
// `wallet_ledger` row atomically. This module only READS those server-side.
//
// Offline (no Supabase) the platform still has to be fully playable, so a local
// mock wallet lives in localStorage and `mockApply()` performs the movement the
// Edge Function would. `mockApply()` throws when Supabase IS configured, so the
// boundary can never be crossed by accident in a real deployment.

import { isConfigured, supabase } from './supabase';
import { isSignedIn } from './auth';

// Server-backed only for authenticated users; anonymous players (even with a
// backend configured) use the local guest wallet so the app is always usable.
const online = (): boolean => isConfigured() && isSignedIn();

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

const BAL_KEY = 'innoarcade.wallet.balance.v1';
const LEDGER_KEY = 'innoarcade.wallet.ledger.v1';
const STARTING_COINS = 100; // a small welcome balance so new local players can try paid entry

let cached = readLocalBalance();
const listeners = new Set<(balance: number) => void>();

function readLocalBalance(): number {
  const raw = localStorage.getItem(BAL_KEY);
  if (raw == null) return STARTING_COINS;
  const n = Number(raw);
  return Number.isFinite(n) ? n : STARTING_COINS;
}

function readLocalLedger(): LedgerEntry[] {
  try { return JSON.parse(localStorage.getItem(LEDGER_KEY) || '[]') as LedgerEntry[]; }
  catch { return []; }
}

function emit(): void {
  for (const fn of listeners) fn(cached);
}

/** Last-known balance, synchronous — for instant chip render. */
export function balanceSync(): number {
  return cached;
}

/** Authoritative balance. Reads `profiles.coins` online, localStorage offline. */
export async function balance(): Promise<number> {
  if (!online()) { cached = readLocalBalance(); emit(); return cached; }
  try {
    const sb = supabase();
    const me = (await sb.auth.getUser()).data.user?.id;
    if (!me) { cached = 0; emit(); return 0; }
    const { data } = await sb.from('profiles').select('coins').eq('id', me).maybeSingle();
    cached = Number(data?.coins ?? 0);
  } catch { /* keep last cached */ }
  emit();
  return cached;
}

/** Recent ledger rows, newest first. */
export async function ledger(limit = 20): Promise<LedgerEntry[]> {
  if (!online()) {
    return readLocalLedger().sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  try {
    const sb = supabase();
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

// --- Mock-only mutation -----------------------------------------------------
// Applies a coin movement to the LOCAL wallet (offline mode only). The mock
// payment / tournament-entry / admin paths call this; online those operations
// are server-authoritative and this throws to enforce the integrity boundary.
export function mockApply(delta: number, reason: string, ref = ''): LedgerEntry {
  if (online()) {
    throw new Error('wallet.mockApply is guest-only; signed-in coins move via Edge Functions');
  }
  const next = Math.max(0, cached + delta);
  cached = next;
  localStorage.setItem(BAL_KEY, String(next));
  const entry: LedgerEntry = {
    id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    delta, reason, ref, balanceAfter: next, createdAt: Date.now(),
  };
  const all = readLocalLedger();
  all.push(entry);
  localStorage.setItem(LEDGER_KEY, JSON.stringify(all.slice(-200)));
  emit();
  return entry;
}

/** True if the local wallet can cover a debit (offline affordability check). */
export function canAfford(cost: number): boolean {
  return balanceSync() >= cost;
}

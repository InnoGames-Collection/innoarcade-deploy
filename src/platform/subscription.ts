// Subscription plans — the recurring-access monetisation alongside per-coin
// purchases. Players subscribe with airtime or TeleBirr to a Daily / Weekly /
// Monthly plan; first-time subscribers get a 1-day free trial.
//
// 100% server-authoritative: the active subscription lives in the `subscriptions`
// table. With PORTAL_ENABLED on the backend, Activate returns `pending` and the
// entitlement is created by `portal-subscription-webhook` (source of truth).
// The client keeps an in-memory cache (NO localStorage) hydrated by loadSubscription().

import { isConfigured, getSupabase } from './supabase';
import { userId } from './auth';
import { type PayMethod } from './payments';

export type SubPeriod = 'daily' | 'weekly' | 'monthly';

export interface SubPlan {
  period: SubPeriod;
  priceEtb: number;
  /** Access length granted by the plan, in days. */
  days: number;
}

export const SUB_PLANS: SubPlan[] = [
  { period: 'daily', priceEtb: 3, days: 1 },
  { period: 'weekly', priceEtb: 15, days: 7 },
  { period: 'monthly', priceEtb: 35, days: 30 },
];

export interface Subscription {
  period: SubPeriod;
  method: PayMethod | 'portal';
  startedAt: number;
  expiresAt: number;
  /** Whether a free trial day was applied at activation. */
  trial: boolean;
  source?: 'app' | 'portal';
}

/** Returned when backend is in portal mode and entitlement is awaited from webhook. */
export interface SubscribePending {
  pending: true;
  period: SubPeriod;
  message?: string;
}

export type SubscribeResult = Subscription | SubscribePending;

export function isSubscribePending(r: SubscribeResult): r is SubscribePending {
  return (r as SubscribePending).pending === true;
}

// In-memory cache only — hydrated by loadSubscription() from the server.
let cache: Subscription | null = null;
let trialUsed = false;
const listeners = new Set<() => void>();
const emit = (): void => { for (const fn of listeners) fn(); };

/** The active subscription from the last hydrate, or null if none / expired. */
export function currentSub(): Subscription | null {
  return cache && cache.expiresAt > Date.now() ? cache : null;
}

export function isSubscribed(): boolean {
  return currentSub() !== null;
}

export function trialAvailable(): boolean {
  return !trialUsed;
}

export function planByPeriod(p: SubPeriod): SubPlan {
  return SUB_PLANS.find((x) => x.period === p)!;
}

function mapRow(r: Record<string, unknown>): Subscription {
  return {
    period: r.period as SubPeriod,
    method: r.method as PayMethod | 'portal',
    startedAt: new Date(r.started_at as string).getTime(),
    expiresAt: new Date(r.expires_at as string).getTime(),
    trial: Boolean(r.trial),
    source: (r.source as 'app' | 'portal' | undefined) ?? 'app',
  };
}

// Hydrate the cache: the player's latest subscription and whether they have ever
// used the free trial. Call on load and after auth changes.
export async function loadSubscription(): Promise<Subscription | null> {
  if (!isConfigured()) { cache = null; trialUsed = false; emit(); return null; }
  try {
    const sb = (await getSupabase());
    const me = await userId();
    if (!me) { cache = null; trialUsed = false; emit(); return null; }
    const { data } = await sb
      .from('subscriptions')
      .select('period, method, started_at, expires_at, trial, source')
      .eq('user_id', me)
      .order('expires_at', { ascending: false })
      .limit(1);
    const rows = data ?? [];
    cache = rows.length ? mapRow(rows[0]) : null;
    // The trial is one-time: used if any past subscription claimed it.
    const { data: trialRows } = await sb
      .from('subscriptions').select('id').eq('user_id', me).eq('trial', true).limit(1);
    trialUsed = (trialRows ?? []).length > 0;
  } catch { /* keep last cache */ }
  emit();
  return currentSub();
}

// Activate a plan via the server. Portal mode may return { pending: true }.
export async function subscribe(period: SubPeriod, method: PayMethod): Promise<SubscribeResult> {
  const { data, error } = await (await getSupabase()).functions.invoke('subscribe', {
    body: { period, method },
  });
  if (error) throw error;
  if (data?.pending) {
    emit();
    return {
      pending: true,
      period: (data.period as SubPeriod) ?? period,
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  }
  cache = mapRow(data.subscription as Record<string, unknown>);
  if (cache.trial) trialUsed = true;
  emit();
  return cache;
}

// Cancel is not offered in-app. Unsubscribe = SMS STOP to shortcode or portal grace_expiry.
// Kept as a no-op error so old clients get a clear failure instead of silently expiring.
export async function cancelSub(): Promise<void> {
  throw new Error('Unsubscribe by texting STOP to the service shortcode');
}

export function onSubChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

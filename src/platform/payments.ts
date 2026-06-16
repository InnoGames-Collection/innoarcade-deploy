// Coin purchases — the bridge between real money (TeleBirr / mobile top-up) and
// the in-app coin wallet. 100% server-authoritative; no localStorage, no sandbox
// fallback on the client.
//
// The flow mirrors every real PSP integration:
//   startCheckout(pkg, method)
//     → invoke the `buy-coins` Edge Function → it creates a pending
//       `payment_orders` row and returns a checkout descriptor. For TeleBirr
//       that's a hosted-page redirect URL; the provider later calls our
//       `payment-callback` webhook, which credits the wallet.
//   pollOrder(id) → watches the `payment_orders` row the webhook updates.
//
// Real TeleBirr is wired by filling in the adapter inside the `buy-coins` /
// `payment-callback` Edge Functions (request signing + webhook verification);
// nothing in this file or the UI changes.

import { supabase } from './supabase';
import { packageById, economyNeedsAuth } from './config';
import { currentUser } from './auth';

/** Thrown when a purchase is attempted signed-out. Coins are account-bound, so
 *  this is the platform-level backstop ensuring coins can never be bought without
 *  an account (the UI gates this earlier). */
export class SignInRequiredError extends Error {
  constructor() { super('sign-in required'); this.name = 'SignInRequiredError'; }
}

export type PayMethod = 'telebirr' | 'topup';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface Order {
  id: string;
  packageId: string;
  coins: number; // total coins (base + bonus) the order grants
  amountEtb: number;
  method: PayMethod;
  status: OrderStatus;
  createdAt: number;
  /** Present for redirect-based methods (e.g. TeleBirr hosted page). */
  redirectUrl?: string;
}

export interface CheckoutResult {
  order: Order;
  /** True when the backend ran in sandbox (no merchant account configured). */
  sandbox: boolean;
}

// Begin a purchase. Returns immediately with a pending order (and a hosted
// checkout redirect URL). Always server-authoritative — requires sign-in.
export async function startCheckout(packageId: string, method: PayMethod): Promise<CheckoutResult> {
  const pkg = packageById(packageId);
  if (!pkg) throw new Error('unknown package');
  await currentUser(); // hydrate the auth cache from the persisted session
  if (economyNeedsAuth()) throw new SignInRequiredError();

  // The hosted checkout page (real TeleBirr, or the sandbox page) needs to know
  // where the app lives so it can send the player back here afterwards.
  const dir = location.pathname.replace(/[^/]*$/, ''); // strip the filename
  const appBase = location.origin + dir;               // e.g. https://host/innoarcade/
  const returnUrl = location.origin + location.pathname; // back to this exact page

  const { data, error } = await supabase().functions.invoke('buy-coins', {
    body: { packageId, method, appBase, returnUrl },
  });
  if (error) throw error;
  return { order: data.order as Order, sandbox: Boolean(data.sandbox) };
}

// Drive a pending order to completion by polling the order row the webhook
// updates (up to ~30s). Resolves with the final order.
export async function pollOrder(orderId: string): Promise<Order> {
  const sb = supabase();
  for (let i = 0; i < 30; i++) {
    const { data } = await sb
      .from('payment_orders')
      .select('id, package_id, coins, amount_etb, method, status, created_at')
      .eq('id', orderId).maybeSingle();
    if (data) {
      const order = mapOrder(data);
      if (order.status !== 'pending') return order;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('payment timed out');
}

// The signed-in player's recent orders (admin sees all via admin.ts).
export async function myOrders(limit = 20): Promise<Order[]> {
  const sb = supabase();
  const me = (await sb.auth.getUser()).data.user?.id;
  if (!me) return [];
  const { data } = await sb
    .from('payment_orders')
    .select('id, package_id, coins, amount_etb, method, status, created_at')
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapOrder);
}

function mapOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    packageId: String(r.package_id),
    coins: Number(r.coins),
    amountEtb: Number(r.amount_etb),
    method: r.method as PayMethod,
    status: r.status as OrderStatus,
    createdAt: new Date(r.created_at as string).getTime(),
  };
}

export const PAY_METHOD_LABEL: Record<PayMethod, { en: string; am: string; icon: string }> = {
  telebirr: { en: 'telebirr', am: 'ቴሌብር', icon: '📱' },
  topup: { en: 'Airtime top-up', am: 'የአየር ሰዓት', icon: '💳' },
};

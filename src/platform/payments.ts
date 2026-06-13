// Coin purchases — the bridge between real money (TeleBirr / mobile top-up) and
// the in-app coin wallet.
//
// The flow mirrors every real PSP integration and keeps the same seam as the
// rest of the platform:
//   startCheckout(pkg, method)
//     → online:  invoke `buy-coins` Edge Function → it creates a pending
//                `payment_orders` row and returns a checkout descriptor. For
//                TeleBirr that's a hosted-page redirect URL; the provider later
//                calls our `payment-callback` webhook, which credits the wallet.
//     → offline: a SANDBOX order that "settles" after a short delay and credits
//                the local wallet via wallet.mockApply — so the whole purchase
//                journey is demoable with no backend and no money.
//
// Real TeleBirr is wired by filling in the adapter inside the `buy-coins` /
// `payment-callback` Edge Functions (request signing + webhook verification);
// nothing in this file or the UI changes.

import { supabase } from './supabase';
import { packageById, economyOnline as online, economyNeedsAuth, type CoinPackage } from './config';
import { mockApply } from './wallet';

/** Thrown when a purchase is attempted signed-out while the server economy is on
 *  (coins are account-bound there). The UI gates this earlier; this is the
 *  platform-level backstop so coins can never be bought without an account. */
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
  /** True when settled instantly with no real money (offline demo). */
  sandbox: boolean;
}

const ORDERS_KEY = 'innoarcade.orders.v1';
const SANDBOX_SETTLE_MS = 1400; // feel of a real redirect round-trip

function totalCoins(pkg: CoinPackage): number {
  return pkg.coins + pkg.bonus;
}

function readMockOrders(): Order[] {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]') as Order[]; }
  catch { return []; }
}
function writeMockOrders(list: Order[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(-100)));
}

// Begin a purchase. Returns immediately with a (pending or sandbox) order.
export async function startCheckout(packageId: string, method: PayMethod): Promise<CheckoutResult> {
  const pkg = packageById(packageId);
  if (!pkg) throw new Error('unknown package');
  // Backend economy on but signed out → never credit a local guest wallet.
  if (economyNeedsAuth()) throw new SignInRequiredError();

  if (!online()) {
    const order: Order = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      packageId, coins: totalCoins(pkg), amountEtb: pkg.priceEtb,
      method, status: 'pending', createdAt: Date.now(),
    };
    const list = readMockOrders();
    list.push(order);
    writeMockOrders(list);
    return { order, sandbox: true };
  }

  // The hosted checkout page (real TeleBirr, or the demo page in sandbox) needs
  // to know where the app lives so it can send the player back here afterwards.
  const dir = location.pathname.replace(/[^/]*$/, ''); // strip the filename
  const appBase = location.origin + dir;               // e.g. https://host/innoarcade/
  const returnUrl = location.origin + location.pathname; // back to this exact page

  const { data, error } = await supabase().functions.invoke('buy-coins', {
    body: { packageId, method, appBase, returnUrl },
  });
  if (error) throw error;
  return { order: data.order as Order, sandbox: Boolean(data.sandbox) };
}

// Drive a pending order to completion. Offline this performs the sandbox
// settlement (credit the wallet). Online it polls the order row the webhook
// updates. Resolves with the final order.
export async function pollOrder(orderId: string): Promise<Order> {
  if (!online()) {
    await new Promise((r) => setTimeout(r, SANDBOX_SETTLE_MS));
    const list = readMockOrders();
    const order = list.find((o) => o.id === orderId);
    if (!order) throw new Error('order not found');
    if (order.status === 'pending') {
      order.status = 'paid';
      writeMockOrders(list);
      mockApply(order.coins, 'purchase', order.id); // credit the local wallet
    }
    return order;
  }

  // Online: poll the order until the webhook flips it (up to ~30s).
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
  if (!online()) {
    return readMockOrders().sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
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

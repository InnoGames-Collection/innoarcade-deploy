// Coin store + checkout flow (TeleBirr / airtime top-up) for the hub. Owns the
// store/payment UI and keeps the coin balance hydrated; the balance itself is
// shown by the hub's #topBalances strip. Strings are inline EN/AM.

import { getLang } from '../i18n';
import { onAuthChange, currentUser } from '../platform/auth';
import { openSignIn } from './signin';
import { balance } from '../platform/wallet';
import { loadConfig, coinPackages, paymentMethodsEnabled, isMaintenance, economyNeedsAuth, type CoinPackage } from '../platform/config';
import { startCheckout, pollOrder, PAY_METHOD_LABEL, SignInRequiredError, type PayMethod } from '../platform/payments';

// Coins are account-bound (server-only economy), so buying requires sign-in.
export function needsSignInToBuy(): boolean {
  return economyNeedsAuth();
}

const STR = {
  en: {
    buy: 'Buy coins', store: 'Coin store', coins: 'coins', bonus: 'bonus', popular: 'Best value',
    pay: 'Pay with', payNow: 'Pay', processing: 'Processing payment…', success: 'Coins added!',
    failed: "Payment didn't complete. Try again.", close: 'Close', sandbox: 'Demo mode — no real charge',
    maintenance: 'The store is briefly unavailable.', total: 'You get', price: 'Price',
    signInTitle: 'Sign in to buy coins', signInBody: 'Coins are tied to your account, so you need to sign in before buying.', signIn: 'Sign in',
    confirmPurchase: 'Confirm purchase', purchaseNotice: 'You will receive {n} coins for {etb} ETB.',
    back: 'Back',
  },
  am: {
    buy: 'ሳንቲም ይግዙ', store: 'የሳንቲም መደብር', coins: 'ሳንቲሞች', bonus: 'ጉርሻ', popular: 'ምርጥ ዋጋ',
    pay: 'ይክፈሉ በ', payNow: 'ይክፈሉ', processing: 'ክፍያ በመከናወን ላይ…', success: 'ሳንቲሞች ታክለዋል!',
    failed: 'ክፍያው አልተጠናቀቀም። እንደገና ይሞክሩ።', close: 'ዝጋ', sandbox: 'የማሳያ ሁነታ — ክፍያ የለም',
    maintenance: 'መደብሩ ለጊዜው አይገኝም።', total: 'ያገኛሉ', price: 'ዋጋ',
    signInTitle: 'ሳንቲም ለመግዛት ይግቡ', signInBody: 'ሳንቲሞች ከመለያዎ ጋር የተሳሰሩ ናቸው፤ ከመግዛትዎ በፊት መግባት አለብዎት።', signIn: 'ግባ',
    confirmPurchase: 'ግዢን አረጋግጥ', purchaseNotice: '{etb} ETB በመክፈል {n} ሳንቲም ያገኛሉ።',
    back: 'ተመለስ',
  },
};
const t = (k: keyof typeof STR.en): string => (STR[getLang()] ?? STR.en)[k];

export async function mountWallet(opts?: { skipHydrate?: boolean }): Promise<void> {
  injectStyles();
  // The top-right balance display is the #topBalances strip (rendered by the hub:
  // points + coins + a Buy button). This module owns only the store/checkout and
  // keeps the coin balance hydrated; it no longer injects its own chip (that was
  // the duplicate currency widget).
  // Refresh the balance on sign-in/out.
  onAuthChange(() => { void balance(); });
  // Prime the signed-in state first so the store/economy correctly recognises an
  // already-signed-in user (otherwise needsSignInToBuy() can wrongly prompt
  // sign-in during the session-restore race).
  await currentUser();
  if (!opts?.skipHydrate) {
    await loadConfig();
    await balance();
  }
  void resumePendingCheckout();
}

// After the hosted checkout page redirects back with ?order=<id>, finish the
// purchase: poll the order the webhook updated, refresh the balance and (on
// success) pop the celebration. Cleans the query string so a refresh is inert.
export async function resumePendingCheckout(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  if (!orderId) return;
  const cancelled = params.get('cancel') === '1';
  ['order', 'paid', 'cancel', 'ref'].forEach((k) => params.delete(k));
  const clean = location.pathname + (params.toString() ? `?${params}` : '');
  history.replaceState(null, '', clean);
  if (cancelled) return;
  try {
    await currentUser(); // ensure the session is loaded so pollOrder hits the server path
    const order = await pollOrder(orderId);
    await balance(); // emits onWalletChange → hub re-renders #topBalances
    if (order.status === 'paid') showSuccess(shell(''), order.coins);
  } catch { /* leave the balance as-is; the order book still shows the attempt */ }
}

// --- store ------------------------------------------------------------------

function shell(inner: string, wide = false): HTMLElement {
  document.querySelector('.wallet-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'wallet-modal';
  m.innerHTML = `<div class="wallet-scrim"></div><div class="wallet-card${wide ? ' wide' : ''}">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.wallet-scrim')!.addEventListener('click', () => m.remove());
  return m;
}

export function openStore(): void {
  if (isMaintenance()) { shell(`<h3>${t('store')}</h3><p class="wallet-hint">${t('maintenance')}</p>`); return; }
  if (needsSignInToBuy()) {
    const m = shell(`
      <h3>${t('signInTitle')}</h3>
      <p class="wallet-hint">${t('signInBody')}</p>
      <button class="wallet-primary" id="signin">${t('signIn')}</button>`);
    m.querySelector('#signin')!.addEventListener('click', () => { m.remove(); openSignIn(); });
    return;
  }
  renderStoreGrid(shell('', true));
}

/** Packages sorted for tournament entry — smallest pack that covers `minCoins` first. */
export function coinPackagesForEntry(minCoins: number): CoinPackage[] {
  const pkgs = [...coinPackages()].sort((a, b) => (a.coins + a.bonus) - (b.coins + b.bonus));
  const cover = pkgs.find((p) => p.coins + p.bonus >= minCoins);
  if (!cover) return pkgs;
  return [cover, ...pkgs.filter((p) => p.id !== cover.id)];
}

function renderStoreGrid(m: HTMLElement): void {
  const pkgs = coinPackages();
  m.querySelector('.wallet-card')!.innerHTML = `
    <h3>🪙 ${t('store')}</h3>
    <div class="store-grid">
      ${pkgs.map((p) => `
        <button class="pkg${p.popular ? ' popular' : ''}" data-id="${p.id}">
          ${p.popular ? `<span class="pkg-tag">${t('popular')}</span>` : ''}
          <span class="pkg-coins">${(p.coins + p.bonus).toLocaleString()}</span>
          <span class="pkg-unit">${t('coins')}</span>
          ${p.bonus ? `<span class="pkg-bonus">+${p.bonus} ${t('bonus')}</span>` : '<span class="pkg-bonus"> </span>'}
          <span class="pkg-price">${p.priceEtb} ETB</span>
        </button>`).join('')}
    </div>`;
  m.querySelectorAll<HTMLButtonElement>('.pkg').forEach((b) => {
    b.addEventListener('click', () => openCheckout(pkgs.find((p) => p.id === b.dataset.id)!));
  });
}

/** Checkout embedded inside another modal (e.g. tournament entry). */
export interface InlineCheckoutHandlers {
  onBack: () => void;
  onPaid: () => void | Promise<void>;
}

export function openInlineCoinCheckout(
  pkg: CoinPackage,
  parentModal: HTMLElement,
  handlers: InlineCheckoutHandlers,
): void {
  injectStyles();
  if (needsSignInToBuy()) { parentModal.remove(); openSignIn(); return; }
  const card = parentModal.querySelector('.entry-card') ?? parentModal.querySelector('.wallet-card');
  if (!card) return;
  const total = pkg.coins + pkg.bonus;
  const methods = paymentMethodsEnabled();
  const avail = (['telebirr', 'topup'] as PayMethod[]).filter((mth) => methods[mth]);
  let chosen: PayMethod = avail[0] ?? 'telebirr';
  card.innerHTML = `
    <h3>${t('confirmPurchase')}</h3>
    <div class="checkout-sum">
      <span class="cs-total">🪙 ${total.toLocaleString()} ${t('coins')}</span>
      <span class="cs-price">${pkg.priceEtb} ETB</span>
    </div>
    <p class="wallet-hint">${t('purchaseNotice').replace('{n}', String(total)).replace('{etb}', String(pkg.priceEtb))}</p>
    <div class="method-list">
      ${avail.map((mth, i) => {
        const lab = PAY_METHOD_LABEL[mth];
        return `<button type="button" class="method${i === 0 ? ' sel' : ''}" data-m="${mth}">
          <span class="m-icon">${lab.icon}</span><span>${getLang() === 'am' ? lab.am : lab.en}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="wallet-err" id="err"></p>
    <button class="wallet-primary" id="pay">${t('payNow')} ${pkg.priceEtb} ETB</button>
    <button class="wallet-link" id="back">${t('back')}</button>
    <p class="wallet-sandbox">${t('sandbox')}</p>`;
  card.querySelectorAll<HTMLButtonElement>('.method').forEach((b) => {
    b.addEventListener('click', () => {
      card.querySelectorAll('.method').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      chosen = b.dataset.m as PayMethod;
    });
  });
  card.querySelector('#back')!.addEventListener('click', () => handlers.onBack());
  const pay = card.querySelector<HTMLButtonElement>('#pay')!;
  pay.addEventListener('click', async () => {
    pay.disabled = true;
    try {
      const { order } = await startCheckout(pkg.id, chosen);
      if (order.status === 'paid') {
        await balance();
        await handlers.onPaid();
        return;
      }
      if (order.redirectUrl) { window.location.href = order.redirectUrl; return; }
      pay.textContent = t('processing');
      await pollOrder(order.id);
      await balance();
      await handlers.onPaid();
    } catch (e) {
      if (e instanceof SignInRequiredError) { parentModal.remove(); openSignIn(); return; }
      card.querySelector('#err')!.textContent = t('failed');
      pay.disabled = false;
      pay.textContent = `${t('payNow')} ${pkg.priceEtb} ETB`;
    }
  });
}

function openCheckout(pkg: CoinPackage): void {
  const methods = paymentMethodsEnabled();
  const avail = (['telebirr', 'topup'] as PayMethod[]).filter((mth) => methods[mth]);
  let chosen: PayMethod = avail[0] ?? 'telebirr';
  const total = pkg.coins + pkg.bonus;
  const m = shell(`
    <h3>${t('confirmPurchase')}</h3>
    <div class="checkout-sum">
      <span class="cs-total">🪙 ${total.toLocaleString()} ${t('coins')}</span>
      <span class="cs-price">${pkg.priceEtb} ETB</span>
    </div>
    <p class="wallet-hint">${t('purchaseNotice').replace('{n}', String(total)).replace('{etb}', String(pkg.priceEtb))}</p>
    <div class="method-list">
      ${avail.map((mth, i) => {
        const lab = PAY_METHOD_LABEL[mth];
        return `<button class="method${i === 0 ? ' sel' : ''}" data-m="${mth}">
          <span class="m-icon">${lab.icon}</span><span>${getLang() === 'am' ? lab.am : lab.en}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="wallet-err" id="err"></p>
    <button class="wallet-primary" id="pay">${t('payNow')} ${pkg.priceEtb} ETB</button>
    <p class="wallet-sandbox">${t('sandbox')}</p>`);
  m.querySelectorAll<HTMLButtonElement>('.method').forEach((b) => {
    b.addEventListener('click', () => {
      m.querySelectorAll('.method').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      chosen = b.dataset.m as PayMethod;
    });
  });
  const pay = m.querySelector<HTMLButtonElement>('#pay')!;
  pay.addEventListener('click', async () => {
    pay.disabled = true;
    try {
      const { order } = await startCheckout(pkg.id, chosen);
      if (order.status === 'paid') { await balance(); showSuccess(m, total); return; }
      if (order.redirectUrl) { window.location.href = order.redirectUrl; return; }
      pay.textContent = t('processing');
      await pollOrder(order.id);
      await balance();
      showSuccess(m, total);
    } catch (e) {
      if (e instanceof SignInRequiredError) { m.remove(); openSignIn(); return; }
      m.querySelector('#err')!.textContent = t('failed');
      pay.disabled = false;
      pay.textContent = `${t('payNow')} ${pkg.priceEtb} ETB`;
    }
  });
}

function showSuccess(m: HTMLElement, coins: number): void {
  m.querySelector('.wallet-card')!.innerHTML = `
    <div class="wallet-success">
      <div class="ws-burst">🎉</div>
      <h3>${t('success')}</h3>
      <p class="ws-coins">+${coins.toLocaleString()} 🪙</p>
      <button class="wallet-primary" id="done">${t('close')}</button>
    </div>`;
  m.querySelector('#done')!.addEventListener('click', () => m.remove());
  // Pulse the topbar balance strip.
  const strip = document.querySelector('#topBalances');
  strip?.classList.add('bump');
  setTimeout(() => strip?.classList.remove('bump'), 600);
}

function injectStyles(): void {
  if (document.getElementById('wallet-styles')) return;
  const s = document.createElement('style');
  s.id = 'wallet-styles';
  s.textContent = `
    .top-balances.bump { animation:coinbump .6s ease; }
    @keyframes coinbump { 30%{transform:scale(1.08);} 60%{transform:scale(.98);} }
    .wallet-modal { position:fixed; inset:0; z-index:9991; display:flex; align-items:center; justify-content:center; }
    .wallet-scrim { position:absolute; inset:0; background:rgba(12,16,30,.5); backdrop-filter:blur(3px); }
    .wallet-card { position:relative; width:min(360px,92vw); background:#fff; color:var(--text); border-radius:16px;
      padding:22px; box-shadow:0 20px 50px rgba(20,30,60,.3); display:flex; flex-direction:column; gap:12px; }
    .wallet-card.wide { width:min(520px,94vw); }
    .wallet-card h3 { font-size:1.15rem; }
    .store-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
    .pkg { position:relative; display:flex; flex-direction:column; align-items:center; gap:2px; padding:14px 8px;
      border:1px solid var(--line); border-radius:14px; background:#fff; cursor:pointer; transition:.15s; }
    .pkg:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 6px 16px rgba(20,30,60,.12); }
    .pkg.popular { border-color:var(--accent); background:linear-gradient(180deg,#fff,#fff6e6); }
    .pkg-tag { position:absolute; top:-9px; background:var(--accent); color:#fff; font-size:.62rem; font-weight:800;
      padding:.1rem .5rem; border-radius:999px; }
    .pkg-coins { font-size:1.25rem; font-weight:900; color:#7a5212; }
    .pkg-unit { font-size:.7rem; color:var(--muted); }
    .pkg-bonus { font-size:.7rem; color:#1f9d55; font-weight:700; min-height:1em; }
    .pkg-price { margin-top:4px; font-weight:800; }
    .checkout-sum { display:flex; justify-content:space-between; align-items:center; padding:12px 14px;
      background:#f6f7fb; border-radius:12px; }
    .cs-total { font-weight:900; color:#7a5212; } .cs-price { font-weight:800; }
    .method-list { display:flex; flex-direction:column; gap:8px; }
    .method { display:flex; align-items:center; gap:10px; padding:.7rem .8rem; border:1px solid var(--line);
      border-radius:12px; background:#fff; font:inherit; font-weight:700; cursor:pointer; }
    .method.sel { border-color:var(--accent); box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 30%,transparent); }
    .m-icon { font-size:1.2rem; }
    .wallet-primary { background:var(--accent); color:#fff; border:none; border-radius:10px; padding:.8rem;
      font:inherit; font-weight:800; cursor:pointer; }
    .wallet-primary:disabled { opacity:.6; cursor:default; }
    .wallet-link { background:none; border:none; color:var(--muted); font:inherit; font-weight:700; cursor:pointer; padding:.4rem; }
    .wallet-hint, .wallet-sandbox { font-size:.78rem; color:var(--muted); text-align:center; margin:0; }
    .wallet-err { font-size:.8rem; color:#d64545; min-height:1em; margin:0; }
    .wallet-success { text-align:center; display:flex; flex-direction:column; gap:10px; align-items:center; padding:8px; }
    .ws-burst { font-size:3rem; } .ws-coins { font-size:1.6rem; font-weight:900; color:#7a5212; }`;
  document.head.appendChild(s);
}

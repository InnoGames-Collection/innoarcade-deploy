// Demo TeleBirr hosted-payment page.
//
// In production the player is redirected to TeleBirr's real hosted page; the
// provider then POSTs the result to our `payment-callback` Edge Function, which
// credits the wallet. There is no TeleBirr merchant account in this demo, so
// this page STANDS IN for that hosted page: it shows a believable telebirr
// checkout and, on "Pay", calls the SAME `payment-callback` webhook the real
// provider would — so the coin credit happens exactly as it will in production.
//
// It carries no secrets and no user session: like a real PSP callback it
// identifies the order purely by the unguessable `provider_ref` minted by
// buy-coins. Wiring real TeleBirr means buy-coins redirects here-no-more (it
// returns TeleBirr's URL instead); this file then goes unused.

import { getLang } from '../i18n';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const q = new URLSearchParams(location.search);
const ref = q.get('ref') ?? '';
const orderId = q.get('order') ?? '';
const amount = q.get('amount') ?? '0';
const coins = q.get('coins') ?? '0';
const returnUrl = decodeURIComponent(q.get('return') ?? '');

const STR = {
  en: {
    pay: 'Pay', cancel: 'Cancel', merchant: 'Pay to', amount: 'Amount',
    youGet: 'You get', phone: 'telebirr number', pin: 'PIN',
    processing: 'Processing…', secure: 'Secured by telebirr',
    demo: 'Demo payment — no real money is charged.',
    err: "Payment couldn't be completed. Please try again.",
  },
  am: {
    pay: 'ይክፈሉ', cancel: 'ይቅር', merchant: 'ክፍያ ለ', amount: 'መጠን',
    youGet: 'ያገኛሉ', phone: 'የቴሌብር ቁጥር', pin: 'ፒን',
    processing: 'በመከናወን ላይ…', secure: 'በቴሌብር የተጠበቀ',
    demo: 'የማሳያ ክፍያ — ምንም እውነተኛ ገንዘብ አይከፈልም።',
    err: 'ክፍያው ሊጠናቀቅ አልቻለም። እባክዎ እንደገና ይሞክሩ።',
  },
};
const t = (k: keyof typeof STR.en): string => (STR[getLang()] ?? STR.en)[k];

function backTo(extra: string): void {
  const sep = returnUrl.includes('?') ? '&' : '?';
  location.href = `${returnUrl}${sep}order=${encodeURIComponent(orderId)}&${extra}`;
}

async function notify(status: 'success' | 'failed'): Promise<Response> {
  return fetch(`${url}/functions/v1/payment-callback`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anon ?? '',
      authorization: `Bearer ${anon ?? ''}`,
    },
    body: JSON.stringify({ providerRef: ref, orderId, status }),
  });
}

function render(): void {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = `
    <div class="tb-wrap">
      <div class="tb-card">
        <header class="tb-head">
          <span class="tb-logo">telebirr</span>
          <span class="tb-by">ethiotelecom</span>
        </header>
        <div class="tb-body">
          <p class="tb-label">${t('merchant')}</p>
          <p class="tb-merchant">🎮 GoPlay</p>
          <div class="tb-amount">
            <span class="tb-etb">ETB</span>
            <span class="tb-val">${Number(amount).toLocaleString()}</span>
          </div>
          <p class="tb-get">${t('youGet')} <strong>${Number(coins).toLocaleString()} 🪙</strong></p>

          <label class="tb-field">
            <span>${t('phone')}</span>
            <input id="phone" type="tel" inputmode="tel" placeholder="09•• ••• •••" value="09•• ••• •••" />
          </label>
          <label class="tb-field">
            <span>${t('pin')}</span>
            <input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" value="0000" />
          </label>

          <p class="tb-err" id="err"></p>
          <button class="tb-pay" id="pay">${t('pay')} · ETB ${Number(amount).toLocaleString()}</button>
          <button class="tb-cancel" id="cancel">${t('cancel')}</button>
          <p class="tb-demo">${t('demo')}</p>
        </div>
        <footer class="tb-foot">🔒 ${t('secure')}</footer>
      </div>
    </div>`;

  const pay = app.querySelector<HTMLButtonElement>('#pay')!;
  pay.addEventListener('click', async () => {
    pay.disabled = true;
    pay.textContent = t('processing');
    try {
      const res = await notify('success');
      if (!res.ok) throw new Error(String(res.status));
      backTo('paid=1');
    } catch {
      app.querySelector('#err')!.textContent = t('err');
      pay.disabled = false;
      pay.textContent = `${t('pay')} · ETB ${Number(amount).toLocaleString()}`;
    }
  });
  app.querySelector('#cancel')!.addEventListener('click', () => {
    void notify('failed').finally(() => backTo('cancel=1'));
  });
}

function injectStyles(): void {
  const s = document.createElement('style');
  s.textContent = `
    :root { color-scheme: light; }
    body { margin:0; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(160deg,#0a8a4f,#076b3e); min-height:100vh; }
    .tb-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:16px; }
    .tb-card { width:min(380px,94vw); background:#fff; border-radius:18px; overflow:hidden;
      box-shadow:0 24px 60px rgba(0,0,0,.3); }
    .tb-head { background:#0a8a4f; color:#fff; padding:16px 20px; display:flex; align-items:baseline; gap:8px; }
    .tb-logo { font-size:1.5rem; font-weight:800; letter-spacing:-.5px; }
    .tb-by { font-size:.72rem; opacity:.85; }
    .tb-body { padding:20px; display:flex; flex-direction:column; gap:10px; }
    .tb-label { margin:0; font-size:.78rem; color:#6b7280; }
    .tb-merchant { margin:0 0 4px; font-size:1.1rem; font-weight:700; color:#111827; }
    .tb-amount { display:flex; align-items:baseline; gap:6px; padding:12px 0; border-top:1px dashed #e5e7eb; border-bottom:1px dashed #e5e7eb; }
    .tb-etb { color:#0a8a4f; font-weight:800; }
    .tb-val { font-size:2rem; font-weight:900; color:#111827; }
    .tb-get { margin:2px 0 6px; font-size:.9rem; color:#374151; }
    .tb-field { display:flex; flex-direction:column; gap:4px; font-size:.78rem; color:#6b7280; }
    .tb-field input { padding:.7rem .8rem; border:1px solid #d1d5db; border-radius:10px; font:inherit; font-size:1rem; color:#111827; }
    .tb-field input:focus { outline:2px solid #0a8a4f; border-color:#0a8a4f; }
    .tb-pay { margin-top:6px; background:#0a8a4f; color:#fff; border:none; border-radius:10px; padding:.85rem;
      font:inherit; font-weight:800; font-size:1rem; cursor:pointer; }
    .tb-pay:hover { filter:brightness(1.05); } .tb-pay:disabled { opacity:.6; cursor:default; }
    .tb-cancel { background:none; border:none; color:#6b7280; font:inherit; padding:6px; cursor:pointer; }
    .tb-err { color:#d64545; font-size:.82rem; min-height:1em; margin:0; text-align:center; }
    .tb-demo { margin:0; text-align:center; font-size:.72rem; color:#9ca3af; }
    .tb-foot { background:#f9fafb; color:#6b7280; text-align:center; padding:10px; font-size:.74rem; border-top:1px solid #f0f1f4; }`;
  document.head.appendChild(s);
}

if (!url || !anon || !ref || !returnUrl) {
  document.querySelector<HTMLElement>('#app')!.innerHTML =
    '<p style="font-family:system-ui;padding:24px;text-align:center">Invalid checkout link.</p>';
} else {
  injectStyles();
  document.documentElement.lang = getLang();
  render();
}

// Phone-OTP sign-in widget for the hub topbar. Self-contained: injects its own
// button, modal and styles, and speaks to the auth layer (Supabase phone OTP).
// When Supabase isn't configured it renders nothing and the platform stays in
// anonymous local-play mode. Strings are inline EN/AM so it needs no shared i18n.

import {
  authAvailable, requestOtp, verifyOtp, currentUser, signOut, setDisplayName,
  onAuthChange, devOtpEcho, fetchDevOtp, AuthTimeoutError, PortalNotEntitledError,
  normalizePhone, type AuthUser,
} from '../platform/auth';
import { maskPhone } from '../platform/phone';
import { getLang } from '../i18n';

const STR = {
  en: {
    signIn: 'Sign in', title: 'Enter your phone number', phone: 'Phone number',
    send: 'Get code', sending: 'Sending…', code: 'Enter the 6-digit code',
    verify: 'Sign in', verifying: 'Verifying…', resend: 'Resend code',
    name: 'Display name', save: 'Save', signOut: 'Sign out',
    sent: 'Code sent. Check your SMS.',
    errSend: "Couldn't send the code. Check the number and try again.",
    errTimeout: 'Network is slow or unreachable. Check your connection and try again.',
    errVerify: 'Wrong or expired code.', close: 'Close',
    errNotSubscribed: 'Text OK to the service shortcode to subscribe, then try again.',
    demoCode: 'Demo mode — your code is',
    otp: 'Code', terms: 'Terms & Conditions',
  },
  am: {
    signIn: 'ግባ', title: 'የስልክ ቁጥርዎን ያስገቡ', phone: 'ስልክ ቁጥር',
    send: 'ኮድ ያግኙ', sending: 'በመላክ ላይ…', code: '6-አሃዝ ኮድ ያስገቡ',
    verify: 'ይግቡ', verifying: 'በማረጋገጥ ላይ…', resend: 'ኮድ እንደገና ላክ',
    name: 'የሚታይ ስም', save: 'አስቀምጥ', signOut: 'ውጣ',
    sent: 'ኮድ ተልኳል። SMS ይመልከቱ።',
    errSend: 'ኮዱን መላክ አልተቻለም። ቁጥሩን አረጋግጠው እንደገና ይሞክሩ።',
    errTimeout: 'አውታረ መረቡ ቀርፋፋ ወይም አይገኝም። ግንኙነትዎን አረጋግጠው እንደገና ይሞክሩ።',
    errVerify: 'የተሳሳተ ወይም ጊዜው ያለፈበት ኮድ።', close: 'ዝጋ',
    errNotSubscribed: 'ወደ አገልግሎቱ አጭር ኮድ OK በመላክ ይመዝገቡ፣ ከዚያ እንደገና ይሞክሩ።',
    demoCode: 'የማሳያ ሁነታ — ኮድዎ',
    otp: 'ኮድ', terms: 'ደንብ እና ሁኔታዎች',
  },
};
const t = (k: keyof typeof STR.en): string => (STR[getLang()] ?? STR.en)[k];
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let user: AuthUser | null = null;
let slot: HTMLElement;
let phone = '';

export function mountSignIn(): void {
  if (!authAvailable()) return;
  injectStyles();
  const bar = document.querySelector('.topbar');
  if (!bar) return;
  slot = document.createElement('div');
  slot.className = 'auth-slot';
  bar.insertBefore(slot, bar.querySelector('#settingsBtn'));
  render();
  void currentUser().then((u) => { user = u; render(); });
  onAuthChange((u) => { user = u; render(); });
}

function render(): void {
  if (!slot) return;
  const label = user ? `👤 ${esc(user.name || maskPhone(user.phone || phone))}` : t('signIn');
  slot.innerHTML = `<button class="auth-btn">${label}</button>`;
  slot.querySelector('button')!.addEventListener('click', user ? openProfile : openModal);
}

// --- modal -----------------------------------------------------------------

function shell(inner: string, showBanner = true): HTMLElement {
  document.querySelector('.auth-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'auth-modal';
  m.innerHTML = `
    <div class="auth-topbar">
      <img class="auth-logo-et" src="/brand/ethio-telecom-full.png" alt="Ethio Telecom" />
      <button class="auth-back" aria-label="${t('close')}">✕</button>
    </div>
    ${showBanner ? `<div class="auth-hero"><img class="auth-hero-img" src="/brand/goplay-banner.png" alt="GoPlay" /></div>` : ''}
    <div class="auth-stack">
      <div class="auth-card">${inner}</div>
    </div>`;
  document.body.appendChild(m);
  m.querySelector('.auth-back')!.addEventListener('click', () => m.remove());
  return m;
}

export function openSignIn(): void {
  if (!authAvailable()) return;
  injectStyles();
  openModal();
}

export function openCodeScreen(phoneNumber: string): void {
  if (!authAvailable()) return;
  injectStyles();
  phone = phoneNumber;
  openCode();
}

export function notifySignIn(): void {
  void currentUser().then((u) => { user = u; render(); });
}

function openModal(): void {
  const m = shell(`
    <h3>${t('title')}</h3>
    <label>${t('phone')}</label>
    <div class="auth-phone-row">
      <input class="auth-input auth-phone-input" id="phone" type="tel" inputmode="tel" placeholder="2519XXXXXXXX / 2518XXXXXXXX" value="${esc(phone)}" />
      <button class="auth-phone-go" id="go">${t('send')}</button>
    </div>
    <p class="auth-err" id="err"></p>
    <a class="auth-terms" href="#">${t('terms')}</a>`);
  const input = m.querySelector<HTMLInputElement>('#phone')!;
  const go = m.querySelector<HTMLButtonElement>('#go')!;
  input.focus();
  go.addEventListener('click', async () => {
    phone = input.value.trim();
    if (!phone) return;
    go.disabled = true; go.textContent = t('sending');
    try {
      await requestOtp(phone);
      openCode();
    } catch (e) {
      const errEl = m.querySelector('#err')!;
      if (e instanceof PortalNotEntitledError) {
        errEl.textContent = e.hint || t('errNotSubscribed');
      } else {
        errEl.textContent = t(e instanceof AuthTimeoutError ? 'errTimeout' : 'errSend');
      }
      go.disabled = false; go.textContent = t('send');
    }
  });
}

function openCode(): void {
  const m = shell(`
    <h3>${t('code')}</h3>
    <p class="auth-hint">${t('sent')}</p>
    <p class="auth-demo" id="demo" hidden></p>
    <label>${t('otp')}</label>
    <div class="auth-otp-row">
      <input class="auth-input auth-otp-input" id="code" type="text" inputmode="numeric" maxlength="6" placeholder="xxxx" />
      <button class="auth-otp-get" id="resend" disabled>${t('send')} <span id="timer"></span></button>
    </div>
    <p class="auth-err" id="err"></p>
    <button class="auth-primary" id="go">${t('verify')}</button>
    <a class="auth-terms" href="#">${t('terms')}</a>`);
  const input = m.querySelector<HTMLInputElement>('#code')!;
  const go = m.querySelector<HTMLButtonElement>('#go')!;
  const resend = m.querySelector<HTMLButtonElement>('#resend')!;
  const timerEl = m.querySelector<HTMLElement>('#timer')!;
  input.focus();
  void showDemoCode(m, input);

  let left = 0;
  let iv: ReturnType<typeof setInterval> | undefined;
  function startCountdown(): void {
    left = 90;
    resend.disabled = true;
    const tick = (): void => {
      const ss = String(left % 60).padStart(2, '0');
      timerEl.textContent = `(${Math.floor(left / 60)}:${ss})`;
      if (left <= 0) { if (iv) clearInterval(iv); resend.disabled = false; timerEl.textContent = ''; }
      left--;
    };
    tick();
    iv = setInterval(tick, 1000);
  }
  startCountdown();
  m.querySelector('.auth-back')!.addEventListener('click', () => { if (iv) clearInterval(iv); });

  go.addEventListener('click', async () => {
    const code = input.value.trim();
    if (code.length < 4) return;
    go.disabled = true; go.textContent = t('verifying');
    try {
      user = await verifyOtp(phone, code);
      const displayName = maskPhone(normalizePhone(phone));
      if (!user.name || user.name === 'Player') {
        await setDisplayName(displayName);
        user = { ...user, name: displayName };
      }
      if (iv) clearInterval(iv);
      m.remove(); render();
    } catch (e) {
      m.querySelector('#err')!.textContent = t(e instanceof AuthTimeoutError ? 'errTimeout' : 'errVerify');
      go.disabled = false; go.textContent = t('verify');
    }
  });
  resend.addEventListener('click', () => {
    if (resend.disabled) return;
    void requestOtp(phone).then(() => {
      void showDemoCode(m, input);
      startCountdown();
    }).catch((e) => {
      const errEl = m.querySelector('#err')!;
      if (e instanceof PortalNotEntitledError) {
        errEl.textContent = e.hint || t('errNotSubscribed');
      } else {
        errEl.textContent = t(e instanceof AuthTimeoutError ? 'errTimeout' : 'errSend');
      }
    });
  });
}

async function showDemoCode(m: HTMLElement, input: HTMLInputElement): Promise<void> {
  if (!devOtpEcho()) return;
  const code = await fetchDevOtp(phone);
  if (!code) return;
  const banner = m.querySelector<HTMLElement>('#demo');
  if (banner) { banner.hidden = false; banner.innerHTML = `${t('demoCode')} <strong>${esc(code)}</strong>`; }
  if (!input.value) input.value = code;
}

function openProfile(): void {
  const m = shell(`
    <h3>👤 ${esc(user?.phone ?? '')}</h3>
    <label>${t('name')}</label>
    <input class="auth-input" id="name" type="text" maxlength="24" value="${esc(user?.name ?? '')}" placeholder="${t('name')}" />
    <button class="auth-primary" id="save">${t('save')}</button>
    <button class="auth-link danger" id="out">${t('signOut')}</button>`, false);
  const input = m.querySelector<HTMLInputElement>('#name')!;
  input.focus();
  m.querySelector('#save')!.addEventListener('click', async () => {
    const name = input.value.trim();
    if (name) { await setDisplayName(name); if (user) user.name = name; }
    m.remove(); render();
  });
  m.querySelector('#out')!.addEventListener('click', async () => {
    await signOut(); user = null; m.remove(); render();
  });
}

function injectStyles(): void {
  if (document.getElementById('auth-styles')) return;
  const s = document.createElement('style');
  s.id = 'auth-styles';
  s.textContent = `
    .auth-slot { display: inline-flex; }
    .auth-btn { border: 1px solid var(--accent); background: var(--accent); color: #fff;
      font: inherit; font-weight: 700; font-size: 0.9rem; padding: 0.4rem 1rem; border-radius: 999px; cursor: pointer; }
    .auth-btn:hover { filter: brightness(1.05); }

    .auth-modal { position: fixed; inset: 0; z-index: 9990; display: flex; flex-direction: column;
      align-items: center;
      --auth-bg: #ffffff;
      --auth-stars: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170' viewBox='0 0 170 170'%3E%3Cg fill='%234f9e16' fill-opacity='0.09'%3E%3Cg transform='translate(6 16) scale(1.8)'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5S19.33 12 18.5 12z'/%3E%3C/g%3E%3Cg transform='translate(96 96) scale(1.8)'%3E%3Cpath d='M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM11 13H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5S19.33 12 18.5 12z'/%3E%3C/g%3E%3Ccircle cx='132' cy='28' r='2.4'/%3E%3Ccircle cx='28' cy='140' r='2.4'/%3E%3C/g%3E%3C/svg%3E");
      background:
        var(--auth-stars),
        radial-gradient(120% 60% at 50% -10%, rgba(124, 201, 58, 0.16) 0%, transparent 55%),
        var(--auth-bg);
      background-attachment: fixed;
      overflow-y: auto; }

    .auth-topbar { width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.8rem 1rem; background: transparent; flex-shrink: 0; }
    .auth-logo-et { height: 2.2rem; object-fit: contain; background: transparent; }
    .auth-back { width: 2.2rem; height: 2.2rem; border-radius: 999px;
      border: 1px solid #e6efdc; background: rgba(255,255,255,.9); color: #5f7262;
      font-size: 1rem; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; }
    .auth-back:hover { background: #f2f6ee; }

    .auth-hero { width: 100%; flex-shrink: 0; }
    .auth-hero-img { width: 100%; display: block; object-fit: cover; max-height: 200px; }

    .auth-stack { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
      padding: 1.2rem 1rem 2rem; width: 100%; }
    .auth-card { position: relative; width: min(420px, 100%); background: #fff; color: #14271a;
      border-radius: 18px; padding: 28px 24px; box-shadow: 0 12px 40px rgba(8,30,8,.25);
      display: flex; flex-direction: column; gap: 10px; }
    .auth-card h3 { font-size: 1.15rem; margin-bottom: 2px; color: #14271a; font-weight: 800; }
    .auth-card label { font-size: 0.8rem; color: #5f7262; font-weight: 600; }

    .auth-phone-row { display: flex; align-items: center; gap: 0; border: 1px solid #e6efdc; border-radius: 10px; overflow: hidden; }
    .auth-phone-input { border: none !important; border-radius: 0 !important; flex: 1; min-width: 0; }
    .auth-phone-go { padding: 0.7rem 1rem; background: linear-gradient(135deg, #2f8fe6, #1f5fc4); color: #fff; border: none;
      font: inherit; font-size: 0.88rem; font-weight: 700; cursor: pointer; white-space: nowrap;
      border-radius: 0 10px 10px 0; flex-shrink: 0; }
    .auth-phone-go:disabled { opacity: .55; cursor: default; }
    .auth-phone-go:hover:not(:disabled) { filter: brightness(1.05); }

    .auth-otp-row { display: flex; align-items: center; gap: 0; border: 1px solid #e6efdc; border-radius: 10px; overflow: hidden; }
    .auth-otp-input { border: none !important; border-radius: 0 !important; flex: 1; min-width: 0; }
    .auth-otp-get { padding: 0.7rem 0.8rem; background: #4f9e16; color: #fff; border: none;
      font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; white-space: nowrap; border-radius: 0 8px 8px 0; }
    .auth-otp-get:disabled { opacity: .55; cursor: default; }
    .auth-otp-get #timer { color: rgba(255,255,255,.8); font-size: 0.75rem; }

    .auth-input { width: 100%; padding: 0.7rem 0.8rem; border: 1px solid #e6efdc; border-radius: 10px;
      font: inherit; font-size: 1rem; color: #14271a; background: #fff; }
    .auth-input:focus { outline: 2px solid #4f9e16; border-color: #4f9e16; }

    .auth-primary { margin-top: 4px; background: linear-gradient(135deg, #2f8fe6, #1f5fc4); color: #fff;
      border: none; border-radius: 999px; padding: 0.8rem; font: inherit; font-weight: 700; font-size: 1rem;
      cursor: pointer; box-shadow: 0 6px 18px rgba(31,95,196,.3); }
    .auth-primary:disabled { opacity: .6; cursor: default; }
    .auth-primary:hover:not(:disabled) { filter: brightness(1.05); }

    .auth-link { background: none; border: none; color: var(--muted); font: inherit; cursor: pointer; padding: 4px; }
    .auth-link.danger { color: #d64545; }
    .auth-terms { display: block; text-align: center; color: #4f9e16; font-size: 0.82rem; font-weight: 600;
      text-decoration: underline; margin-top: 4px; }

    .auth-hint { font-size: 0.82rem; color: #5f7262; }
    .auth-demo { font-size: 0.86rem; color: #1f6f43; background: #e9f8ef; border: 1px solid #bce8cf;
      border-radius: 8px; padding: 6px 10px; margin: 0; }
    .auth-demo strong { font-size: 1.05rem; letter-spacing: 2px; }
    .auth-err { font-size: 0.82rem; color: #d64545; min-height: 1em; margin: 0; }

    @media (min-width: 600px) {
      .auth-modal { justify-content: flex-start; }
      .auth-topbar { padding-inline: clamp(1.2rem, 4vw, 2.5rem); }
      .auth-hero-img { max-height: min(32vw, 320px); }
      .auth-stack { justify-content: flex-start; flex: 1; }
    }`;
  document.head.appendChild(s);
}

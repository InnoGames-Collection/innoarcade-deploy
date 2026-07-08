// InnoArcade admin console — a lightweight role-gated SPA.
//
// Offline (no Supabase) the console is open for the demo. Online it requires a
// signed-in user whose profile.role === 'admin'; everything it writes goes
// through the admin-action Edge Function, which re-checks the role server-side.
// Views are simple render(host) modules; navigation is a hash router.

import './admin.css';
import { getLang, setLang } from '../i18n';
import {
  authAvailable, currentUser, onAuthChange, requestOtp, verifyOtp, signOut, normalizePhone,
  devOtpEcho, fetchDevOtp,
} from '../platform/auth';
import { isAdmin } from '../platform/admin';
import { t, esc } from './ui';
import * as dashboard from './views/dashboard';
import * as tournaments from './views/tournaments';
import * as draws from './views/draws';
import * as players from './views/players';
import * as payments from './views/payments';
import * as configView from './views/config';
import * as portalView from './views/portal';

const VIEWS = {
  dashboard: { mod: dashboard, icon: '📊', label: 'nav_dashboard' },
  tournaments: { mod: tournaments, icon: '🏆', label: 'nav_tournaments' },
  draws: { mod: draws, icon: '🎟️', label: 'nav_draws' },
  players: { mod: players, icon: '👥', label: 'nav_players' },
  payments: { mod: payments, icon: '💳', label: 'nav_payments' },
  portal: { mod: portalView, icon: '🌐', label: 'nav_portal' },
  config: { mod: configView, icon: '⚙️', label: 'nav_config' },
} as const;
type ViewKey = keyof typeof VIEWS;

const app = document.querySelector<HTMLElement>('#app')!;

function currentView(): ViewKey {
  const h = location.hash.replace(/^#\/?/, '') as ViewKey;
  return h in VIEWS ? h : 'dashboard';
}

function shell(): void {
  const view = currentView();
  app.innerHTML = `
    <aside class="a-side">
      <div class="a-brand"><span class="a-logo">🕹️</span><span>${t('title')}</span></div>
      <nav class="a-nav">
        ${(Object.keys(VIEWS) as ViewKey[]).map((k) => `
          <a class="a-navlink${k === view ? ' active' : ''}" href="#/${k}">
            <span class="a-navicon">${VIEWS[k].icon}</span>${t(VIEWS[k].label as Parameters<typeof t>[0])}
          </a>`).join('')}
      </nav>
    </aside>
    <main class="a-main">
      <header class="a-top">
        <h1>${t(VIEWS[view].label as Parameters<typeof t>[0])}</h1>
        <div class="a-top-right">
          <div class="a-lang">
            <button data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">EN</button>
            <button data-lang="am" class="${getLang() === 'am' ? 'on' : ''}">አማ</button>
          </div>
          <div id="a-auth"></div>
        </div>
      </header>
      <section class="a-content" id="a-content"></section>
    </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => { setLang(b.dataset.lang as 'en' | 'am'); shell(); void mountView(); }));
  renderAuth();
  void mountView();
}

async function mountView(): Promise<void> {
  const host = app.querySelector<HTMLElement>('#a-content');
  if (host) await VIEWS[currentView()].mod.render(host);
}

function renderAuth(): void {
  const slot = app.querySelector<HTMLElement>('#a-auth');
  if (!slot) return;
  if (!authAvailable()) { slot.innerHTML = `<span class="a-demo">demo</span>`; return; }
  void currentUser().then((u) => {
    slot.innerHTML = u
      ? `<button class="a-btn ghost" id="out">${t('signOut')}</button>`
      : '';
    slot.querySelector('#out')?.addEventListener('click', async () => { await signOut(); boot(); });
  });
}

// --- Gate -------------------------------------------------------------------

function renderGate(signedIn: boolean): void {
  app.innerHTML = `
    <div class="a-gate">
      <div class="a-gate-card">
        <div class="a-logo big">🕹️</div>
        <h2>${t('title')}</h2>
        ${signedIn
          ? `<p class="a-gate-msg">${t('notAuthorised')}</p>
             <button class="a-btn ghost" id="out">${t('signOut')}</button>`
          : `<p class="a-gate-msg">${t('signInPrompt')}</p>
             <input class="a-input" id="phone" type="tel" placeholder="+2519…" />
             <p class="a-err" id="err"></p>
             <button class="a-btn primary" id="send">${t('signIn')}</button>`}
      </div>
    </div>`;
  if (signedIn) {
    app.querySelector('#out')!.addEventListener('click', async () => { await signOut(); boot(); });
    return;
  }
  const phone = app.querySelector<HTMLInputElement>('#phone')!;
  const send = app.querySelector<HTMLButtonElement>('#send')!;
  send.addEventListener('click', async () => {
    if (!phone.value.trim()) return;
    send.disabled = true;
    try { await requestOtp(phone.value); promptCode(normalizePhone(phone.value)); }
    catch { app.querySelector('#err')!.textContent = '✕'; send.disabled = false; }
  });
}

function promptCode(phone: string): void {
  const card = app.querySelector('.a-gate-card')!;
  card.innerHTML = `
    <div class="a-logo big">🔑</div>
    <h2>${esc(phone)}</h2>
    <p class="a-demo-code" id="demo" hidden></p>
    <input class="a-input" id="code" inputmode="numeric" maxlength="6" placeholder="123456" />
    <p class="a-err" id="err"></p>
    <button class="a-btn primary" id="verify">${t('signIn')}</button>`;
  const code = card.querySelector<HTMLInputElement>('#code')!;
  card.querySelector('#verify')!.addEventListener('click', async () => {
    try { await verifyOtp(phone, code.value); boot(); }
    catch { card.querySelector('#err')!.textContent = '✕'; }
  });
  // DEMO ONLY: show the OTP the send-sms mock stashed (no SMS gateway needed).
  if (devOtpEcho()) {
    void fetchDevOtp(phone).then((c) => {
      if (!c) return;
      const banner = card.querySelector<HTMLElement>('#demo');
      if (banner) { banner.hidden = false; banner.textContent = `Demo code: ${c}`; }
      if (!code.value) code.value = c;
    });
  }
}

// --- Boot -------------------------------------------------------------------

async function boot(): Promise<void> {
  if (authAvailable()) {
    const u = await currentUser();
    const ok = await isAdmin();
    if (!ok) { renderGate(Boolean(u)); return; }
  }
  shell();
}

window.addEventListener('hashchange', () => {
  if (app.querySelector('.a-side')) shell();
});
if (authAvailable()) onAuthChange(() => { /* re-gate handled via boot on sign in/out */ });
document.documentElement.lang = getLang();
void boot();

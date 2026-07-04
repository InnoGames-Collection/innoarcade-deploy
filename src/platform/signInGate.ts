// Blocking sign-in surface for the hub and direct game URLs. The portal is
// OTP-only when Supabase is configured — guests cannot reach games or economy.
// The entire phone + OTP flow lives in one card — no separate modal.

import '../styles/sign-in-gate.css';
import {
  authAvailable, currentUser, onAuthChange,
  requestOtp, verifyOtp, AuthTimeoutError, normalizePhone, setDisplayName,
  devOtpEcho, fetchDevOtp,
} from './auth';
import { notifySignIn } from '../hub/signin';
import { maskPhone } from './phone';
import { t, getLang, setLang } from '../i18n';
import { sfx } from '../engine/audio';

let mounted = false;

export function mountSignInGate(): void {
  if (!authAvailable() || mounted) return;
  mounted = true;

  const show = (): void => {
    if (document.getElementById('signinGate')) return;
    const g = document.createElement('div');
    g.id = 'signinGate';
    g.className = 'signin-gate';
    g.innerHTML = `
      <div class="sg-topbar">
        <img class="sg-logo-et" src="/brand/ethio-telecom-full.png" alt="Ethio Telecom" />
        <button class="sg-settings" id="sgSettingsBtn" aria-label="Settings">⚙</button>
      </div>
      <div class="sg-hero">
        <img class="sg-hero-img" src="/brand/goplay-banner.png" alt="GoPlay" />
      </div>
      <div class="sg-card">
        <h2>${t('gate.title')}</h2>
        <p>${t('gate.sub')}</p>
        <label class="sg-label">${t('gate.phone')}</label>
        <input class="sg-input" id="sgPhone" type="tel" inputmode="tel"
               placeholder="2519XXXXXXXX / 2518XXXXXXXX" />
        <div class="sg-code-row">
          <input class="sg-code-input" id="sgCode" type="text" inputmode="numeric"
                 maxlength="6" placeholder="6-digit code" disabled />
          <button class="sg-code-btn" id="sgGo">${t('gate.getCode')}</button>
        </div>
        <p class="sg-demo" id="sgDemo" hidden></p>
        <p class="sg-hint hidden" id="sgHint"></p>
        <p class="sg-err" id="sgErr"></p>
        <button class="sg-verify-btn hidden" id="sgVerify">${t('gate.signIn')}</button>
        <a class="sg-terms" href="#">${t('gate.terms')}</a>
      </div>`;
    document.body.appendChild(g);
    wireGateAuth(g);
    g.querySelector('#sgSettingsBtn')!.addEventListener('click', () => openGateSettings(g));
  };

  const hide = (): void => document.getElementById('signinGate')?.remove();

  void currentUser().then((u) => (u ? hide() : show()));
  onAuthChange((u) => (u ? hide() : show()));
}

function wireGateAuth(g: HTMLElement): void {
  const phoneInput = g.querySelector<HTMLInputElement>('#sgPhone')!;
  const codeInput = g.querySelector<HTMLInputElement>('#sgCode')!;
  const goBtn = g.querySelector<HTMLButtonElement>('#sgGo')!;
  const verifyBtn = g.querySelector<HTMLButtonElement>('#sgVerify')!;
  const hintEl = g.querySelector<HTMLElement>('#sgHint')!;
  const errEl = g.querySelector<HTMLElement>('#sgErr')!;

  let phone = '';
  let countdownIv: ReturnType<typeof setInterval> | undefined;

  goBtn.addEventListener('click', async () => {
    phone = phoneInput.value.trim();
    if (!phone) return;
    errEl.textContent = '';
    goBtn.disabled = true; goBtn.textContent = t('gate.sending');
    try {
      await requestOtp(phone);
      codeInput.disabled = false;
      codeInput.focus();
      hintEl.textContent = t('gate.codeSent');
      hintEl.classList.remove('hidden');
      verifyBtn.classList.remove('hidden');
      startResendTimer();
      void showGateDemoCode(g, codeInput, phone);
    } catch (e) {
      errEl.textContent = t(e instanceof AuthTimeoutError ? 'gate.errTimeout' : 'gate.errSend');
      goBtn.disabled = false; goBtn.textContent = t('gate.getCode');
    }
  });

  function startResendTimer(): void {
    if (countdownIv) clearInterval(countdownIv);
    let left = 90;
    goBtn.disabled = true;
    const tick = (): void => {
      const mm = Math.floor(left / 60);
      const ss = String(left % 60).padStart(2, '0');
      goBtn.textContent = `${t('gate.resend')} (${mm}:${ss})`;
      if (left <= 0) {
        if (countdownIv) clearInterval(countdownIv);
        goBtn.disabled = false;
        goBtn.textContent = t('gate.resend');
      }
      left--;
    };
    tick();
    countdownIv = setInterval(tick, 1000);
  }

  verifyBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (code.length < 4) return;
    errEl.textContent = '';
    verifyBtn.disabled = true; verifyBtn.textContent = t('gate.verifying');
    try {
      const user = await verifyOtp(phone, code);
      const displayName = maskPhone(normalizePhone(phone));
      if (!user.name || user.name === 'Player') {
        await setDisplayName(displayName);
      }
      if (countdownIv) clearInterval(countdownIv);
      notifySignIn();
    } catch (e) {
      errEl.textContent = t(e instanceof AuthTimeoutError ? 'gate.errTimeout' : 'gate.errVerify');
      verifyBtn.disabled = false; verifyBtn.textContent = t('gate.signIn');
    }
  });
}

async function showGateDemoCode(g: HTMLElement, input: HTMLInputElement, phone: string): Promise<void> {
  if (!devOtpEcho()) return;
  const code = await fetchDevOtp(phone);
  if (!code) return;
  const demo = g.querySelector<HTMLElement>('#sgDemo');
  if (demo) { demo.hidden = false; demo.innerHTML = `Demo code: <strong>${code}</strong>`; }
  if (!input.value) input.value = code;
}

function openGateSettings(gate: HTMLElement): void {
  if (gate.querySelector('.sg-settings-menu')) {
    gate.querySelector('.sg-settings-menu')!.remove();
    return;
  }
  const lang = getLang();
  const menu = document.createElement('div');
  menu.className = 'sg-settings-menu';
  menu.innerHTML = `
    <div class="sgm-row sgm-static">
      <span class="sgm-label">${t('set.language')}</span>
      <span class="sgm-langbtns">
        <button class="sgm-lang-btn${lang === 'en' ? ' active' : ''}" data-lang="en">EN</button>
        <button class="sgm-lang-btn${lang === 'am' ? ' active' : ''}" data-lang="am">አማ</button>
      </span>
    </div>
    <button class="sgm-row" id="sgmSound">
      <span class="sgm-label">${t('set.sound')}</span>
      <span class="sgm-toggle${sfx.muted ? '' : ' on'}"></span>
    </button>
    <a class="sgm-row" href="#" id="sgmTerms">
      <span class="sgm-label">${t('set.terms')}</span>
      <span class="sgm-chev">›</span>
    </a>
    <a class="sgm-row" href="#" id="sgmFaq">
      <span class="sgm-label">${t('set.faq')}</span>
      <span class="sgm-chev">›</span>
    </a>`;
  gate.appendChild(menu);

  menu.querySelectorAll<HTMLButtonElement>('.sgm-lang-btn').forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang as 'en' | 'am');
      menu.remove();
      document.getElementById('signinGate')?.remove();
      const show = mountSignInGate as () => void;
      mounted = false;
      show();
    }));
  menu.querySelector('#sgmSound')!.addEventListener('click', () => {
    sfx.toggleMute();
    menu.remove();
  });
  menu.querySelector('#sgmTerms')!.addEventListener('click', (e) => e.preventDefault());
  menu.querySelector('#sgmFaq')!.addEventListener('click', (e) => e.preventDefault());

  const closeOnOutside = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node) && !(e.target as Element)?.closest('#sgSettingsBtn')) {
      menu.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
}

if (typeof document !== 'undefined' && document.body?.classList.contains('game-shell')) {
  mountSignInGate();
}

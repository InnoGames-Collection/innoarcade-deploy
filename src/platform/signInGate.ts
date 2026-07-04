// Blocking sign-in surface for the hub and direct game URLs. The portal is
// OTP-only when Supabase is configured — guests cannot reach games or economy.

import '../styles/sign-in-gate.css';
import { authAvailable, currentUser, onAuthChange } from './auth';
import { openSignIn } from '../hub/signin';
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
        <button class="btn primary sg-cta" id="sgBtn">📱 ${t('gate.cta')}</button>
      </div>`;
    document.body.appendChild(g);
    g.querySelector('#sgBtn')!.addEventListener('click', () => openSignIn());
    g.querySelector('#sgSettingsBtn')!.addEventListener('click', () => openGateSettings(g));
  };

  const hide = (): void => document.getElementById('signinGate')?.remove();

  void currentUser().then((u) => (u ? hide() : show()));
  onAuthChange((u) => (u ? hide() : show()));
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

// Blocking sign-in surface for the hub and direct game URLs. The portal is
// OTP-only when Supabase is configured — guests cannot reach games or economy.

import '../styles/sign-in-gate.css';
import { authAvailable, currentUser, onAuthChange } from './auth';
import { openSignIn } from '../hub/signin';
import { t } from '../i18n';

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
      <div class="sg-card">
        <div class="sg-brand"><span class="sg-icon">🎮</span> GoPlay</div>
        <h2>${t('gate.title')}</h2>
        <p>${t('gate.sub')}</p>
        <button class="btn primary" id="sgBtn">📱 ${t('gate.cta')}</button>
      </div>`;
    document.body.appendChild(g);
    g.querySelector('#sgBtn')!.addEventListener('click', () => openSignIn());
  };

  const hide = (): void => document.getElementById('signinGate')?.remove();

  void currentUser().then((u) => (u ? hide() : show()));
  onAuthChange((u) => (u ? hide() : show()));
}

if (typeof document !== 'undefined' && document.body?.classList.contains('game-shell')) {
  mountSignInGate();
}

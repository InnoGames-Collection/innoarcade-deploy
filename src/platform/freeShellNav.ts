// In-shell close navigation for free games — return to menu/pause/hub instead of history.back().

import { t } from '../i18n';

export type FreeShellPhase = 'menu' | 'playing' | 'paused' | 'over';

const HUB_URL = '../../';

export interface FreeShellNavHandlers {
  getPhase: () => FreeShellPhase;
  goMenu: () => void;
  /** Called when closing while playing; return false to cancel. */
  confirmAbandon?: () => boolean;
  /** Leave the game entirely while playing (defaults to goMenu). */
  abandonPlaying?: () => void;
}

export function goHub(): void {
  if (history.length > 1) history.back();
  else location.href = HUB_URL;
}

/** Wire all close buttons inside a free-game stage. */
export function wireFreeShellCloseButtons(
  stage: HTMLElement,
  handlers: FreeShellNavHandlers,
): void {
  const playingClose = stage.querySelector('#closeBtn');
  playingClose?.removeAttribute('onclick');
  const leavePlaying = (): void => {
    (handlers.abandonPlaying ?? handlers.goMenu)();
  };

  playingClose?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const phase = handlers.getPhase();
    if (phase !== 'playing' && phase !== 'paused') return;
    if (handlers.confirmAbandon?.() === false) return;
    leavePlaying();
  });

  stage.querySelectorAll<HTMLElement>('.gp-close, .gp-close-corner').forEach((btn) => {
    if (btn.id === 'closeBtn') return;
    btn.removeAttribute('onclick');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const phase = handlers.getPhase();
      if (phase === 'menu' || phase === 'over') goHub();
      else if (phase === 'paused') leavePlaying();
      else if (phase === 'playing') {
        if (handlers.confirmAbandon?.() === false) return;
        leavePlaying();
      }
    });
  });
}

export function confirmAbandonRun(message?: string): boolean {
  return window.confirm(message ?? t('shell.abandonRun'));
}

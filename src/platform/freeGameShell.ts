// Shared runner-style shell for free games — menu / pause / game-over overlays,
// GameHost begin/finish, and XP feedback. No tournament entry, leaderboard, or
// attempt gating.

import { GameHost, type FinishResult } from './gameHost';
import { getLang, t } from '../i18n';
import { isConfigured } from './supabase';
import { promptIfSessionExpired } from './sessionAuth';

export function gameTitle(host: GameHost): string {
  return getLang() === 'am' ? host.meta.nameAm : host.meta.nameEn;
}

/** Menu block: icon, title, optional best, free + XP tag. */
export function renderFreeMenuHtml(host: GameHost, best = 0): string {
  const title = gameTitle(host);
  const icon = host.meta.icon;
  const bestRow = best > 0
    ? `<div class="shell-free-best">${t('td.yourBest')}: <strong>${best.toLocaleString()}</strong></div>`
    : '';
  return `
    <div class="shell-free-head">
      <span class="shell-free-icon">${icon}</span>
      <span class="shell-free-title">${title}</span>
    </div>
    ${bestRow}
    <div class="shell-free-tag">🆓 ${t('arc.free')} · ⭐ ${t('td.xpGained')}</div>`;
}

export function renderRunRewardHtml(res: FinishResult): string {
  if (res.award != null && res.award > 0) {
    return `<span class="shell-rr-stat xp">+${res.award} ⭐ ${t('td.xpGained')}</span>`;
  }
  if (res.award === 0 && res.points != null) {
    return `<span class="shell-rr-note">${t('arc.xpDailyCap')}</span>`;
  }
  return '';
}

export async function submitFreeRun(
  host: GameHost,
  score: number,
  isWin: boolean,
  durationMs = 0,
): Promise<FinishResult | null> {
  if (!isConfigured()) return null;
  try {
    return await host.finish(score, isWin, durationMs, { ranked: false });
  } catch {
    return null;
  }
}

export async function startFreeRound(host: GameHost, toast?: (msg: string) => void): Promise<boolean> {
  const begin = await host.begin();
  if (!begin.ok) {
    if (begin.reason === 'auth') {
      await promptIfSessionExpired(toast);
    } else {
      toast?.(t('td.needCoins'));
    }
    return false;
  }
  return true;
}

export function wireOverlayVisibility(
  overlays: Record<string, HTMLElement>,
  activeKey: string,
  opts?: { hud?: HTMLElement | null; close?: HTMLElement | null; playing?: boolean },
): void {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== activeKey);
  }
  const playing = opts?.playing ?? false;
  opts?.hud?.classList.toggle('hidden', !playing);
  opts?.close?.classList.toggle('hidden', !playing);
}

export function ensureToast(id = 'shellToast'): (msg: string) => void {
  let timer = 0;
  return (msg: string) => {
    let el = document.getElementById(id) as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'shell-toast hidden';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(timer);
    timer = window.setTimeout(() => el!.classList.add('hidden'), 2800);
  };
}

export function wireMutePause(
  muteBtn: HTMLElement | null | undefined,
  pauseBtn: HTMLElement | null | undefined,
  game: { state: string; pause: () => void; resume: () => void },
  sfxModule: { muted: boolean; toggleMute: () => boolean },
): void {
  if (muteBtn) {
    muteBtn.textContent = sfxModule.muted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      muteBtn.textContent = sfxModule.toggleMute() ? '🔇' : '🔊';
    });
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (game.state === 'playing') game.pause();
      else if (game.state === 'paused') game.resume();
    });
  }
}

export function wirePlayButtons(ids: string[], handler: () => void | Promise<void>): void {
  for (const id of ids) {
    document.getElementById(id)?.addEventListener('click', () => void handler());
  }
}

export interface GameOverEls {
  reward: HTMLElement;
  finalScore: HTMLElement;
  finalBest: HTMLElement;
  newBest: HTMLElement;
}

export async function paintGameOver(
  host: GameHost,
  els: GameOverEls,
  score: number,
  localBest: number,
  isRecord: boolean,
  durationMs = 0,
  formatScore?: (s: number) => string,
): Promise<FinishResult | null> {
  els.finalScore.textContent = formatScore ? formatScore(score) : score.toLocaleString();
  els.finalBest.textContent = '—';
  els.newBest.classList.add('hidden');
  els.reward.innerHTML = '<span class="shell-rr-pending">…</span>';

  const res = await submitFreeRun(host, score, score >= host.winScore, durationMs);
  if (!res) {
    els.finalBest.textContent = localBest.toLocaleString();
    els.newBest.classList.toggle('hidden', !isRecord);
    if (await promptIfSessionExpired()) {
      els.reward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
    } else if (isConfigured()) {
      els.reward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
    } else {
      els.reward.innerHTML = '';
    }
    return null;
  }
  const displayBest = Math.max(localBest, score, res.best ?? 0);
  els.finalBest.textContent = displayBest.toLocaleString();
  els.newBest.classList.toggle('hidden', !isRecord && !res.isRecord);
  els.reward.innerHTML = renderRunRewardHtml(res);
  return res;
}

/** Paint XP feedback into any mount (inline casual games). */
export async function paintInlineReward(
  host: GameHost,
  mount: HTMLElement,
  score: number,
  isWin: boolean,
  durationMs = 0,
): Promise<FinishResult | null> {
  mount.innerHTML = '<span class="shell-rr-pending">…</span>';
  const res = await submitFreeRun(host, score, isWin, durationMs);
  if (!res) {
    if (await promptIfSessionExpired()) {
      mount.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
    } else if (isConfigured()) {
      mount.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
    } else {
      mount.innerHTML = '';
    }
    return null;
  }
  mount.innerHTML = renderRunRewardHtml(res);
  return res;
}

export interface FreeEngineBindings {
  host: GameHost;
  overlays: Record<string, HTMLElement>;
  /** Map game.state → overlay key; return null while playing (hides all overlays). */
  stateOverlay: (state: string) => string | null;
  hud?: HTMLElement | null;
  closeBtn?: HTMLElement | null;
  freeMenu?: HTMLElement | null;
  startBtn: HTMLElement;
  againBtn: HTMLElement;
  restartBtn: HTMLElement;
  resumeBtn: HTMLElement;
  finalScore: HTMLElement;
  finalBest: HTMLElement;
  newBest: HTMLElement;
  runReward: HTMLElement;
  game: {
    start: () => void;
    pause: () => void;
    resume: () => void;
    get state(): string;
    get best(): number;
  };
  formatScore?: (score: number) => string;
  getDurationMs?: () => number;
}

export interface FreeEngineShell {
  toast: (msg: string) => void;
  refreshMenu: () => void;
  play: () => Promise<void>;
  showForState: (state: string) => void;
  handleGameOver: (score: number, isRecord: boolean) => Promise<void>;
}

/** Wire menu/pause/over overlays + free play flow for canvas engine games. */
export function wireFreeEngineMain(b: FreeEngineBindings): FreeEngineShell {
  const toast = ensureToast(`${b.host.meta.id}-toast`);
  let starting = false;
  let serverBest = 0;

  const refreshMenu = (): void => {
    if (b.freeMenu) b.freeMenu.innerHTML = renderFreeMenuHtml(b.host, Math.max(b.game.best, serverBest));
  };

  const showForState = (state: string): void => {
    const key = b.stateOverlay(state);
    if (key == null) {
      for (const el of Object.values(b.overlays)) el.classList.add('hidden');
      b.hud?.classList.remove('hidden');
      b.closeBtn?.classList.remove('hidden');
      return;
    }
    wireOverlayVisibility(b.overlays, key, { hud: b.hud, close: b.closeBtn, playing: false });
  };

  const play = async (): Promise<void> => {
    if (starting || b.game.state === 'playing' || b.game.state === 'paused') return;
    starting = true;
    try {
      if (!(await startFreeRound(b.host, toast))) return;
      b.game.start();
    } finally {
      starting = false;
    }
  };

  wirePlayButtons([b.startBtn.id, b.againBtn.id, b.restartBtn.id], play);
  b.resumeBtn.addEventListener('click', () => b.game.resume());

  const handleGameOver = async (score: number, isRecord: boolean): Promise<void> => {
    const durationMs = b.getDurationMs?.() ?? 0;
    const res = await paintGameOver(
      b.host,
      { reward: b.runReward, finalScore: b.finalScore, finalBest: b.finalBest, newBest: b.newBest },
      score,
      b.game.best,
      isRecord,
      durationMs,
      b.formatScore,
    );
    if (res?.best) serverBest = Math.max(serverBest, res.best);
    refreshMenu();
  };

  return { toast, refreshMenu, play, showForState, handleGameOver };
}

/** Standard overlay key mapper for games with menu / paused / gameOver states. */
export function standardStateOverlay(state: string): string | null {
  if (state === 'playing') return null;
  if (state === 'paused') return 'paused';
  if (state === 'gameOver' || state === 'over') return 'over';
  if (state === 'menu') return 'menu';
  if (state === 'levelClear') return 'levelClear';
  return state;
}

/** Free HUD strip for inline/casual games (replaces cost / win coin hints). */
export function renderFreeHudHtml(host: GameHost): string {
  return `
    <div class="shell-free-hud">
      <span class="shell-free-hud-tag">🆓 ${t('arc.free')}</span>
      <span class="shell-free-hud-title">${host.meta.icon} ${gameTitle(host)}</span>
      <span class="shell-free-hud-xp">⭐ ${t('td.xpGained')}</span>
    </div>`;
}

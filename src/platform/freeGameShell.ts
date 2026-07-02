// Shared runner-style shell for free games — menu / pause / game-over overlays,
// GameHost begin/finish, and XP feedback. No tournament entry, leaderboard, or
// attempt gating.

import { GameHost, type FinishResult } from './gameHost';
import { freeGameBestRemote } from './backend';
import { getLang, t } from '../i18n';
import { isConfigured } from './supabase';
import { promptIfSessionExpired } from './sessionAuth';
import {
  CASUAL_HEADER_SLOTS,
  ensureFreePlayChrome,
  setFreePlayHeaderValues,
  type FreePlayHeaderSlot,
} from './freePlayHeader';
import {
  confirmAbandonRun,
  wireFreeShellCloseButtons,
  type FreeShellPhase,
} from './freeShellNav';

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
    ${bestRow}`;
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

type ShellPhase = 'menu' | 'playing' | 'paused' | 'over';

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
  handleGameOver: (score: number, isRecord: boolean) => void;
}

/** Wire menu/pause/over overlays + free play flow for canvas engine games. */
export function wireFreeEngineMain(b: FreeEngineBindings): FreeEngineShell {
  const toast = ensureToast(`${b.host.meta.id}-toast`);
  let phase: ShellPhase = 'menu';
  let starting = false;
  let serverBest = 0;

  const overOverlay = b.overlays.over ?? b.overlays.gameOver;
  if (!overOverlay) throw new Error('wireFreeEngineMain: overlays.over required');

  const shellOverlays: Record<string, HTMLElement> = {};
  for (const [key, el] of Object.entries(b.overlays)) {
    if (key !== 'over' && key !== 'gameOver') shellOverlays[key] = el;
  }

  const stage = document.getElementById('stage') as HTMLElement | null;

  const refreshMenu = (): void => {
    if (b.freeMenu) {
      b.freeMenu.innerHTML = renderFreeMenuHtml(b.host, Math.max(b.game.best, serverBest));
    }
  };

  const hideOverOverlay = (): void => {
    overOverlay.classList.add('hidden');
    overOverlay.setAttribute('aria-hidden', 'true');
  };

  const goMenu = (): void => {
    if (b.game.state === 'playing' || b.game.state === 'paused') {
      b.game.pause();
    }
    setPhase('menu');
  };

  const showOverOverlay = (score: number, isRecord: boolean): void => {
    b.finalScore.textContent = b.formatScore ? b.formatScore(score) : score.toLocaleString();
    b.finalBest.textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
    b.newBest.classList.toggle('hidden', !isRecord);
    b.runReward.innerHTML = '<span class="shell-rr-pending">…</span>';
    b.closeBtn?.classList.add('hidden');
    overOverlay.classList.remove('hidden');
    overOverlay.setAttribute('aria-hidden', 'false');
  };

  const setPhase = (next: ShellPhase): void => {
    phase = next;
    if (next === 'menu') {
      wireOverlayVisibility(shellOverlays, 'menu', { hud: b.hud, close: b.closeBtn, playing: false });
      hideOverOverlay();
      return;
    }
    if (next === 'paused') {
      wireOverlayVisibility(shellOverlays, 'paused', { hud: b.hud, close: b.closeBtn, playing: false });
      hideOverOverlay();
      return;
    }
    if (next === 'over') {
      for (const el of Object.values(shellOverlays)) el.classList.add('hidden');
      b.hud?.classList.remove('hidden');
      b.closeBtn?.classList.add('hidden');
      return;
    }
    // playing
    for (const el of Object.values(shellOverlays)) el.classList.add('hidden');
    hideOverOverlay();
    b.hud?.classList.remove('hidden');
    b.closeBtn?.classList.remove('hidden');
  };

  const showForState = (state: string): void => {
    if (state === 'gameOver' || state === 'over') return;
    const key = b.stateOverlay(state);
    if (key == null) {
      setPhase('playing');
      return;
    }
    if (key === 'over') return;
    if (key === 'menu') setPhase('menu');
    else if (key === 'paused') setPhase('paused');
    else {
      wireOverlayVisibility(shellOverlays, key, { hud: b.hud, close: b.closeBtn, playing: true });
      phase = 'playing';
      hideOverOverlay();
    }
  };

  const submitRunBackground = async (
    score: number,
    isRecord: boolean,
    durationMs: number,
  ): Promise<void> => {
    const res = await submitFreeRun(b.host, score, score >= b.host.winScore, durationMs);
    if (!res) {
      b.finalBest.textContent = Math.max(b.game.best, serverBest).toLocaleString();
      b.newBest.classList.toggle('hidden', !isRecord);
      if (await promptIfSessionExpired(toast)) {
        b.runReward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
      } else if (isConfigured()) {
        b.runReward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
      } else {
        b.runReward.innerHTML = '';
      }
      return;
    }
    if (typeof res.best === 'number') serverBest = Math.max(serverBest, res.best);
    b.finalBest.textContent = serverBest.toLocaleString();
    b.newBest.classList.toggle('hidden', !isRecord && !res.isRecord);
    b.runReward.innerHTML = renderRunRewardHtml(res);
    refreshMenu();
  };

  const beginFreeRound = async (): Promise<void> => {
    if (starting) return;
    starting = true;
    try {
      if (!(await startFreeRound(b.host, toast))) return;
      hideOverOverlay();
      b.game.start();
    } finally {
      starting = false;
    }
  };

  const onPlayOrEnter = async (): Promise<void> => {
    if (starting || phase === 'playing' || phase === 'paused') return;
    await beginFreeRound();
  };

  const restartFromPause = async (): Promise<void> => {
    if (phase !== 'paused') return;
    hideOverOverlay();
    await beginFreeRound();
  };

  wirePlayButtons([b.startBtn.id, b.againBtn.id], onPlayOrEnter);
  b.restartBtn.addEventListener('click', () => void restartFromPause());
  b.resumeBtn.addEventListener('click', () => b.game.resume());

  const handleGameOver = (score: number, isRecord: boolean): void => {
    const durationMs = b.getDurationMs?.() ?? 0;
    if (isRecord) serverBest = Math.max(serverBest, score);
    setPhase('over');
    showOverOverlay(score, isRecord);
    void submitRunBackground(score, isRecord, durationMs);
  };

  void freeGameBestRemote(b.host.meta.id).then((best) => {
    serverBest = best;
    refreshMenu();
  });

  if (stage) {
    wireFreeShellCloseButtons(stage, {
      getPhase: () => phase,
      goMenu,
      confirmAbandon: () => {
        if (phase !== 'playing') return true;
        return confirmAbandonRun();
      },
    });
  }

  return { toast, refreshMenu, play: onPlayOrEnter, showForState, handleGameOver };
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

export interface FreeCasualShellOptions {
  /** Stats header slots; defaults to time + score. Set `[]` to skip injection. */
  headerSlots?: FreePlayHeaderSlot[];
  /** Show pause button and pause overlay (requires onPause/onResume). */
  pauseable?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  /** Reset game state when abandoning from playing/pause. */
  onAbandon?: () => void;
  /** Skip abandon confirm when closing mid-run. */
  skipAbandonConfirm?: boolean;
}

export interface FreeCasualShell {
  toast: (msg: string) => void;
  refreshMenu: () => void;
  getPhase: () => FreeShellPhase;
  /** Begin a round (auth + menu). Calls onStart when entry succeeds. */
  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  goMenu: () => void;
  setHeader: (values: Record<string, string>) => void;
  /** Show game-over overlay and submit score in the background. */
  finishPlay: (score: number, isWin: boolean, summary?: string, durationMs?: number) => void;
}

function ensurePauseOverlay(stage: HTMLElement): {
  overlay: HTMLElement;
  resumeBtn: HTMLElement;
  restartBtn: HTMLElement;
} {
  let overlay = stage.querySelector('#pauseOverlay') as HTMLElement | null;
  if (overlay) {
    return {
      overlay,
      resumeBtn: overlay.querySelector('#resumeBtn') as HTMLElement,
      restartBtn: overlay.querySelector('#restartBtn') as HTMLElement,
    };
  }
  overlay = document.createElement('div');
  overlay.id = 'pauseOverlay';
  overlay.className = 'game-overlay hidden';
  overlay.innerHTML = `
    <div class="game-panel">
      <button type="button" class="gp-close gp-close-corner" aria-label="Close">✕</button>
      <h2 data-i18n="td.paused">Paused</h2>
      <button id="resumeBtn" class="btn primary" data-i18n="td.resume">Resume</button>
      <button id="restartBtn" class="btn" data-i18n="td.restart">Play again</button>
    </div>`;
  const menu = stage.querySelector('#menuOverlay');
  if (menu?.parentNode) menu.parentNode.insertBefore(overlay, menu.nextSibling);
  else stage.appendChild(overlay);
  return {
    overlay,
    resumeBtn: overlay.querySelector('#resumeBtn') as HTMLElement,
    restartBtn: overlay.querySelector('#restartBtn') as HTMLElement,
  };
}

/** Hub shell for timed / chance casual games (Tap, Dice, etc.). */
export function wireFreeCasualShell(
  host: GameHost,
  onStart: () => void | Promise<void>,
  options: FreeCasualShellOptions = {},
): FreeCasualShell {
  const toast = ensureToast(`${host.meta.id}-toast`);
  let serverBest = 0;
  let starting = false;
  let phase: FreeShellPhase = 'menu';

  const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;
  const stage = document.getElementById('stage');
  const playFrame = $('fcPlayFrame');
  if (!stage || !playFrame) {
    console.error('[freeGameShell] missing #stage or #fcPlayFrame');
  }
  const headerSlots = options.headerSlots ?? CASUAL_HEADER_SLOTS;
  if (playFrame && headerSlots.length) {
    ensureFreePlayChrome(playFrame, headerSlots, { pauseable: options.pauseable });
  }
  const pauseUi = options.pauseable && stage ? ensurePauseOverlay(stage) : null;

  const refreshMenu = (): void => {
    const menu = $('freeMenu');
    if (menu) menu.innerHTML = renderFreeMenuHtml(host, serverBest);
  };

  const hideOverOverlay = (): void => {
    const overlay = $('overOverlay');
    overlay?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden', 'true');
  };

  const showMenu = (): void => {
    $('menuOverlay')?.classList.remove('hidden');
    playFrame?.classList.add('hidden');
    $('fcBackdrop')?.classList.remove('hidden');
    pauseUi?.overlay.classList.add('hidden');
    hideOverOverlay();
  };

  const showGame = (): void => {
    $('menuOverlay')?.classList.add('hidden');
    playFrame?.classList.remove('hidden');
    $('fcBackdrop')?.classList.add('hidden');
    pauseUi?.overlay.classList.add('hidden');
  };

  const setPhase = (next: FreeShellPhase): void => {
    phase = next;
    if (next === 'menu') showMenu();
    else if (next === 'paused') {
      playFrame?.classList.add('hidden');
      pauseUi?.overlay.classList.remove('hidden');
    } else showGame();
    $('closeBtn')?.classList.toggle('hidden', next === 'menu' || next === 'over');
  };

  const goMenu = (): void => {
    options.onAbandon?.();
    setPhase('menu');
  };

  const finishPlay = (
    score: number,
    isWin: boolean,
    summary = '',
    durationMs = 0,
  ): void => {
    const isRecord = score > serverBest;
    if (isRecord) serverBest = score;
    refreshMenu();
    const summaryEl = document.getElementById('fcOverSummary');
    if (summaryEl) {
      summaryEl.textContent = summary;
      summaryEl.classList.toggle('hidden', !summary);
    }
    const finalScore = $('finalScore');
    if (finalScore) finalScore.textContent = score.toLocaleString();
    const finalBest = $('finalBest');
    const newBest = $('newBest');
    const runReward = $('runReward');
    const overOverlay = $('overOverlay');
    if (finalBest) finalBest.textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
    newBest?.classList.toggle('hidden', !isRecord);
    if (runReward) runReward.innerHTML = '<span class="shell-rr-pending">…</span>';
    $('closeBtn')?.classList.add('hidden');
    overOverlay?.classList.remove('hidden');
    overOverlay?.setAttribute('aria-hidden', 'false');
    phase = 'over';

    void (async () => {
      const res = await submitFreeRun(host, score, isWin, durationMs);
      if (!res) {
        if (finalBest) finalBest.textContent = serverBest.toLocaleString();
        newBest?.classList.toggle('hidden', !isRecord);
        if (await promptIfSessionExpired(toast)) {
          if (runReward) runReward.innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
        } else if (isConfigured()) {
          if (runReward) runReward.innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
        } else if (runReward) {
          runReward.innerHTML = '';
        }
        return;
      }
      if (typeof res.best === 'number') serverBest = Math.max(serverBest, res.best);
      if (finalBest) finalBest.textContent = serverBest.toLocaleString();
      newBest?.classList.toggle('hidden', !isRecord && !res.isRecord);
      if (runReward) runReward.innerHTML = renderRunRewardHtml(res);
      refreshMenu();
    })();
  };

  const play = async (): Promise<void> => {
    if (starting || phase === 'playing') return;
    starting = true;
    try {
      if (!(await startFreeRound(host, toast))) return;
      hideOverOverlay();
      setPhase('playing');
      await onStart();
    } finally {
      starting = false;
    }
  };

  const pause = (): void => {
    if (!options.pauseable || phase !== 'playing') return;
    options.onPause?.();
    setPhase('paused');
  };

  const resume = (): void => {
    if (phase !== 'paused') return;
    setPhase('playing');
    options.onResume?.();
  };

  const restartFromPause = async (): Promise<void> => {
    if (phase !== 'paused') return;
    hideOverOverlay();
    options.onAbandon?.();
    await play();
  };

  wirePlayButtons(['startBtn', 'againBtn'], play);

  if (options.pauseable && playFrame) {
    playFrame.querySelector('#fpPauseBtn')?.addEventListener('click', () => pause());
    pauseUi?.resumeBtn.addEventListener('click', () => resume());
    pauseUi?.restartBtn.addEventListener('click', () => void restartFromPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && phase === 'playing') pause();
    });
  }

  if (stage) {
    wireFreeShellCloseButtons(stage, {
      getPhase: () => phase,
      goMenu,
      confirmAbandon: () => {
        if (options.skipAbandonConfirm || phase !== 'playing') return true;
        return confirmAbandonRun();
      },
    });
  }

  refreshMenu();
  setPhase('menu');

  void freeGameBestRemote(host.meta.id).then((best) => {
    serverBest = best;
    refreshMenu();
  });

  return {
    toast,
    refreshMenu,
    getPhase: () => phase,
    play,
    pause,
    resume,
    goMenu,
    setHeader: (values) => {
      if (playFrame) setFreePlayHeaderValues(values, playFrame);
    },
    finishPlay,
  };
}

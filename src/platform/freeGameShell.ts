// Shared runner-style shell for free games — menu / pause / game-over overlays,
// GameHost begin/finish, and XP feedback. No tournament entry, leaderboard, or
// attempt gating.

import { GameHost, type FinishResult } from './gameHost';
import { freeGameBestRemote } from './backend';
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

  const refreshMenu = (): void => {
    if (b.freeMenu) {
      b.freeMenu.innerHTML = renderFreeMenuHtml(b.host, Math.max(b.game.best, serverBest));
    }
  };

  const hideOverOverlay = (): void => {
    overOverlay.classList.add('hidden');
    overOverlay.setAttribute('aria-hidden', 'true');
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

export interface FreeCasualShell {
  toast: (msg: string) => void;
  refreshMenu: () => void;
  /** Begin a round (auth + menu). Calls onStart when entry succeeds. */
  play: () => Promise<void>;
  /** Show game-over overlay and submit score in the background. */
  finishPlay: (score: number, isWin: boolean, summary?: string, durationMs?: number) => void;
}

/** Hub shell for timed / chance casual games (Tap, Dice, etc.). */
export function wireFreeCasualShell(
  host: GameHost,
  onStart: () => void | Promise<void>,
): FreeCasualShell {
  const toast = ensureToast(`${host.meta.id}-toast`);
  let serverBest = 0;
  let starting = false;
  let phase: 'menu' | 'playing' | 'over' = 'menu';

  const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

  const refreshMenu = (): void => {
    $('freeMenu').innerHTML = renderFreeMenuHtml(host, serverBest);
  };

  const hideOverOverlay = (): void => {
    const overlay = $('overOverlay');
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  };

  const showMenu = (): void => {
    $('menuOverlay').classList.remove('hidden');
    $('fcPlayFrame').classList.add('hidden');
    $('fcBackdrop').classList.remove('hidden');
    hideOverOverlay();
  };

  const showGame = (): void => {
    $('menuOverlay').classList.add('hidden');
    $('fcPlayFrame').classList.remove('hidden');
    $('fcBackdrop').classList.add('hidden');
  };

  const setPhase = (next: typeof phase): void => {
    phase = next;
    if (next === 'menu') showMenu();
    else showGame();
    $('closeBtn').classList.toggle('hidden', next === 'menu' || next === 'over');
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
    if (summaryEl) summaryEl.textContent = summary;
    $('finalScore').textContent = score.toLocaleString();
    $('finalBest').textContent = serverBest > 0 ? serverBest.toLocaleString() : '—';
    $('newBest').classList.toggle('hidden', !isRecord);
    $('runReward').innerHTML = '<span class="shell-rr-pending">…</span>';
    $('closeBtn').classList.add('hidden');
    $('overOverlay').classList.remove('hidden');
    $('overOverlay').setAttribute('aria-hidden', 'false');
    phase = 'over';

    void (async () => {
      const res = await submitFreeRun(host, score, isWin, durationMs);
      if (!res) {
        $('finalBest').textContent = serverBest.toLocaleString();
        $('newBest').classList.toggle('hidden', !isRecord);
        if (await promptIfSessionExpired(toast)) {
          $('runReward').innerHTML = `<span class="shell-rr-note">${t('td.sessionExpired')}</span>`;
        } else if (isConfigured()) {
          $('runReward').innerHTML = `<span class="shell-rr-note">${t('td.submitFailed')}</span>`;
        } else {
          $('runReward').innerHTML = '';
        }
        return;
      }
      if (typeof res.best === 'number') serverBest = Math.max(serverBest, res.best);
      $('finalBest').textContent = serverBest.toLocaleString();
      $('newBest').classList.toggle('hidden', !isRecord && !res.isRecord);
      $('runReward').innerHTML = renderRunRewardHtml(res);
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

  wirePlayButtons(['startBtn', 'againBtn'], play);

  void freeGameBestRemote(host.meta.id).then((best) => {
    serverBest = best;
    refreshMenu();
  });

  setPhase('menu');

  return { toast, refreshMenu, play, finishPlay };
}

// Shared runtime for the native LexiQuest brain & word games. Ported from the
// retired vendored app's core.js — the DOM helpers, on-screen keypad, modal/
// toast, and seeded RNG the games are built on — minus all the standalone-app
// shell (routing, localStorage XP/stats, theme). Scoring now flows through the
// GoPlay GameHost (server-only points), not a local store.

import '../../styles/game-shell.css';
import '../_casual/style.css';
import { applyGameThemeFromPage } from '../../platform/gameTheme';
import { sfx } from '../../engine/audio';
import { renderRunRewardHtml, wireFreeCasualShell } from '../../platform/freeGameShell';
import type { FreePlayHeaderSlot } from '../../platform/freePlayHeader';
import { applyTranslations, getLang } from '../../i18n';
import { createHost, type FinishResult, type GameHost } from '../../platform/gameHost';
import { emitGameEvent } from '../../platform/gameEvents';
import { promptIfSessionExpired } from '../../platform/sessionAuth';
import { isConfigured } from '../../platform/supabase';

export { dayNumber, mulberry32, randInt, shuffled } from './rng';

type Attrs = Record<string, string | EventListenerOrEventListenerObject>;
type Child = Node | string | null | undefined | Child[];

applyGameThemeFromPage();

export function el(tag: string, attrs?: Attrs | null, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v as string;
      else if (k === 'text') node.textContent = v as string;
      else if (k === 'html') node.innerHTML = v as string;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v as EventListener);
      else node.setAttribute(k, v as string);
    }
  }
  const append = (c: Child): void => {
    if (c == null) return;
    if (Array.isArray(c)) { c.forEach(append); return; }
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  };
  children.forEach(append);
  return node;
}

// --- tiny WebAudio synth (respects the engine mute) -------------------------
let audioCtx: AudioContext | null = null;
type SoundName = 'click' | 'good' | 'bad' | 'win';
export function sound(name: SoundName): void {
  if (sfx.muted) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new Ctor();
    const ctx = audioCtx;
    const notes: Record<SoundName, Array<[number, number, number]>> = {
      click: [[700, 0, 0.04]],
      good: [[660, 0, 0.08], [880, 0.08, 0.1]],
      bad: [[240, 0, 0.16]],
      win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.18]],
    };
    for (const [freq, at, dur] of notes[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'bad' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + dur + 0.02);
    }
  } catch { /* audio unavailable */ }
}

// --- toast ------------------------------------------------------------------
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string, ms = 1800): void {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t!.classList.remove('show'), ms);
}

// --- modal ------------------------------------------------------------------
export interface ModalAction { label: string; primary?: boolean; onClick?: () => void; }
export function modal(opts: { title: string; body: string | Node; actions?: ModalAction[] }): { close: () => void } {
  const back = el('div', { class: 'modal-back' });
  const close = (): void => back.remove();
  const actionBtns = (opts.actions || [{ label: 'OK', primary: true }]).map((a) =>
    el('button', { class: 'btn' + (a.primary ? ' primary' : ''), text: a.label, onclick: () => { close(); a.onClick?.(); } }));
  const m = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
    el('h3', { text: opts.title }),
    el('div', { class: 'body' }),
    el('div', { class: 'actions' }, actionBtns));
  const bodyEl = m.querySelector('.body')!;
  if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body; else bodyEl.appendChild(opts.body);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.appendChild(m);
  document.body.appendChild(back);
  (m.querySelector('button') as HTMLButtonElement | null)?.focus();
  return { close };
}

export function statsRow(pairs: Array<[number | string, string]>): HTMLElement {
  return el('div', { class: 'stats-row' },
    pairs.map(([num, lbl]) => el('div', { class: 'stat' },
      el('div', { class: 'num', text: String(num) }), el('div', { class: 'lbl', text: lbl }))));
}

// --- numeric keypad (digits + custom extras) --------------------------------
export function keypad(onKey: (k: string) => void, extras?: string[]): HTMLElement {
  const rows = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']];
  const last = ['0'].concat(extras || []);
  return el('div', { class: 'kbd keypad', role: 'group', 'aria-label': 'Number pad' },
    rows.concat([last]).map((row) =>
      el('div', { class: 'kbd-row' },
        row.map((k) => el('button', { class: 'key num', text: k, onclick: () => onKey(k) })))),
    el('div', { class: 'kbd-row' },
      el('button', { class: 'key wide', text: '⌫', 'aria-label': 'Backspace', onclick: () => onKey('Backspace') }),
      el('button', { class: 'key wide go', text: 'enter', 'aria-label': 'Enter', onclick: () => onKey('Enter') })));
}

// --- hidden input that summons the phone keyboard ---------------------------
export function typeCatcher(onKey: (k: string) => void, tapTarget: HTMLElement): HTMLInputElement {
  const inp = el('input', {
    type: 'text', class: 'type-catcher', autocapitalize: 'none', autocomplete: 'off',
    autocorrect: 'off', spellcheck: 'false', 'aria-hidden': 'true', tabindex: '-1', enterkeyhint: 'send',
  }) as HTMLInputElement;
  inp.addEventListener('input', () => {
    const v = inp.value; inp.value = '';
    for (const ch of v) if (/^[a-z0-9]$/i.test(ch)) onKey(ch.toLowerCase());
  });
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); onKey(e.key); }
  });
  tapTarget.addEventListener('click', () => {
    if (matchMedia('(pointer: coarse)').matches) inp.focus({ preventScroll: true });
  });
  tapTarget.appendChild(inp);
  return inp;
}

// --- scoring: GoPlay GameHost (server-only points) --------------------------
let activeHost: GameHost | null = null;

// Submit a finished free run: begin() opens the round token, finish() awards XP
// with ranked:false (no leaderboard / attempt gating for these brain games).
export async function recordResultAsync(
  gameId: string,
  res: { won: boolean; score: number },
  durationMs = 0,
): Promise<FinishResult | null> {
  const host = activeHost && activeHost.meta.id === gameId ? activeHost : createHost(gameId);
  activeHost = host;
  try {
    await host.begin();
    const out = await host.finish(Math.max(0, res.score || 0), res.won, durationMs, { ranked: false });
    if (isConfigured() && typeof out.points !== 'number') {
      await promptIfSessionExpired();
      return null;
    }
    return out;
  } catch {
    await promptIfSessionExpired();
    return null;
  }
}

/** XP strip HTML for win modals and inline result panels. */
export function formatResultBody(res: FinishResult | null): string {
  return res ? renderRunRewardHtml(res) : '';
}

/** Paint the stage-bottom #runReward mount (legacy inline panels). */
export function showRunReward(res: FinishResult | null): void {
  const mount = document.getElementById('runReward');
  if (!mount) return;
  const html = formatResultBody(res);
  mount.innerHTML = html;
  mount.classList.toggle('hidden', !html);
}

type LQFinishFn = (score: number, isWin: boolean, summary?: string, durationMs?: number) => void;
let lqFinish: LQFinishFn | null = null;
let lqSetHeader: ((values: Record<string, string>) => void) | null = null;

/** Update the free-shell stats header from a brain-game session. */
export function setLQHeader(values: Record<string, string>): void {
  lqSetHeader?.(values);
}

/** Report a completed brain-game run to the hub game-over overlay. */
export function finishLQRound(
  score: number,
  isWin: boolean,
  _summary = '',
  durationMs = 0,
): void {
  if (activeHost) {
    emitGameEvent({
      type: 'gameOver',
      gameId: activeHost.meta.id,
      score,
      isWin,
    });
  }
  lqFinish?.(score, isWin, _summary, durationMs);
}

/** Brain-game level cleared (analytics hook). */
export function emitLQLevelComplete(level: number, score?: number): void {
  if (!activeHost) return;
  emitGameEvent({
    type: 'levelComplete',
    gameId: activeHost.meta.id,
    level,
    score,
  });
}

export interface MountLQOptions {
  headerSlots?: FreePlayHeaderSlot[];
  /** Show pause button and pause overlay during play. */
  pauseable?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onAbandon?: () => void;
}

/** Boot a native LexiQuest brain game inside the free hub shell. */
export function mountLQ(
  gameId: string,
  render: (mount: HTMLElement) => void,
  opts?: MountLQOptions,
): void {
  activeHost = createHost(gameId);
  const shell = wireFreeCasualShell(activeHost, () => {
    const mount = document.getElementById('lq-mount');
    if (!mount) return;
    mount.innerHTML = '';
    render(mount);
  }, {
    headerSlots: opts?.headerSlots ?? [
      { id: 'round', labelKey: 'eq.question', icon: 'question' },
      { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    ],
    pauseable: opts?.pauseable,
    onPause: opts?.onPause,
    onResume: opts?.onResume,
    onAbandon: opts?.onAbandon,
  });
  lqFinish = (score, isWin, summary, durationMs) => {
    shell.finishPlay(score, isWin, summary ?? '', durationMs);
  };
  lqSetHeader = shell.setHeader;
  const mount = document.getElementById('lq-mount');
  if (mount) mount.classList.add('fc-game-body');
  document.documentElement.lang = getLang();
  applyTranslations();
  shell.refreshMenu();
}

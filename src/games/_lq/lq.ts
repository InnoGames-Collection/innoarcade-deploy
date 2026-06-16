// Shared runtime for the native LexiQuest brain & word games. Ported from the
// retired vendored app's core.js — the DOM helpers, on-screen keypad, modal/
// toast, and seeded RNG the games are built on — minus all the standalone-app
// shell (routing, localStorage XP/stats, theme). Scoring now flows through the
// GoPlay GameHost (server-only points), not a local store.

import { sfx } from '../../engine/audio';
import { createHost, type GameHost } from '../../platform/gameHost';

// --- DOM helper -------------------------------------------------------------
type Attrs = Record<string, string | EventListenerOrEventListenerObject>;
type Child = Node | string | null | undefined | Child[];

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

// --- seeded RNG + helpers ---------------------------------------------------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function dayNumber(): number { return Math.floor(Date.now() / 86400000); }
export function shuffled<T>(arr: T[], rnd?: () => number): T[] {
  const a = arr.slice();
  const r = rnd || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function randInt(lo: number, hi: number, rnd?: () => number): number {
  return lo + Math.floor((rnd || Math.random)() * (hi - lo + 1));
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

// Submit a finished run through the shared GameHost — identical to every other
// game. The server awards the uniform flat points on a win (res.won); no
// game-specific point formula, no leaderboard (these are free games), no store.
export function recordResult(gameId: string, res: { won: boolean; score: number }): void {
  const host = activeHost && activeHost.meta.id === gameId ? activeHost : createHost(gameId);
  void host.startRound().then(() => host.finish(Math.max(0, res.score || 0), res.won)).catch(() => {});
}

// Boot a native LexiQuest game: create its host, wire the EN/AM chrome buttons,
// and hand the mount node to the game's render function.
export function mountLQ(gameId: string, render: (mount: HTMLElement) => void): void {
  activeHost = createHost(gameId);
  // The chrome lang buttons (optional) just toggle the document lang; the puzzle
  // content is English (these are English word/number/logic games).
  void import('../../i18n').then(({ getLang, setLang, applyTranslations }) => {
    const en = document.getElementById('langEn');
    const am = document.getElementById('langAm');
    const sync = (): void => {
      en?.classList.toggle('active', getLang() === 'en');
      am?.classList.toggle('active', getLang() === 'am');
    };
    en?.addEventListener('click', () => { setLang('en'); applyTranslations(); sync(); });
    am?.addEventListener('click', () => { setLang('am'); applyTranslations(); sync(); });
    document.documentElement.lang = getLang();
    applyTranslations();
    sync();
  });
  const mount = document.getElementById('lq-mount');
  if (mount) render(mount);
}

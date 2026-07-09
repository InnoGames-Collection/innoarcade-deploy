/** Animated tube transfer — liquid stream or flying spheres. */

import './liquidPour.css';
import { sfx } from '../../engine/audio';
import { gemClassesByIndex, type GemVariant } from './premiumGems';

export interface PourTheme {
  variant: GemVariant;
  stackSelector: string;
  pieceSelector: string;
  liftingClass: string;
  landingClass: string;
}

export const LIQUID_POUR_THEME: PourTheme = {
  variant: 'liquid',
  stackSelector: '.ws-liquid-stack',
  pieceSelector: '.ws-seg',
  liftingClass: 'ws-seg--lifting',
  landingClass: 'ws-seg--landing',
};

export const SPHERE_POUR_THEME: PourTheme = {
  variant: 'sphere',
  stackSelector: '.bs-ball-stack',
  pieceSelector: '.bs-ball',
  liftingClass: 'bs-ball--lifting',
  landingClass: 'bs-ball--landing',
};

export interface PourAnimOptions {
  board: HTMLElement;
  row: HTMLElement;
  fromIdx: number;
  toIdx: number;
  colorId: number;
  amount: number;
  theme?: PourTheme;
  onTick?: () => void;
}

const POUR_MS = 340;
const SETTLE_MS = 120;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tubeCenter(row: HTMLElement, idx: number): { x: number; y: number } {
  const tube = row.children[idx] as HTMLElement | undefined;
  if (!tube) return { x: 0, y: 0 };
  const rowRect = row.getBoundingClientRect();
  const rect = tube.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - rowRect.left,
    y: rect.top + rect.height / 2 - rowRect.top,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function playPourSound(kind: 'start' | 'land' | 'complete'): void {
  if (sfx.muted) return;
  try {
    const Ctor = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const notes: Record<typeof kind, Array<[number, number, number, OscillatorType]>> = {
      start: [[420, 0, 0.06, 'sine'], [520, 0.04, 0.08, 'sine']],
      land: [[280, 0, 0.05, 'sine'], [360, 0.05, 0.1, 'triangle']],
      complete: [[660, 0, 0.08, 'sine'], [880, 0.08, 0.12, 'sine'], [1100, 0.16, 0.14, 'sine']],
    };
    for (const [freq, at, dur, type] of notes[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.1, now + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    }
    window.setTimeout(() => void ctx.close(), 600);
  } catch { /* audio unavailable */ }
}

export async function animatePour(opts: PourAnimOptions): Promise<void> {
  const theme = opts.theme ?? LIQUID_POUR_THEME;
  const { board, row, fromIdx, toIdx, colorId, amount, onTick } = opts;
  if (amount <= 0 || prefersReducedMotion()) {
    onTick?.();
    return;
  }

  const fromTube = row.children[fromIdx] as HTMLElement | undefined;
  const toTube = row.children[toIdx] as HTMLElement | undefined;
  if (!fromTube || !toTube) {
    onTick?.();
    return;
  }

  const fromStack = fromTube.querySelector(theme.stackSelector) as HTMLElement | null;
  const pieces = fromStack
    ? Array.from(fromStack.querySelectorAll(theme.pieceSelector)).slice(-amount)
    : [];
  pieces.forEach((seg) => seg.classList.add(theme.liftingClass));

  const from = tubeCenter(row, fromIdx);
  const to = tubeCenter(row, toIdx);
  const targetX = to.x;
  const targetY = to.y - (theme.variant === 'sphere' ? 28 : 20);

  if (theme.variant === 'sphere') {
    const flyer = document.createElement('div');
    flyer.className = 'lpour-flyer';
    for (let i = 0; i < amount; i++) {
      const ball = document.createElement('div');
      ball.className = `lpour-fly-ball ${gemClassesByIndex(colorId - 1, 'sphere')}`;
      ball.style.setProperty('--fly-i', String(i));
      flyer.appendChild(ball);
    }
    flyer.style.left = `${from.x}px`;
    flyer.style.top = `${from.y - 24}px`;
    flyer.style.setProperty('--fly-tx', `${targetX - from.x}px`);
    flyer.style.setProperty('--fly-ty', `${targetY - from.y}px`);
    board.appendChild(flyer);
    playPourSound('start');
    requestAnimationFrame(() => flyer.classList.add('lpour-flyer--active'));
    await wait(POUR_MS);
    flyer.classList.add('lpour-flyer--fade');
    pieces.forEach((seg) => {
      seg.classList.remove(theme.liftingClass);
      seg.classList.add(theme.landingClass);
    });
    playPourSound('land');
    onTick?.();
    await wait(SETTLE_MS);
    flyer.remove();
    pieces.forEach((seg) => seg.classList.remove(theme.landingClass));
    return;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;

  const stream = document.createElement('div');
  stream.className = `lpour-stream ${gemClassesByIndex(colorId - 1, 'liquid')}`;
  stream.style.setProperty('--lpour-len', `${Math.max(dist, 40)}px`);
  stream.style.setProperty('--lpour-angle', `${angle}deg`);
  stream.style.left = `${from.x}px`;
  stream.style.top = `${from.y - 20}px`;
  board.appendChild(stream);

  playPourSound('start');
  requestAnimationFrame(() => stream.classList.add('lpour-stream--active'));

  await wait(POUR_MS);
  stream.classList.add('lpour-stream--fade');
  pieces.forEach((seg) => {
    seg.classList.remove(theme.liftingClass);
    seg.classList.add(theme.landingClass);
  });
  playPourSound('land');
  onTick?.();

  await wait(SETTLE_MS);
  stream.remove();
  pieces.forEach((seg) => seg.classList.remove(theme.landingClass));
}

export function spawnTubeSparkles(tubeEl: HTMLElement): void {
  if (prefersReducedMotion()) return;
  for (let i = 0; i < 6; i++) {
    const spark = document.createElement('span');
    spark.className = 'lpour-spark';
    spark.style.setProperty('--sx', `${(Math.random() - 0.5) * 48}px`);
    spark.style.setProperty('--sy', `${-12 - Math.random() * 36}px`);
    spark.style.animationDelay = `${i * 45}ms`;
    tubeEl.appendChild(spark);
    window.setTimeout(() => spark.remove(), 700);
  }
}

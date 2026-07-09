/** Animated tube transfer — real liquid pour & per-ball sorting. */

import './liquidPour.css';
import { sfx } from '../../engine/audio';
import { gemClassesByIndex } from './premiumGems';

export interface PourTheme {
  variant: 'liquid' | 'sphere';
  stackSelector: string;
  pieceSelector: string;
  tubeSelector: string;
  heldClass: string;
}

export const LIQUID_POUR_THEME: PourTheme = {
  variant: 'liquid',
  stackSelector: '.ws-liquid-stack',
  pieceSelector: '.ws-seg',
  tubeSelector: '.ws-tube',
  heldClass: 'ws-seg--held',
};

export const SPHERE_POUR_THEME: PourTheme = {
  variant: 'sphere',
  stackSelector: '.bs-ball-stack',
  pieceSelector: '.bs-ball',
  tubeSelector: '.bs-tube',
  heldClass: 'bs-ball--held',
};

export interface PourAnimOptions {
  board: HTMLElement;
  row: HTMLElement;
  fromIdx: number;
  toIdx: number;
  colorId: number;
  amount: number;
  theme?: PourTheme;
}

const LIQUID_POUR_MS = 520;
const BALL_ARC_MS = 280;
const BALL_GAP_MS = 95;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function relRect(el: HTMLElement, board: HTMLElement): DOMRect {
  const b = board.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return new DOMRect(r.left - b.left, r.top - b.top, r.width, r.height);
}

function tubeMouth(board: HTMLElement, tube: HTMLElement): { x: number; y: number } {
  const t = relRect(tube, board);
  return { x: t.left + t.width / 2, y: t.top + 6 };
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

/** Lift the pourable top run when a tube is selected. */
export function applyHeldPieces(
  row: HTMLElement,
  tubeIdx: number,
  amount: number,
  theme: PourTheme,
): void {
  const tube = row.children[tubeIdx] as HTMLElement | undefined;
  if (!tube || amount <= 0) return;
  const stack = tube.querySelector(theme.stackSelector);
  if (!stack) return;
  const pieces = Array.from(stack.querySelectorAll(theme.pieceSelector));
  pieces.slice(-amount).forEach((p) => p.classList.add(theme.heldClass));
}

async function animateWaterPour(
  board: HTMLElement,
  row: HTMLElement,
  fromIdx: number,
  toIdx: number,
  colorId: number,
  amount: number,
  theme: PourTheme,
): Promise<void> {
  const fromTube = row.children[fromIdx] as HTMLElement;
  const toTube = row.children[toIdx] as HTMLElement;
  const fromStack = fromTube.querySelector(theme.stackSelector)!;
  const pieces = Array.from(fromStack.querySelectorAll(theme.pieceSelector)).slice(-amount);
  if (!pieces.length) return;

  const firstR = relRect(pieces[0] as HTMLElement, board);
  const lastR = relRect(pieces[pieces.length - 1] as HTMLElement, board);
  const blobH = lastR.top + lastR.height - firstR.top;
  const blobW = Math.max(...pieces.map((p) => relRect(p as HTMLElement, board).width));

  pieces.forEach((p) => p.classList.add('lpour-hide'));

  const tilt = toIdx > fromIdx ? 'lpour-tilt-right' : toIdx < fromIdx ? 'lpour-tilt-left' : '';
  fromTube.classList.add('lpour-tube-pour', tilt);

  const fromMouth = tubeMouth(board, fromTube);
  const toMouth = tubeMouth(board, toTube);
  const toStack = toTube.querySelector(theme.stackSelector)!;
  const destPieces = Array.from(toStack.querySelectorAll(theme.pieceSelector));
  const landY = destPieces.length
    ? relRect(destPieces[destPieces.length - 1] as HTMLElement, board).top - blobH - 2
    : relRect(toStack as HTMLElement, board).top + relRect(toStack as HTMLElement, board).height - blobH - 4;

  const layer = document.createElement('div');
  layer.className = 'lpour-layer';
  board.appendChild(layer);

  const blob = document.createElement('div');
  blob.className = `lpour-blob ${gemClassesByIndex(colorId - 1, 'liquid')}`;
  blob.style.left = `${firstR.left}px`;
  blob.style.top = `${firstR.top}px`;
  blob.style.width = `${blobW}px`;
  blob.style.height = `${blobH}px`;
  layer.appendChild(blob);

  const stream = document.createElement('div');
  stream.className = `lpour-stream-v2 ${gemClassesByIndex(colorId - 1, 'liquid')}`;
  const dx = toMouth.x - fromMouth.x;
  const dy = toMouth.y - fromMouth.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) - 90;
  stream.style.left = `${fromMouth.x}px`;
  stream.style.top = `${fromMouth.y}px`;
  stream.style.setProperty('--lpour-len', `${Math.max(len, 24)}px`);
  stream.style.setProperty('--lpour-angle', `${angle}deg`);
  layer.appendChild(stream);

  playPourSound('start');
  requestAnimationFrame(() => {
    blob.classList.add('lpour-blob--pour');
    blob.style.left = `${toMouth.x - blobW / 2}px`;
    blob.style.top = `${landY}px`;
    stream.classList.add('lpour-stream-v2--on');
  });

  await wait(LIQUID_POUR_MS);
  playPourSound('land');
  layer.remove();
  fromTube.classList.remove('lpour-tube-pour', 'lpour-tilt-right', 'lpour-tilt-left');
  pieces.forEach((p) => p.classList.remove('lpour-hide'));
}

async function animateBallPour(
  board: HTMLElement,
  row: HTMLElement,
  fromIdx: number,
  toIdx: number,
  colorId: number,
  amount: number,
  theme: PourTheme,
): Promise<void> {
  const fromTube = row.children[fromIdx] as HTMLElement;
  const toTube = row.children[toIdx] as HTMLElement;
  const fromStack = fromTube.querySelector(theme.stackSelector)!;
  const toStack = toTube.querySelector(theme.stackSelector)!;
  const sourcePieces = Array.from(fromStack.querySelectorAll(theme.pieceSelector)).slice(-amount);

  const layer = document.createElement('div');
  layer.className = 'lpour-layer';
  board.appendChild(layer);

  const toRect = relRect(toStack as HTMLElement, board);
  const ballW = sourcePieces.length
    ? relRect(sourcePieces[0] as HTMLElement, board).width
    : 28;
  const gap = 4;
  const baseLandX = toRect.left + toRect.width / 2;
  const startLandY = toRect.top + toRect.height - ballW - 4;
  const existing = toStack.querySelectorAll(theme.pieceSelector).length;

  sourcePieces.forEach((p) => p.classList.add('lpour-hide'));

  for (let i = 0; i < amount; i++) {
    const src = sourcePieces[sourcePieces.length - 1 - i] as HTMLElement;
    const fromR = relRect(src, board);
    const landY = startLandY - (existing + i) * (ballW + gap);

    const flyer = document.createElement('div');
    flyer.className = `lpour-ball-fly ${gemClassesByIndex(colorId - 1, 'sphere')}`;
    flyer.style.width = `${ballW}px`;
    flyer.style.height = `${ballW}px`;
    flyer.style.left = `${fromR.left}px`;
    flyer.style.top = `${fromR.top}px`;
    flyer.style.setProperty('--bx0', `${fromR.left}px`);
    flyer.style.setProperty('--by0', `${fromR.top}px`);
    flyer.style.setProperty('--bx1', `${baseLandX - ballW / 2}px`);
    flyer.style.setProperty('--by1', `${landY}px`);
    flyer.style.setProperty('--bxm', `${(fromR.left + baseLandX - ballW / 2) / 2}px`);
    flyer.style.setProperty('--bym', `${Math.min(fromR.top, landY) - 36}px`);
    layer.appendChild(flyer);

    if (i === 0) playPourSound('start');
    requestAnimationFrame(() => flyer.classList.add('lpour-ball-fly--go'));
    await wait(BALL_ARC_MS);
    flyer.remove();
    if (i < amount - 1) await wait(BALL_GAP_MS);
  }

  playPourSound('land');
  layer.remove();
  sourcePieces.forEach((p) => p.classList.remove('lpour-hide'));
}

export async function animatePour(opts: PourAnimOptions): Promise<void> {
  const theme = opts.theme ?? LIQUID_POUR_THEME;
  const { board, row, fromIdx, toIdx, colorId, amount } = opts;
  if (amount <= 0) return;

  if (prefersReducedMotion()) return;

  const fromTube = row.children[fromIdx] as HTMLElement | undefined;
  const toTube = row.children[toIdx] as HTMLElement | undefined;
  if (!fromTube || !toTube) return;

  if (theme.variant === 'sphere') {
    await animateBallPour(board, row, fromIdx, toIdx, colorId, amount, theme);
  } else {
    await animateWaterPour(board, row, fromIdx, toIdx, colorId, amount, theme);
  }
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

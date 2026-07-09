/** Animated tube transfer — continuous liquid stream & per-ball sorting. */

import './liquidPour.css';
import { sfx } from '../../engine/audio';
import { gemClassesByIndex } from './premiumGems';
import {
  clearStreamCanvas,
  drawLiquidStream,
  drawSplashParticles,
  easeInOutCubic,
  easeOutCubic,
  ensureStreamCanvas,
  tubeMouthOnBoard,
  type SplashParticle,
  type WaterBottleManager,
} from './tubeSort/waterFluid';

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
  /** Called after each liquid unit transfers (water sort). */
  onSegment?: () => void;
  fluidManager?: WaterBottleManager;
  tubes?: number[][];
  fromCap?: number;
  toCap?: number;
  fromHidden?: number;
  toHidden?: number;
}

const TILT_ANGLE = 22;
const TILT_IN_MS = 300;
const UNTILT_MS = 360;
const POUR_BASE_MS = 400;
const POUR_PER_UNIT_MS = 130;
const POUR_START_TILT = 0.72;
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

/** Selection highlight — fluid renderer handles this via canvas. */
export function applyHeldPieces(
  _row: HTMLElement,
  _tubeIdx: number,
  _amount: number,
  theme: PourTheme,
): void {
  if (theme.variant === 'sphere') {
    const row = _row;
    const tube = row.children[_tubeIdx] as HTMLElement | undefined;
    if (!tube || _amount <= 0) return;
    const stack = tube.querySelector(theme.stackSelector);
    if (!stack) return;
    const pieces = Array.from(stack.querySelectorAll(theme.pieceSelector));
    pieces.slice(-_amount).forEach((p) => p.classList.add(theme.heldClass));
  }
}

function rafPour(duration: number, onFrame: (t: number) => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number): void => {
      const raw = Math.min(1, (now - t0) / duration);
      const done = onFrame(raw);
      if (done || raw >= 1) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function setTubeTilt(tube: HTMLElement, degrees: number, toRight: boolean): void {
  const sign = toRight ? 1 : -1;
  tube.style.setProperty('--pour-tilt', `${sign * degrees}deg`);
}

function spawnSplashAt(
  particles: SplashParticle[],
  x: number,
  y: number,
  colorId: number,
): void {
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
    const speed = 1.2 + Math.random() * 2.8;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 1,
      colorId,
      size: 2 + Math.random() * 2.5,
    });
  }
}

function tickSplash(particles: SplashParticle[]): void {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.life -= 0.045;
  }
}

/** Canvas fluid pour — neck pivot tilt, delayed stream, per-frame liquid levels. */
async function animateWaterPour(opts: PourAnimOptions): Promise<void> {
  const {
    board, row, fromIdx, toIdx, colorId, amount, onSegment,
    fluidManager, tubes, fromCap = 4, toCap = 4, fromHidden = 0, toHidden = 0,
  } = opts;
  if (!fluidManager || !tubes || amount <= 0) return;

  const fromTube = row.children[fromIdx] as HTMLElement;
  const toTube = row.children[toIdx] as HTMLElement;
  const fromData = tubes[fromIdx].slice();
  const toData = tubes[toIdx].slice();
  const toRight = toIdx > fromIdx;
  const pourMs = POUR_BASE_MS + amount * POUR_PER_UNIT_MS;
  const totalMs = TILT_IN_MS + pourMs + UNTILT_MS;

  fromTube.classList.add('lpour-tube-pour');
  if (toRight) fromTube.classList.add('lpour-tilt-right');
  else fromTube.classList.add('lpour-tilt-left');

  const streamCanvas = ensureStreamCanvas(board);
  const streamCtx = streamCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let segmentsApplied = 0;
  let pourSoundPlayed = false;
  const splashParticles: SplashParticle[] = [];
  let lastSplashAt = 0;

  await rafPour(totalMs, (raw) => {
    const elapsed = raw * totalMs;
    let drained = 0;
    let streamAlpha = 0;

    if (elapsed < TILT_IN_MS) {
      const t = easeOutCubic(elapsed / TILT_IN_MS);
      setTubeTilt(fromTube, t * TILT_ANGLE, toRight);
    } else if (elapsed < TILT_IN_MS + pourMs) {
      setTubeTilt(fromTube, TILT_ANGLE, toRight);
      const pourRaw = (elapsed - TILT_IN_MS) / pourMs;
      const pourT = easeInOutCubic(pourRaw);
      drained = amount * pourT;
      streamAlpha = pourRaw >= POUR_START_TILT - 0.05 ? Math.min(1, (pourRaw - POUR_START_TILT + 0.05) / 0.2) : 0;

      if (streamAlpha > 0.5 && !pourSoundPlayed) {
        playPourSound('start');
        pourSoundPlayed = true;
      }

      const applied = Math.floor(drained + 0.0001);
      while (segmentsApplied < applied) {
        onSegment?.();
        segmentsApplied++;
        fluidManager.triggerRipple(toIdx);
        const toMouth = tubeMouthOnBoard(board, toTube);
        spawnSplashAt(splashParticles, toMouth.x, toMouth.y + 4, colorId);
        lastSplashAt = elapsed;
      }
    } else {
      const t = easeInOutCubic((elapsed - TILT_IN_MS - pourMs) / UNTILT_MS);
      setTubeTilt(fromTube, TILT_ANGLE * (1 - t), toRight);
      drained = amount;
    }

    fluidManager.render(fromIdx, fromData, {
      capacity: fromCap,
      hiddenBottom: fromHidden,
      drainTop: drained,
      drainColor: colorId,
    });
    fluidManager.render(toIdx, toData, {
      capacity: toCap,
      hiddenBottom: toHidden,
      pourColor: colorId,
      pourUnits: drained,
      ripple: fluidManager.rippleStrength(toIdx),
    });

    if (streamCtx && streamAlpha > 0) {
      const boardRect = board.getBoundingClientRect();
      streamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streamCtx.clearRect(0, 0, boardRect.width, boardRect.height);
      const fromMouth = tubeMouthOnBoard(board, fromTube);
      const toMouth = tubeMouthOnBoard(board, toTube);
      drawLiquidStream(streamCtx, fromMouth, toMouth, colorId, 10, elapsed * 0.006, streamAlpha);
      tickSplash(splashParticles);
      drawSplashParticles(streamCtx, splashParticles);
    } else if (streamCtx && splashParticles.length && elapsed - lastSplashAt < 400) {
      const boardRect = board.getBoundingClientRect();
      streamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streamCtx.clearRect(0, 0, boardRect.width, boardRect.height);
      tickSplash(splashParticles);
      drawSplashParticles(streamCtx, splashParticles);
    }

    return raw >= 1;
  });

  while (segmentsApplied < amount) {
    onSegment?.();
    segmentsApplied++;
  }

  clearStreamCanvas(board);
  fromTube.style.removeProperty('--pour-tilt');
  fromTube.classList.remove('lpour-tube-pour', 'lpour-tilt-right', 'lpour-tilt-left');
  fluidManager.triggerRipple(toIdx);
  fluidManager.render(fromIdx, tubes[fromIdx], { capacity: fromCap, hiddenBottom: fromHidden });
  fluidManager.render(toIdx, tubes[toIdx], { capacity: toCap, hiddenBottom: toHidden });
  playPourSound('land');
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
  const { board, row, fromIdx, toIdx, colorId, amount, onSegment } = opts;
  if (amount <= 0) return;

  const fromTube = row.children[fromIdx] as HTMLElement | undefined;
  const toTube = row.children[toIdx] as HTMLElement | undefined;
  if (!fromTube || !toTube) return;

  if (prefersReducedMotion()) {
    for (let i = 0; i < amount; i++) onSegment?.();
    return;
  }

  if (theme.variant === 'sphere') {
    await animateBallPour(board, row, fromIdx, toIdx, colorId, amount, theme);
  } else if (opts.fluidManager && opts.tubes) {
    await animateWaterPour(opts);
  }
}

/** Gentle shake with red glow for invalid moves. */
export function shakeTube(tubeEl: HTMLElement, prefix = 'ws'): void {
  const shakeCls = `${prefix}-tube--shake`;
  const glowCls = `${prefix}-tube--invalid`;
  tubeEl.classList.remove(shakeCls, glowCls);
  void tubeEl.offsetWidth;
  tubeEl.classList.add(shakeCls, glowCls);
  window.setTimeout(() => tubeEl.classList.remove(shakeCls), 520);
  window.setTimeout(() => tubeEl.classList.remove(glowCls), 680);
}

export function spawnTubeSparkles(tubeEl: HTMLElement): void {
  if (prefersReducedMotion()) return;
  tubeEl.classList.add('ws-tube--sparkle');
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement('span');
    spark.className = 'lpour-spark';
    spark.style.setProperty('--sx', `${(Math.random() - 0.5) * 56}px`);
    spark.style.setProperty('--sy', `${-16 - Math.random() * 40}px`);
    spark.style.animationDelay = `${i * 40}ms`;
    tubeEl.appendChild(spark);
    window.setTimeout(() => spark.remove(), 800);
  }
  window.setTimeout(() => tubeEl.classList.remove('ws-tube--sparkle'), 1200);
}

/** Confetti + sparkle victory burst. */
export function spawnVictoryBurst(board: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'lpour-victory';
  board.appendChild(layer);
  const rect = board.getBoundingClientRect();
  const colors = ['#5b8cff', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('span');
    const isRect = i % 3 === 0;
    piece.className = isRect ? 'lpour-confetti lpour-confetti--rect' : 'lpour-confetti';
    piece.style.left = `${rect.width * 0.5 + (Math.random() - 0.5) * 60}px`;
    piece.style.top = `${rect.height * 0.25}px`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--cdx', `${(Math.random() - 0.5) * 220}px`);
    piece.style.setProperty('--cdy', `${80 + Math.random() * 160}px`);
    piece.style.setProperty('--crot', `${(Math.random() - 0.5) * 720}deg`);
    piece.style.animationDelay = `${i * 25}ms`;
    layer.appendChild(piece);
  }
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement('span');
    spark.className = 'lpour-victory-spark';
    spark.style.left = `${20 + Math.random() * (rect.width - 40)}px`;
    spark.style.top = `${20 + Math.random() * (rect.height * 0.55)}px`;
    spark.style.setProperty('--vdx', `${(Math.random() - 0.5) * 90}px`);
    spark.style.setProperty('--vdy', `${-50 - Math.random() * 70}px`);
    spark.style.animationDelay = `${i * 45}ms`;
    layer.appendChild(spark);
  }
  window.setTimeout(() => layer.remove(), 2200);
}

/** Brief score header pop animation. */
export function animateScorePop(): void {
  const el = document.getElementById('fpStat-score');
  if (!el) return;
  el.classList.remove('ws-score-pop');
  void el.offsetWidth;
  el.classList.add('ws-score-pop');
  window.setTimeout(() => el.classList.remove('ws-score-pop'), 700);
}

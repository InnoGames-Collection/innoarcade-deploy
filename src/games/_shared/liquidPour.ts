/** Animated tube transfer — continuous liquid stream & per-ball sorting. */

import './liquidPour.css';
import { sfx } from '../../engine/audio';
import { gemClassesByIndex } from './premiumGems';
import { ballSortPourSound, isBallSortPage } from '../ball-sort/audio';
import { isWaterSortPage, waterSortPourSound } from '../water-sort/audio';
import {
  clearStreamCanvas,
  drawConnectedPourStream,
  drawSplashParticles,
  drawLandingRipple,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  ensureStreamCanvas,
  SplashPool,
  tubeLiquidSurfaceOnBoard,
  tubeMouthOnBoard,
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

/** Phase durations (ms) — strict sequence: lift → travel → tilt → pour → untilt → return → lower */
const VERT_LIFT_MS = 260;
const TRAVEL_MS = 340;
const TILT_IN_MS = 320;
const TILT_OUT_MS = 320;
const TRAVEL_BACK_MS = 340;
const LOWER_MS = 300;
const LANDING_MS = 220;
const POUR_BASE_MS = 380;
const POUR_PER_UNIT_MS = 120;
const BALL_ARC_MS = 280;
const BALL_GAP_MS = 95;

/** Shared splash pool — reused across pours to avoid GC pressure. */
const splashPool = new SplashPool();

interface PourTransform {
  shiftX: number;
  liftY: number;
  tilt: number;
}

interface PourTimeline {
  vertLiftEnd: number;
  travelEnd: number;
  tiltInEnd: number;
  pourEnd: number;
  tiltOutEnd: number;
  travelBackEnd: number;
  lowerEnd: number;
  total: number;
  shiftTarget: number;
  liftY: number;
  tiltAngle: number;
  pourMs: number;
}

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
  if (isBallSortPage()) {
    ballSortPourSound(kind);
    return;
  }
  if (isWaterSortPage()) {
    waterSortPourSound(kind);
    return;
  }
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

function rafPour(duration: number, onFrame: (t: number, elapsed: number) => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - t0;
      const raw = Math.min(1, elapsed / duration);
      const done = onFrame(raw, elapsed);
      if (done || raw >= 1) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function setTubePourTransform(tube: HTMLElement, t: PourTransform, toRight: boolean): void {
  const sign = toRight ? 1 : -1;
  tube.style.setProperty('--pour-shift-x', `${t.shiftX}px`);
  tube.style.setProperty('--pour-lift-y', `${t.liftY}px`);
  tube.style.setProperty('--pour-tilt', `${sign * t.tilt}deg`);
}

function computePourTimeline(
  amount: number,
  fromTube: HTMLElement,
  toTube: HTMLElement,
): PourTimeline {
  const fromR = fromTube.getBoundingClientRect();
  const toR = toTube.getBoundingClientRect();
  const shiftTarget = toR.left + toR.width / 2 - (fromR.left + fromR.width / 2);
  const liftY = -(Math.max(fromR.height * 0.44, 40) + 10);
  const dist = Math.abs(shiftTarget);
  const tiltAngle = Math.min(58, Math.max(42, 46 + dist * 0.028));
  const pourMs = POUR_BASE_MS + amount * POUR_PER_UNIT_MS;

  const vertLiftEnd = VERT_LIFT_MS;
  const travelEnd = vertLiftEnd + TRAVEL_MS;
  const tiltInEnd = travelEnd + TILT_IN_MS;
  const pourEnd = tiltInEnd + pourMs;
  const tiltOutEnd = pourEnd + TILT_OUT_MS;
  const travelBackEnd = tiltOutEnd + TRAVEL_BACK_MS;
  const lowerEnd = travelBackEnd + LOWER_MS;

  return {
    vertLiftEnd,
    travelEnd,
    tiltInEnd,
    pourEnd,
    tiltOutEnd,
    travelBackEnd,
    lowerEnd,
    total: lowerEnd,
    shiftTarget,
    liftY,
    tiltAngle,
    pourMs,
  };
}

/** Seven-phase motion: vertical lift → travel → tilt → hold → untilt → return → lower. */
function samplePourTransform(elapsed: number, tl: PourTimeline): PourTransform {
  if (elapsed < tl.vertLiftEnd) {
    const t = easeOutCubic(elapsed / tl.vertLiftEnd);
    return { shiftX: 0, liftY: tl.liftY * t, tilt: 0 };
  }
  if (elapsed < tl.travelEnd) {
    const t = easeInOutCubic((elapsed - tl.vertLiftEnd) / TRAVEL_MS);
    return { shiftX: tl.shiftTarget * t, liftY: tl.liftY, tilt: 0 };
  }
  if (elapsed < tl.tiltInEnd) {
    const t = easeInOutCubic((elapsed - tl.travelEnd) / TILT_IN_MS);
    return { shiftX: tl.shiftTarget, liftY: tl.liftY, tilt: tl.tiltAngle * t };
  }
  if (elapsed < tl.pourEnd) {
    return { shiftX: tl.shiftTarget, liftY: tl.liftY, tilt: tl.tiltAngle };
  }
  if (elapsed < tl.tiltOutEnd) {
    const t = easeInOutCubic((elapsed - tl.pourEnd) / TILT_OUT_MS);
    return { shiftX: tl.shiftTarget, liftY: tl.liftY, tilt: tl.tiltAngle * (1 - t) };
  }
  if (elapsed < tl.travelBackEnd) {
    const t = easeInOutCubic((elapsed - tl.tiltOutEnd) / TRAVEL_BACK_MS);
    return { shiftX: tl.shiftTarget * (1 - t), liftY: tl.liftY, tilt: 0 };
  }
  const t = easeOutBack(Math.min(1, (elapsed - tl.travelBackEnd) / LOWER_MS));
  return { shiftX: 0, liftY: tl.liftY * (1 - t), tilt: 0 };
}

function samplePourDrain(elapsed: number, tl: PourTimeline, amount: number): number {
  if (elapsed < tl.tiltInEnd) return 0;
  if (elapsed >= tl.pourEnd) return amount;
  const pourRaw = (elapsed - tl.tiltInEnd) / tl.pourMs;
  if (pourRaw < 0.02) return 0;
  const eased = pourRaw < 0.5
    ? 2 * pourRaw * pourRaw
    : 1 - ((-2 * pourRaw + 2) ** 2) / 2;
  return amount * Math.min(1, eased);
}

function sampleStreamAlpha(elapsed: number, tl: PourTimeline): number {
  if (elapsed < tl.tiltInEnd - 40) return 0;
  if (elapsed >= tl.pourEnd + 60) return 0;
  if (elapsed < tl.tiltInEnd) {
    const t = (elapsed - (tl.tiltInEnd - 40)) / 40;
    return t * t;
  }
  if (elapsed >= tl.pourEnd) {
    const t = 1 - (elapsed - tl.pourEnd) / 60;
    return t * t;
  }
  return 1;
}

function resetTubePourStyles(tube: HTMLElement): void {
  tube.style.removeProperty('--pour-shift-x');
  tube.style.removeProperty('--pour-lift-y');
  tube.style.removeProperty('--pour-tilt');
  tube.classList.remove('lpour-tube-pour', 'lpour-tilt-right', 'lpour-tilt-left');
}

/** Canvas fluid pour — lift, neck tilt, continuous stream, bounce return. */
async function animateWaterPour(opts: PourAnimOptions): Promise<void> {
  const {
    board, row, fromIdx, toIdx, colorId, amount, onSegment,
    fluidManager, tubes, fromCap = 4, toCap = 4, fromHidden = 0, toHidden = 0,
  } = opts;
  if (!fluidManager || !tubes || amount <= 0) return;

  const fromTube = row.children[fromIdx] as HTMLElement;
  const toTube = row.children[toIdx] as HTMLElement;
  if (!fromTube.isConnected || !toTube.isConnected) return;

  const fromData = tubes[fromIdx].slice();
  const toData = tubes[toIdx].slice();
  const toRight = toIdx > fromIdx;

  fromTube.classList.remove('ws-tube--sel');
  void fromTube.offsetWidth;
  const tl = computePourTimeline(amount, fromTube, toTube);

  fromTube.classList.add('lpour-tube-pour');
  fromTube.classList.add(toRight ? 'lpour-tilt-right' : 'lpour-tilt-left');

  const streamCanvas = ensureStreamCanvas(board);
  const streamCtx = streamCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let segmentsApplied = 0;
  let pourSoundPlayed = false;
  let lastSplashAt = 0;
  let lastDropletAt = 0;
  splashPool.clear();

  await rafPour(tl.total, (_raw, elapsed) => {
    if (!fromTube.isConnected) return true;

    const transform = samplePourTransform(elapsed, tl);
    setTubePourTransform(fromTube, transform, toRight);

    const drained = samplePourDrain(elapsed, tl, amount);
    const streamAlpha = sampleStreamAlpha(elapsed, tl);

    if (streamAlpha > 0.35 && !pourSoundPlayed) {
      playPourSound('start');
      pourSoundPlayed = true;
    }

    const applied = Math.floor(drained + 0.0001);
    while (segmentsApplied < applied) {
      onSegment?.();
      segmentsApplied++;
      fluidManager.triggerRipple(toIdx, 720);
      const toMouth = tubeMouthOnBoard(board, toTube);
      splashPool.spawn(toMouth.x, toMouth.y + 4, colorId, 6);
      lastSplashAt = elapsed;
    }

    if (streamAlpha > 0.5 && elapsed - lastDropletAt > 42) {
      const toMouth = tubeMouthOnBoard(board, toTube);
      splashPool.spawn(toMouth.x, toMouth.y + 2, colorId, 3);
      lastDropletAt = elapsed;
    }

    fluidManager.render(fromIdx, fromData, {
      capacity: fromCap,
      hiddenBottom: fromHidden,
      drainTop: drained,
      drainColor: colorId,
      wobble: fluidManager.wobbleStrength(fromIdx),
      animPhase: elapsed * 0.0014,
    });
    fluidManager.render(toIdx, toData, {
      capacity: toCap,
      hiddenBottom: toHidden,
      pourColor: colorId,
      pourUnits: drained,
      ripple: Math.max(fluidManager.rippleStrength(toIdx), streamAlpha * 0.6),
      wobble: fluidManager.wobbleStrength(toIdx),
      animPhase: elapsed * 0.0014,
    });

    if (streamCtx) {
      splashPool.tick();
      const boardRect = board.getBoundingClientRect();
      streamCtx.imageSmoothingEnabled = true;
      streamCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      streamCtx.clearRect(0, 0, boardRect.width, boardRect.height);

      if (streamAlpha > 0) {
        const fromMouth = tubeMouthOnBoard(board, fromTube);
        const toMouth = tubeMouthOnBoard(board, toTube);
        const fromFill = Math.max(0, fromData.length - fromHidden - drained);
        const toFill = toData.length - toHidden + drained;
        const fromSurface = tubeLiquidSurfaceOnBoard(board, fromTube, fromFill, fromCap);
        const pourProgress = amount > 0 ? drained / amount : 1;
        const streamW = Math.max(14, Math.min(22, fromTube.getBoundingClientRect().width * 0.32));
        drawConnectedPourStream(
          streamCtx, fromSurface, fromMouth, toMouth, colorId, streamW, elapsed * 0.005,
          Math.min(1, streamAlpha * 1.2), { progress: pourProgress, phase: elapsed * 0.005 },
        );
        const destSurface = tubeLiquidSurfaceOnBoard(board, toTube, toFill, toCap);
        drawLandingRipple(
          streamCtx, toMouth.x, Math.min(toMouth.y, destSurface.y + 2), streamW, colorId,
          streamAlpha * pourProgress * 0.85, elapsed * 0.005,
        );
      }
      if (splashPool.particles.length) {
        drawSplashParticles(streamCtx, splashPool.particles);
      }
    } else if (elapsed - lastSplashAt < 400) {
      splashPool.tick();
    }

    return elapsed >= tl.total;
  });

  while (segmentsApplied < amount) {
    onSegment?.();
    segmentsApplied++;
  }

  clearStreamCanvas(board);
  splashPool.clear();

  if (fromTube.isConnected) {
    resetTubePourStyles(fromTube);
    fromTube.classList.add('lpour-tube-landing');
    await wait(LANDING_MS);
    fromTube.classList.remove('lpour-tube-landing');
  }

  fluidManager.triggerRipple(toIdx, 820);
  fluidManager.triggerWobble(fromIdx, 950);
  fluidManager.triggerWobble(toIdx, 1100);
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

/** Brief tap feedback when selecting a tube. */
export function pulseTubeSelect(tubeEl: HTMLElement, prefix = 'ws'): void {
  const cls = `${prefix}-tube--tap`;
  tubeEl.classList.remove(cls);
  void tubeEl.offsetWidth;
  tubeEl.classList.add(cls);
  window.setTimeout(() => tubeEl.classList.remove(cls), 320);
}

/** Undo ripple across all tubes. */
export async function animateUndoRipple(
  board: HTMLElement,
  fluidManager: WaterBottleManager,
  tubeCount: number,
): Promise<void> {
  if (prefersReducedMotion()) return;
  board.classList.add('ws-board--undo-flash');
  fluidManager.triggerWobbleAll(tubeCount);
  await wait(420);
  board.classList.remove('ws-board--undo-flash');
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
  const prefix = tubeEl.classList.contains('bs-tube') ? 'bs' : 'ws';
  tubeEl.classList.add(`${prefix}-tube--sparkle`);
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement('span');
    spark.className = 'lpour-spark';
    spark.style.setProperty('--sx', `${(Math.random() - 0.5) * 56}px`);
    spark.style.setProperty('--sy', `${-16 - Math.random() * 40}px`);
    spark.style.animationDelay = `${i * 40}ms`;
    tubeEl.appendChild(spark);
    window.setTimeout(() => spark.remove(), 800);
  }
  window.setTimeout(() => tubeEl.classList.remove(`${prefix}-tube--sparkle`), 1200);
}

/** Confetti + sparkle victory burst. */
export function spawnVictoryBurst(board: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'lpour-victory';
  board.appendChild(layer);
  const rect = board.getBoundingClientRect();
  const colors = isBallSortPage()
    ? ['#4f9e16', '#1f74e0', '#6cc52f', '#ffffff', '#3d8010', '#2aa9d6']
    : isWaterSortPage()
      ? ['#4f9e16', '#2aa9d6', '#1f74e0', '#ffffff', '#22c55e', '#3d7aff', '#f5a623']
      : ['#5b8cff', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c'];
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
  const popCls = isBallSortPage() ? 'bs-score-pop' : isWaterSortPage() ? 'ws-score-pop' : 'ws-score-pop';
  el.classList.remove(popCls);
  void el.offsetWidth;
  el.classList.add(popCls);
  window.setTimeout(() => el.classList.remove(popCls), 700);
}

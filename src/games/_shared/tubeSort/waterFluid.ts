/** Canvas fluid renderer — premium glass bottles with continuous liquid. */

import { gemIdFromIndex, type GemId } from '../premiumGems';

export interface FluidLayer {
  colorId: number;
  units: number;
  mystery?: boolean;
}

export interface BottleDrawOpts {
  capacity: number;
  hiddenBottom: number;
  selected?: boolean;
  highlightTop?: number;
  completed?: boolean;
  /** 0–1 ripple strength on the top meniscus */
  ripple?: number;
  /** Animation phase for bubbles / shine (radians) */
  animPhase?: number;
  /** Stable seed for bubble placement */
  tubeSeed?: number;
}

const PALETTE: Record<GemId, { light: string; mid: string; dark: string }> = {
  sapphire: { light: '#d4e6ff', mid: '#5b8cff', dark: '#2848a8' },
  emerald: { light: '#b0f5d0', mid: '#2ecc71', dark: '#167a40' },
  amber: { light: '#ffeeb0', mid: '#f39c12', dark: '#a86808' },
  ruby: { light: '#ffc0cc', mid: '#e74c3c', dark: '#8c2018' },
  amethyst: { light: '#ead0ff', mid: '#9b59b6', dark: '#542870' },
  aquamarine: { light: '#b0faf0', mid: '#1abc9c', dark: '#0a7060' },
  coral: { light: '#ffd8bc', mid: '#e67e22', dark: '#9a4808' },
  violet: { light: '#e0d4ff', mid: '#6c5ce7', dark: '#3820a0' },
};

const MYSTERY = { light: '#9aa8b8', mid: '#5a6578', dark: '#3a4558' };

export function liquidColors(colorId: number): { light: string; mid: string; dark: string } {
  if (colorId <= 0) return MYSTERY;
  return PALETTE[gemIdFromIndex(colorId - 1)];
}

export function mergeTubeLayers(tube: number[]): FluidLayer[] {
  if (!tube.length) return [];
  const layers: FluidLayer[] = [];
  let cur = tube[0];
  let count = 1;
  for (let i = 1; i < tube.length; i++) {
    if (tube[i] === cur) count++;
    else {
      layers.push({ colorId: cur, units: count });
      cur = tube[i];
      count = 1;
    }
  }
  layers.push({ colorId: cur, units: count });
  return layers;
}

export function visualLayers(
  tube: number[],
  hiddenBottom: number,
  opts?: { drainTop?: number; drainColor?: number; pourColor?: number; pourUnits?: number },
): FluidLayer[] {
  const hidden = Math.min(hiddenBottom, tube.length);
  const visible = tube.slice(hidden);
  let layers = mergeTubeLayers(visible);

  if (hidden > 0) {
    layers = [{ colorId: 0, units: hidden, mystery: true }, ...layers];
  }

  const drain = opts?.drainTop ?? 0;
  const drainColor = opts?.drainColor;
  if (drain > 0 && layers.length) {
    const top = layers[layers.length - 1];
    if (!top.mystery && (drainColor == null || top.colorId === drainColor)) {
      top.units = Math.max(0, top.units - drain);
      if (top.units < 0.001) layers.pop();
    }
  }

  const pourU = opts?.pourUnits ?? 0;
  const pourC = opts?.pourColor ?? 0;
  if (pourU > 0 && pourC > 0) {
    const top = layers[layers.length - 1];
    if (top && !top.mystery && top.colorId === pourC) {
      top.units += pourU;
    } else {
      layers.push({ colorId: pourC, units: pourU });
    }
  }

  return layers;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rtl: number,
  rtr: number,
  rbr: number,
  rbl: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + rtl, y);
  ctx.lineTo(x + w - rtr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rtr);
  ctx.lineTo(x + w, y + h - rbr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
  ctx.lineTo(x + rbl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rbl);
  ctx.lineTo(x, y + rtl);
  ctx.quadraticCurveTo(x, y, x + rtl, y);
  ctx.closePath();
}

function bottleClip(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const padX = w * 0.06;
  const padTop = h * 0.04;
  const padBot = h * 0.03;
  const r = Math.min(w * 0.22, 14);
  roundRectPath(ctx, padX, padTop, w - padX * 2, h - padTop - padBot, 4, 4, r, r);
  ctx.clip();
}

function drawFluidBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: { light: string; mid: string; dark: string },
  roundTop: boolean,
  roundBottom: boolean,
): void {
  if (h < 0.5) return;
  const rtl = roundTop ? Math.min(8, w * 0.22) : 0;
  const rtr = roundTop ? Math.min(8, w * 0.22) : 0;
  const rbl = roundBottom ? Math.min(11, w * 0.3) : 0;
  const rbr = roundBottom ? Math.min(11, w * 0.3) : 0;

  roundRectPath(ctx, x, y, w, h, rtl, rtr, rbr, rbl);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colors.light);
  grad.addColorStop(0.38, colors.mid);
  grad.addColorStop(1, colors.dark);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (roundTop && h > 4) {
    const meniscusY = y + 1;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, meniscusY + 2, w * 0.44, Math.min(5, h * 0.18), 0, 0, Math.PI * 2);
    ctx.clip();
    const hl = ctx.createRadialGradient(x + w * 0.35, meniscusY, 0, x + w / 2, meniscusY + 3, w * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.55)');
    hl.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, y, w, Math.min(h, 14));
    ctx.restore();
  }
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  phase: number,
): void {
  if (h < 12) return;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 0, 0, 0, 0);
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const bx = x + w * (0.2 + ((seed * 17 + i * 41) % 100) / 100 * 0.6);
    const baseY = y + h * (0.25 + ((seed * 23 + i * 59) % 100) / 100 * 0.55);
    const drift = Math.sin(phase * 1.4 + i * 1.8) * 2;
    const by = baseY + drift;
    const r = 1.2 + (i % 2) * 0.8;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx - r * 0.25, by - r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }
  ctx.restore();
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  surfaceY: number,
  w: number,
  strength: number,
): void {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = strength * 0.45;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const spread = 1 + i * 0.35 + strength * 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY + 2, w * 0.38 * spread, 3.5 * spread, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlassReflection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
): void {
  const shimmer = 0.85 + Math.sin(phase * 0.8) * 0.15;
  ctx.save();
  const gx = w * 0.14;
  const gy = h * 0.1;
  const gw = w * 0.2;
  const gh = h * 0.55;
  const grad = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
  grad.addColorStop(0, `rgba(255,255,255,${0.32 * shimmer})`);
  grad.addColorStop(0.45, `rgba(255,255,255,${0.08 * shimmer})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(gx + gw / 2, gy + gh / 2, gw / 2, gh / 2, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawInnerShadow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const padX = w * 0.06;
  const padTop = h * 0.04;
  const padBot = h * 0.03;
  const r = Math.min(w * 0.22, 14);
  ctx.save();
  roundRectPath(ctx, padX, padTop, w - padX * 2, h - padTop - padBot, 4, 4, r, r);
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.14)');
  grad.addColorStop(0.12, 'rgba(0,0,0,0)');
  grad.addColorStop(0.88, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

export function drawBottleFluid(
  canvas: HTMLCanvasElement,
  layers: FluidLayer[],
  opts: BottleDrawOpts,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const phase = opts.animPhase ?? 0;
  const seed = opts.tubeSeed ?? 1;

  ctx.save();
  bottleClip(ctx, w, h);

  const padX = w * 0.08;
  const innerW = w - padX * 2;
  const padTop = h * 0.05;
  const padBot = h * 0.04;
  const innerH = h - padTop - padBot;
  const unitH = innerH / opts.capacity;

  let bottomY = h - padBot;
  const totalUnits = layers.reduce((s, l) => s + l.units, 0);
  let topSurfaceY = bottomY;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerH = layer.units * unitH;
    const topY = bottomY - layerH;
    const isTop = i === layers.length - 1;
    const isBottom = i === 0;
    const colors = layer.mystery ? MYSTERY : liquidColors(layer.colorId);
    drawFluidBody(ctx, padX, topY, innerW, layerH, colors, isTop, isBottom && totalUnits >= opts.capacity - 0.01);

    if (!layer.mystery && layerH > 10) {
      drawBubbles(ctx, padX, topY, innerW, layerH, seed + layer.colorId, phase);
    }

    if (layer.mystery && layerH > 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `bold ${Math.min(16, innerW * 0.45)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', padX + innerW / 2, topY + layerH / 2);
    }

    if (isTop) topSurfaceY = topY;
    bottomY = topY;
  }

  if (opts.ripple && opts.ripple > 0) {
    drawRipple(ctx, padX + innerW / 2, topSurfaceY, innerW, opts.ripple);
  }

  if (opts.selected && layers.length) {
    const top = layers[layers.length - 1];
    if (!top.mystery) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      const topH = top.units * unitH;
      roundRectPath(ctx, padX + 1, topSurfaceY + 1, innerW - 2, Math.max(4, topH - 2), 7, 7, 0, 0);
      ctx.stroke();
    }
  }

  ctx.restore();

  drawInnerShadow(ctx, w, h);
  drawGlassReflection(ctx, w, h, phase);

  if (opts.completed) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(phase * 2) * 0.15;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    const padX2 = w * 0.06;
    const padTop2 = h * 0.04;
    const padBot2 = h * 0.03;
    const r = Math.min(w * 0.22, 14);
    roundRectPath(ctx, padX2, padTop2, w - padX2 * 2, h - padTop2 - padBot2, 4, 4, r, r);
    ctx.stroke();
    ctx.restore();
  }
}

export interface StreamPoint {
  x: number;
  y: number;
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  colorId: number;
  size: number;
}

export function drawLiquidStream(
  ctx: CanvasRenderingContext2D,
  from: StreamPoint,
  to: StreamPoint,
  colorId: number,
  width: number,
  phase: number,
  alpha = 1,
): void {
  const colors = liquidColors(colorId);
  const cx = (from.x + to.x) / 2;
  const cy = Math.max(from.y, to.y) + Math.abs(to.x - from.x) * 0.22 + 32;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  grad.addColorStop(0, colors.light);
  grad.addColorStop(0.45, colors.mid);
  grad.addColorStop(1, colors.dark);

  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(cx, cy, to.x, to.y);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = width * 0.32;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y - 1);
  ctx.quadraticCurveTo(cx, cy - 3, to.x, to.y);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = colors.mid;
  const droplets = 4;
  for (let i = 0; i < droplets; i++) {
    const t = ((phase * 1.8 + i / droplets) % 1);
    const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
    const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
    ctx.beginPath();
    ctx.arc(px, py, width * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawSplashParticles(ctx: CanvasRenderingContext2D, particles: SplashParticle[]): void {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const colors = liquidColors(p.colorId);
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life) * 0.85;
    ctx.fillStyle = colors.mid;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(p.x - p.size * 0.2, p.y - p.size * 0.2, p.size * 0.25 * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class WaterBottleManager {
  private canvases = new Map<number, HTMLCanvasElement>();
  private hiddenBottoms = new Map<number, number>();
  private capacities = new Map<number, number>();
  private rippleUntil = new Map<number, number>();
  private animPhase = 0;

  setAnimPhase(phase: number): void {
    this.animPhase = phase;
  }

  triggerRipple(idx: number, durationMs = 520): void {
    this.rippleUntil.set(idx, performance.now() + durationMs);
  }

  rippleStrength(idx: number): number {
    const until = this.rippleUntil.get(idx);
    if (!until) return 0;
    const left = until - performance.now();
    if (left <= 0) {
      this.rippleUntil.delete(idx);
      return 0;
    }
    return left / 520;
  }

  attach(idx: number, tubeEl: HTMLElement): HTMLCanvasElement {
    let canvas = tubeEl.querySelector('.ws-fluid-canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'ws-fluid-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      tubeEl.insertBefore(canvas, tubeEl.firstChild);
    }
    this.canvases.set(idx, canvas);
    return canvas;
  }

  setMeta(idx: number, capacity: number, hiddenBottom: number): void {
    this.capacities.set(idx, capacity);
    this.hiddenBottoms.set(idx, hiddenBottom);
  }

  render(
    idx: number,
    tube: number[],
    opts?: Partial<BottleDrawOpts> & {
      drainTop?: number;
      drainColor?: number;
      pourColor?: number;
      pourUnits?: number;
    },
  ): void {
    const canvas = this.canvases.get(idx);
    if (!canvas) return;
    const capacity = opts?.capacity ?? this.capacities.get(idx) ?? 4;
    const hiddenBottom = opts?.hiddenBottom ?? this.hiddenBottoms.get(idx) ?? 0;
    const layers = visualLayers(tube, hiddenBottom, {
      drainTop: opts?.drainTop,
      drainColor: opts?.drainColor,
      pourColor: opts?.pourColor,
      pourUnits: opts?.pourUnits,
    });
    drawBottleFluid(canvas, layers, {
      capacity,
      hiddenBottom,
      selected: opts?.selected,
      highlightTop: opts?.highlightTop,
      completed: opts?.completed,
      ripple: opts?.ripple ?? this.rippleStrength(idx),
      animPhase: opts?.animPhase ?? this.animPhase,
      tubeSeed: opts?.tubeSeed ?? idx + 1,
    });
  }

  renderAll(
    tubes: number[][],
    getOpts: (idx: number) => Partial<BottleDrawOpts> & {
      drainTop?: number;
      drainColor?: number;
      pourColor?: number;
      pourUnits?: number;
    },
  ): void {
    tubes.forEach((tube, idx) => {
      this.render(idx, tube, getOpts(idx));
    });
  }

  clear(): void {
    this.canvases.clear();
    this.hiddenBottoms.clear();
    this.capacities.clear();
    this.rippleUntil.clear();
  }
}

export function tubeMouthOnBoard(board: HTMLElement, tubeEl: HTMLElement): StreamPoint {
  const b = board.getBoundingClientRect();
  const r = tubeEl.getBoundingClientRect();
  return { x: r.left - b.left + r.width / 2, y: r.top - b.top + 10 };
}

export function ensureStreamCanvas(board: HTMLElement): HTMLCanvasElement {
  let canvas = board.querySelector('.ws-stream-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'ws-stream-canvas';
    board.appendChild(canvas);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = board.getBoundingClientRect();
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  return canvas;
}

export function clearStreamCanvas(board: HTMLElement): void {
  const canvas = board.querySelector('.ws-stream-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

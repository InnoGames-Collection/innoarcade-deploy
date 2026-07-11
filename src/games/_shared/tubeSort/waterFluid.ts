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
  ripple?: number;
  wobble?: number;
  animPhase?: number;
  tubeSeed?: number;
}

interface LiquidPalette {
  light: string;
  mid: string;
  dark: string;
  glow: string;
  shine: string;
}

const PALETTE: Record<GemId, LiquidPalette> = {
  sapphire: { light: 'rgba(180,215,255,0.92)', mid: 'rgba(55,120,255,0.82)', dark: 'rgba(20,50,140,0.88)', glow: 'rgba(61,122,255,0.4)', shine: 'rgba(220,240,255,0.7)' },
  emerald: { light: 'rgba(150,245,195,0.9)', mid: 'rgba(30,190,90,0.8)', dark: 'rgba(10,90,45,0.88)', glow: 'rgba(34,197,94,0.38)', shine: 'rgba(200,255,230,0.65)' },
  amber: { light: 'rgba(255,235,140,0.92)', mid: 'rgba(245,165,35,0.82)', dark: 'rgba(140,85,5,0.88)', glow: 'rgba(245,166,35,0.35)', shine: 'rgba(255,250,200,0.7)' },
  ruby: { light: 'rgba(255,185,195,0.92)', mid: 'rgba(235,55,55,0.82)', dark: 'rgba(120,15,15,0.88)', glow: 'rgba(239,68,68,0.38)', shine: 'rgba(255,220,225,0.68)' },
  amethyst: { light: 'rgba(225,195,255,0.92)', mid: 'rgba(160,75,240,0.8)', dark: 'rgba(70,20,110,0.88)', glow: 'rgba(168,85,247,0.36)', shine: 'rgba(240,220,255,0.68)' },
  aquamarine: { light: 'rgba(155,250,235,0.9)', mid: 'rgba(15,185,165,0.8)', dark: 'rgba(5,85,75,0.88)', glow: 'rgba(20,184,166,0.36)', shine: 'rgba(190,255,245,0.65)' },
  coral: { light: 'rgba(255,210,170,0.92)', mid: 'rgba(245,110,25,0.82)', dark: 'rgba(130,55,5,0.88)', glow: 'rgba(249,115,22,0.36)', shine: 'rgba(255,230,200,0.68)' },
  violet: { light: 'rgba(215,200,255,0.92)', mid: 'rgba(115,55,235,0.8)', dark: 'rgba(45,15,120,0.88)', glow: 'rgba(124,58,237,0.36)', shine: 'rgba(230,215,255,0.68)' },
};

const MYSTERY: LiquidPalette = {
  light: 'rgba(170,180,195,0.85)',
  mid: 'rgba(85,95,115,0.8)',
  dark: 'rgba(45,52,68,0.88)',
  glow: 'rgba(100,110,130,0.2)',
  shine: 'rgba(200,210,220,0.5)',
};

export function liquidColors(colorId: number): LiquidPalette {
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

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function easeInOutBack(t: number): number {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return t < 0.5
    ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
    : ((2 * t - 2) ** 2 * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
}

function bottleClip(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const padX = w * 0.07;
  const padTop = h * 0.045;
  const padBot = h * 0.035;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBot;
  const rBot = Math.min(innerW * 0.48, 18);
  const rTop = Math.min(5, w * 0.09);
  ctx.beginPath();
  ctx.moveTo(padX + rTop, padTop);
  ctx.lineTo(padX + innerW - rTop, padTop);
  ctx.quadraticCurveTo(padX + innerW, padTop, padX + innerW, padTop + rTop);
  ctx.lineTo(padX + innerW, padTop + innerH - rBot);
  ctx.quadraticCurveTo(padX + innerW, padTop + innerH, padX + innerW - rBot, padTop + innerH);
  ctx.lineTo(padX + rBot, padTop + innerH);
  ctx.quadraticCurveTo(padX, padTop + innerH, padX, padTop + innerH - rBot);
  ctx.lineTo(padX, padTop + rTop);
  ctx.quadraticCurveTo(padX, padTop, padX + rTop, padTop);
  ctx.closePath();
  ctx.clip();
}

function meniscusWave(x: number, w: number, phase: number, wobble: number, ripple: number): number {
  const cx = x + w / 2;
  const edge = Math.sin(phase * 2.8) * wobble * 1.8;
  const rippleW = Math.sin(phase * 5.5 + x * 0.08) * ripple * 1.2;
  const bowl = -w * 0.06 * (1 - Math.abs((cx - (x + w / 2)) / (w / 2)));
  return edge + rippleW + bowl;
}

/** Build a smooth liquid segment path — no rectangular blocks. */
function traceLiquidSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  w: number,
  h: number,
  opts: {
    isTop: boolean;
    isBottom: boolean;
    phase: number;
    wobble: number;
    ripple: number;
  },
): void {
  if (h < 0.3) return;
  const { isTop, isBottom, phase, wobble, ripple } = opts;
  const rBot = isBottom ? Math.min(w * 0.46, h * 0.55, 16) : 0;
  const bottomY = topY + h;

  ctx.beginPath();

  if (isBottom && rBot > 2) {
    ctx.moveTo(x, bottomY - rBot);
    ctx.quadraticCurveTo(x, bottomY, x + rBot, bottomY);
    ctx.lineTo(x + w - rBot, bottomY);
    ctx.quadraticCurveTo(x + w, bottomY, x + w, bottomY - rBot);
  } else {
    const iface = Math.sin(phase * 2.2) * 0.6;
    ctx.moveTo(x, bottomY + iface);
    ctx.lineTo(x + w, bottomY - iface);
  }

  if (isTop) {
    const wv = meniscusWave(x, w, phase, wobble, ripple);
    const edgeH = Math.min(3.5, h * 0.22);
    ctx.lineTo(x + w, topY + edgeH);
    ctx.bezierCurveTo(
      x + w * 0.78, topY + wv - 0.5,
      x + w * 0.55, topY + wv + 1.2,
      x + w * 0.5, topY + wv + 1.8,
    );
    ctx.bezierCurveTo(
      x + w * 0.45, topY + wv + 1.2,
      x + w * 0.22, topY + wv - 0.5,
      x, topY + edgeH,
    );
  } else {
    const iface = Math.sin(phase * 2.5 + topY * 0.05) * 0.8;
    ctx.lineTo(x + w, topY - iface);
    ctx.lineTo(x, topY + iface);
  }

  ctx.closePath();
}

function fillLiquidSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  w: number,
  h: number,
  colors: LiquidPalette,
  opts: {
    isTop: boolean;
    isBottom: boolean;
    phase: number;
    wobble: number;
    ripple: number;
  },
): void {
  traceLiquidSegment(ctx, x, topY, w, h, opts);
  const bottomY = topY + h;

  const bodyGrad = ctx.createLinearGradient(x, topY, x + w * 0.35, bottomY);
  bodyGrad.addColorStop(0, colors.light);
  bodyGrad.addColorStop(0.35, colors.mid);
  bodyGrad.addColorStop(0.75, colors.mid);
  bodyGrad.addColorStop(1, colors.dark);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.save();
  traceLiquidSegment(ctx, x, topY, w, h, opts);
  ctx.clip();

  const depth = ctx.createLinearGradient(x, topY, x + w, topY);
  depth.addColorStop(0, 'rgba(0,0,0,0.18)');
  depth.addColorStop(0.12, 'rgba(0,0,0,0.02)');
  depth.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  depth.addColorStop(0.88, 'rgba(0,0,0,0.02)');
  depth.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = depth;
  ctx.fillRect(x, topY, w, h);

  if (opts.isTop) {
    const wv = meniscusWave(x, w, opts.phase, opts.wobble, opts.ripple);
    const hl = ctx.createRadialGradient(x + w * 0.38, topY + wv, 0, x + w * 0.5, topY + wv + 4, w * 0.62);
    hl.addColorStop(0, colors.shine);
    hl.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, topY - 2, w, Math.min(h, 22));

    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + 1, topY + 2.5);
    ctx.bezierCurveTo(x + w * 0.3, topY + wv, x + w * 0.7, topY + wv + 1, x + w - 1, topY + 2.5);
    ctx.stroke();
  }

  ctx.restore();

  ctx.save();
  traceLiquidSegment(ctx, x, topY, w, h, opts);
  ctx.globalCompositeOperation = 'source-atop';
  const glow = ctx.createLinearGradient(x, topY, x, bottomY);
  glow.addColorStop(0, 'rgba(255,255,255,0.12)');
  glow.addColorStop(0.4, 'rgba(255,255,255,0)');
  glow.addColorStop(1, colors.glow);
  ctx.fillStyle = glow;
  ctx.fillRect(x, topY, w, h);
  ctx.restore();
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
  if (h < 10) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const count = Math.min(5, Math.floor(h / 14) + 1);
  for (let i = 0; i < count; i++) {
    const bx = x + w * (0.15 + ((seed * 17 + i * 41) % 100) / 100 * 0.7);
    const baseY = y + h * (0.2 + ((seed * 23 + i * 59) % 100) / 100 * 0.65);
    const drift = Math.sin(phase * 1.6 + i * 2.1) * 2.5;
    const by = baseY + drift;
    const r = 0.9 + (i % 3) * 0.6;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.3, 0, Math.PI * 2);
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
  phase: number,
): void {
  if (strength <= 0.01) return;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const spread = 1 + i * 0.28 + strength * 0.4;
    const wobble = Math.sin(phase * 4 + i) * strength * 1.5;
    ctx.globalAlpha = strength * (0.5 - i * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.1 - i * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY + 2 + wobble, w * 0.36 * spread, 3 + i * 0.8, 0, 0, Math.PI * 2);
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
  const shimmer = 0.8 + Math.sin(phase * 0.7) * 0.2;
  ctx.save();
  const gx = w * 0.12;
  const gy = h * 0.08;
  const gw = w * 0.22;
  const gh = h * 0.58;
  const grad = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
  grad.addColorStop(0, `rgba(255,255,255,${0.38 * shimmer})`);
  grad.addColorStop(0.4, `rgba(255,255,255,${0.1 * shimmer})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(gx + gw / 2, gy + gh / 2, gw / 2, gh / 2, -0.12, 0, Math.PI * 2);
  ctx.fill();

  const gx2 = w * 0.72;
  ctx.fillStyle = `rgba(255,255,255,${0.06 * shimmer})`;
  ctx.beginPath();
  ctx.ellipse(gx2, h * 0.35, w * 0.06, h * 0.2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawInnerShadow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const padX = w * 0.07;
  const padTop = h * 0.045;
  const padBot = h * 0.035;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBot;
  const rBot = Math.min(innerW * 0.48, 18);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(padX, padTop);
  ctx.lineTo(padX + innerW, padTop);
  ctx.lineTo(padX + innerW, padTop + innerH - rBot);
  ctx.quadraticCurveTo(padX + innerW, padTop + innerH, padX + innerW - rBot, padTop + innerH);
  ctx.lineTo(padX + rBot, padTop + innerH);
  ctx.quadraticCurveTo(padX, padTop + innerH, padX, padTop + innerH - rBot);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.16)');
  grad.addColorStop(0.1, 'rgba(0,0,0,0)');
  grad.addColorStop(0.9, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
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
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const phase = opts.animPhase ?? 0;
  const seed = opts.tubeSeed ?? 1;
  const wobble = opts.wobble ?? 0;
  const ripple = opts.ripple ?? 0;

  ctx.save();
  bottleClip(ctx, w, h);

  const padX = w * 0.085;
  const innerW = w - padX * 2;
  const padTop = h * 0.05;
  const padBot = h * 0.042;
  const innerH = h - padTop - padBot;
  const unitH = innerH / opts.capacity;
  const tubeBottomY = h - padBot;

  let bottomY = tubeBottomY;
  const totalUnits = layers.reduce((s, l) => s + l.units, 0);
  let topSurfaceY = bottomY;

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerH = layer.units * unitH;
    const topY = bottomY - layerH;
    const isTop = i === layers.length - 1;
    const isBottom = i === 0;
    const colors = layer.mystery ? MYSTERY : liquidColors(layer.colorId);

    if (layer.mystery) {
      traceLiquidSegment(ctx, padX, topY, innerW, layerH, {
        isTop, isBottom: isBottom && totalUnits >= opts.capacity - 0.01,
        phase, wobble: isTop ? wobble : 0, ripple: isTop ? ripple : 0,
      });
      ctx.fillStyle = 'rgba(90,100,120,0.75)';
      ctx.fill();
      if (layerH > 8) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `bold ${Math.min(16, innerW * 0.45)}px system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', padX + innerW / 2, topY + layerH / 2);
      }
    } else {
      fillLiquidSegment(ctx, padX, topY, innerW, layerH, colors, {
        isTop,
        isBottom: isBottom && totalUnits >= opts.capacity - 0.01,
        phase,
        wobble: isTop ? wobble : 0,
        ripple: isTop ? ripple : 0,
      });
      if (layerH > 8) {
        drawBubbles(ctx, padX, topY, innerW, layerH, seed + layer.colorId, phase);
      }
    }

    if (isTop) topSurfaceY = topY;
    bottomY = topY;
  }

  if (wobble > 0.01 && layers.length) {
    drawRipple(ctx, padX + innerW / 2, topSurfaceY, innerW, wobble * 0.7, phase);
  } else if (ripple > 0.01 && layers.length) {
    drawRipple(ctx, padX + innerW / 2, topSurfaceY, innerW, ripple, phase);
  }

  ctx.restore();

  drawInnerShadow(ctx, w, h);
  drawGlassReflection(ctx, w, h, phase);

  if (opts.completed) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(phase * 2) * 0.12;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    const padX2 = w * 0.07;
    const padTop2 = h * 0.045;
    const padBot2 = h * 0.035;
    const innerW2 = w - padX2 * 2;
    const innerH2 = h - padTop2 - padBot2;
    const rBot = Math.min(innerW2 * 0.48, 18);
    ctx.beginPath();
    ctx.moveTo(padX2 + 4, padTop2);
    ctx.lineTo(padX2 + innerW2 - 4, padTop2);
    ctx.lineTo(padX2 + innerW2, padTop2 + innerH2 - rBot);
    ctx.quadraticCurveTo(padX2 + innerW2, padTop2 + innerH2, padX2 + innerW2 - rBot, padTop2 + innerH2);
    ctx.lineTo(padX2 + rBot, padTop2 + innerH2);
    ctx.quadraticCurveTo(padX2, padTop2 + innerH2, padX2, padTop2 + innerH2 - rBot);
    ctx.closePath();
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

export interface StreamDrawOpts {
  phase: number;
  alpha?: number;
  /** 0–1 how much has been poured so far */
  progress?: number;
}

function streamCurvePoints(
  from: StreamPoint,
  to: StreamPoint,
  phase: number,
  segments = 24,
): StreamPoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const cx = (from.x + to.x) / 2 + dx * 0.04;
  const cy = Math.max(from.y, to.y) + dist * 0.35 + Math.abs(dx) * 0.18 + Math.sin(phase * 1.8) * 2;
  const points: StreamPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const ease = t * t * (3 - 2 * t);
    const px = (1 - ease) * (1 - ease) * from.x + 2 * (1 - ease) * ease * cx + ease * ease * to.x;
    const py = (1 - ease) * (1 - ease) * from.y + 2 * (1 - ease) * ease * cy + ease * ease * to.y;
    const wobble = Math.sin(phase * 5 + t * 10) * (1.2 - t * 0.8);
    points.push({ x: px + wobble, y: py });
  }
  return points;
}

export function drawLiquidStream(
  ctx: CanvasRenderingContext2D,
  from: StreamPoint,
  to: StreamPoint,
  colorId: number,
  baseWidth: number,
  phase: number,
  alpha = 1,
  opts?: StreamDrawOpts,
): void {
  const colors = liquidColors(colorId);
  const progress = opts?.progress ?? 1;
  const points = streamCurvePoints(from, to, phase);
  const n = points.length;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const left: StreamPoint[] = [];
  const right: StreamPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const taper = (1 - t * 0.55) * (0.55 + progress * 0.45);
    const w = baseWidth * taper;
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    left.push({ x: p.x + nx * w * 0.5, y: p.y + ny * w * 0.5 });
    right.push({ x: p.x - nx * w * 0.5, y: p.y - ny * w * 0.5 });
  }

  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();

  const streamGrad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  streamGrad.addColorStop(0, colors.light);
  streamGrad.addColorStop(0.35, colors.mid);
  streamGrad.addColorStop(0.85, colors.dark);
  ctx.fillStyle = streamGrad;
  ctx.globalAlpha = alpha * 0.88;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  ctx.strokeStyle = colors.shine;
  ctx.lineWidth = baseWidth * 0.18;
  ctx.globalAlpha = alpha * 0.55;
  ctx.stroke();

  const sourceBulge = baseWidth * 0.72;
  const srcGrad = ctx.createRadialGradient(from.x, from.y, 0, from.x, from.y, sourceBulge);
  srcGrad.addColorStop(0, colors.mid);
  srcGrad.addColorStop(0.6, colors.light);
  srcGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = srcGrad;
  ctx.beginPath();
  ctx.ellipse(from.x, from.y + 2, sourceBulge * 0.55, sourceBulge * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = colors.glow;
  ctx.beginPath();
  ctx.ellipse(to.x, to.y + 3, baseWidth * 0.65, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.65;
  ctx.fillStyle = colors.mid;
  const droplets = 8;
  for (let i = 0; i < droplets; i++) {
    const t = ((phase * 2.5 + i / droplets) % 1) * progress;
    const idx = Math.min(n - 2, Math.floor(t * (n - 1)));
    const frac = t * (n - 1) - idx;
    const px = points[idx].x + (points[idx + 1].x - points[idx].x) * frac;
    const py = points[idx].y + (points[idx + 1].y - points[idx].y) * frac;
    const dr = baseWidth * (0.08 + 0.05 * Math.sin(phase * 3 + i));
    ctx.beginPath();
    ctx.ellipse(px, py, dr, dr * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawSplashParticles(ctx: CanvasRenderingContext2D, particles: readonly SplashParticle[]): void {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const colors = liquidColors(p.colorId);
    const life = Math.min(1, p.life);
    ctx.save();
    ctx.globalAlpha = life * 0.8;
    const r = p.size * life;
    const grad = ctx.createRadialGradient(p.x - r * 0.2, p.y - r * 0.2, 0, p.x, p.y, r);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.5, colors.mid);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.5 * life})`;
    ctx.beginPath();
    ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawLandingRipple(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  colorId: number,
  strength: number,
  phase: number,
): void {
  if (strength <= 0) return;
  const colors = liquidColors(colorId);
  ctx.save();
  ctx.globalAlpha = strength * 0.35;
  ctx.strokeStyle = colors.shine;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    const spread = 1 + i * 0.4 + Math.sin(phase * 3) * 0.15;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, width * 0.5 * spread, 3.5 * spread, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export class SplashPool {
  private pool: SplashParticle[] = [];
  private active: SplashParticle[] = [];

  spawn(x: number, y: number, colorId: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() ?? {
        x: 0, y: 0, vx: 0, vy: 0, life: 1, colorId: 1, size: 2,
      };
      const angle = -Math.PI * 0.9 + Math.random() * Math.PI * 0.8;
      const speed = 0.8 + Math.random() * 2.2;
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1.2;
      p.life = 1;
      p.colorId = colorId;
      p.size = 1.5 + Math.random() * 2;
      this.active.push(p);
    }
  }

  tick(): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.98;
      p.life -= 0.038;
      if (p.life <= 0) {
        this.active.splice(i, 1);
        if (this.pool.length < 64) this.pool.push(p);
      }
    }
  }

  get particles(): readonly SplashParticle[] {
    return this.active;
  }

  clear(): void {
    while (this.active.length) {
      const p = this.active.pop()!;
      if (this.pool.length < 64) this.pool.push(p);
    }
  }
}

export class WaterBottleManager {
  private canvases = new Map<number, HTMLCanvasElement>();
  private hiddenBottoms = new Map<number, number>();
  private capacities = new Map<number, number>();
  private rippleUntil = new Map<number, number>();
  private wobbleUntil = new Map<number, number>();
  private animPhase = 0;

  setAnimPhase(phase: number): void {
    this.animPhase = phase;
  }

  triggerRipple(idx: number, durationMs = 680): void {
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
    const t = left / 680;
    return t * t;
  }

  triggerWobble(idx: number, durationMs = 900): void {
    this.wobbleUntil.set(idx, performance.now() + durationMs);
  }

  wobbleStrength(idx: number): number {
    const until = this.wobbleUntil.get(idx);
    if (!until) return 0;
    const left = until - performance.now();
    if (left <= 0) {
      this.wobbleUntil.delete(idx);
      return 0;
    }
    const t = left / 900;
    return t * t * (1 + Math.sin(left * 0.02) * 0.15);
  }

  triggerWobbleAll(count: number): void {
    for (let i = 0; i < count; i++) this.triggerWobble(i, 520);
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
    if (!tubeEl.querySelector('.ws-pour-anchor')) {
      const anchor = document.createElement('span');
      anchor.className = 'ws-pour-anchor';
      anchor.setAttribute('aria-hidden', 'true');
      tubeEl.appendChild(anchor);
    }
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
      wobble: opts?.wobble ?? this.wobbleStrength(idx),
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
    this.wobbleUntil.clear();
  }
}

export function tubeMouthOnBoard(board: HTMLElement, tubeEl: HTMLElement): StreamPoint {
  const b = board.getBoundingClientRect();
  const anchor = tubeEl.querySelector('.ws-pour-anchor') as HTMLElement | null;
  const r = anchor ? anchor.getBoundingClientRect() : tubeEl.getBoundingClientRect();
  return {
    x: r.left - b.left + r.width / 2,
    y: r.top - b.top + (anchor ? r.height * 0.5 : 10),
  };
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

// Premium illustrated entities — realistic procedural canvas art.

import { CELL, W } from '../types';
import type { VehicleKind } from '../types';

function shade(hex: string, f: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function bodyGrad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _w: number,
  h: number,
  light: string,
  mid: string,
  dark: string,
): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  r: number,
  rot: number,
  simple: boolean,
): void {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.9, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const tire = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  tire.addColorStop(0, '#3a3a3a');
  tire.addColorStop(0.7, '#1a1a1a');
  tire.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = tire;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  if (!simple) {
    const rim = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * 0.62);
    rim.addColorStop(0, '#e8e8e8');
    rim.addColorStop(0.5, '#b0b0b0');
    rim.addColorStop(1, '#707070');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const VEHICLE_STYLE: Record<VehicleKind, { light: string; mid: string; dark: string; glass: string }> = {
  sedan: { light: '#6eb5ff', mid: '#2980d9', dark: '#1a5276', glass: '#c8ecff' },
  suv: { light: '#95a5b8', mid: '#5d6d7e', dark: '#2c3e50', glass: '#dfe6ed' },
  taxi: { light: '#ffe566', mid: '#f1c40f', dark: '#b7950b', glass: '#fff8dc' },
  bus: { light: '#ffb347', mid: '#e67e22', dark: '#a04000', glass: '#fff0d8' },
  police: { light: '#f8f9fa', mid: '#dfe6e9', dark: '#636e72', glass: '#b8d4f0' },
  van: { light: '#ffffff', mid: '#ecf0f1', dark: '#bdc3c7', glass: '#dff9ff' },
  minibus: { light: '#5dade2', mid: '#1f74e0', dark: '#0d4a9e', glass: '#d6eaff' },
};

function drawCarWindows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  glass: string,
  count: number,
): void {
  const pad = w * 0.08;
  const winW = (w - pad * 2 - (count - 1) * 4) / count;
  for (let i = 0; i < count; i++) {
    const wx = x + pad + i * (winW + 4);
    const g = ctx.createLinearGradient(wx, y, wx, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, glass);
    g.addColorStop(1, shade(glass, 0.65));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(wx, y, winW, h, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.roundRect(wx + 2, y + 2, winW * 0.35, h * 0.35, 2);
    ctx.fill();
  }
}

function drawHeadlights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  right: boolean,
): void {
  const hx = right ? x + w - 6 : x + 2;
  const g = ctx.createRadialGradient(hx + 3, y + h / 2, 1, hx + 3, y + h / 2, 8);
  g.addColorStop(0, '#fffde7');
  g.addColorStop(0.4, '#fff59d');
  g.addColorStop(1, 'rgba(255,245,157,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(hx + 3, y + h / 2, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff9c4';
  ctx.beginPath();
  ctx.roundRect(hx, y + 1, 6, h - 2, 2);
  ctx.fill();
}

export function drawIllustratedChicken(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  arcZ: number,
  squash: { sx: number; sy: number },
  animT: number,
): void {
  const u = unit;
  const groundY = cy + u * 0.2 - arcZ;
  const breathe = 1 + Math.sin(animT * 2.4) * 0.025;
  const blink = Math.sin(animT * 0.85) > 0.93;
  const legPhase = Math.sin(animT * 8) * 2;

  ctx.save();
  ctx.translate(cx, cy - arcZ * 0.5);
  ctx.scale(squash.sx * breathe, squash.sy * breathe);
  ctx.translate(-cx, -(cy - arcZ * 0.5));

  // Shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + u * 0.08, u * 0.28, u * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legY = groundY - u * 0.02;
  ctx.strokeStyle = '#e67e22';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const lx = cx + side * u * 0.1;
    ctx.beginPath();
    ctx.moveTo(lx, legY - u * 0.12);
    ctx.lineTo(lx + side * legPhase * 0.3, legY);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(lx + side * legPhase * 0.3, legY);
    ctx.lineTo(lx + side * legPhase * 0.3 - 4, legY + 3);
    ctx.moveTo(lx + side * legPhase * 0.3, legY);
    ctx.lineTo(lx + side * legPhase * 0.3 + 1, legY + 3);
    ctx.stroke();
    ctx.lineWidth = 2.4;
  }

  // Tail feathers
  ctx.save();
  ctx.translate(cx - u * 0.22, groundY - u * 0.28);
  for (let i = 0; i < 4; i++) {
    const a = -0.6 + i * 0.22;
    const len = u * 0.22;
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, '#f5f5f5');
    g.addColorStop(1, '#d5d5d5');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a - 0.2) * len * 0.6, Math.sin(a - 0.2) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len);
    ctx.quadraticCurveTo(Math.cos(a + 0.15) * len * 0.5, Math.sin(a + 0.15) * len * 0.5, 0, 0);
    ctx.fill();
  }
  ctx.restore();

  // Body
  const bodyGrad = ctx.createRadialGradient(cx - u * 0.12, groundY - u * 0.38, u * 0.05, cx, groundY - u * 0.3, u * 0.34);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.55, '#f2f2f2');
  bodyGrad.addColorStop(1, '#d8d8d8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(cx, groundY - u * 0.3, u * 0.3, u * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Feather texture
  ctx.strokeStyle = 'rgba(180,180,180,0.35)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const fx = cx + (i - 2.5) * u * 0.08;
    ctx.beginPath();
    ctx.moveTo(fx, groundY - u * 0.18);
    ctx.quadraticCurveTo(fx + 3, groundY - u * 0.32, fx + 1, groundY - u * 0.42);
    ctx.stroke();
  }

  // Wing
  const wingGrad = ctx.createLinearGradient(cx + u * 0.05, groundY - u * 0.42, cx + u * 0.28, groundY - u * 0.18);
  wingGrad.addColorStop(0, '#ececec');
  wingGrad.addColorStop(1, '#c8c8c8');
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.ellipse(cx + u * 0.16, groundY - u * 0.3, u * 0.14, u * 0.1, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Head
  const hx = cx + u * 0.2;
  const hy = groundY - u * 0.44;
  const headGrad = ctx.createRadialGradient(hx - 3, hy - 4, 2, hx, hy, u * 0.16);
  headGrad.addColorStop(0, '#ffffff');
  headGrad.addColorStop(1, '#e8e8e8');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(hx, hy, u * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Comb
  ctx.fillStyle = '#c0392b';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(hx - u * 0.04 + i * u * 0.07, hy - u * 0.14 - (i % 2) * 2, u * 0.04, u * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wattle
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.ellipse(hx + u * 0.02, hy + u * 0.1, u * 0.035, u * 0.05, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  const beakGrad = ctx.createLinearGradient(hx, hy, hx + u * 0.14, hy + u * 0.04);
  beakGrad.addColorStop(0, '#f9d71c');
  beakGrad.addColorStop(1, '#e67e22');
  ctx.fillStyle = beakGrad;
  ctx.beginPath();
  ctx.moveTo(hx + u * 0.1, hy + u * 0.02);
  ctx.lineTo(hx + u * 0.22, hy + u * 0.05);
  ctx.lineTo(hx + u * 0.1, hy + u * 0.09);
  ctx.closePath();
  ctx.fill();

  // Eye
  if (!blink) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(hx + u * 0.04, hy - u * 0.02, u * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx + u * 0.055, hy - u * 0.035, u * 0.012, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx, hy - u * 0.02);
    ctx.lineTo(hx + u * 0.08, hy - u * 0.02);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawIllustratedVehicle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gridSpan: number,
  kind: VehicleKind,
  facingRight: boolean,
  unit: number,
  animT: number,
  simple = false,
): void {
  const span = Math.max(0.85, Math.abs(gridSpan));
  const bounce = Math.sin(animT * 10 + cx * 0.05) * 1.2;
  const groundY = cy + unit * 0.18 + bounce;
  const style = VEHICLE_STYLE[kind];
  const isTrain = kind === 'bus' && span > 1.6;
  const bodyW = Math.min(W * 0.95, span * CELL * 0.94);
  const bodyH = kind === 'bus' || kind === 'minibus' ? unit * 0.44 : unit * 0.36;
  const x = cx - bodyW / 2;
  const y = groundY - bodyH;
  const wheelR = unit * 0.09;
  const wheelRot = animT * 12;

  ctx.save();
  if (!facingRight) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }

  // Underbody shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + wheelR * 0.2, bodyW * 0.42, wheelR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels (behind body)
  const wheelSlots = isTrain
    ? [-0.38, -0.22, -0.06, 0.1, 0.26, 0.38]
    : kind === 'bus' || kind === 'minibus'
      ? [-0.32, -0.1, 0.1, 0.32]
      : [-0.28, 0.28];
  for (const slot of wheelSlots) {
    drawWheel(ctx, cx + slot * bodyW, groundY - wheelR * 0.15, wheelR, wheelRot, simple);
  }

  // Body
  const grad = bodyGrad(ctx, x, y, bodyW, bodyH, style.light, style.mid, style.dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y + bodyH * 0.12, bodyW, bodyH * 0.88, kind === 'van' ? 4 : 7);
  ctx.fill();

  // Roof / cabin
  if (kind !== 'van') {
    ctx.fillStyle = bodyGrad(ctx, x, y, bodyW, bodyH * 0.5, style.light, style.mid, style.dark);
    ctx.beginPath();
    ctx.roundRect(x + bodyW * 0.12, y, bodyW * 0.76, bodyH * 0.55, 6);
    ctx.fill();
  }

  if (!simple) {
    // Windows
    const winY = y + bodyH * 0.14;
    const winH = bodyH * 0.28;
    const winCount = isTrain ? 5 : kind === 'bus' || kind === 'minibus' ? 4 : 2;
    drawCarWindows(ctx, x, winY, bodyW, winH, style.glass, winCount);

    // Kind-specific details
    if (kind === 'taxi') {
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(x + bodyW * 0.35, y - unit * 0.06, bodyW * 0.3, unit * 0.07);
      ctx.fillStyle = '#111';
      ctx.font = `bold ${unit * 0.1}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', x + bodyW * 0.5, y - unit * 0.01);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + bodyW * 0.15 + i * bodyW * 0.18, y + bodyH * 0.72, bodyW * 0.08, bodyH * 0.08);
      }
    } else if (kind === 'police') {
      const flash = Math.sin(animT * 16) > 0;
      ctx.fillStyle = flash ? '#3498db' : '#e74c3c';
      ctx.fillRect(x + bodyW * 0.32, y - unit * 0.05, bodyW * 0.36, unit * 0.06);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(x, y + bodyH * 0.55, bodyW, bodyH * 0.18);
    } else if (kind === 'van') {
      drawCarWindows(ctx, x, y + bodyH * 0.18, bodyW, bodyH * 0.22, style.glass, 2);
      ctx.fillStyle = '#1f74e0';
      ctx.fillRect(x + bodyW * 0.08, y + bodyH * 0.55, bodyW * 0.2, unit * 0.06);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x + bodyW * 0.72, y + bodyH * 0.55, bodyW * 0.12, unit * 0.06);
    } else if (isTrain) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 1; i < 5; i++) {
        ctx.fillRect(x + i * (bodyW / 5) - 1, y + bodyH * 0.12, 2, bodyH * 0.88);
      }
    }

    // Chrome trim
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + bodyH * 0.62);
    ctx.lineTo(x + bodyW - 4, y + bodyH * 0.62);
    ctx.stroke();

    // Headlights & taillights
    drawHeadlights(ctx, x, y + bodyH * 0.58, bodyW, bodyH * 0.2, true);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + bodyH * 0.62, 5, bodyH * 0.14, 2);
    ctx.fill();

    // Body highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + bodyW * 0.28, y + bodyH * 0.28, bodyW * 0.14, bodyH * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawIllustratedLog(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gridSpan: number,
  unit: number,
  animT: number,
  gridCx: number,
): void {
  const span = Math.max(0.7, Math.abs(gridSpan));
  const bob = Math.sin(animT * 2.2 + gridCx * 0.8) * 2;
  const groundY = cy + unit * 0.14 + bob;
  const logW = span * CELL * 0.92;
  const logH = unit * 0.3;
  const x = cx - logW / 2;
  const y = groundY - logH;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 3, logW * 0.44, unit * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  const bark = ctx.createLinearGradient(x, y, x, y + logH);
  bark.addColorStop(0, '#8B5A2B');
  bark.addColorStop(0.3, '#6d4422');
  bark.addColorStop(0.7, '#5c3a1e');
  bark.addColorStop(1, '#4a2e18');
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.roundRect(x, y, logW, logH, logH * 0.45);
  ctx.fill();

  // Bark grooves
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const lx = x + logW * (0.1 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(lx, y + 2);
    ctx.bezierCurveTo(lx + 2, y + logH * 0.4, lx - 2, y + logH * 0.7, lx + 1, y + logH - 2);
    ctx.stroke();
  }

  // End caps (wood rings)
  for (const side of [-1, 1] as const) {
    const ex = side < 0 ? x + 3 : x + logW - 3;
    const ringGrad = ctx.createRadialGradient(ex, groundY - logH / 2, 1, ex, groundY - logH / 2, logH * 0.42);
    ringGrad.addColorStop(0, '#c4884a');
    ringGrad.addColorStop(0.35, '#8B5A2B');
    ringGrad.addColorStop(0.7, '#5c3418');
    ringGrad.addColorStop(1, '#3d2210');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.ellipse(ex, groundY - logH / 2, logH * 0.38, logH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let r = 1; r <= 3; r++) {
      ctx.strokeStyle = `rgba(60,35,15,${0.15 + r * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ex, groundY - logH / 2, logH * 0.12 * r, logH * 0.13 * r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Wet sheen
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(cx, y + logH * 0.25, logW * 0.35, logH * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawIllustratedCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  animT: number,
  col: number,
): void {
  const bob = Math.sin(animT * 4 + col * 1.3) * 5;
  const spin = animT * 3 + col;
  const y = cy + bob;
  const rx = unit * 0.24 * (0.5 + Math.abs(Math.cos(spin)) * 0.5);
  const ry = unit * 0.26;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, y + unit * 0.22, rx, unit * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  const face = ctx.createLinearGradient(cx - rx, y - ry, cx + rx, y + ry);
  face.addColorStop(0, '#fff0a0');
  face.addColorStop(0.35, '#ffd700');
  face.addColorStop(0.65, '#f1c40f');
  face.addColorStop(1, '#b8860b');
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#9a7209';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffe566';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.25, y - ry * 0.3, rx * 0.2, ry * 0.15, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b6914';
  ctx.font = `bold ${Math.max(11, unit * 0.28)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cx, y + 1);

  ctx.restore();
}

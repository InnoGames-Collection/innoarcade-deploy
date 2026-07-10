// Pseudo-3D voxel primitives for premium Crossy Road entities.

import { COS30, SIN30 } from '../iso';
import type { VehicleKind } from '../types';

interface Point {
  x: number;
  y: number;
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  fill: string,
): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function shadeColor(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function isoOffset(dgx: number, dgy: number, scale: number): Point {
  return {
    x: (dgx - dgy) * COS30 * scale,
    y: (dgx + dgy) * SIN30 * scale,
  };
}

export function draw3DBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  width: number,
  length: number,
  height: number,
  color: string,
  unitScale = 1,
): void {
  const hw = width / 2;
  const hl = length / 2;
  const baseY = y - z;
  const pt = (dgx: number, dgy: number, lift: number): Point => {
    const o = isoOffset(dgx, dgy, unitScale);
    return { x: x + o.x, y: baseY + o.y - lift };
  };
  const nw = pt(-hw, -hl, height);
  const ne = pt(hw, -hl, height);
  const se = pt(hw, hl, height);
  const sw = pt(-hw, hl, height);
  const neB = pt(hw, -hl, 0);
  const seB = pt(hw, hl, 0);
  const swB = pt(-hw, hl, 0);
  fillQuad(ctx, neB, seB, se, ne, shadeColor(color, 0.72));
  fillQuad(ctx, seB, swB, sw, se, shadeColor(color, 0.52));
  fillQuad(ctx, nw, ne, se, sw, color);
}

const VEHICLE_PAL: Record<VehicleKind, { body: string; accent: string; trim: string }> = {
  sedan: { body: '#3498db', accent: '#dff4ff', trim: '#1f5f8b' },
  suv: { body: '#5d6d7e', accent: '#ecf0f1', trim: '#2c3e50' },
  taxi: { body: '#f1c40f', accent: '#fff8dc', trim: '#b7950b' },
  bus: { body: '#e67e22', accent: '#fff4e6', trim: '#a04000' },
  police: { body: '#ecf0f1', accent: '#3498db', trim: '#2c3e50' },
  van: { body: '#ffffff', accent: '#e67e22', trim: '#d35400' },
  minibus: { body: '#1f74e0', accent: '#f4f8ff', trim: '#0d4a9e' },
};

export function drawVoxelChicken(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  arcZ: number,
  squash: { sx: number; sy: number },
  animT: number,
): void {
  const footY = cy + unit * 0.22;
  const breathe = 1 + Math.sin(animT * 2.4) * 0.03;
  const blink = Math.sin(animT * 0.9) > 0.92;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squash.sx * breathe, squash.sy * breathe);
  ctx.translate(-cx, -cy);

  draw3DBox(ctx, cx, footY, arcZ + 1, 0.52, 0.48, unit * 0.58, '#f8f8f8', unit);
  draw3DBox(ctx, cx - unit * 0.04, footY - unit * 0.06, arcZ + unit * 0.58, 0.2, 0.16, unit * 0.22, '#e74c3c', unit);
  draw3DBox(ctx, cx + unit * 0.24, footY - unit * 0.02, arcZ + unit * 0.18, 0.14, 0.1, unit * 0.12, '#f2c40a', unit);
  if (!blink) {
    draw3DBox(ctx, cx + unit * 0.14, footY - unit * 0.1, arcZ + unit * 0.38, 0.09, 0.07, unit * 0.08, '#2c2c2c', unit);
  }
  draw3DBox(ctx, cx - unit * 0.18, footY + unit * 0.02, arcZ + unit * 0.08, 0.1, 0.08, unit * 0.1, '#f2c40a', unit);

  ctx.restore();
}

export function drawVoxelVehicle(
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
  const footY = cy + unit * 0.18 + bounce;
  const pal = VEHICLE_PAL[kind];
  const bodyH = kind === 'bus' ? unit * 0.52 : unit * 0.44;

  ctx.save();
  if (!facingRight) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }

  draw3DBox(ctx, cx, footY, 2, span * 0.96, 0.54, bodyH, pal.body, unit);

  if (!simple) {
    if (kind === 'van') {
      draw3DBox(ctx, cx, footY - unit * 0.02, unit * 0.48, span * 0.82, 0.5, unit * 0.14, pal.accent, unit);
      draw3DBox(ctx, cx, footY - unit * 0.04, bodyH + 3, span * 0.22, 0.08, unit * 0.06, '#1f74e0', unit);
      draw3DBox(ctx, cx + span * unit * 0.28, footY - unit * 0.04, bodyH + 3, span * 0.12, 0.08, unit * 0.06, '#27ae60', unit);
    } else if (kind === 'taxi') {
      draw3DBox(ctx, cx, footY - unit * 0.02, bodyH + 2, span * 0.5, 0.12, unit * 0.08, '#2c2c2c', unit);
    } else if (kind === 'police') {
      draw3DBox(ctx, cx, footY - unit * 0.04, bodyH + 4, span * 0.35, 0.1, unit * 0.08, '#3498db', unit);
      draw3DBox(ctx, cx, footY - unit * 0.04, bodyH + 4, span * 0.12, 0.08, unit * 0.06, '#e74c3c', unit);
    } else {
      const winCount = kind === 'bus' ? 4 : 2;
      for (let i = 0; i < winCount; i++) {
        const wx = cx + (i - (winCount - 1) / 2) * span * unit * 0.22;
        draw3DBox(ctx, wx, footY - unit * 0.04, bodyH + 3, 0.18, 0.14, unit * 0.1, pal.accent, unit);
      }
    }
    draw3DBox(ctx, cx, footY - unit * 0.02, bodyH + 1, span * 0.98, 0.08, unit * 0.06, pal.trim, unit);
  }

  const wheelN = simple ? 2 : (kind === 'bus' ? 4 : 2);
  const slots = wheelN === 4 ? [-0.32, -0.1, 0.1, 0.32] : [-0.22, 0.22];
  if (!simple) {
    const wheelRot = animT * 8;
    for (const slot of slots) {
      const wx = cx + slot * span * unit;
      draw3DBox(ctx, wx, footY + unit * 0.08, 0, 0.14, 0.12, unit * 0.14, '#1a1a1a', unit);
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(wx + Math.cos(wheelRot) * 2, footY + unit * 0.14, 2, 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (const slot of slots) {
      const wx = cx + slot * span * unit;
      draw3DBox(ctx, wx, footY + unit * 0.08, 0, 0.14, 0.12, unit * 0.12, '#1a1a1a', unit);
    }
  }

  ctx.restore();
}

export function drawVoxelLog(
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
  const footY = cy + unit * 0.16 + bob;
  draw3DBox(ctx, cx, footY, 1, span * 0.95, 0.44, unit * 0.3, '#a0622a', unit);
  draw3DBox(ctx, cx - span * unit * 0.38, footY, unit * 0.22, 0.1, 0.38, unit * 0.08, '#5c3418', unit);
  draw3DBox(ctx, cx + span * unit * 0.38, footY, unit * 0.22, 0.1, 0.38, unit * 0.08, '#5c3418', unit);
  for (let i = -2; i <= 2; i++) {
    ctx.strokeStyle = 'rgba(60,40,20,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + i * span * unit * 0.15, footY - unit * 0.08);
    ctx.lineTo(cx + i * span * unit * 0.15, footY + unit * 0.1);
    ctx.stroke();
  }
}

export function drawVoxelCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  unit: number,
  animT: number,
  col: number,
): void {
  const bob = Math.sin(animT * 4 + col * 1.3) * 4;
  const spin = animT * 3 + col;
  const footY = cy + unit * 0.1 + bob;
  const thick = 0.08 + Math.abs(Math.cos(spin)) * 0.06;

  draw3DBox(ctx, cx, footY, 6, 0.22, thick, unit * 0.2, '#f1c40f', unit);
  draw3DBox(ctx, cx, footY - unit * 0.02, unit * 0.18, 0.18, thick * 0.9, unit * 0.04, '#f9e076', unit);

  ctx.fillStyle = '#d4a017';
  ctx.font = `bold ${Math.max(7, unit * 0.16)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cx, footY - unit * 0.08);
}

export function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.22,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

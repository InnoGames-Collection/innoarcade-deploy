// Isometric 3D terrain slabs — grass, road, river.

import type { RowKind } from '../types';

type Corner = { x: number; y: number };

export const SLAB_DEPTH = 14;

interface SlabPalette {
  topLight: string;
  topDark: string;
  eastFace: string;
  southFace: string;
}

const PALETTES: Record<RowKind | 'grassStart', SlabPalette> = {
  grass: {
    topLight: '#8ed85c',
    topDark: '#6eb844',
    eastFace: '#4a9a38',
    southFace: '#3d8230',
  },
  grassStart: {
    topLight: '#7ec850',
    topDark: '#5a9a3e',
    eastFace: '#428a32',
    southFace: '#357028',
  },
  road: {
    topLight: '#6a6a6a',
    topDark: '#434343',
    eastFace: '#2e2e2e',
    southFace: '#252525',
  },
  river: {
    topLight: '#6ec8f0',
    topDark: '#2980b9',
    eastFace: '#1f6f9f',
    southFace: '#185a82',
  },
};

function fillQuad(
  ctx: CanvasRenderingContext2D,
  a: Corner,
  b: Corner,
  c: Corner,
  d: Corner,
  fill: string | CanvasGradient,
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

function traceDiamond(ctx: CanvasRenderingContext2D, corners: [Corner, Corner, Corner, Corner]): void {
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
}

function paletteFor(kind: RowKind, isStart: boolean): SlabPalette {
  if (kind === 'grass' && isStart) return PALETTES.grassStart;
  return PALETTES[kind];
}

export function drawSlabSides(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  palette: SlabPalette,
  depth = SLAB_DEPTH,
): void {
  const [, ne, se, sw] = corners;
  const drop = (c: Corner): Corner => ({ x: c.x, y: c.y + depth });
  const neB = drop(ne);
  const seB = drop(se);
  const swB = drop(sw);
  fillQuad(ctx, ne, se, seB, neB, palette.eastFace);
  fillQuad(ctx, se, sw, swB, seB, palette.southFace);
}

export function drawSlabTop(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  palette: SlabPalette,
): void {
  const cx = (corners[0].x + corners[2].x) / 2;
  const g = ctx.createLinearGradient(cx, corners[0].y, cx, corners[2].y);
  g.addColorStop(0, palette.topLight);
  g.addColorStop(1, palette.topDark);
  traceDiamond(ctx, corners);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function drawRoadMarking(ctx: CanvasRenderingContext2D, corners: [Corner, Corner, Corner, Corner]): void {
  const mid = { x: (corners[1].x + corners[3].x) / 2, y: (corners[1].y + corners[3].y) / 2 };
  const tip = { x: (corners[0].x + corners[2].x) / 2, y: (corners[0].y + corners[2].y) / 2 };
  ctx.strokeStyle = 'rgba(240,192,64,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(mid.x, mid.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRiverShimmer(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  animT: number,
  col: number,
): void {
  const cy = (corners[0].y + corners[2].y) / 2;
  const cx = corners[1].x + ((animT * 36 + col * 19) % 40) - 20;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 10, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTerrainCell(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  kind: import('../types').RowKind,
  opts: { isStart?: boolean; animT?: number; col?: number; sidesOnly?: boolean; topOnly?: boolean },
): void {
  const palette = paletteFor(kind, !!opts.isStart);
  if (!opts.topOnly) drawSlabSides(ctx, corners, palette);
  if (!opts.sidesOnly) {
    drawSlabTop(ctx, corners, palette);
    if (kind === 'road') drawRoadMarking(ctx, corners);
    if (kind === 'river' && opts.animT !== undefined && opts.col !== undefined) {
      drawRiverShimmer(ctx, corners, opts.animT, opts.col);
    }
  }
}

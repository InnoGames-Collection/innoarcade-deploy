// Isometric 3D terrain slabs — premium grass, road, river (Phase 2).

import type { RowKind } from '../types';
import { cellHash, cellRand } from './cellHash';

type Corner = { x: number; y: number };

export const SLAB_DEPTH = 14;

interface SlabPalette {
  topLight: string;
  topDark: string;
  eastFace: string;
  southFace: string;
}

const GRASS_VARIANTS: SlabPalette[] = [
  { topLight: '#8ed85c', topDark: '#6eb844', eastFace: '#4a9a38', southFace: '#3d8230' },
  { topLight: '#82d054', topDark: '#65b23c', eastFace: '#458a32', southFace: '#387828' },
  { topLight: '#96e068', topDark: '#74c44e', eastFace: '#50a23c', southFace: '#428a34' },
];

const PALETTES: Record<RowKind | 'grassStart', SlabPalette> = {
  grass: GRASS_VARIANTS[0],
  grassStart: {
    topLight: '#7ec850',
    topDark: '#5a9a3e',
    eastFace: '#428a32',
    southFace: '#357028',
  },
  road: {
    topLight: '#5e5e5e',
    topDark: '#3a3a3a',
    eastFace: '#2a2a2a',
    southFace: '#222222',
  },
  river: {
    topLight: '#5ecae8',
    topDark: '#2471a3',
    eastFace: '#1a5f8f',
    southFace: '#144a70',
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

function clipDiamond(ctx: CanvasRenderingContext2D, corners: [Corner, Corner, Corner, Corner]): void {
  traceDiamond(ctx, corners);
  ctx.clip();
}

function paletteFor(
  kind: RowKind,
  isStart: boolean,
  col: number,
  row: number,
): SlabPalette {
  if (kind === 'grass' && isStart) return PALETTES.grassStart;
  if (kind === 'grass') {
    const v = cellHash(col, row) % GRASS_VARIANTS.length;
    return GRASS_VARIANTS[v];
  }
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
  fillQuad(ctx, ne, se, drop(se), drop(ne), palette.eastFace);
  fillQuad(ctx, se, sw, drop(sw), drop(se), palette.southFace);
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
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function drawGrassBlades(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  col: number,
  row: number,
  animT: number,
): void {
  const r = cellRand(col, row, 3);
  if (r < 0.55) return;
  const cx = (corners[0].x + corners[2].x) / 2;
  const cy = (corners[0].y + corners[2].y) / 2;
  const sway = Math.sin(animT * 3 + col * 0.7 + row) * 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const ox = (r + i * 0.3 - 0.5) * 12;
    ctx.beginPath();
    ctx.moveTo(cx + ox, cy + 2);
    ctx.lineTo(cx + ox + sway, cy - 4 - i);
    ctx.stroke();
  }
}

function drawRoadDetails(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  col: number,
  row: number,
): void {
  const [nw, ne, se, sw] = corners;
  const curb = 'rgba(180,180,175,0.85)';
  ctx.strokeStyle = curb;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(nw.x, nw.y);
  ctx.lineTo(ne.x, ne.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sw.x, sw.y);
  ctx.lineTo(se.x, se.y);
  ctx.stroke();

  if (col === 0 || col === 7) {
    ctx.strokeStyle = '#5a9e38';
    ctx.lineWidth = 3;
    const edge = col === 0 ? [nw, sw] : [ne, se];
    ctx.beginPath();
    ctx.moveTo(edge[0].x, edge[0].y);
    ctx.lineTo(edge[1].x, edge[1].y);
    ctx.stroke();
  }

  const axisAligned = Math.abs(nw.y - ne.y) < 1;
  ctx.strokeStyle = 'rgba(255,240,180,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  if (axisAligned) {
    const cy = (nw.y + sw.y) / 2;
    ctx.moveTo(nw.x + 5, cy);
    ctx.lineTo(ne.x - 5, cy);
  } else {
    const mid = { x: (ne.x + sw.x) / 2, y: (ne.y + sw.y) / 2 };
    const tip = { x: (nw.x + se.x) / 2, y: (nw.y + se.y) / 2 };
    ctx.moveTo(mid.x, mid.y);
    ctx.lineTo(tip.x, tip.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.save();
  clipDiamond(ctx, corners);
  const h = cellHash(col, row);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const px = ((h >> (i * 4)) & 0xf) / 16;
    const py = ((h >> (i * 4 + 2)) & 0x3) / 4;
    const x = nw.x + (se.x - nw.x) * px;
    const y = nw.y + (se.y - nw.y) * py;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRiverDetails(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  animT: number,
  col: number,
  row: number,
): void {
  ctx.save();
  clipDiamond(ctx, corners);
  const phase = animT * 40 + col * 12 + row * 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const y = corners[0].y + ((corners[2].y - corners[0].y) * (0.2 + i * 0.18));
    const xOff = -((phase + i * 30) % 50);
    ctx.beginPath();
    ctx.moveTo(corners[0].x + xOff, y);
    ctx.lineTo(corners[1].x + xOff + 40, y);
    ctx.stroke();
  }

  const cx = (corners[0].x + corners[2].x) / 2;
  const cy = (corners[0].y + corners[2].y) / 2;
  for (let i = 0; i < 2; i++) {
    const rx = cx + ((phase * 0.3 + i * 25) % 40) - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(rx, cy + i * 3, 8, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(200,240,255,0.2)';
  ctx.fillRect(corners[3].x, corners[0].y, corners[1].x - corners[3].x, 4);
  ctx.restore();
}

export interface TerrainOpts {
  isStart?: boolean;
  animT?: number;
  col?: number;
  row?: number;
  sidesOnly?: boolean;
  topOnly?: boolean;
  grassBlades?: boolean;
  roadDetails?: boolean;
  riverDetails?: boolean;
}

export function drawTerrainCell(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  kind: RowKind,
  opts: TerrainOpts = {},
): void {
  const col = opts.col ?? 0;
  const row = opts.row ?? 0;
  const palette = paletteFor(kind, !!opts.isStart, col, row);
  if (!opts.topOnly) drawSlabSides(ctx, corners, palette);
  if (!opts.sidesOnly) {
    drawSlabTop(ctx, corners, palette);
    if (kind === 'grass' && opts.animT !== undefined && opts.grassBlades !== false) {
      drawGrassBlades(ctx, corners, col, row, opts.animT);
    }
    if (kind === 'road' && opts.roadDetails !== false) drawRoadDetails(ctx, corners, col, row);
    if (kind === 'river' && opts.animT !== undefined && opts.riverDetails !== false) {
      drawRiverDetails(ctx, corners, opts.animT, col, row);
    }
  }
}

// Isometric 3D terrain slabs — premium grass, road, river (Phase 2).

import type { RowKind } from '../types';
import { cellHash, cellRand } from './cellHash';

type Corner = { x: number; y: number };

export const SLAB_DEPTH = 8;

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
  col = 0,
  maxCol = 7,
): void {
  const [, ne, se, sw] = corners;
  const drop = (c: Corner): Corner => ({ x: c.x, y: c.y + depth });
  if (col < maxCol) {
    fillQuad(ctx, ne, se, drop(se), drop(ne), palette.eastFace);
  }
  fillQuad(ctx, se, sw, drop(sw), drop(se), palette.southFace);
}

export function drawSlabTop(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  palette: SlabPalette,
  kind: RowKind = 'grass',
  col = 0,
  row = 0,
  animT = 0,
): void {
  const [nw, , se, sw] = corners;
  const cx = (nw.x + se.x) / 2;

  traceDiamond(ctx, corners);
  if (kind === 'grass') {
    const g = ctx.createLinearGradient(cx, nw.y, cx, sw.y);
    g.addColorStop(0, palette.topLight);
    g.addColorStop(0.55, palette.topDark);
    g.addColorStop(1, shadeColor(palette.topDark, 0.88));
    ctx.fillStyle = g;
    ctx.fill();
    drawGrassTexture(ctx, corners, col, row, animT);
  } else if (kind === 'road') {
    const g = ctx.createLinearGradient(cx, nw.y, cx, sw.y);
    g.addColorStop(0, '#5a5a5a');
    g.addColorStop(0.5, '#3d3d3d');
    g.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = g;
    ctx.fill();
    drawAsphaltTexture(ctx, corners, col, row);
  } else {
    const g = ctx.createLinearGradient(cx, nw.y - 4, cx, sw.y + 4);
    g.addColorStop(0, '#7ec8e8');
    g.addColorStop(0.35, '#3d9fd4');
    g.addColorStop(0.7, '#1a6fa8');
    g.addColorStop(1, '#0d4a78');
    ctx.fillStyle = g;
    ctx.fill();
    drawWaterTexture(ctx, corners, animT, col, row);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

function shadeColor(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function drawGrassTexture(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  col: number,
  row: number,
  animT: number,
): void {
  ctx.save();
  clipDiamond(ctx, corners);
  const [nw, ne, se] = corners;
  const h = cellHash(col, row);

  // Soft color patches (clover / worn grass)
  for (let i = 0; i < 3; i++) {
    const px = nw.x + ((h >> (i * 5)) & 0x1f) / 31 * (ne.x - nw.x);
    const py = nw.y + ((h >> (i * 5 + 3)) & 0x1f) / 31 * (se.y - nw.y);
    const tone = (h >> i) & 1 ? 'rgba(90,160,50,0.18)' : 'rgba(120,200,70,0.14)';
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.ellipse(px, py, 8 + (i * 2), 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine grass blades
  const sway = Math.sin(animT * 2.5 + col * 0.6 + row) * 1.5;
  for (let i = 0; i < 8; i++) {
    const t = ((h >> (i * 2)) & 0x3) / 4;
    const bx = nw.x + 6 + t * (ne.x - nw.x - 12);
    const by = nw.y + 8 + ((h >> (i * 3)) & 0x7) / 7 * (se.y - nw.y - 16);
    const shade = i % 2 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(40,100,20,0.2)';
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bx, by + 4);
    ctx.quadraticCurveTo(bx + sway, by - 2, bx + 1 + sway * 0.5, by - 5 - (i % 3));
    ctx.stroke();
  }
  ctx.restore();
}

function drawAsphaltTexture(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  col: number,
  row: number,
): void {
  ctx.save();
  clipDiamond(ctx, corners);
  const [nw, ne, se] = corners;
  const h = cellHash(col, row);

  // Aggregate noise
  for (let i = 0; i < 14; i++) {
    const px = nw.x + ((h >> (i % 8)) & 0xf) / 15 * (ne.x - nw.x);
    const py = nw.y + ((h >> ((i + 3) % 8)) & 0xf) / 15 * (se.y - nw.y);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(px, py, 2 + (i % 3), 1 + (i % 2));
  }

  // Subtle oil stain
  if ((h & 0x7) === 0) {
    const ox = nw.x + (ne.x - nw.x) * 0.45;
    const oy = nw.y + (se.y - nw.y) * 0.5;
    const oil = ctx.createRadialGradient(ox, oy, 2, ox, oy, 14);
    oil.addColorStop(0, 'rgba(40,40,40,0.25)');
    oil.addColorStop(1, 'rgba(40,40,40,0)');
    ctx.fillStyle = oil;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 12, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWaterTexture(
  ctx: CanvasRenderingContext2D,
  corners: [Corner, Corner, Corner, Corner],
  animT: number,
  col: number,
  row: number,
): void {
  ctx.save();
  clipDiamond(ctx, corners);
  const [nw, ne, , sw] = corners;
  const phase = animT * 35 + col * 11 + row * 7;
  const laneH = sw.y - nw.y;

  // Caustic shimmer
  for (let i = 0; i < 5; i++) {
    const y = nw.y + laneH * (0.15 + i * 0.17);
    const xOff = -((phase + i * 22) % 55);
    const shimmer = ctx.createLinearGradient(nw.x + xOff, y, ne.x + xOff + 30, y);
    shimmer.addColorStop(0, 'rgba(255,255,255,0)');
    shimmer.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    shimmer.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = shimmer;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nw.x + xOff, y);
    ctx.bezierCurveTo(
      nw.x + xOff + 18, y - 2,
      nw.x + xOff + 32, y + 2,
      ne.x + xOff + 10, y,
    );
    ctx.stroke();
  }

  // Depth sparkles
  const cx = (nw.x + ne.x) / 2;
  const cy = nw.y + laneH * 0.5;
  for (let i = 0; i < 3; i++) {
    const sx = cx + Math.sin(phase * 0.04 + i * 2.1) * 18;
    const sy = cy + Math.cos(phase * 0.03 + i * 1.7) * 6;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 6, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shore foam at top edge
  ctx.fillStyle = 'rgba(220,245,255,0.35)';
  ctx.fillRect(nw.x, nw.y, ne.x - nw.x, 3);
  ctx.restore();
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
  _row: number,
): void {
  const [nw, ne, se, sw] = corners;
  const laneCy = (nw.y + sw.y) / 2;

  // Concrete curbs with bevel
  for (const [a, b, side] of [[nw, ne, 'top'], [sw, se, 'bottom']] as const) {
    const curbGrad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    curbGrad.addColorStop(0, '#c8c8c4');
    curbGrad.addColorStop(0.5, '#a8a8a4');
    curbGrad.addColorStop(1, '#888884');
    ctx.strokeStyle = curbGrad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = side === 'top' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + (side === 'top' ? 1 : -1));
    ctx.lineTo(b.x, b.y + (side === 'top' ? 1 : -1));
    ctx.stroke();
  }

  if (col === 0 || col === 7) {
    ctx.strokeStyle = '#4a9438';
    ctx.lineWidth = 3.5;
    const edge = col === 0 ? [nw, sw] : [ne, se];
    ctx.beginPath();
    ctx.moveTo(edge[0].x, edge[0].y);
    ctx.lineTo(edge[1].x, edge[1].y);
    ctx.stroke();
  }

  // Lane divider — reflective paint
  ctx.save();
  clipDiamond(ctx, corners);
  const dashGrad = ctx.createLinearGradient(nw.x, laneCy - 2, nw.x, laneCy + 2);
  dashGrad.addColorStop(0, 'rgba(255,250,210,0.95)');
  dashGrad.addColorStop(0.5, 'rgba(255,235,150,0.85)');
  dashGrad.addColorStop(1, 'rgba(230,210,120,0.75)');
  ctx.strokeStyle = dashGrad;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(nw.x + 6, laneCy);
  ctx.lineTo(ne.x - 6, laneCy);
  ctx.stroke();
  ctx.setLineDash([]);
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
  const [nw, ne, se, sw] = corners;
  const phase = animT * 45 + col * 12 + row * 5;
  const laneH = se.y - nw.y;

  // Rolling wave crests
  for (let i = 0; i < 3; i++) {
    const y = nw.y + laneH * (0.25 + i * 0.28);
    const xOff = -((phase + i * 28) % 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nw.x + xOff, y);
    for (let x = nw.x + xOff; x <= ne.x + 20; x += 12) {
      ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y);
    }
    ctx.stroke();
  }

  // Foam patches
  const cx = (nw.x + ne.x) / 2;
  const cy = (nw.y + sw.y) / 2;
  for (let i = 0; i < 2; i++) {
    const rx = cx + ((phase * 0.25 + i * 30) % 36) - 18;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(rx, cy + i * 4, 10, 3, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shore wash
  ctx.fillStyle = 'rgba(180,230,255,0.28)';
  ctx.fillRect(sw.x, sw.y - 5, ne.x - sw.x, 5);
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
  if (!opts.topOnly) drawSlabSides(ctx, corners, palette, SLAB_DEPTH, col, 7);
  if (!opts.sidesOnly) {
    drawSlabTop(ctx, corners, palette, kind, col, row, opts.animT ?? 0);
    if (kind === 'grass' && opts.animT !== undefined && opts.grassBlades !== false) {
      drawGrassBlades(ctx, corners, col, row, opts.animT);
    }
    if (kind === 'road' && opts.roadDetails !== false) drawRoadDetails(ctx, corners, col, row);
    if (kind === 'river' && opts.animT !== undefined && opts.riverDetails !== false) {
      drawRiverDetails(ctx, corners, opts.animT, col, row);
    }
  }
}

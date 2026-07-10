// Classic Crossy Road layout — horizontal lanes, vertical forward hops.

import { CELL, H, hopEase, hopProgress, type WorldSnapshot } from './types';

export interface ClassicPoint {
  x: number;
  y: number;
}

export function classicRowTop(row: number, camZ: number, camBob = 0): number {
  return H - (row * CELL - camZ) - CELL + camBob;
}

/** Cell corners as [nw, ne, se, sw] — axis-aligned rectangles (horizontal rows). */
export function classicCellCorners(
  col: number,
  row: number,
  camZ: number,
  camBob = 0,
): [ClassicPoint, ClassicPoint, ClassicPoint, ClassicPoint] {
  const sy = classicRowTop(row, camZ, camBob);
  const sx = col * CELL;
  return [
    { x: sx, y: sy },
    { x: sx + CELL, y: sy },
    { x: sx + CELL, y: sy + CELL },
    { x: sx, y: sy + CELL },
  ];
}

export function classicGridToScreen(
  gridX: number,
  gridY: number,
  camZ: number,
  camBob = 0,
): ClassicPoint {
  return {
    x: gridX * CELL,
    y: H - (gridY * CELL - camZ) - CELL / 2 + camBob,
  };
}

export function classicPlayerCenter(s: WorldSnapshot): ClassicPoint {
  const t = hopEase(hopProgress(s.hopT));
  const gx = s.hopT > 0
    ? s.fromPx + (s.px - s.fromPx) * t + 0.5
    : s.px + 0.5;
  const gz = s.hopT > 0
    ? s.fromPz + (s.pz - s.fromPz) * t + 0.5
    : s.pz + 0.5;
  return classicGridToScreen(gx, gz, s.camZ, s.camBob);
}

export function classicPaintDepth(row: number, col: number): number {
  return row + col * 0.001;
}

export function classicCamTarget(gz: number): number {
  return gz * CELL - H * 0.55;
}

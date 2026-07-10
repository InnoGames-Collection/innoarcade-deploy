// Isometric projection for premium Crossy Road rendering.

import { CELL } from './types';

export const COS30 = Math.cos(Math.PI / 6);
export const SIN30 = Math.sin(Math.PI / 6);

export interface IsoPoint {
  x: number;
  y: number;
}

export interface IsoCamera {
  x: number;
  y: number;
}

export interface ScreenOrigin {
  x: number;
  y: number;
}

export function gridToIso(gridX: number, gridY: number, tileSize = CELL): IsoPoint {
  return {
    x: (gridX - gridY) * COS30 * tileSize,
    y: (gridX + gridY) * SIN30 * tileSize,
  };
}

export function isoToScreen(
  isoX: number,
  isoY: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
  bob = 0,
): IsoPoint {
  return {
    x: isoX - camera.x + origin.x,
    y: isoY - camera.y + origin.y + bob,
  };
}

export function gridToScreen(
  gridX: number,
  gridY: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
  bob = 0,
  tileSize = CELL,
): IsoPoint {
  const iso = gridToIso(gridX, gridY, tileSize);
  return isoToScreen(iso.x, iso.y, camera, origin, bob);
}

export function cellDiamondScreen(
  col: number,
  row: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
  bob = 0,
  tileSize = CELL,
): [IsoPoint, IsoPoint, IsoPoint, IsoPoint] {
  return [
    gridToScreen(col, row, camera, origin, bob, tileSize),
    gridToScreen(col + 1, row, camera, origin, bob, tileSize),
    gridToScreen(col + 1, row + 1, camera, origin, bob, tileSize),
    gridToScreen(col, row + 1, camera, origin, bob, tileSize),
  ];
}

export function cellCenterScreen(
  col: number,
  row: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
  bob = 0,
  tileSize = CELL,
): IsoPoint {
  return gridToScreen(col + 0.5, row + 0.5, camera, origin, bob, tileSize);
}

export function paintDepth(row: number, col: number): number {
  return row + col;
}

export function lerpCamera(
  camera: IsoCamera,
  targetX: number,
  targetY: number,
  dt: number,
  speed: number,
): void {
  const t = 1 - Math.exp(-dt * speed);
  camera.x += (targetX - camera.x) * t;
  camera.y += (targetY - camera.y) * t;
}

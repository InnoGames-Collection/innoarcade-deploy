// Isometric grid projection for Crossy Road.
// Standard formulas: isoX = (x - y) * cos(30°), isoY = (x + y) * sin(30°)

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

/** Convert flat grid coordinates to isometric space (scaled by tile size). */
export function gridToIso(gridX: number, gridY: number, tileSize: number): IsoPoint {
  return {
    x: (gridX - gridY) * COS30 * tileSize,
    y: (gridX + gridY) * SIN30 * tileSize,
  };
}

/** Map isometric world coordinates to screen space using camera + origin offset. */
export function isoToScreen(
  isoX: number,
  isoY: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
): IsoPoint {
  return {
    x: isoX - camera.x + origin.x,
    y: isoY - camera.y + origin.y,
  };
}

/** Grid → isometric → screen in one step. */
export function gridToScreen(
  gridX: number,
  gridY: number,
  tileSize: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
): IsoPoint {
  const iso = gridToIso(gridX, gridY, tileSize);
  return isoToScreen(iso.x, iso.y, camera, origin);
}

/** Four corners of a grid cell diamond in screen space (nw, ne, se, sw). */
export function cellDiamondScreen(
  col: number,
  row: number,
  tileSize: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
): [IsoPoint, IsoPoint, IsoPoint, IsoPoint] {
  return [
    gridToScreen(col, row, tileSize, camera, origin),
    gridToScreen(col + 1, row, tileSize, camera, origin),
    gridToScreen(col + 1, row + 1, tileSize, camera, origin),
    gridToScreen(col, row + 1, tileSize, camera, origin),
  ];
}

/** Screen center of a grid cell. */
export function cellCenterScreen(
  col: number,
  row: number,
  tileSize: number,
  camera: IsoCamera,
  origin: ScreenOrigin,
): IsoPoint {
  return gridToScreen(col + 0.5, row + 0.5, tileSize, camera, origin);
}

/** Painter's-algorithm depth key — higher draws on top. */
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

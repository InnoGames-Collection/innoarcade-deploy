// Crossy Road — shared types and world snapshot for logic/render split.

export const W = 480;
export const H = 720;
export const COLS = 8;
export const CELL = W / COLS;

export const HOP_DUR = 0.14;
export const IDLE_LIMIT = 14;
export const CAMP_LIMIT = 5;
export const EAGLE_DUR = 0.85;
export const CAM_LERP = 4.2;
export const SCREEN_ANCHOR_Y = 0.55;

/** Toggle premium isometric renderer (Phase 1+). Set false to use legacy flat view. */
export const PREMIUM_RENDER = true;

export type RowKind = 'grass' | 'road' | 'river';
export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export type VehicleKind =
  | 'sedan'
  | 'suv'
  | 'taxi'
  | 'bus'
  | 'police'
  | 'van'
  | 'minibus';

export interface Car {
  row: number;
  x: number;
  w: number;
  speed: number;
  kind: VehicleKind;
}

export interface Log {
  row: number;
  x: number;
  w: number;
  speed: number;
}

export interface Coin {
  row: number;
  col: number;
}

export interface Row {
  z: number;
  kind: RowKind;
  dir: number;
  speed: number;
}

/** Read-only frame state passed from game logic to renderers. */
export interface WorldSnapshot {
  state: GameState;
  px: number;
  pz: number;
  fromPx: number;
  fromPz: number;
  hopT: number;
  idleT: number;
  camZ: number;
  camIsoX: number;
  camIsoY: number;
  camBob: number;
  animT: number;
  campT: number;
  eagleT: number;
  coinsCollected: number;
  rows: readonly Row[];
  cars: readonly Car[];
  logs: readonly Log[];
  coins: readonly Coin[];
}

export function rowAt(rows: readonly Row[], z: number): Row {
  return rows.find((r) => r.z === z) ?? { z, kind: 'grass', dir: 1, speed: 0 };
}

export function hopProgress(hopT: number): number {
  return hopT > 0 ? 1 - hopT / HOP_DUR : 1;
}

export function hopEase(t: number): number {
  return t * t * (3 - 2 * t);
}

export function playerGridPos(s: WorldSnapshot): { gx: number; gz: number } {
  const p = hopEase(hopProgress(s.hopT));
  const gx = s.hopT > 0
    ? s.fromPx + (s.px - s.fromPx) * p + 0.5
    : s.px + 0.5;
  const gz = s.hopT > 0
    ? s.fromPz + (s.pz - s.fromPz) * p + 0.5
    : s.pz + 0.5;
  return { gx, gz };
}

// Rendering-engine types — read-only snapshots from the frozen game engine.

export const RW = 480;
export const RH = 720;

export type FruitType = 'apple' | 'banana' | 'cherry' | 'orange' | 'peach';

export type ParticleKind = 'juice' | 'pulp' | 'seed' | 'spark' | 'droplet' | 'glow' | 'mist';

export interface VfxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: ParticleKind;
  rotation: number;
  rotSpeed: number;
}

export interface RenderFruit {
  x: number;
  y: number;
  type: FruitType;
  sliced: boolean;
  sliceTime: number;
  rot: number;
}

export interface RenderBomb {
  x: number;
  y: number;
  hit: boolean;
}

export interface RenderSlice {
  points: Array<{ x: number; y: number }>;
  createdAt: number;
}

/** Immutable frame description produced by the game engine each render tick. */
export interface RenderSnapshot {
  time: number;
  combo: number;
  comboFlash: number;
  screenShake: number;
  fruits: RenderFruit[];
  bombs: RenderBomb[];
  particles: VfxParticle[];
  slices: RenderSlice[];
  currentSlice: Array<{ x: number; y: number }>;
  fruitRadius: number;
  bombRadius: number;
}

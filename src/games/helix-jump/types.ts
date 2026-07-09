export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export interface Ring {
  id: number;
  y: number;
  gapStart: number;
  colorIndex: number;
  danger: boolean;
  broken: boolean;
  breakAnim: number;
}

export interface BallState {
  y: number;
  vy: number;
  squash: number;
  colorIndex: number;
}

export interface CollisionHit {
  ring: Ring;
  screenY: number;
  passedGap: boolean;
  bounced: boolean;
  smashed: boolean;
  died: boolean;
}

/** Helix Jump — Ethio Telecom inspired palette & tuning constants. */

export const W = 480;
export const H = 720;
export const CX = W / 2;
export const BALL_R = 13;
export const RING_R = 138;
export const RING_STROKE = 24;
export const GAP_ARC = 1.15;
export const PILLAR_W = 28;

export const GRAVITY_BASE = 720;
export const BOUNCE_VEL = -340;
export const CAM_LERP = 6.5;
export const CAM_OFFSET = 0.36;

export const RING_SPACING_BASE = 88;
export const FEVER_THRESHOLD = 4;
export const FEVER_DURATION = 2.8;
export const COMBO_CAP = 8;

/** Ethio Telecom theme — green, blue, white accents */
export const THEME = {
  bgTop: '#0a1628',
  bgMid: '#0d2847',
  bgBot: '#051018',
  pillar: 'rgba(255,255,255,0.12)',
  pillarGlow: 'rgba(46,204,113,0.25)',
  safe: '#1e88e5',
  accent: '#2ecc71',
  danger: '#e53935',
  dangerDark: '#b71c1c',
  white: '#ffffff',
  fever: '#ffd54f',
  hud: 'rgba(255,255,255,0.92)',
} as const;

export const RING_COLORS = [
  '#1e88e5',
  '#2ecc71',
  '#42a5f5',
  '#26c6da',
  '#66bb6a',
  '#29b6f6',
] as const;

export const SAVE_KEY = 'helix-jump.save.v1';

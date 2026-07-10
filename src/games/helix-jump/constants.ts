/** Helix Jump — premium arcade tuning & palette. */

export const W = 480;
export const H = 720;
export const CX = W / 2;

/** World units — Y increases downward in gameplay space. */
export const BALL_R = 0.55;
export const RING_R = 4.05;
/** Hollow shaft — smaller than the ball so the ball rests on platform inner rim. */
export const RING_INNER = 0.30;
export const RING_THICKNESS = 0.62;
export const RING_HEIGHT = 0.34;
export const PILLAR_R = 0.20;
/** Ball sits on platform ring, offset from thin pillar axis (reference Helix Jump). */
export const BALL_CONTACT_R = RING_INNER + BALL_R * 0.38;
export const GAP_ARC = 1.12;

export const GRAVITY_BASE = 26;
export const BOUNCE_VEL = 11.5;
export const CAM_LERP = 7.2;
export const CAM_OFFSET = 0.38;

export const RING_SPACING_BASE = 2.55;
export const FEVER_THRESHOLD = 4;
export const FEVER_DURATION = 2.8;
export const COMBO_CAP = 8;

/** Bright premium arcade palette — high contrast, clean backgrounds. */
export const THEME = {
  bgTop: '#b8e4ff',
  bgMid: '#e8d4ff',
  bgBot: '#ffd6ec',
  pillar: '#f5f7ff',
  pillarGlow: '#ffffff',
  safe: '#ff5c8a',
  accent: '#00d4aa',
  danger: '#1a1a2e',
  dangerDark: '#0d0d18',
  white: '#ffffff',
  fever: '#ffd93d',
  hud: 'rgba(30,30,50,0.88)',
  shadow: '#6b7fd7',
} as const;

export const RING_COLORS = [
  '#ff5c8a',
  '#00d4ff',
  '#ffd93d',
  '#7cff6b',
  '#ff8c42',
  '#c77dff',
  '#ff6bcb',
  '#4dffb8',
] as const;

export const SAVE_KEY = 'helix-jump.save.v2';

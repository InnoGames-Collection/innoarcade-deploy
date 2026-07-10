/** Helix Jump — premium arcade tuning & palette. */

export const W = 480;
export const H = 720;
export const CX = W / 2;

/** World units — Y increases downward in gameplay space. */
export const BALL_R = 0.55;
export const RING_R = 4.05;
/** Thick central pillar — reference ball ≈ ⅓ pillar width. */
export const PILLAR_R = 0.82;
/** Platform inner lip hugs the pillar; ball rests on this rim, not the shaft. */
export const RING_INNER = PILLAR_R + 0.04;
export const RING_THICKNESS = 0.62;
export const RING_HEIGHT = 0.38;
/** Radial offset: ball center on platform top at inner rim (camera-facing side). */
export const BALL_CONTACT_R = RING_INNER + BALL_R * 0.95;
/** Camera-facing contact angle — ball fixed south of helix axis. */
export const BALL_CONTACT_ANGLE = -Math.PI / 2;
export const GAP_ARC = 1.08;
/** Orange hazard wedge on solid platforms (reference: partial segment, not full ring). */
export const DANGER_ARC_MIN = 0.42;
export const DANGER_ARC_MAX = 0.62;
export const DANGER_TOLERANCE = 0.035;
/** Angular grace when gap-aligned — generous pass, tight solid edge. */
export const GAP_PASS_TOLERANCE = 0.04;
export const SOLID_EDGE_INSET = 0.07;

export const GRAVITY_BASE = 24;
/** Impact speed before high-drop extra pop kicks in. */
export const BOUNCE_VEL = 14;
/** Target upward speed after bounce — apex ≈ 1.7–2× ball diameter at GRAVITY_BASE. */
export const BOUNCE_UP_VEL = 10.0;
export const BOUNCE_UP_MAX = 11.5;
/** Extra pop coefficient for impacts above BOUNCE_VEL. */
export const BOUNCE_RESTITUTION = 0.22;
export const CAM_FOV = 44;
/** Screen framing — ball sits in upper-middle third (reference). */
export const CAM_OFFSET = 0.44;
/** Camera rig height / distance — ~40° downward tilt. */
export const CAM_Y = 7.0;
export const CAM_Z = 7.5;
export const CAM_LOOK_BELOW = 0.45;

/** ~2.2× ball diameter — matches reference platform spacing. */
export const RING_SPACING_BASE = 2.38;
export const FEVER_THRESHOLD = 4;
export const FEVER_DURATION = 2.8;
export const COMBO_CAP = 8;
/** Consecutive gap passes before platforms shatter on streak (reference Helix Jump). */
export const STREAK_SHATTER_THRESHOLD = 2;

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

/** Helix Jump — premium arcade tuning & palette. */

export const W = 480;
export const H = 720;
export const CX = W / 2;

/** World units — Y increases downward in gameplay space. */
export const BALL_R = 0.48;
/** Outer platform lip — reference: short wedges around a thick pillar. */
export const RING_R = 3.05;
/** Thick central pillar — ~38% of platform diameter (reference). */
export const PILLAR_R = 1.18;
/** Platform inner lip hugs the pillar. */
export const RING_INNER = PILLAR_R + 0.06;
export const RING_THICKNESS = 0.42;
export const RING_HEIGHT = 0.34;
/** Ball sits on inner rim, screen-fixed south of axis. */
export const BALL_CONTACT_R = RING_INNER + BALL_R * 0.88;
/** Camera-facing contact angle — ball fixed toward camera (+Z). */
export const BALL_CONTACT_ANGLE = Math.PI / 2;
/** Fixed screen Y for the ball rig (world scrolls past it). */
export const BALL_SCREEN_Y = 0;
/** World XZ of the ball on the platform inner rim (toward camera). */
export const BALL_WORLD_X = Math.cos(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
export const BALL_WORLD_Z = Math.sin(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
/** Visible pillar segment height around the play axis. */
export const PILLAR_HEIGHT = 16;
export const GAP_ARC = 1.0;
/** Angular margin at gap edges — keep small so solid platforms stop the ball. */
export const GAP_EDGE_INSET = 0.04;
export const GAP_PASS_TOLERANCE = 0.012;
export const GAP_PASS_VEL_BONUS = 0;
export const SOLID_EDGE_INSET = 0.03;
export const DANGER_ARC_MIN = 0.45;
export const DANGER_ARC_MAX = 0.68;
export const DANGER_TOLERANCE = 0.03;

export const GRAVITY_BASE = 15;
export const BOUNCE_VEL = 10;
export const BOUNCE_UP_VEL = 6.0;
export const BOUNCE_UP_MAX = 6.8;
export const BOUNCE_RESTITUTION = 0.05;
export const FALL_TERMINAL_VY = 12;
export const FALL_STRETCH_SPEED = 16;
export const BALL_STRETCH_MAX = 0.1;
export const BALL_ROLL_RATE = 1.8;
export const BALL_SQUASH_MIN = 0.72;
export const BALL_SQUASH_MAX = 1.06;
export const CAM_FOV = 44;
export const CAM_Y = 5.6;
export const CAM_Z = 8.2;
export const CAM_LOOK_Y = -0.15;
export const CAM_LOOK_Z = 0.9;

/** ~2.1× ball diameter — reference pacing between decisions. */
export const RING_SPACING_BASE = 2.1;
export const SIM_SPEED = 0.82;
export const FEVER_THRESHOLD = 4;
export const FEVER_DURATION = 2.8;
export const COMBO_CAP = 8;
/** Three clean gap passes → smash / fireball through next platform (reference). */
export const STREAK_SHATTER_THRESHOLD = 3;

/** Bright premium arcade palette — high contrast, clean backgrounds. */
export const THEME = {
  bgTop: '#2d1b4e',
  bgMid: '#6b4a7a',
  bgBot: '#f0b88a',
  pillar: '#4a2d7a',
  pillarTop: '#6b45a8',
  pillarGlow: '#9b6fd4',
  safe: '#f5efe6',
  accent: '#00d4aa',
  danger: '#ff6b35',
  dangerDark: '#cc4420',
  white: '#ffffff',
  fever: '#ffd93d',
  hud: 'rgba(30,30,50,0.88)',
  shadow: '#6b7fd7',
} as const;

export const RING_COLORS = [
  '#6EC6FF',
  '#FFB74D',
  '#CE93D8',
  '#81C784',
  '#F06292',
  '#FFF176',
  '#4DD0E1',
  '#FF8A65',
  '#AED581',
  '#9575CD',
] as const;

export const SAVE_KEY = 'helix-jump.save.v2';

// Authored vector art for Temple Dash, generated in-repo (no external downloads).
// The runner is a *parametric* character: drawChar() composes a flat-shaded
// explorer at a given pose, and charSheet() bakes six poses (a 4-frame run cycle
// plus jump and slide) into one horizontal sprite sheet per skin. assets.ts
// rasterizes the SVG once at load; anim.ts plays the frames. Obstacles, coins and
// power-ups are richly shaded single-frame sprites. This is the "authored SVG"
// half of the hybrid art plan; backgrounds are painted procedurally in game.ts.

import type { SheetDef } from '../../engine/assets';

export const FRAME = 128;
const RUN_FRAMES = 4;
export const CHAR_FRAMES = RUN_FRAMES + 2; // + jump + slide
export const FRAME_RUN = 0; // first run frame index
export const FRAME_JUMP = RUN_FRAMES;
export const FRAME_SLIDE = RUN_FRAMES + 1;

export interface Skin {
  id: string;
  nameEn: string;
  nameAm: string;
  cost: number;
  shirt: string;
  shirtDark: string;
  pants: string;
  skin: string;
  hat: string;
  pack: string;
}

export const SKINS: Skin[] = [
  { id: 'scout', nameEn: 'Scout', nameAm: 'ስካውት', cost: 0,
    shirt: '#e0533a', shirtDark: '#b23a26', pants: '#34495e', skin: '#e8b98f', hat: '#2c3e50', pack: '#8e6e3f' },
  { id: 'jade', nameEn: 'Jade', nameAm: 'ጄድ', cost: 250,
    shirt: '#17a589', shirtDark: '#0e6b58', pants: '#145a32', skin: '#d9a679', hat: '#0e6251', pack: '#7d6608' },
  { id: 'royal', nameEn: 'Royal', nameAm: 'ሮያል', cost: 600,
    shirt: '#7d3c98', shirtDark: '#5b2c6f', pants: '#4a235a', skin: '#e8b98f', hat: '#512e5f', pack: '#b9770e' },
  { id: 'gold', nameEn: 'Sun', nameAm: 'ፀሐይ', cost: 1200,
    shirt: '#f1c40f', shirtDark: '#c49a06', pants: '#7e5109', skin: '#e8b98f', hat: '#b9770e', pack: '#6e2c00' },
];

type Pose = { kind: 'run' | 'jump' | 'slide'; phase: number };

function limb(x1: number, y1: number, x2: number, y2: number, w: number, color: string): string {
  return `<path d="M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
}
function f(n: number): string {
  return n.toFixed(1);
}

// One character frame, drawn in a FRAME×FRAME box with the figure centred on x=64.
function drawChar(pose: Pose, s: Skin): string {
  const cx = 64;
  let parts = '';

  if (pose.kind === 'slide') {
    // Low forward slide: body reclined, legs thrust ahead, trailing dust handled in-game.
    const baseY = 96;
    parts += limb(cx - 6, baseY, cx + 30, baseY + 6, 15, s.pants); // forward legs
    parts += limb(cx - 6, baseY, cx + 26, baseY - 2, 15, s.pants);
    parts += `<rect x="${cx - 30}" y="${baseY - 26}" rx="13" ry="13" width="48" height="26" fill="${s.shirt}"/>`; // reclined torso
    parts += `<rect x="${cx - 34}" y="${baseY - 24}" rx="8" ry="8" width="14" height="22" fill="${s.pack}"/>`; // pack
    parts += limb(cx + 6, baseY - 16, cx + 30, baseY - 22, 11, s.shirtDark); // arm forward
    parts += `<circle cx="${cx - 26}" cy="${baseY - 22}" r="15" fill="${s.skin}"/>`; // head trailing
    parts += `<path d="M${cx - 41} ${baseY - 24} a15 15 0 0 1 30 0 z" fill="${s.hat}"/>`;
    parts += `<circle cx="${cx - 30}" cy="${baseY - 24}" r="2.2" fill="#23303a"/>`;
    return parts;
  }

  if (pose.kind === 'jump') {
    const lift = 0;
    const hipY = 80 + lift, shoulderY = 56 + lift, headY = 38 + lift;
    parts += limb(cx + 2, hipY, cx + 18, hipY - 2, 15, s.shirtDark); // tucked legs (back)
    parts += `<rect x="${cx - 38}" y="${shoulderY - 2}" rx="8" ry="8" width="15" height="24" fill="${s.pack}"/>`;
    parts += `<rect x="${cx - 16}" y="${shoulderY - 4}" rx="12" ry="12" width="32" height="42" fill="${s.shirt}"/>`;
    parts += limb(cx + 1, hipY, cx + 20, hipY + 10, 15, s.pants); // tucked legs (front)
    parts += limb(cx - 10, shoulderY + 2, cx - 22, shoulderY - 20, 11, s.shirt); // arms up
    parts += limb(cx + 10, shoulderY + 2, cx + 24, shoulderY - 18, 11, s.shirt);
    parts += `<circle cx="${cx}" cy="${headY}" r="16" fill="${s.skin}"/>`;
    parts += `<path d="M${cx - 16} ${headY - 1} a16 16 0 0 1 32 0 z" fill="${s.hat}"/>`;
    parts += `<rect x="${cx + 8}" y="${headY - 3}" width="12" height="5" rx="2" fill="${s.hat}"/>`; // cap brim
    parts += `<circle cx="${cx + 6}" cy="${headY + 1}" r="2.4" fill="#23303a"/>`;
    return parts;
  }

  // Run cycle.
  const sw = Math.sin(pose.phase * Math.PI * 2);
  const lift = -Math.abs(sw) * 3;
  const hipX = cx, hipY = 84 + lift, shoulderY = 56 + lift, headY = 38 + lift;
  const legSwing = sw * 0.55, armSwing = sw * 0.6;
  const Lleg = 30, Larm = 22;
  const foot = (theta: number) => [hipX + Math.sin(theta) * Lleg, hipY + Math.cos(theta) * Lleg] as const;
  const hand = (theta: number) => [hipX + Math.sin(theta) * Larm, shoulderY + Math.cos(theta) * Larm] as const;

  const [bfX, bfY] = foot(-legSwing); // back leg
  const [bhX, bhY] = hand(armSwing); // back arm
  const [ffX, ffY] = foot(legSwing); // front leg
  const [fhX, fhY] = hand(-armSwing); // front arm

  parts += limb(hipX, hipY, bfX, bfY, 15, s.shirtDark); // back leg
  parts += limb(cx, shoulderY, bhX, bhY, 11, s.shirtDark); // back arm
  parts += `<rect x="${cx - 38}" y="${shoulderY - 2}" rx="8" ry="8" width="15" height="26" fill="${s.pack}"/>`; // pack
  parts += `<rect x="${cx - 16}" y="${shoulderY - 4}" rx="12" ry="12" width="32" height="44" fill="${s.shirt}"/>`; // torso
  parts += `<circle cx="${cx}" cy="${headY}" r="16" fill="${s.skin}"/>`; // head
  parts += `<path d="M${cx - 16} ${headY - 1} a16 16 0 0 1 32 0 z" fill="${s.hat}"/>`; // hat dome
  parts += `<rect x="${cx + 8}" y="${headY - 3}" width="13" height="5" rx="2" fill="${s.hat}"/>`; // brim
  parts += `<circle cx="${cx + 6}" cy="${headY + 1}" r="2.4" fill="#23303a"/>`; // eye
  parts += limb(hipX, hipY, ffX, ffY, 15, s.pants); // front leg
  parts += limb(cx, shoulderY, fhX, fhY, 11, s.shirt); // front arm
  return parts;
}

export function charSheet(s: Skin): string {
  const frames: Pose[] = [
    { kind: 'run', phase: 0 },
    { kind: 'run', phase: 0.25 },
    { kind: 'run', phase: 0.5 },
    { kind: 'run', phase: 0.75 },
    { kind: 'jump', phase: 0 },
    { kind: 'slide', phase: 0 },
  ];
  const groups = frames
    .map((p, i) => `<g transform="translate(${i * FRAME},0)">${drawChar(p, s)}</g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME * CHAR_FRAMES}" height="${FRAME}">${groups}</svg>`;
}

// --- World sprites ---------------------------------------------------------

// Spinning coin: 6 frames, ellipse width narrowing to an edge then back.
export function coinSheet(): string {
  const rxs = [22, 15, 5, 5, 15, 22];
  const N = rxs.length;
  const groups = rxs
    .map((rx, i) => {
      const cx = 32, cy = 32;
      const edge = rx < 8;
      const face = edge
        ? `<rect x="${cx - rx}" y="${cy - 24}" width="${rx * 2}" height="48" rx="3" fill="#c8960c"/>`
        : `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="24" fill="#f1c40f"/>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="24" fill="none" stroke="#b7950b" stroke-width="3"/>` +
          `<ellipse cx="${cx - rx * 0.25}" cy="${cy - 6}" rx="${rx * 0.4}" ry="10" fill="#fce8a6" opacity="0.7"/>` +
          (rx > 12 ? `<text x="${cx}" y="${cy + 7}" font-size="20" text-anchor="middle" fill="#b7950b" font-family="system-ui">★</text>` : '');
      return `<g transform="translate(${i * 64},0)">${face}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${64 * N}" height="64">${groups}</svg>`;
}

// Three obstacle types in one sheet (frame 0 block, 1 hurdle, 2 beam), 128×128.
export function obstacleSheet(): string {
  const block = `
    <defs><linearGradient id="st" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8d8273"/><stop offset="1" stop-color="#5f574b"/></linearGradient></defs>
    <rect x="34" y="18" width="60" height="100" rx="6" fill="url(#st)"/>
    <rect x="34" y="18" width="60" height="14" rx="6" fill="#a59880"/>
    <path d="M44 40 H84 M44 64 H84 M44 88 H84" stroke="#4a4339" stroke-width="3"/>
    <path d="M64 32 V52 M54 52 V76 M74 76 V100" stroke="#4a4339" stroke-width="3"/>
    <ellipse cx="58" cy="26" rx="12" ry="5" fill="#4e7d3a" opacity="0.8"/>`;
  const hurdle = `
    <rect x="22" y="78" width="84" height="16" rx="8" fill="#7a4a23"/>
    <rect x="22" y="78" width="84" height="6" rx="3" fill="#9c6435"/>
    <rect x="30" y="92" width="10" height="26" fill="#5d3a1c"/>
    <rect x="88" y="92" width="10" height="26" fill="#5d3a1c"/>
    <path d="M22 86 H106" stroke="#5d3a1c" stroke-width="2" opacity="0.6"/>`;
  const beam = `
    <rect x="14" y="20" width="100" height="22" rx="4" fill="#5d4f41"/>
    <rect x="14" y="20" width="100" height="8" rx="4" fill="#6f6152"/>
    <rect x="20" y="20" width="10" height="92" fill="#5d4f41"/>
    <rect x="98" y="20" width="10" height="92" fill="#5d4f41"/>
    ${[0, 1, 2, 3].map((i) => {
      const x = 34 + i * 22;
      return `<path d="M${x} 42 L${x + 8} 60 L${x + 16} 42 Z" fill="#3f352b"/>`;
    }).join('')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${128 * 3}" height="128">
    <g>${block}</g>
    <g transform="translate(128,0)">${hurdle}</g>
    <g transform="translate(256,0)">${beam}</g>
  </svg>`;
}

// Power-ups in one sheet: 0 magnet, 1 shield, 2 multiplier. 96×96 each.
export function powerupSheet(): string {
  const magnet = `
    <path d="M30 20 a18 18 0 0 1 36 0 v34 h-13 v-34 a5 5 0 0 0 -10 0 v34 h-13 z" fill="#d63031"/>
    <rect x="30" y="54" width="13" height="14" fill="#dfe6e9"/>
    <rect x="53" y="54" width="13" height="14" fill="#dfe6e9"/>`;
  const shield = `
    <path d="M48 16 L74 26 V52 C74 68 62 78 48 84 C34 78 22 68 22 52 V26 Z" fill="#4a90d9"/>
    <path d="M48 16 L74 26 V52 C74 68 62 78 48 84 Z" fill="#3a7bc0"/>
    <path d="M48 30 L58 46 L48 64 L38 46 Z" fill="#dff0ff" opacity="0.85"/>`;
  const mult = `
    <circle cx="48" cy="48" r="32" fill="#f1c40f"/>
    <circle cx="48" cy="48" r="32" fill="none" stroke="#b7950b" stroke-width="4"/>
    <text x="48" y="60" font-size="38" text-anchor="middle" fill="#7e5109" font-family="system-ui" font-weight="bold">2×</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${96 * 3}" height="96">
    <g>${magnet}</g>
    <g transform="translate(96,0)">${shield}</g>
    <g transform="translate(192,0)">${mult}</g>
  </svg>`;
}

// Build the sheet-definition map handed to AssetStore.load().
export function sheetDefs(): Record<string, SheetDef> {
  const defs: Record<string, SheetDef> = {
    coin: { src: coinSheet(), frameW: 64, frameH: 64, scale: 2 },
    obstacles: { src: obstacleSheet(), frameW: 128, frameH: 128, scale: 2 },
    powerups: { src: powerupSheet(), frameW: 96, frameH: 96, scale: 2 },
  };
  for (const s of SKINS) {
    defs[`char_${s.id}`] = { src: charSheet(s), frameW: FRAME, frameH: FRAME, scale: 2 };
  }
  return defs;
}

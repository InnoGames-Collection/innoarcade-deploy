#!/usr/bin/env node
/** Generate SVG hub covers for the 26 new games (gradient + emoji). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/covers');

const GAMES = [
  { file: 'water_sort', icon: '🧪', c0: '#2aa9d6', c1: '#13627e' },
  { file: 'parking_jam', icon: '🚗', c0: '#5b8cff', c1: '#0a1130' },
  { file: 'laser_puzzle', icon: '🔴', c0: '#e74c3c', c1: '#2a0c0c' },
  { file: 'piano_tiles', icon: '🎹', c0: '#4a4a6a', c1: '#0d0d18' },
  { file: 'stack_tower', icon: '🗼', c0: '#f39c12', c1: '#3d2808' },
  { file: 'crossy_road', icon: '🐔', c0: '#6ab04c', c1: '#142a0c' },
  { file: 'block_blast', icon: '🟦', c0: '#5b8cff', c1: '#0a1130' },
  { file: 'tile_connect', icon: '🔗', c0: '#7a6cff', c1: '#1a1430' },
  { file: 'hexa_block', icon: '⬡', c0: '#1abc9c', c1: '#052a24' },
  { file: 'knife_hit', icon: '🔪', c0: '#8B4513', c1: '#1a0d04' },
  { file: 'helix_jump', icon: '🌀', c0: '#5b8cff', c1: '#0a1020' },
  { file: 'hill_climb', icon: '🚙', c0: '#e74c3c', c1: '#2a0c0c' },
  { file: 'tower_defense', icon: '🏰', c0: '#6ab04c', c1: '#142a0c' },
  { file: 'draw_bridge', icon: '🌉', c0: '#8B7355', c1: '#1a140c' },
  { file: 'ball_sort', icon: '⚪', c0: '#9b59b6', c1: '#1a0c2a' },
  { file: 'jewel_match', icon: '💎', c0: '#9b59b6', c1: '#1a0c2a' },
  { file: 'reflex_tap', icon: '⚡', c0: '#f39c12', c1: '#2a1a04' },
  { file: 'doodle_jump', icon: '🦘', c0: '#6c5ce7', c1: '#140c2a' },
  { file: 'zigzag', icon: '〰️', c0: '#00cec9', c1: '#042a2a' },
  { file: 'color_switch', icon: '🎨', c0: '#e84393', c1: '#2a0c1a' },
  { file: 'rope_rescue', icon: '🪢', c0: '#e67e22', c1: '#2a1404' },
  { file: 'pipe_connect', icon: '🔧', c0: '#3498db', c1: '#0c1a2a' },
  { file: 'ball_maze', icon: '🔮', c0: '#e17055', c1: '#2a100c' },
  { file: 'arrow_shot', icon: '🏹', c0: '#8B7355', c1: '#1a140c' },
  { file: 'slide_puzzle', icon: '🧩', c0: '#74b9ff', c1: '#0c1a2a' },
  { file: 'race_car', icon: '🏎️', c0: '#d63031', c1: '#2a0808' },
];

fs.mkdirSync(outDir, { recursive: true });

for (const g of GAMES) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${g.c0}"/>
      <stop offset="100%" stop-color="${g.c1}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="20%" r="70%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
  </defs>
  <rect width="320" height="200" fill="url(#bg)"/>
  <rect width="320" height="200" fill="url(#glow)"/>
  <text x="160" y="118" text-anchor="middle" font-size="88">${g.icon}</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `${g.file}.svg`), svg);
}

console.log(`Wrote ${GAMES.length} covers to ${outDir}`);

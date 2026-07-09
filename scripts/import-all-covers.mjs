#!/usr/bin/env node
/** Import generated PNG covers from assets dir into public/*.webp */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = process.argv[2]
  ?? '/Users/yasabneh/.cursor/projects/Users-yasabneh-Documents-ITG-InnoGames/assets';
const archiveDir = path.join(root, 'assets/covers');

const GAMES = [
  ['water_sort_cover.png', 'water-sort'],
  ['parking_jam_cover.png', 'parking-jam'],
  ['laser_puzzle_cover.png', 'laser-puzzle'],
  ['piano_tiles_cover.png', 'piano-tiles'],
  ['stack_tower_cover.png', 'stack-tower'],
  ['crossy_road_cover.png', 'crossy-road'],
  ['block_blast_cover.png', 'block-blast'],
  ['tile_connect_cover.png', 'tile-connect'],
  ['hexa_block_cover.png', 'hexa-block'],
  ['knife_hit_cover.png', 'knife-hit'],
  ['helix_jump_cover.png', 'helix-jump'],
  ['hill_climb_cover.png', 'hill-climb'],
  ['tower_defense_cover.png', 'tower-defense'],
  ['draw_bridge_cover.png', 'draw-bridge'],
  ['ball_sort_cover.png', 'ball-sort'],
  ['jewel_match_cover.png', 'jewel-match'],
  ['reflex_tap_cover.png', 'reflex-tap'],
  ['doodle_jump_cover.png', 'doodle-jump'],
  ['zigzag_cover.png', 'zigzag'],
  ['color_switch_cover.png', 'color-switch'],
  ['rope_rescue_cover.png', 'rope-rescue'],
  ['pipe_connect_cover.png', 'pipe-connect'],
  ['ball_maze_cover.png', 'ball-maze'],
  ['arrow_shot_cover.png', 'arrow-shot'],
  ['slide_puzzle_cover.png', 'slide-puzzle'],
  ['race_car_cover.png', 'race-car'],
  ['traffic_master_cover.png', 'traffic-master'],
  ['city_rush_cover.png', 'city-rush'],
  ['mega_match_cover.png', 'mega-match'],
  ['ninja_dash_cover.png', 'ninja-dash'],
];

fs.mkdirSync(archiveDir, { recursive: true });

for (const [file, id] of GAMES) {
  const src = path.join(assetsDir, file);
  if (!fs.existsSync(src)) {
    // try archived png in assets/covers
    const alt = path.join(archiveDir, file.replace('_cover', ''));
    if (!fs.existsSync(alt) && !fs.existsSync(src)) {
      console.warn('skip missing', file);
      continue;
    }
  }
  const slug = id.replace(/-/g, '_');
  const srcPath = fs.existsSync(src) ? src : path.join(archiveDir, `${slug}.png`);
  if (!fs.existsSync(srcPath)) {
    console.warn('skip', id);
    continue;
  }
  const out = path.join(root, 'public', `${slug}.webp`);
  await sharp(srcPath)
    .resize(800, 600, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88, effort: 6 })
    .toFile(out);
  fs.copyFileSync(srcPath, path.join(archiveDir, `${slug}.png`));
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`${id} → ${slug}.webp (${kb} KB)`);
}

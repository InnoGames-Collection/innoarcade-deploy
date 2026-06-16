// Temple Dash art — Kenney "Platformer Art Complete Pack" (https://kenney.nl),
// licensed CC0 / public domain (see ./kenney/CREDITS.md). The PNGs vendored under
// ./kenney are imported as hashed URLs by Vite and loaded as single-frame sheets
// by assets.ts, so each sprite is addressed by its file name (e.g. 'scout_walk1',
// 'coin', 'obs_block', 'bg_jungle'). This is the CC0 "backbone" of the hybrid art
// plan; particle/track effects remain procedural.

import type { SheetDef } from '../../engine/assets';

const urls = import.meta.glob('./kenney/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const WALK_FRAMES = 3; // run0/run1/run2 side-facing run cycle

export interface Skin {
  id: string; // sprite-name prefix (scout|jade|royal)
  nameEn: string;
  nameAm: string;
  cost: number;
}

// Kenney "Toon Characters 1" human runners: Male Adventurer, Female Adventurer,
// Zombie — each with a real 3-frame run cycle plus jump and duck poses.
export const SKINS: Skin[] = [
  { id: 'boy', nameEn: 'Abebe', nameAm: 'አበበ', cost: 0 },   // GoPlay original Ethiorunner
  { id: 'scout', nameEn: 'Max', nameAm: 'ማክስ', cost: 0 },
  { id: 'jade', nameEn: 'Mia', nameAm: 'ሚያ', cost: 250 },
  { id: 'royal', nameEn: 'Zombie', nameAm: 'ዞምቢ', cost: 600 },
];

// Map every vendored PNG to a single-frame sheet (whole image = frame 0).
export function sheetDefs(): Record<string, SheetDef> {
  const defs: Record<string, SheetDef> = {};
  for (const [path, url] of Object.entries(urls)) {
    const name = path.slice('./kenney/'.length, -'.png'.length);
    defs[name] = { src: url };
  }
  return defs;
}

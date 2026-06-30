// Temple Dash runners — custom 3D-style skin PNGs. Animated skins ship one PNG per
// pose under skins/<id>/; others reuse a single thumb for every pose. Kenney CC0
// assets remain for obstacles/coins/backgrounds.

import type { SheetDef } from '../../engine/assets';

const urls = import.meta.glob(['./kenney/*.png', './skins/*.png', './skins/**/*.png', '!./skins/**/run/**', '!./skins/**/img/**'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const WALK_FRAMES = 6;
/** Stride animation rate at base run speed (lower = slower leg cycle). */
export const WALK_PHASE_RATE = 8;

/** Normalized sprite canvas (keep in sync with skins/ethio_f/manifest.json). */
export const SKIN_SPRITE_W = 515;
export const SKIN_SPRITE_H = 732;
export const SKIN_ASPECT = SKIN_SPRITE_W / SKIN_SPRITE_H;
export const DEFAULT_SKIN_ID = 'ethio_f';

export interface Skin {
  id: string;
  nameEn: string;
  nameAm: string;
  cost: number;
  /** Static skin image for shop thumbnail. */
  thumb: string;
}

export const SKINS: Skin[] = [
  { id: DEFAULT_SKIN_ID, nameEn: 'Ethio Star', nameAm: 'ኢትዮ ኮከብ', cost: 0, thumb: './skins/ethio_f.png' },
];

const POSES = [
  'stand',
  'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6',
  'jump', 'slide',
] as const;

function assetUrl(relativePath: string): string {
  const suffix = relativePath.replace('./', '');
  const key = Object.keys(urls).find((k) => k.endsWith(suffix));
  return key ? urls[key] : '';
}

function skinThumbSrc(skin: Skin): string {
  return assetUrl(skin.thumb);
}

/** Per-pose PNG when present, otherwise the skin thumb (static skins). */
function skinPoseSrc(skinId: string, pose: string): string {
  const poseSrc = assetUrl(`./skins/${skinId}/${pose}.png`);
  if (poseSrc) return poseSrc;
  const skin = SKINS.find((s) => s.id === skinId);
  return skin ? skinThumbSrc(skin) : '';
}

export function skinThumbUrl(id: string): string {
  const skin = SKINS.find((s) => s.id === id);
  return skin ? skinThumbSrc(skin) : '';
}

/** Kenney environment sprites + per-pose aliases for each runner skin. */
export function sheetDefs(): Record<string, SheetDef> {
  const defs: Record<string, SheetDef> = {};
  for (const [path, url] of Object.entries(urls)) {
    if (!path.includes('/kenney/')) continue;
    const name = path.slice(path.indexOf('/kenney/') + '/kenney/'.length, -'.png'.length);
    defs[name] = { src: url };
  }
  for (const skin of SKINS) {
    for (const pose of POSES) {
      const src = skinPoseSrc(skin.id, pose);
      if (!src) continue;
      defs[`${skin.id}_${pose}`] = { src };
    }
  }
  return defs;
}

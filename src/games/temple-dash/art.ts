// Temple Dash runners — custom 3D-style skin PNGs (one image per skin; all poses
// reuse the same sheet). Kenney CC0 assets remain for obstacles/coins/backgrounds.

import type { SheetDef } from '../../engine/assets';

const urls = import.meta.glob(['./kenney/*.png', './skins/*.png'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const WALK_FRAMES = 3;

export interface Skin {
  id: string;
  nameEn: string;
  nameAm: string;
  cost: number;
  /** Static skin image for shop thumbnail. */
  thumb: string;
}

export const SKINS: Skin[] = [
  { id: 'champion', nameEn: 'Champion', nameAm: 'ቻምፒዮን', cost: 0, thumb: './skins/champion.png' },
  { id: 'ethio_m', nameEn: 'Ethio Runner', nameAm: 'ኢትዮ ሯጭ', cost: 0, thumb: './skins/ethio_m.png' },
  { id: 'ethio_f', nameEn: 'Ethio Star', nameAm: 'ኢትዮ ኮከብ', cost: 0, thumb: './skins/ethio_f.png' },
];

const POSES = ['stand', 'walk1', 'walk2', 'walk3', 'jump', 'slide'] as const;

function skinUrl(thumbPath: string): string {
  const key = Object.keys(urls).find((k) => k.endsWith(thumbPath.replace('./', '')));
  return key ? urls[key] : '';
}

export function skinThumbUrl(id: string): string {
  const skin = SKINS.find((s) => s.id === id);
  return skin ? skinUrl(skin.thumb) : '';
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
    const src = skinUrl(skin.thumb);
    if (!src) continue;
    for (const pose of POSES) {
      defs[`${skin.id}_${pose}`] = { src };
    }
  }
  return defs;
}

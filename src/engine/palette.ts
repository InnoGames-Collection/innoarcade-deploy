// Semantic color palette with colorblind-safe variants. Games reference colors by
// role (e.g. 'a'..'e' for the five match/lane colors, plus 'good'/'bad') instead
// of hex literals, and the active palette is chosen from the global settings. The
// alternate sets are tuned for distinguishability under the three common types of
// color vision deficiency, satisfying the accessibility option in the panel.

import { settings, type Palette } from './settings';

export type Role = 'a' | 'b' | 'c' | 'd' | 'e' | 'good' | 'bad' | 'gold' | 'accent';

type Set = Record<Role, string>;

const SETS: Record<Palette, Set> = {
  default: {
    a: '#fc6e51', b: '#ffce54', c: '#48cfad', d: '#5d9cec', e: '#ac92ec',
    good: '#48cfad', bad: '#ed5565', gold: '#ffce54', accent: '#fc6e51',
  },
  // High-contrast, hue-separated ramps that stay distinct for each CVD type.
  deuteranopia: {
    a: '#e8772e', b: '#f5d400', c: '#0099c6', d: '#6f7bd6', e: '#9d5bd2',
    good: '#0099c6', bad: '#d6492f', gold: '#f5d400', accent: '#e8772e',
  },
  protanopia: {
    a: '#d98a00', b: '#f2e500', c: '#00a0a8', d: '#5a8fe6', e: '#8e6fd0',
    good: '#00a0a8', bad: '#c45a00', gold: '#f2e500', accent: '#d98a00',
  },
  tritanopia: {
    a: '#e8553e', b: '#ff8fa3', c: '#11a3a3', d: '#3f7bd6', e: '#b14fa0',
    good: '#11a3a3', bad: '#e8553e', gold: '#ff8fa3', accent: '#11a3a3',
  },
};

export function pal(role: Role): string {
  return SETS[settings.data.palette][role];
}

// The five-color ramp as an array — handy for index-keyed game pieces.
export function ramp(): string[] {
  const s = SETS[settings.data.palette];
  return [s.a, s.b, s.c, s.d, s.e];
}

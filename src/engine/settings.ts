// Global, cross-game settings persisted to localStorage. The audio engine,
// particle density and screen-fx all read from here so a single panel controls
// the feel of every game. Defaults are chosen to look great on first run while
// respecting the OS reduced-motion preference.

const KEY = 'innoarcade.settings.v1';

export type Quality = 'low' | 'high';
export type Palette = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia';

export interface SettingsData {
  master: number; // 0..1
  music: number; // 0..1
  sfx: number; // 0..1
  quality: Quality;
  palette: Palette;
  reducedMotion: boolean;
}

function osReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function defaults(): SettingsData {
  return {
    master: 0.8,
    music: 0.6,
    sfx: 0.9,
    quality: 'high',
    palette: 'default',
    reducedMotion: osReducedMotion(),
  };
}

class Settings {
  data: SettingsData;
  private listeners: Array<(s: SettingsData) => void> = [];

  constructor() {
    this.data = this.read();
  }

  private read(): SettingsData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...defaults(), ...JSON.parse(raw) };
    } catch { /* fall through */ }
    return defaults();
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data[key] = value;
    localStorage.setItem(KEY, JSON.stringify(this.data));
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn: (s: SettingsData) => void): void {
    this.listeners.push(fn);
  }

  // Particle-count multiplier derived from quality (and zeroed-ish for reduced motion).
  get particleScale(): number {
    if (this.data.reducedMotion) return 0.25;
    return this.data.quality === 'high' ? 1 : 0.5;
  }
}

export const settings = new Settings();

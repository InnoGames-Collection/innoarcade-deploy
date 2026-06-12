// Versioned player profile: a single localStorage record holding the coin
// wallet, per-game stats (best score, plays, unlocks) and owned skins. Replaces
// the old one-key high-score store while staying backward compatible — legacy
// `innoarcade.<game>.best` values are migrated on first read.

const KEY = 'innoarcade.profile.v1';
const LEGACY_PREFIX = 'innoarcade.';

export interface GameStats {
  best: number;
  plays: number;
  totalScore: number;
  unlocks: string[]; // ids of unlocked skins/power-ups for this game
}

interface ProfileData {
  version: 1;
  coins: number;
  selectedSkin: Record<string, string>; // game -> skin id
  games: Record<string, GameStats>;
}

function emptyStats(): GameStats {
  return { best: 0, plays: 0, totalScore: 0, unlocks: [] };
}

class Profile {
  private data: ProfileData;
  private listeners: Array<() => void> = [];

  constructor() {
    this.data = this.read();
  }

  private read(): ProfileData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as ProfileData;
    } catch { /* fall through to fresh profile */ }
    return { version: 1, coins: 0, selectedSkin: {}, games: {} };
  }

  private save(): void {
    localStorage.setItem(KEY, JSON.stringify(this.data));
    for (const fn of this.listeners) fn();
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  stats(game: string): GameStats {
    if (!this.data.games[game]) {
      const s = emptyStats();
      // Migrate a legacy best score if present.
      const legacy = Number(localStorage.getItem(`${LEGACY_PREFIX}${game}.best`));
      if (legacy > 0) s.best = legacy;
      this.data.games[game] = s;
    }
    return this.data.games[game];
  }

  get coins(): number {
    return this.data.coins;
  }

  addCoins(n: number): void {
    this.data.coins = Math.max(0, this.data.coins + n);
    this.save();
  }

  spendCoins(n: number): boolean {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  }

  // Records a finished run; returns true when it set a new best.
  recordRun(game: string, score: number): boolean {
    const s = this.stats(game);
    s.plays++;
    s.totalScore += score;
    const record = score > s.best;
    if (record) s.best = score;
    this.save();
    return record;
  }

  isUnlocked(game: string, id: string): boolean {
    return this.stats(game).unlocks.includes(id);
  }

  unlock(game: string, id: string): void {
    const s = this.stats(game);
    if (!s.unlocks.includes(id)) {
      s.unlocks.push(id);
      this.save();
    }
  }

  selectedSkin(game: string, fallback: string): string {
    return this.data.selectedSkin[game] ?? fallback;
  }

  selectSkin(game: string, id: string): void {
    this.data.selectedSkin[game] = id;
    this.save();
  }
}

export const profile = new Profile();

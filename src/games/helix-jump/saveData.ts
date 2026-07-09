import { SAVE_KEY } from './constants';

export interface HelixSave {
  best: number;
  coins: number;
  unlockedSkins: string[];
  selectedSkin: string;
  musicOn: boolean;
  vibrateOn: boolean;
  lastDailyMs: number;
  totalPlays: number;
  achievements: string[];
}

const DEFAULT: HelixSave = {
  best: 0,
  coins: 0,
  unlockedSkins: ['classic', 'ethio-green'],
  selectedSkin: 'ethio-green',
  musicOn: true,
  vibrateOn: true,
  lastDailyMs: 0,
  totalPlays: 0,
  achievements: [],
};

let cache: HelixSave | null = null;

export function loadSave(): HelixSave {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      cache = { ...DEFAULT, ...JSON.parse(raw) as Partial<HelixSave> };
      return cache;
    }
  } catch { /* ignore */ }
  cache = { ...DEFAULT };
  return cache;
}

export function persistSave(save: HelixSave): void {
  cache = save;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch { /* ignore */ }
}

export function addCoins(amount: number): void {
  const s = loadSave();
  s.coins += amount;
  persistSave(s);
}

export function claimDailyReward(): number {
  const s = loadSave();
  const now = Date.now();
  const day = 86_400_000;
  if (now - s.lastDailyMs < day) return 0;
  s.lastDailyMs = now;
  const reward = 25 + Math.min(50, s.totalPlays);
  s.coins += reward;
  persistSave(s);
  return reward;
}

export function recordPlay(score: number): { record: boolean; coinsEarned: number } {
  const s = loadSave();
  s.totalPlays++;
  const record = score > s.best;
  if (record) s.best = score;
  const coinsEarned = Math.floor(score / 3);
  s.coins += coinsEarned;
  if (score >= 50 && !s.achievements.includes('depth50')) s.achievements.push('depth50');
  if (score >= 100 && !s.achievements.includes('depth100')) s.achievements.push('depth100');
  persistSave(s);
  return { record, coinsEarned };
}

export function toggleMusic(): boolean {
  const s = loadSave();
  s.musicOn = !s.musicOn;
  persistSave(s);
  return s.musicOn;
}

export function toggleVibrate(): boolean {
  const s = loadSave();
  s.vibrateOn = !s.vibrateOn;
  persistSave(s);
  return s.vibrateOn;
}

export function vibrate(ms = 12): void {
  const s = loadSave();
  if (!s.vibrateOn) return;
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

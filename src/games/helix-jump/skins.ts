import { loadSave, type HelixSave } from './saveData';

export interface BallSkin {
  id: string;
  name: string;
  color: string;
  cost: number;
}

export const BALL_SKINS: BallSkin[] = [
  { id: 'classic', name: 'Classic', color: '#ffffff', cost: 0 },
  { id: 'ethio-green', name: 'Ethio Green', color: '#2ecc71', cost: 0 },
  { id: 'telecom-blue', name: 'Telecom Blue', color: '#1e88e5', cost: 150 },
  { id: 'sky', name: 'Sky', color: '#42a5f5', cost: 200 },
  { id: 'mint', name: 'Mint', color: '#26c6da', cost: 250 },
  { id: 'gold', name: 'Gold', color: '#ffd54f', cost: 400 },
  { id: 'coral', name: 'Coral', color: '#ff7043', cost: 500 },
];

export function getBallSkin(save: HelixSave): BallSkin {
  const skin = BALL_SKINS.find((s) => s.id === save.selectedSkin);
  return skin ?? BALL_SKINS[0];
}

export function unlockableSkins(save: HelixSave): BallSkin[] {
  return BALL_SKINS.filter((s) => save.unlockedSkins.includes(s.id));
}

export function tryUnlockSkin(save: HelixSave, skinId: string): boolean {
  const skin = BALL_SKINS.find((s) => s.id === skinId);
  if (!skin || save.unlockedSkins.includes(skinId)) return false;
  if (save.coins < skin.cost) return false;
  save.coins -= skin.cost;
  save.unlockedSkins.push(skinId);
  return true;
}

export function ballColorForSave(): string {
  return getBallSkin(loadSave()).color;
}

import { describe, expect, it } from 'vitest';
import {
  dailyChallengeSeed,
  endlessLevelSpec,
  gemCatalogProgress,
  roundLabel,
  sessionSeed,
} from './meta';

describe('tubeSort meta', () => {
  it('daily seed is stable per day and game', () => {
    const a = dailyChallengeSeed('water-sort');
    const b = dailyChallengeSeed('water-sort');
    const c = dailyChallengeSeed('ball-sort');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('sessionSeed uses daily seed for daily mode', () => {
    expect(sessionSeed('daily', 'water-sort')).toBe(dailyChallengeSeed('water-sort'));
  });

  it('endless spec escalates past level 8', () => {
    const l8 = endlessLevelSpec(8);
    const l16 = endlessLevelSpec(16);
    expect(l16.shuffle).toBeGreaterThan(l8.shuffle);
    expect(l16.parMoves).toBeGreaterThan(l8.parMoves);
  });

  it('round label shows endless marker', () => {
    expect(roundLabel(7, 'classic')).toBe('8/8');
    expect(roundLabel(10, 'endless')).toBe('∞ 11');
    expect(roundLabel(0, 'daily')).toContain('☀');
  });

  it('gem catalog starts empty for test id', () => {
    const p = gemCatalogProgress('test-game-xyz');
    expect(p.collected).toBe(0);
    expect(p.total).toBe(8);
  });
});

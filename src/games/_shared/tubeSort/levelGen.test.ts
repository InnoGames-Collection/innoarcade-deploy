import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../_lq/rng';
import { isSolved } from './gameRules';
import { generateLevel, hasOpeningMove, isSolvable, LEVEL_COUNT } from './levelGen';

function countMixedTubes(tubes: number[][]): number {
  return tubes.filter((t) => t.length >= 2 && new Set(t).size >= 2).length;
}

describe('tubeSort levelGen', () => {
  it('generates non-solved boards with mixed colors for all 8 levels', () => {
    const rnd = mulberry32(42);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd);
      expect(isSolved(lvl.tubes, lvl.mods), `level ${i + 1} should not start solved`).toBe(false);
      expect(lvl.tubes.length).toBeGreaterThan(0);
      expect(countMixedTubes(lvl.tubes), `level ${i + 1} needs mixed tubes`).toBeGreaterThanOrEqual(2);
    }
  }, 15000);

  it('ball sort levels start mixed and playable with single-ball moves', () => {
    const rnd = mulberry32(77);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd, 'single');
      expect(isSolved(lvl.tubes, lvl.mods)).toBe(false);
      expect(countMixedTubes(lvl.tubes)).toBeGreaterThanOrEqual(1);
    }
  }, 15000);

  it('locked levels pass bounded solvability check', () => {
    const rnd = mulberry32(99);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd);
      if (lvl.spec.modifiers.includes('locked')) {
        expect(isSolvable(lvl.tubes, lvl.mods)).toBe(true);
      }
    }
  }, 15000);

  it('water sort early levels are playable and modifier levels are solvable', () => {
    const rnd = mulberry32(1234);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd, 'run');
      expect(hasOpeningMove(lvl.tubes, lvl.mods), `level ${i + 1} needs opening move`).toBe(true);
      if (lvl.spec.modifiers.length > 0) {
        expect(isSolvable(lvl.tubes, lvl.mods, 'run'), `level ${i + 1} must be winnable`).toBe(true);
      }
    }
  }, 20000);

  it('generates all 8 levels quickly (< 20000ms)', () => {
    const rnd = mulberry32(7);
    const t0 = performance.now();
    for (let i = 0; i < LEVEL_COUNT; i++) generateLevel(i, rnd);
    for (let i = 0; i < LEVEL_COUNT; i++) generateLevel(i, rnd, 'single');
    expect(performance.now() - t0).toBeLessThan(20000);
  });
});

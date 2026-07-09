import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../_lq/rng';
import { isSolved } from './gameRules';
import { generateLevel, isSolvable, LEVEL_COUNT } from './levelGen';
// tubeSort shared module

describe('tubeSort levelGen', () => {
  it('generates non-solved boards for all 8 levels', () => {
    const rnd = mulberry32(42);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd);
      expect(isSolved(lvl.tubes, lvl.mods), `level ${i + 1} should not start solved`).toBe(false);
      expect(lvl.tubes.length).toBeGreaterThan(0);
    }
  });

  it('locked levels pass bounded solvability check', () => {
    const rnd = mulberry32(99);
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const lvl = generateLevel(i, rnd);
      if (lvl.spec.modifiers.includes('locked')) {
        expect(isSolvable(lvl.tubes, lvl.mods)).toBe(true);
      }
    }
  });

  it('generates all 8 levels quickly (< 500ms)', () => {
    const rnd = mulberry32(7);
    const t0 = performance.now();
    for (let i = 0; i < LEVEL_COUNT; i++) generateLevel(i, rnd);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

/** Seeded RNG helpers — no DOM/audio deps (safe for unit tests). */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayNumber(): number { return Math.floor(Date.now() / 86400000); }

export function shuffled<T>(arr: T[], rnd?: () => number): T[] {
  const a = arr.slice();
  const r = rnd || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randInt(lo: number, hi: number, rnd?: () => number): number {
  return lo + Math.floor((rnd || Math.random)() * (hi - lo + 1));
}

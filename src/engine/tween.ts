// Easing functions and a tiny tween/timeline runner. No allocations in the hot
// path beyond the tween objects themselves; tweens self-remove when finished.

export type Easing = (t: number) => number;

// Penner-style easings, all normalized to f(0)=0, f(1)=1.
export const Ease = {
  linear: (t: number): number => t,
  inQuad: (t: number): number => t * t,
  outQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t: number): number => t * t * t,
  outCubic: (t: number): number => 1 - (1 - t) ** 3,
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number): number => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t: number): number => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
} as const;

interface Tween {
  elapsed: number;
  dur: number;
  delay: number;
  ease: Easing;
  from: number;
  to: number;
  onUpdate: (v: number) => void;
  onDone?: () => void;
}

export class Tweens {
  private active: Tween[] = [];

  to(
    from: number,
    to: number,
    dur: number,
    onUpdate: (v: number) => void,
    opts: { ease?: Easing; delay?: number; onDone?: () => void } = {},
  ): void {
    this.active.push({
      elapsed: 0,
      dur: Math.max(dur, 0.0001),
      delay: opts.delay ?? 0,
      ease: opts.ease ?? Ease.outQuad,
      from,
      to,
      onUpdate,
      onDone: opts.onDone,
    });
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tw = this.active[i];
      if (tw.delay > 0) {
        tw.delay -= dt;
        continue;
      }
      tw.elapsed += dt;
      const k = Math.min(tw.elapsed / tw.dur, 1);
      tw.onUpdate(tw.from + (tw.to - tw.from) * tw.ease(k));
      if (k >= 1) {
        tw.onDone?.();
        this.active.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.active.length = 0;
  }
}

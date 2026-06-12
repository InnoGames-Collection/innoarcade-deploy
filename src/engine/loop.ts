// Fixed requestAnimationFrame loop with a clamped delta so a background tab
// doesn't produce a giant timestep on resume.

export class GameLoop {
  private raf = 0;
  private last = 0;
  running = false;

  constructor(
    private update: (dt: number) => void,
    private render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamp to [0, 0.05]: a background tab can produce a huge step, and an rAF
      // timestamp can trail the performance.now() baseline (negative step).
      const dt = Math.max(0, Math.min((now - this.last) / 1000, 0.05));
      this.last = now;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

// Frame-based sprite animation. A clip is a named sequence of frame indices into
// a loaded sheet (see assets.ts) played at a given fps. The Animator advances the
// current clip by dt and exposes the frame index to draw. Designed for character
// states like run / jump / slide that swap instantly and may or may not loop.

import type { AssetStore } from './assets';

export interface Clip {
  frames: number[];
  fps: number;
  loop?: boolean; // default true
}

export class Animator {
  private clips: Record<string, Clip>;
  private current: string;
  private t = 0;
  private frameIdx = 0;
  private finished = false;

  constructor(clips: Record<string, Clip>, initial: string) {
    this.clips = clips;
    this.current = initial;
  }

  // Switch clips. `force` restarts even if already on this clip.
  play(name: string, force = false): void {
    if (this.current === name && !force) return;
    if (!this.clips[name]) return;
    this.current = name;
    this.t = 0;
    this.frameIdx = 0;
    this.finished = false;
  }

  get clipName(): string {
    return this.current;
  }

  get done(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    const clip = this.clips[this.current];
    if (!clip || clip.frames.length <= 1) return;
    this.t += dt;
    const frameDur = 1 / clip.fps;
    while (this.t >= frameDur) {
      this.t -= frameDur;
      this.frameIdx++;
      if (this.frameIdx >= clip.frames.length) {
        if (clip.loop === false) {
          this.frameIdx = clip.frames.length - 1;
          this.finished = true;
          break;
        }
        this.frameIdx = 0;
      }
    }
  }

  // Current frame index into the sheet.
  frame(): number {
    const clip = this.clips[this.current];
    return clip ? clip.frames[this.frameIdx] ?? 0 : 0;
  }

  // Convenience: draw the current frame centered at (x, y) with a size, with
  // optional horizontal flip. Falls back silently if the sheet isn't loaded.
  draw(
    assets: AssetStore,
    sheet: string,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    flip = false,
  ): void {
    if (!assets.has(sheet)) return;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    assets.draw(ctx, sheet, this.frame(), -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// Responsive canvas manager. Games render in a fixed "design" coordinate space
// (e.g. 480×720); the Viewport fits that space into any window, preserving aspect
// ratio with letterboxing, and sets a device-pixel-correct backing store so art
// stays crisp on hi-dpi screens. It also maps pointer coordinates back into
// design space so input is resolution-independent.

import { settings } from './settings';

export class Viewport {
  readonly ctx: CanvasRenderingContext2D;
  scale = 1; // backing-store pixels per design unit

  constructor(
    private canvas: HTMLCanvasElement,
    readonly designW: number,
    readonly designH: number,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
  }

  // Fit the design rect into the available window box, preserving aspect ratio.
  resize(): void {
    const margin = 0;
    const availW = Math.max(1, window.innerWidth - margin);
    const availH = Math.max(1, window.innerHeight - margin);
    const fit = Math.min(availW / this.designW, availH / this.designH);
    const cssW = Math.round(this.designW * fit);
    const cssH = Math.round(this.designH * fit);

    // Render at device resolution, capped for fill-rate on low-end/low quality.
    const dprCap = settings.data.quality === 'high' ? 2 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.scale = (cssW / this.designW) * dpr;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(this.designW * this.scale);
    this.canvas.height = Math.round(this.designH * this.scale);
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  // Re-apply the base transform (call at the start of each frame after any
  // game-level ctx.save/restore juggling).
  beginFrame(): void {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  // Convert a DOM pointer event position into design-space coordinates.
  toDesign(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * this.designW,
      y: ((clientY - r.top) / r.height) * this.designH,
    };
  }
}

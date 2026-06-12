// Multi-layer parallax background. Each layer scrolls at a fraction of the world
// speed (depth illusion) and tiles horizontally. A layer can be drawn from a
// loaded sprite sheet (real art) or by a procedural paint callback (gradients,
// silhouettes), so the same system covers both halves of the hybrid art plan.

import type { AssetStore } from './assets';

export interface ParallaxLayer {
  factor: number; // 0 = fixed to camera, 1 = moves with world
  sheet?: string; // sprite name in the AssetStore to tile
  tileW?: number; // width of one tile in design px (defaults to layer height * art ratio)
  y?: number; // top offset in design px
  height?: number; // draw height in design px
  paint?: (ctx: CanvasRenderingContext2D, offset: number, w: number, h: number) => void;
}

export class Parallax {
  constructor(
    private layers: ParallaxLayer[],
    private viewW: number,
    private viewH: number,
  ) {}

  // `dist` is the world scroll distance in design px (monotonic).
  render(ctx: CanvasRenderingContext2D, dist: number, assets?: AssetStore): void {
    for (const layer of this.layers) {
      const offset = dist * layer.factor;
      const h = layer.height ?? this.viewH;
      const y = layer.y ?? 0;

      if (layer.paint) {
        ctx.save();
        ctx.translate(0, y);
        layer.paint(ctx, offset, this.viewW, h);
        ctx.restore();
        continue;
      }

      if (layer.sheet && assets?.has(layer.sheet)) {
        const tileW = layer.tileW ?? h;
        // Tile across the viewport, wrapping by the scroll offset.
        let startX = -(offset % tileW);
        if (startX > 0) startX -= tileW;
        for (let x = startX; x < this.viewW; x += tileW) {
          assets.draw(ctx, layer.sheet, 0, x, y, tileW, h);
        }
      }
    }
  }
}

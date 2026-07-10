// Composes the full visual frame from a read-only gameplay snapshot.
// All rendering lives here — game.ts only supplies data.

import { OrchardBackground } from './background';
import {
  createJuiceBurst, createBombBurst, updateParticles, drawParticles,
  drawSliceTrail, drawComboEffect, type VfxParticle,
} from './effects';
import { drawFruit, drawBomb, drawSlicedHalf, getFruitColor } from './fruits';
import { drawWarmGrade, drawSunWash, drawPlayfieldBloom, drawDepthVignette } from './lighting';

export type FruitType = 'apple' | 'banana' | 'cherry' | 'orange' | 'peach';

export interface SceneFruit {
  x: number;
  y: number;
  type: FruitType;
  sliced: boolean;
  sliceTime: number;
  rot: number;
}

export interface SceneBomb {
  x: number;
  y: number;
  hit: boolean;
}

export interface SceneSlice {
  points: Array<{ x: number; y: number }>;
  createdAt: number;
}

export interface SceneSnapshot {
  time: number;
  combo: number;
  comboFlash: number;
  screenShake: number;
  fruits: SceneFruit[];
  bombs: SceneBomb[];
  particles: VfxParticle[];
  slices: SceneSlice[];
  currentSlice: Array<{ x: number; y: number }>;
  fruitRadius: number;
  bombRadius: number;
}

export { createJuiceBurst, createBombBurst, updateParticles, type VfxParticle };

export class SceneRenderer {
  private bg = new OrchardBackground();
  private menuBgTime = 0;

  updateBackground(dt: number): void {
    this.bg.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, snap: SceneSnapshot): void {
    const shake = snap.screenShake * 4;
    const W = 480;
    const H = 720;

    ctx.save();
    ctx.translate(shake * (Math.random() - 0.5), shake * (Math.random() - 0.5));

    this.bg.render(ctx, snap.time);
    drawSunWash(ctx, snap.time);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    drawPlayfieldBloom(ctx, snap.fruits, getFruitColor);

    for (const bomb of snap.bombs) {
      if (!bomb.hit) drawBomb(ctx, bomb.x, bomb.y, snap.bombRadius, snap.time);
    }

    for (const fruit of snap.fruits) {
      if (fruit.sliced) {
        const alpha = Math.max(0, 1 - fruit.sliceTime / 0.3);
        const offset = fruit.sliceTime * 60;
        drawSlicedHalf(ctx, fruit.x - offset, fruit.y + offset * 0.3, snap.fruitRadius, fruit.type, -1, alpha);
        drawSlicedHalf(ctx, fruit.x + offset, fruit.y + offset * 0.3, snap.fruitRadius, fruit.type, 1, alpha);
        continue;
      }
      drawFruit(ctx, fruit.x, fruit.y, snap.fruitRadius, fruit.type, fruit.rot, 1);
    }

    for (const s of snap.slices) {
      drawSliceTrail(ctx, s.points, snap.time - s.createdAt, 0.15);
    }
    if (snap.currentSlice.length > 1) {
      drawSliceTrail(ctx, snap.currentSlice, 0, 0.15);
    }

    drawParticles(ctx, snap.particles);

    if (snap.combo >= 2 && snap.comboFlash > 0) {
      drawComboEffect(ctx, snap.combo, snap.comboFlash, W / 2, H * 0.35);
    }

    drawWarmGrade(ctx);
    drawDepthVignette(ctx);

    ctx.restore();
    ctx.restore();
  }

  renderMenuBg(ctx: CanvasRenderingContext2D): void {
    this.menuBgTime += 0.016;
    this.bg.update(0.016);
    this.bg.renderMenu(ctx, this.menuBgTime);
  }
}

// ═══════════════════════════════════════════════════════════════
//  RENDERING ENGINE — Fruit Slice
//  All canvas drawing lives here. Game engine is frozen.
// ═══════════════════════════════════════════════════════════════

import { OrchardBackground } from './drawBackground';
import { drawFruit, drawSlicedHalf } from './drawFruits';
import { drawBomb } from './drawBombs';
import {
  createJuiceBurst, createBombBurst, updateParticles, drawParticles,
} from './drawParticles';
import { drawSliceTrail, drawComboEffect } from './drawEffects';
import {
  drawSunWash, drawFruitBloom, drawWarmGrade, drawDepthVignette, drawPlayfieldFocus,
} from './drawLighting';
import type { RenderSnapshot, VfxParticle } from './types';
import { RW as W, RH as H } from './types';

export type { VfxParticle, RenderSnapshot };
export { createJuiceBurst, createBombBurst, updateParticles };

/** Main rendering engine — composes every draw pass per frame. */
export class SceneRenderer {
  private bg = new OrchardBackground();
  private menuTime = 0;

  updateBackground(dt: number): void {
    this.bg.update(dt);
  }

  render(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const shake = snap.screenShake * 4;
    ctx.save();
    ctx.translate(shake * (Math.random() - 0.5), shake * (Math.random() - 0.5));

    // ── Layer 0: parallax orchard ──
    this.bg.render(ctx, snap.time);
    drawSunWash(ctx, snap.time);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // ── Layer 1: playfield lighting ──
    drawFruitBloom(ctx, snap.fruits);
    drawPlayfieldFocus(ctx);

    // ── Layer 2: gameplay objects ──
    for (const bomb of snap.bombs) {
      if (!bomb.hit) drawBomb(ctx, bomb.x, bomb.y, snap.bombRadius, snap.time);
    }
    for (const fruit of snap.fruits) {
      if (fruit.sliced) {
        const alpha = Math.max(0, 1 - fruit.sliceTime / 0.3);
        const off = fruit.sliceTime * 60;
        drawSlicedHalf(ctx, fruit.x - off, fruit.y + off * 0.3, snap.fruitRadius, fruit.type, -1, alpha);
        drawSlicedHalf(ctx, fruit.x + off, fruit.y + off * 0.3, snap.fruitRadius, fruit.type, 1, alpha);
      } else {
        drawFruit(ctx, fruit.x, fruit.y, snap.fruitRadius, fruit.type, fruit.rot);
      }
    }

    // ── Layer 3: effects ──
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

    // ── Layer 4: post-process ──
    drawWarmGrade(ctx);
    drawDepthVignette(ctx);

    ctx.restore();
    ctx.restore();
  }

  renderMenuBg(ctx: CanvasRenderingContext2D): void {
    this.menuTime += 0.016;
    this.bg.update(0.016);
    this.bg.renderMenu(ctx, this.menuTime);
  }
}

// Alias for documentation clarity
export { SceneRenderer as RenderingEngine };

// Screen juice: camera shake, hit-stop (brief freeze on impact), full-screen
// flashes and fade transitions. A game wraps its world-space rendering between
// fx.preRender(ctx) / fx.postRender(ctx) so the shake offset and flash overlay
// apply automatically. Honors reduced-motion by damping shake to zero.

export class ScreenFx {
  private shakeMag = 0;
  private shakeT = 0;
  private shakeDur = 0;
  private flashAlpha = 0;
  private flashColor = '#fff';
  private freezeT = 0;
  reducedMotion = false;

  shakeX = 0;
  shakeY = 0;

  // Trauma-based shake: magnitude in px, duration in seconds.
  shake(mag: number, dur = 0.3): void {
    if (this.reducedMotion) return;
    if (mag > this.shakeMag || this.shakeT <= 0) {
      this.shakeMag = mag;
      this.shakeDur = dur;
      this.shakeT = dur;
    }
  }

  flash(color = '#ffffff', strength = 0.6): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }

  // Freeze gameplay for `secs` (impact emphasis). The game should multiply its
  // dt by the value from frozen() — see update().
  hitStop(secs = 0.06): void {
    if (this.reducedMotion) return;
    this.freezeT = Math.max(this.freezeT, secs);
  }

  frozen(): boolean {
    return this.freezeT > 0;
  }

  update(dt: number): void {
    if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur);
      const amp = this.shakeMag * k * k;
      this.shakeX = (Math.random() * 2 - 1) * amp;
      this.shakeY = (Math.random() * 2 - 1) * amp;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
  }

  preRender(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
  }

  postRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.restore();
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  reset(): void {
    this.shakeMag = this.shakeT = this.flashAlpha = this.freezeT = 0;
    this.shakeX = this.shakeY = 0;
  }
}

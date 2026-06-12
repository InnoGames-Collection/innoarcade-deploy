// Lightweight 2D camera with smooth follow. Games translate the context by
// (-x, -y) between camera.apply()/restore() to render in world space. Follow uses
// exponential smoothing so the camera eases toward its target without overshoot.

export class Camera {
  x = 0;
  y = 0;
  private targetX = 0;
  private targetY = 0;
  private stiffness: number;

  constructor(stiffness = 6) {
    this.stiffness = stiffness;
  }

  follow(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  snap(x: number, y: number): void {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-this.stiffness * dt);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  restore(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}

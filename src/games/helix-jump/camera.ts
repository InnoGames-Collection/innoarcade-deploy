import { CAM_LERP, CAM_OFFSET, H } from './constants';

export class CameraController {
  y = 0;
  shake = 0;

  follow(ballY: number, dt: number): void {
    const target = ballY - H * CAM_OFFSET;
    const t = Math.min(1, dt * CAM_LERP);
    this.y += (target - this.y) * t;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 9);
  }

  apply(ctx: CanvasRenderingContext2D): void {
    if (this.shake <= 0) return;
    const s = this.shake * 4;
    ctx.translate(s * (Math.random() - 0.5), s * (Math.random() - 0.5));
  }

  reset(): void {
    this.y = 0;
    this.shake = 0;
  }
}

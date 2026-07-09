/** Smooth tower rotation with drag momentum. */

const DRAG_SENS = 0.0075;
const IMPULSE_SENS = 0.014;
const TAP_IMPULSE = Math.PI / 3.2;
const SWIPE_IMPULSE = Math.PI / 4.5;
const FRICTION = 5.2;

export class RotationController {
  angle = 0;
  private velocity = 0;

  drag(dx: number): void {
    this.angle += dx * DRAG_SENS;
    this.velocity += dx * IMPULSE_SENS;
  }

  tap(): void {
    this.velocity += TAP_IMPULSE;
  }

  swipeLeft(): void {
    this.velocity -= SWIPE_IMPULSE;
  }

  swipeRight(): void {
    this.velocity += SWIPE_IMPULSE;
  }

  update(dt: number): void {
    this.angle += this.velocity * dt;
    this.velocity *= Math.exp(-FRICTION * dt);
  }

  reset(): void {
    this.angle = 0;
    this.velocity = 0;
  }
}

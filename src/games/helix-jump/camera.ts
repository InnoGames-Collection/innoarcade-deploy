import * as THREE from 'three';
import { CAM_FOV, CAM_LOOK_Y, CAM_LOOK_Z, CAM_Y, CAM_Z } from './constants';
import { clamp } from './easing';

/** Vertical bias so the fixed ball rig sits ~40% above the bottom of the view. */
const CAM_FRAMING_Y = 0.55;
/** Max allowed lag (game Y) before the camera hard-catches-up. */
const MAX_LAG = 1.0;
/** Predictive lead while falling fast (seconds of motion). */
const FALL_PREDICT = 0.07;

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  private smoothY = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(CAM_FOV, aspect, 0.1, 120);
    this.applyView();
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  follow(ballY: number, ballVy: number, _combo: number, _fever: boolean, dt: number): void {
    const falling = ballVy > 0.4;
    const rising = ballVy < -0.4;

    let stiffness = 6.5;
    if (falling) {
      stiffness = 11 + clamp(ballVy, 0, 14) * 2.4;
    } else if (rising) {
      stiffness = 8.5;
    }

    const alpha = 1 - Math.exp(-stiffness * dt);
    const predict = falling ? ballVy * FALL_PREDICT : 0;
    const goal = ballY + predict;

    this.smoothY += (goal - this.smoothY) * alpha;

    const lag = ballY - this.smoothY;
    if (lag > MAX_LAG) {
      this.smoothY += (lag - MAX_LAG) * clamp(alpha * 3.2, 0, 1);
    } else if (lag < -0.55) {
      this.smoothY += (lag + 0.55) * clamp(alpha * 2.2, 0, 1);
    }
  }

  /** Shake disabled — camera follow only. */
  addShake(_amount: number): void {
    // no-op
  }

  addImpactPunch(_amount: number): void {
    // no-op
  }

  update(_dt: number): void {
    // no shake decay
  }

  applyView(): void {
    const y = this.smoothY + CAM_FRAMING_Y;
    this.camera.position.set(0, CAM_Y + y, CAM_Z);
    this.camera.lookAt(0, CAM_LOOK_Y + y, CAM_LOOK_Z);
  }

  reset(): void {
    this.smoothY = 0;
    this.camera.fov = CAM_FOV;
    this.camera.updateProjectionMatrix();
    this.applyView();
  }

  snapTo(ballY = 0): void {
    this.smoothY = ballY;
    this.applyView();
  }
}

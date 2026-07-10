import * as THREE from 'three';
import { CAM_OFFSET, H } from './constants';

const WORLD_PER_PX = 0.018;

/**
 * Ball-fixed camera: ball stays centered on screen.
 * Vertical scroll is simulated by moving platforms; camera adds smooth follow feel.
 */
export class CameraController {
  y = 0;
  shake = 0;
  private vel = 0;
  private shakeX = 0;
  private shakeY = 0;

  readonly camera: THREE.PerspectiveCamera;

  private static readonly CAM_Y = 5.8;
  private static readonly CAM_Z = 8.5;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 120);
    this.camera.position.set(0, CameraController.CAM_Y, CameraController.CAM_Z);
    this.camera.lookAt(0, 0, 0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  follow(ballY: number, ballVy: number, dt: number): void {
    const lookAhead = Math.max(-1.5, Math.min(1.2, ballVy * 0.04));
    const target = ballY - H * CAM_OFFSET * WORLD_PER_PX + lookAhead;
    const stiffness = 36;
    const damping = 11;
    const diff = target - this.y;
    this.vel += (diff * stiffness - this.vel * damping) * dt;
    this.y += this.vel * dt;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 9);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.shakeX = s * (Math.random() - 0.5);
      this.shakeY = s * (Math.random() - 0.5);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  applyView(ballOffset = new THREE.Vector3()): void {
    const scrollY = -this.y * 0.04;
    this.camera.position.set(
      ballOffset.x + this.shakeX,
      CameraController.CAM_Y + this.shakeY + scrollY * 0.15,
      CameraController.CAM_Z,
    );
    this.camera.lookAt(
      ballOffset.x + this.shakeX * 0.25,
      ballOffset.y + scrollY * 0.1,
      ballOffset.z,
    );
  }

  reset(): void {
    this.y = 0;
    this.vel = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  snapTo(ballY: number): void {
    this.y = ballY - H * CAM_OFFSET * WORLD_PER_PX;
    this.vel = 0;
  }
}

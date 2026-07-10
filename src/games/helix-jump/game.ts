/**
 * Helix Jump — premium 3D arcade orchestrator.
 */

import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { CameraController } from './camera';
import {
  BALL_CONTACT_ANGLE, BALL_CONTACT_R, COMBO_CAP, FEVER_DURATION, FEVER_THRESHOLD,
  RING_COLORS, RING_HEIGHT, STREAK_SHATTER_THRESHOLD, THEME, BALL_R,
} from './constants';
import {
  applyBounce,
  applyFallBoost,
  clearYThroughRing,
  findSweepCollision,
  gravityForDepth,
  integrateBall,
  restYOnPlatform,
  substepCount,
} from './physics';
import { clearGeometryCache } from './geometry';
import { drawFlash, drawHud } from './renderer';
import { RotationController } from './rotation';
import { BALL_SKINS, getBallSkin, type BallSkin } from './skins';
import { loadSave, recordPlay, vibrate } from './saveData';
import { createRing, resetRingIds, towerConfigForDepth } from './towerGenerator';
import type { BallState, GameState, Ring } from './types';
import { HelixWorld } from './world';

export { W, H } from './constants';
export type { GameState } from './types';

export class HelixJump {
  state: GameState = 'menu';
  score = 0;
  best = 0;
  coins = 0;
  combo = 0;
  feverLeft = 0;
  depth = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  readonly world: HelixWorld;

  private ball: BallState = { y: 0, vy: 0, squash: 1, squashVel: 0, colorIndex: 1 };
  private rotation = new RotationController();
  private camera: CameraController;
  private rings: Ring[] = [];
  private rnd = mulberry32(7);
  private cleared = new Set<number>();
  private bonusScore = 0;
  private fallMul = 1;
  private skin: BallSkin = getBallSkin(loadSave());
  private cfg = towerConfigForDepth(0);
  private flashColor = 'rgba(255,255,255,0)';
  private flashAlpha = 0;
  private hudCtx: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new HelixWorld(canvas);
    this.camera = this.world.cameraCtrl;
    const save = loadSave();
    this.best = save.best;
    this.coins = save.coins;
  }

  setHudContext(ctx: CanvasRenderingContext2D): void {
    this.hudCtx = ctx;
  }

  start(): void {
    const save = loadSave();
    this.skin = getBallSkin(save);
    const skinIdx = BALL_SKINS.findIndex((s) => s.id === save.selectedSkin);
    this.score = 0;
    this.bonusScore = 0;
    this.depth = 0;
    this.combo = 0;
    this.feverLeft = 0;
    this.fallMul = 1;
    this.flashAlpha = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    resetRingIds();
    this.rings = [];
    this.world.clear();
    clearGeometryCache();
    this.cleared.clear();
    this.cfg = towerConfigForDepth(0);
    const firstRingY = this.cfg.spacing * 2.0;
    let prev: Ring | undefined;
    for (let i = 0; i < 24; i++) {
      const ring = createRing(firstRingY + i * this.cfg.spacing, this.rnd, this.cfg, prev);
      this.rings.push(ring);
      prev = ring;
    }
    const spawnY = firstRingY - BALL_R - RING_HEIGHT * 1.2;
    this.ball = {
      y: spawnY,
      vy: 0,
      squash: 1,
      squashVel: 0,
      colorIndex: Math.max(0, skinIdx % RING_COLORS.length),
    };
    this.rotation.reset();
    this.camera.reset();
    this.camera.snapTo(this.ball.y);
    this.world.syncRings(this.rings, this.cfg.gapArc, this.ball.y);
    this.world.updateBall(this.ball, this.skin, false, 0);
    this.setState('playing');
    vibrate(8);
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (this.state !== 'playing') return;
    if (a === 'tap') {
      this.rotation.tap();
      sfx.click();
      vibrate(6);
    }
    if (a === 'left') {
      this.rotation.swipeLeft();
      sfx.click();
    }
    if (a === 'right') {
      this.rotation.swipeRight();
      sfx.click();
    }
  }

  onDrag(dx: number): void {
    if (this.state !== 'playing') return;
    this.rotation.drag(dx);
  }

  setDragging(active: boolean): void {
    this.rotation.setDragging(active);
  }

  resize(): void {
    this.world.resize();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    const capped = Math.min(dt, 1 / 45);
    this.rotation.update(capped);

    const gravity = gravityForDepth(this.depth, this.fallMul);
    const steps = substepCount(this.ball.vy, capped);
    let prevY = this.ball.y;

    for (let s = 0; s < steps; s++) {
      const subDt = capped / steps;
      integrateBall(this.ball, gravity, subDt);
      this.resolveCollisions(prevY);
      prevY = this.ball.y;
      if (this.state !== 'playing') return;
    }

    this.fallMul = Math.max(1, this.fallMul - capped * 0.1);

    this.camera.follow(this.ball.y, this.ball.vy, capped);
    this.camera.update(capped);
    this.recycleRings();

    const fever = this.feverLeft > 0;
    this.world.setTowerAngle(this.rotation.angle);
    this.world.updateBall(this.ball, this.skin, fever, capped, this.combo);
    this.world.syncRings(this.rings, this.cfg.gapArc, this.ball.y);
    this.world.updateEffects(capped);

    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - capped * 2.5);
    }

    if (this.feverLeft > 0) this.feverLeft -= capped;

    for (const ring of this.rings) {
      if (ring.breakAnim > 0 && ring.breakAnim < 1) {
        ring.breakAnim = Math.min(1, ring.breakAnim + capped * 4);
      }
    }
  }

  render(): void {
    this.world.render();

    if (this.hudCtx) {
      const mult = Math.min(COMBO_CAP, this.combo);
      drawHud(this.hudCtx, this.state, this.combo, this.feverLeft, mult);
      drawFlash(this.hudCtx, this.flashColor, this.flashAlpha);
    }
  }

  private resolveCollisions(prevY: number): void {
    const feverActive = this.feverLeft > 0;
    const hit = findSweepCollision(
      this.ball,
      prevY,
      this.rings,
      this.rotation.angle,
      this.cfg.gapArc,
      feverActive,
      this.cleared,
    );
    if (!hit) return;

    const wy = hit.ring.y;
    const ry = this.world.ringOffset(this.ball.y, wy);
    const px = Math.cos(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    const pz = Math.sin(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;

    if (hit.passedGap) {
      const throughY = clearYThroughRing(wy);
      if (this.ball.y < throughY) this.ball.y = throughY;

      if (!this.cleared.has(hit.ring.id)) {
        this.cleared.add(hit.ring.id);
        this.combo++;
        const mult = Math.min(COMBO_CAP, this.combo);
        this.bonusScore += mult;
        this.score = this.depth + this.bonusScore;
        applyFallBoost(this.ball, this.combo);
        this.fallMul = Math.min(1.4, this.fallMul + 0.05 + mult * 0.01);
        const shake = 0.05 + mult * 0.015;
        this.camera.addShake(shake);
        this.world.particles.comboBurst(px, ry, pz, mult);
        if (hit.perfect) {
          this.world.particles.burst(px, ry, pz, THEME.fever, 8, 4);
          this.bonusScore += 1;
        }
        sfx.coin();
        vibrate(3 + mult);
        if (this.combo >= FEVER_THRESHOLD && this.feverLeft <= 0) {
          this.feverLeft = FEVER_DURATION;
          this.flashColor = 'rgba(255,217,61,0.35)';
          this.flashAlpha = 0.4;
          this.world.flash('#ffd93d', 0.35);
          this.world.particles.feverRing(px, ry, pz);
          this.camera.addShake(0.18);
        }

        if (this.combo >= STREAK_SHATTER_THRESHOLD) {
          this.shatterRingOnStreak(hit.ring, ry, px, pz, mult);
        }
      }
      return;
    }

    this.combo = 0;
    this.fallMul = 1;

    if (hit.died) {
      this.die(hit.ring);
      return;
    }

    if (hit.smashed) {
      this.breakRing(hit.ring, ry, px, pz, 2, true);
      applyFallBoost(this.ball, 2);
      sfx.coin();
      vibrate(10);
      return;
    }

    if (hit.bounced) {
      const impact = this.ball.vy;
      applyBounce(this.ball, impact);
      this.ball.y = restYOnPlatform(hit.ring.y);
      const landShake = 0.08 + Math.min(0.12, Math.abs(impact) / 40);
      this.camera.addShake(landShake);
      this.world.particles.landing(px, ry, pz, this.skin.color);
      this.world.addLandingSplat(hit.ring.id, this.skin.color, this.rotation.angle);
      sfx.coin();
      vibrate(12);
    }
  }

  private shatterRingOnStreak(
    ring: Ring,
    ry: number,
    px: number,
    pz: number,
    mult: number,
  ): void {
    if (ring.broken) return;
    this.breakRing(ring, ry, px, pz, mult, false);
    vibrate(4 + mult);
  }

  private breakRing(
    ring: Ring,
    ry: number,
    px: number,
    pz: number,
    mult: number,
    feverHit: boolean,
  ): void {
    if (ring.broken) return;
    ring.broken = true;
    ring.breakAnim = 0.01;
    this.bonusScore += feverHit ? 2 : 1;
    this.score = this.depth + this.bonusScore;

    const color = RING_COLORS[ring.colorIndex] ?? this.skin.color;
    const shardCount = feverHit ? 14 : 10 + mult * 2;
    const particleCount = feverHit ? 18 : 10 + mult * 2;
    const spread = feverHit ? 5.5 : 4 + mult * 0.35;

    this.world.shards.burst(ry, color, this.rotation.angle, shardCount);
    this.world.particles.burst(px, ry, pz, color, particleCount, spread);
    this.camera.addShake(feverHit ? 0.14 : 0.07 + mult * 0.01);
  }

  private recycleRings(): void {
    while (this.rings.length && this.rings[0].y < this.ball.y - 4) {
      this.rings.shift();
      this.depth++;
      this.score = this.depth + this.bonusScore;
      this.cfg = towerConfigForDepth(this.depth);
      const last = this.rings[this.rings.length - 1];
      this.spawnRing(last.y + this.cfg.spacing);
    }
  }

  private spawnRing(y: number): void {
    const prev = this.rings[this.rings.length - 1];
    this.rings.push(createRing(y, this.rnd, this.cfg, prev));
  }

  private die(hitRing?: Ring): void {
    sfx.crash();
    this.camera.addShake(0.4);
    this.flashColor = 'rgba(229,57,53,0.45)';
    this.flashAlpha = 0.5;
    this.world.flash('#e53935', 0.45);

    const px = Math.cos(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    const pz = Math.sin(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    this.world.particles.burst(px, 0, pz, THEME.danger, 22, 7);

    const burstY = hitRing?.y ?? this.ball.y;
    const radius = this.cfg.spacing * 2.8;
    for (const ring of this.rings) {
      if (ring.broken) continue;
      if (Math.abs(ring.y - burstY) > radius) continue;
      const ry = this.world.ringOffset(this.ball.y, ring.y);
      this.breakRing(ring, ry, px, pz, 5, false);
    }

    vibrate(35);

    const result = recordPlay(this.score);
    this.best = loadSave().best;
    this.coins = loadSave().coins;
    this.setState('over');
    this.onGameOver(this.score, result.record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }
}

export function getHelixCoins(): number {
  return loadSave().coins;
}

export function getHelixBest(): number {
  return loadSave().best;
}

export { toggleMusic, toggleVibrate, claimDailyReward } from './saveData';

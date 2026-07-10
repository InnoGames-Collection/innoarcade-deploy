/**
 * Helix Jump — premium 3D arcade orchestrator.
 */

import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { CameraController } from './camera';
import {
  BALL_CONTACT_ANGLE, BALL_CONTACT_R, COMBO_CAP, FEVER_DURATION, FEVER_THRESHOLD,
  RING_COLORS, SIM_SPEED, STREAK_SHATTER_THRESHOLD, THEME,
} from './constants';
import { helixAudio } from './helixAudio';
import {
  applyBounce,
  applyFallBoost,
  applyLandingFx,
  ballAngle,
  clearYThroughRing,
  findApproachRing,
  findSweepCollision,
  gravityForDepth,
  integrateBall,
  landingFx,
  restYOnPlatform,
  substepCount,
} from './physics';
import { clearGeometryCache } from './geometry';
import { drawFlash, drawHud, tickDisplayScore } from './renderer';
import { RotationController } from './rotation';
import { BALL_SKINS, getBallSkin, type BallSkin } from './skins';
import { loadSave, recordPlay, vibrate } from './saveData';
import { createRing, resetRingIds, ringWorldY, towerConfigForDepth } from './towerGenerator';
import type { BallState, GameState, Ring } from './types';
import { HelixWorld } from './world';

export { W, H } from './constants';
export type { GameState } from './types';

export class HelixJump {
  state: GameState = 'menu';
  score = 0;
  displayScore = 0;
  best = 0;
  coins = 0;
  combo = 0;
  feverLeft = 0;
  depth = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  readonly world: HelixWorld;

  private ball: BallState = { y: 0, vy: 0, squash: 1, squashVel: 0, rollAngle: 0, stretch: 0, colorIndex: 1 };
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
  private time = 0;

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
    this.displayScore = 0;
    this.bonusScore = 0;
    this.depth = 0;
    this.combo = 0;
    this.feverLeft = 0;
    this.fallMul = 1;
    this.flashAlpha = 0;
    this.time = 0;
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    resetRingIds();
    this.rings = [];
    this.world.clear();
    clearGeometryCache();
    this.cleared.clear();
    this.cfg = towerConfigForDepth(0);
    const firstRingY = this.cfg.spacing * 1.5;
    const startBallAng = ballAngle(0);
    let prev: Ring | undefined;
    for (let i = 0; i < 24; i++) {
      const solidUnder = i === 0 ? startBallAng : undefined;
      const ring = createRing(firstRingY + i * this.cfg.spacing, this.rnd, this.cfg, prev, solidUnder);
      this.rings.push(ring);
      prev = ring;
    }
    this.ball = {
      y: restYOnPlatform(firstRingY),
      vy: 0,
      squash: 1,
      squashVel: 0,
      rollAngle: 0,
      stretch: 0,
      colorIndex: Math.max(0, skinIdx % RING_COLORS.length),
    };
    this.rotation.reset();
    this.camera.reset();
    this.camera.snapTo();
    this.world.syncRings(this.rings, this.cfg.gapArc, this.ball.y, this.time, this.rotation.angle);
    this.world.updateBall(this.ball, this.skin, false, 0);
    helixAudio.startSession();
    this.setState('playing');
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
      helixAudio.click();
    }
    if (a === 'left') {
      this.rotation.swipeLeft();
      helixAudio.click();
    }
    if (a === 'right') {
      this.rotation.swipeRight();
      helixAudio.click();
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

    const capped = Math.min(dt, 1 / 45) * SIM_SPEED;
    this.time += capped;
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

    const fever = this.feverLeft > 0;
    this.camera.follow(this.ball.vy, this.combo, fever, capped);
    this.camera.update(capped);
    this.recycleRings();

    const approach = findApproachRing(this.ball, this.rings, this.time, this.cleared);

    this.world.setTowerAngle(this.rotation.angle);
    this.world.updateBall(this.ball, this.skin, fever, capped, this.combo);
    this.world.syncRings(
      this.rings,
      this.cfg.gapArc,
      this.ball.y,
      this.time,
      this.rotation.angle,
      approach?.id ?? -1,
    );
    this.world.updateEffects(capped);

    this.displayScore = tickDisplayScore(this.displayScore, this.score, capped);

    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - capped * 2.5);
    }

    if (this.feverLeft > 0) this.feverLeft -= capped;

    for (const ring of this.rings) {
      if (ring.breakAnim > 0 && ring.breakAnim < 1) {
        ring.breakAnim = Math.min(1, ring.breakAnim + capped * 3.5);
      }
    }
  }

  render(): void {
    this.world.render();

    if (this.hudCtx) {
      const mult = Math.min(COMBO_CAP, this.combo);
      drawHud(this.hudCtx, {
        state: this.state,
        score: this.score,
        displayScore: this.displayScore,
        combo: this.combo,
        feverLeft: this.feverLeft,
        multiplier: mult,
        depth: this.depth,
        feverThreshold: FEVER_THRESHOLD,
      });
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
      feverActive,
      this.time,
      this.cleared,
    );
    if (!hit) return;

    const wy = ringWorldY(hit.ring, this.time);
    const ry = this.world.ringOffset(this.ball.y, wy);
    const px = Math.cos(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    const pz = Math.sin(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    const contactAngle = ballAngle(this.rotation.angle);

    if (hit.passedGap) {
      const throughY = clearYThroughRing(wy);
      if (this.ball.y < throughY) this.ball.y = throughY;
      if (this.ball.vy < 1.5) this.ball.vy = Math.max(this.ball.vy, 2.5);

      if (!this.cleared.has(hit.ring.id)) {
        this.cleared.add(hit.ring.id);
        this.combo++;
        const mult = Math.min(COMBO_CAP, this.combo);
        this.bonusScore += mult;
        this.score = this.depth + this.bonusScore;
        applyFallBoost(this.ball, this.combo);
        this.fallMul = Math.min(1.35, this.fallMul + 0.022 + mult * 0.01);
        this.camera.addShake(0.015 + mult * 0.004);
        this.world.particles.comboBurst(px, ry, pz, mult);
        helixAudio.gapPass(this.combo);
        if (hit.perfect) {
          this.world.particles.burst(px, ry, pz, THEME.fever, 8, 4);
          this.bonusScore += 1;
        }
        if (this.combo >= FEVER_THRESHOLD && this.feverLeft <= 0) {
          this.feverLeft = FEVER_DURATION;
          this.flashColor = 'rgba(255,217,61,0.35)';
          this.flashAlpha = 0.4;
          this.world.flash('#ffd93d', 0.35);
          this.world.particles.feverRing(px, ry, pz);
          this.camera.addShake(0.04);
          helixAudio.feverStart();
        }

        if (this.combo >= STREAK_SHATTER_THRESHOLD) {
          this.shatterRingOnStreak(hit.ring, wy, px, pz, mult, contactAngle);
        }
      }
      return;
    }

    this.combo = 0;
    this.fallMul = 1;

    if (hit.died) {
      this.die(hit.ring, contactAngle);
      return;
    }

    if (hit.smashed) {
      this.breakRing(hit.ring, wy, px, pz, 2, true, contactAngle);
      applyFallBoost(this.ball, 1);
      helixAudio.breakPlatform();
      return;
    }

    if (hit.bounced) {
      const impact = this.ball.vy;
      const impactSpeed = applyBounce(this.ball, impact);
      this.ball.y = restYOnPlatform(wy);
      this.cleared.delete(hit.ring.id);
      const fx = landingFx(impactSpeed);
      applyLandingFx(this.ball, fx);
      this.camera.addShake(fx.shake * 0.5);
      this.world.particles.landing(px, ry, pz, this.skin.color, impactSpeed);
      this.world.addLandingSplat(hit.ring.id, this.skin.color, this.rotation.angle);
      helixAudio.land(impactSpeed);
    }
  }

  private shatterRingOnStreak(
    ring: Ring,
    wy: number,
    px: number,
    pz: number,
    mult: number,
    contactAngle: number,
  ): void {
    if (ring.broken) return;
    this.breakRing(ring, wy, px, pz, mult, false, contactAngle);
    helixAudio.breakPlatform();
  }

  private breakRing(
    ring: Ring,
    wy: number,
    px: number,
    pz: number,
    mult: number,
    feverHit: boolean,
    contactAngle: number,
  ): void {
    if (ring.broken) return;
    ring.broken = true;
    ring.breakAnim = 0.01;
    this.bonusScore += feverHit ? 2 : 1;
    this.score = this.depth + this.bonusScore;

    const color = RING_COLORS[ring.colorIndex] ?? this.skin.color;
    const shardCount = feverHit ? 16 : 10 + mult * 2;
    const particleCount = feverHit ? 20 : 10 + mult * 2;
    const spread = feverHit ? 5.5 : 4 + mult * 0.35;
    const sy = this.world.ringScreenY(this.ball.y, wy);

    this.world.shards.burst(sy, color, this.rotation.angle, shardCount, contactAngle);
    this.world.particles.burst(px, sy, pz, color, particleCount, spread);
    this.world.particles.emitBreakDust(px, sy, pz, color, 8 + mult);
    this.camera.addShake(feverHit ? 0.03 : 0.02);
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

  private die(hitRing: Ring | undefined, contactAngle: number): void {
    helixAudio.gameOver();
    this.camera.addShake(0.08);
    this.flashColor = 'rgba(229,57,53,0.45)';
    this.flashAlpha = 0.5;
    this.world.flash('#e53935', 0.45);

    const px = Math.cos(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    const pz = Math.sin(BALL_CONTACT_ANGLE) * BALL_CONTACT_R;
    this.world.particles.burst(px, 0, pz, THEME.danger, 22, 7);

    const burstY = hitRing ? ringWorldY(hitRing, this.time) : this.ball.y;
    const radius = this.cfg.spacing * 2.8;
    for (const ring of this.rings) {
      if (ring.broken) continue;
      if (Math.abs(ringWorldY(ring, this.time) - burstY) > radius) continue;
      const wy = ringWorldY(ring, this.time);
      this.breakRing(ring, wy, px, pz, 5, false, contactAngle);
    }

    vibrate(18);

    const result = recordPlay(this.score);
    this.best = loadSave().best;
    this.coins = loadSave().coins;
    if (result.record) {
      helixAudio.newBest();
      this.world.particles.confetti(px, 0, pz);
    }
    this.setState('over');
    this.onGameOver(this.score, result.record);
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' || s === 'menu') helixAudio.stopSession();
    if (s === 'playing' && this.score === 0) helixAudio.startSession();
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

// ═══════════════════════════════════════════════════════════════
//  GAME ENGINE — Fruit Slice  [FROZEN — do not modify gameplay]
//  Logic only: physics, collisions, scoring, spawning, state.
//  All canvas drawing is delegated to ./rendering/
// ═══════════════════════════════════════════════════════════════

import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import {
  SceneRenderer, createJuiceBurst, createBombBurst, updateParticles,
  type VfxParticle,
} from './rendering';

export const W = 480;
export const H = 720;

/** Run ends when lives hit 0 — no countdown timer. */
export const STARTING_LIVES = 5;
/** Survival bonus while the run is active (points per second). */
export const TIME_POINTS_PER_SEC = 2;
export const FRUIT_BASE = 10;
/** Extra points per combo step on each fruit (streak after the first slice). */
export const COMBO_BONUS = 2;
/** Max combo steps that add bonus on a single fruit (+18 at most). */
export const COMBO_BONUS_CAP = 9;
export const BOMB_PENALTY = 10;

const FRUIT_RADIUS = 18;
const BOMB_RADIUS = 16;
const SPAWN_RATE = 1.2;
const SPAWN_MARGIN = FRUIT_RADIUS + 8;
const FRUIT_TYPES = ['apple', 'banana', 'cherry', 'orange', 'peach'] as const;

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: typeof FRUIT_TYPES[number];
  sliced: boolean;
  sliceTime: number;
  rot: number;
  rotSpeed: number;
}

interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hit: boolean;
}

interface Slice {
  points: Array<{ x: number; y: number }>;
  createdAt: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export class FruitSlice {
  state: GameState = 'menu';
  score = 0;
  combo = 0;
  lives = STARTING_LIVES;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, durationMs: number) => void = () => {};

  private time = 0;
  private timeScoreBank = 0;
  // Difficulty ramp: spawn rate + object speed scale up with elapsed time, so the
  // endless run eventually outpaces the player (no hard end — you fail by misses).
  private speedMul = 1;
  private fruits: Fruit[] = [];
  private bombs: Bomb[] = [];
  private particles: VfxParticle[] = [];
  private slices: Slice[] = [];
  private screenShake = 0;
  private spawnCursor = 0;
  private currentSlice: Array<{ x: number; y: number }> = [];
  private scene = new SceneRenderer();
  private comboFlash = 0;
  private lastCombo = 0;

  start(): void {
    this.score = 0;
    this.combo = 0;
    this.lives = STARTING_LIVES;
    this.time = 0;
    this.timeScoreBank = 0;
    this.speedMul = 1;
    this.fruits = [];
    this.bombs = [];
    this.particles = [];
    this.slices = [];
    this.screenShake = 0;
    this.spawnCursor = 0;
    this.currentSlice = [];
    this.comboFlash = 0;
    this.lastCombo = 0;
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
    }
  }

  startSlice(x: number, y: number): void {
    if (this.state !== 'playing') return;
    this.currentSlice = [{ x, y }];
  }

  continueSlice(x: number, y: number): void {
    if (this.state !== 'playing' || this.currentSlice.length === 0) return;
    const last = this.currentSlice[this.currentSlice.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 15) {
      this.currentSlice.push({ x, y });
      this.checkSliceCollisions(x, y);
    }
  }

  endSlice(): void {
    if (this.state !== 'playing') return;
    if (this.currentSlice.length > 2) {
      this.slices.push({ points: [...this.currentSlice], createdAt: this.time });
    }
    this.currentSlice = [];
  }

  private checkSliceCollisions(sx: number, sy: number): void {
    const R = 15;
    for (const fruit of this.fruits) {
      if (fruit.sliced) continue;
      const dist = Math.hypot(fruit.x - sx, fruit.y - sy);
      if (dist < R + FRUIT_RADIUS) {
        this.sliceFruit(fruit);
      }
    }
    for (const bomb of this.bombs) {
      if (bomb.hit) continue;
      const dist = Math.hypot(bomb.x - sx, bomb.y - sy);
      if (dist < R + BOMB_RADIUS) {
        this.hitBomb(bomb);
      }
    }
  }

  /** Elapsed run time in whole seconds (timer counts up). */
  elapsedSeconds(): number {
    return Math.floor(this.time);
  }

  private fruitPoints(): number {
    const streak = Math.max(0, this.combo - 1);
    return FRUIT_BASE + Math.min(streak, COMBO_BONUS_CAP) * COMBO_BONUS;
  }

  private endRun(): void {
    if (this.state !== 'playing') return;
    this.setState('gameOver');
    this.onGameOver(this.score, Math.floor(this.time * 1000));
  }

  private bounceInBounds(x: number, vx: number): { x: number; vx: number } {
    const min = SPAWN_MARGIN;
    const max = W - SPAWN_MARGIN;
    if (x < min) return { x: min, vx: Math.abs(vx) * 0.85 };
    if (x > max) return { x: max, vx: -Math.abs(vx) * 0.85 };
    return { x, vx };
  }

  private sliceFruit(fruit: Fruit): void {
    if (fruit.sliced) return;
    fruit.sliced = true;
    this.combo += 1;
    this.score += this.fruitPoints();
    sfx.click();
    createJuiceBurst(this.particles, fruit.x, fruit.y, fruit.type);
    this.screenShake = 0.1;
    if (this.combo > this.lastCombo) {
      this.comboFlash = 0.5;
      this.lastCombo = this.combo;
    }
  }

  // Bombs cost points and reset combo; the run ends only when lives reach 0.
  private hitBomb(bomb: Bomb): void {
    if (bomb.hit) return;
    bomb.hit = true;
    this.combo = 0;
    this.lastCombo = 0;
    this.score = Math.max(0, this.score - BOMB_PENALTY);
    sfx.jump();
    createBombBurst(this.particles, bomb.x, bomb.y);
    this.screenShake = 0.2;
  }

  update(dt: number): void {
    if (this.state === 'playing') {
      this.scene.updateBackground(dt);
    }

    if (this.state !== 'playing') return;

    this.time += dt;

    this.timeScoreBank += TIME_POINTS_PER_SEC * dt;
    const timeTicks = Math.floor(this.timeScoreBank);
    if (timeTicks > 0) {
      this.score += timeTicks;
      this.timeScoreBank -= timeTicks;
    }

    this.screenShake = Math.max(0, this.screenShake - dt * 8);
    this.comboFlash = Math.max(0, this.comboFlash - dt * 2);

    // Ramp difficulty with time: spawn faster + everything moves faster, so it
    // becomes progressively harder to keep up (≈2× speed at 45s, 3× at 90s).
    this.speedMul = 1 + this.time / 45;
    const grav = 380 * this.speedMul;

    this.spawnCursor -= dt;
    if (this.spawnCursor <= 0) {
      this.spawnFruit();
      this.spawnCursor = Math.max(0.3, SPAWN_RATE / this.speedMul);
    }

    for (const fruit of this.fruits) {
      if (!fruit.sliced) {
        fruit.x += fruit.vx * dt;
        fruit.y += fruit.vy * dt;
        fruit.vy += grav * dt;
        fruit.rot += fruit.rotSpeed * dt;
        const bounced = this.bounceInBounds(fruit.x, fruit.vx);
        fruit.x = bounced.x;
        fruit.vx = bounced.vx;
      } else {
        fruit.sliceTime += dt;
      }
    }

    for (const bomb of this.bombs) {
      if (!bomb.hit) {
        bomb.x += bomb.vx * dt;
        bomb.y += bomb.vy * dt;
        bomb.vy += grav * dt;
        const bounced = this.bounceInBounds(bomb.x, bomb.vx);
        bomb.x = bounced.x;
        bomb.vx = bounced.vx;
      }
    }

    updateParticles(this.particles, dt);

    this.fruits = this.fruits.filter((f) => f.y < H + 50 && f.sliceTime < 0.3);
    this.bombs = this.bombs.filter((b) => b.y < H + 50);
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    this.slices = this.slices.filter((s) => this.time - s.createdAt < 0.15);

    if (this.fruits.some((f) => !f.sliced && f.y > H)) {
      this.lives -= 1;
      this.combo = 0;
      if (this.lives <= 0) {
        this.endRun();
      }
    }
    this.fruits = this.fruits.filter((f) => f.y <= H || f.sliced);
  }

  private spawnFruit(): void {
    if (this.state !== 'playing') return;
    const isBomb = Math.random() < 0.15;
    const x = SPAWN_MARGIN + Math.random() * (W - SPAWN_MARGIN * 2);
    const vx = (Math.random() - 0.5) * 140 * this.speedMul;
    const vy = -(200 + Math.random() * 150) * this.speedMul;

    if (isBomb) {
      this.bombs.push({ x, y: -20, vx, vy, hit: false });
    } else {
      const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      this.fruits.push({
        x, y: -20, vx, vy, type, sliced: false, sliceTime: 0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 4,
      });
    }
  }

  private setState(next: GameState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.scene.render(ctx, {
      time: this.time,
      combo: this.combo,
      comboFlash: this.comboFlash,
      screenShake: this.screenShake,
      fruits: this.fruits,
      bombs: this.bombs,
      particles: this.particles,
      slices: this.slices,
      currentSlice: this.currentSlice,
      fruitRadius: FRUIT_RADIUS,
      bombRadius: BOMB_RADIUS,
    });
  }

  renderMenuBg(ctx: CanvasRenderingContext2D): void {
    this.scene.renderMenuBg(ctx);
  }
}

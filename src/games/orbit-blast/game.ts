// Orbit Blast — a 99-Balls-style aim-and-shoot blaster, built as the platform's
// flagship tournament game: one pure-skill score, short fair rounds, endlessly
// replayable. You aim a volley of orbs from the bottom; they ricochet off walls
// and numbered blocks, knocking each block's counter down until it shatters.
// Every turn the wall of blocks descends one row — survive as long as you can.
//
// Physics use sub-stepped circle-vs-AABB sweeps so fast orbs never tunnel
// through a block. The logic is self-contained; main.ts owns pointer aiming and
// the tournament leaderboard hookup.

import { Particles } from '../../engine/particles';
import { ScreenFx } from '../../engine/fx';
import { settings } from '../../engine/settings';
import { obSfx } from './obAudio';

export const W = 480;
export const H = 640;

const AIM_LINE = 'rgba(94, 232, 154, 0.85)';
const LAUNCHER_READY = '#00c853';
const LAUNCHER_BUSY = '#1f74e0';

const COLS = 7;
const GAP = 8;
const BLOCK = (W - GAP * (COLS + 1)) / COLS;
const TOP_Y = 76;
const FLOOR_Y = H - 46;
const ROW_STEP = BLOCK + GAP;
const BALL_R = 7;
const BALL_SPEED = 640;
const LAUNCH_INTERVAL = 0.045;

const COMBO_WINDOW = 2.0;
const DISPLAY_SCORE_MULT = 10;

const BLOCK_PALETTE = [
  { top: '#5ee89a', mid: '#00c853', bot: '#009624', glow: '#88f0b8', shine: '#c8ffe0' },
  { top: '#4dc8ff', mid: '#1f74e0', bot: '#0d47a1', glow: '#80d8ff', shine: '#b8ecff' },
  { top: '#7eb8ff', mid: '#5b8cff', bot: '#3a5fd4', glow: '#a8c8ff', shine: '#d0e4ff' },
  { top: '#ffb84d', mid: '#ff9500', bot: '#cc7700', glow: '#ffd080', shine: '#ffe8b0' },
  { top: '#ff8a9a', mid: '#ff3d6a', bot: '#c41e52', glow: '#ffb0c0', shine: '#ffd0dc' },
  { top: '#b388ff', mid: '#7c4dff', bot: '#5e35b1', glow: '#d0b0ff', shine: '#e8d4ff' },
];

export type GameState = 'menu' | 'ready' | 'firing' | 'paused' | 'over';

interface Ball {
  x: number; y: number; vx: number; vy: number;
  active: boolean; returned: boolean;
  trail: Array<{ x: number; y: number; life: number }>;
  launchFlash: number;
}
interface Block { col: number; y: number; hits: number; max: number; bounce: number; }
interface Pickup { col: number; y: number; taken: boolean; pulse: number; }
interface ScorePopup {
  x: number; y: number; text: string; life: number; maxLife: number;
  color: string; scale: number;
}
interface DestroyAnim {
  cx: number; cy: number; color: string; t: number; max: number;
}
interface BgParticle {
  x: number; y: number; vx: number; vy: number; size: number; alpha: number; phase: number;
}

function colX(col: number): number { return GAP + col * (BLOCK + GAP); }

function blockPalette(max: number): typeof BLOCK_PALETTE[0] {
  const idx = Math.min(BLOCK_PALETTE.length - 1, Math.floor(max / 7));
  return BLOCK_PALETTE[idx];
}

export class OrbitBlast {
  state: GameState = 'menu';
  score = 0;
  best = 0;
  ballCount = 1;
  level = 0;

  /** Display-only stats for game-over screen. */
  visualCombo = 0;
  highestCombo = 0;
  blocksDestroyed = 0;
  totalHits = 0;
  ballsFired = 0;
  volleysLaunched = 0;

  get displayLevel(): number { return this.level; }
  get displayCombo(): number { return this.visualCombo; }
  get accuracy(): number {
    if (this.ballsFired === 0) return 100;
    return Math.min(100, Math.round((this.totalHits / this.ballsFired) * 100));
  }

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};
  onScore: (score: number, balls: number) => void = () => {};

  private balls: Ball[] = [];
  private blocks: Block[] = [];
  private pickups: Pickup[] = [];
  private launchX = W / 2;
  private firstReturnX = -1;
  private pickupGain = 0;

  aimActive = false;
  private aimX = W / 2;
  private aimY = FLOOR_Y - 200;
  private aimPulse = 0;
  private chargeT = 0;

  private toLaunch = 0;
  private launchTimer = 0;
  private launchVx = 0;
  private launchVy = 0;
  private turnTime = 0;

  private particles = new Particles(600);
  private fx = new ScreenFx();
  private scorePopups: ScorePopup[] = [];
  private destroyAnims: DestroyAnim[] = [];
  private bgParticles: BgParticle[] = [];
  private comboTimer = 0;
  private comboBanner = '';
  private comboBannerT = 0;
  private time = 0;
  private stateBeforePause: GameState | null = null;
  private launcherPulse = 0;

  constructor() {
    this.fx.reducedMotion = settings.data.reducedMotion;
    this.initBgParticles();
  }

  start(): void {
    this.score = 0;
    this.level = 0;
    this.ballCount = 1;
    this.balls = [];
    this.blocks = [];
    this.pickups = [];
    this.launchX = W / 2;
    this.pickupGain = 0;
    this.visualCombo = 0;
    this.highestCombo = 0;
    this.blocksDestroyed = 0;
    this.totalHits = 0;
    this.ballsFired = 0;
    this.volleysLaunched = 0;
    this.comboTimer = 0;
    this.comboBanner = '';
    this.comboBannerT = 0;
    this.scorePopups = [];
    this.destroyAnims = [];
    this.particles.clear();
    this.fx.reset();
    this.initBgParticles();
    obSfx.startMusic();
    this.addRow();
    this.addRow();
    this.setState('ready');
    this.onScore(this.score, this.ballCount);
  }

  pause(): void {
    if (this.state === 'menu' || this.state === 'over' || this.state === 'paused') return;
    this.stateBeforePause = this.state;
    this.setState('paused');
    obSfx.pause();
  }

  resume(): void {
    if (this.state !== 'paused' || !this.stateBeforePause) return;
    this.setState(this.stateBeforePause);
    this.stateBeforePause = null;
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private initBgParticles(): void {
    this.bgParticles = [];
    for (let i = 0; i < 28; i++) {
      this.bgParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 18,
        size: 1.5 + Math.random() * 3,
        alpha: 0.08 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private addRow(): void {
    this.level++;
    for (const b of this.blocks) b.y += ROW_STEP;
    for (const p of this.pickups) p.y += ROW_STEP;
    const cols = [...Array(COLS).keys()];
    const pickupCol = cols[(Math.random() * COLS) | 0];
    for (const col of cols) {
      if (col === pickupCol) {
        this.pickups.push({ col, y: TOP_Y, taken: false, pulse: Math.random() * Math.PI * 2 });
        continue;
      }
      if (Math.random() < 0.22) continue;
      const max = 1 + Math.floor(Math.random() * (this.level + 1));
      this.blocks.push({ col, y: TOP_Y, hits: max, max, bounce: 0 });
    }
  }

  private reachedFloor(): boolean {
    return this.blocks.some((b) => b.y + BLOCK >= FLOOR_Y);
  }

  setAim(x: number, y: number): void {
    if (this.state !== 'ready') return;
    this.aimActive = true;
    this.aimX = x;
    this.aimY = Math.min(y, FLOOR_Y - 12);
    this.chargeT = Math.min(1, this.chargeT + 0.04);
  }

  release(): void {
    if (this.state !== 'ready' || !this.aimActive) return;
    const dx = this.aimX - this.launchX;
    const dy = this.aimY - FLOOR_Y;
    const len = Math.hypot(dx, dy);
    if (len < 8 || dy > -8) { this.aimActive = false; this.chargeT = 0; return; }
    this.launchVx = (dx / len) * BALL_SPEED;
    this.launchVy = (dy / len) * BALL_SPEED;
    this.toLaunch = this.ballCount;
    this.launchTimer = 0;
    this.turnTime = 0;
    this.firstReturnX = -1;
    this.pickupGain = 0;
    this.aimActive = false;
    this.chargeT = 0;
    this.volleysLaunched++;
    this.launcherPulse = 0.4;
    this.particles.burst(this.launchX, FLOOR_Y, Math.round(14 * settings.particleScale),
      ['#5ee89a', '#1f74e0', '#ffffff'],
      { speed: 160, life: 0.35, size: 4, glow: true });
    this.fx.flash('#5ee89a', 0.12);
    this.setState('firing');
    obSfx.launch();
  }

  aimPath(): Array<[number, number]> {
    const pts: Array<[number, number]> = [[this.launchX, FLOOR_Y]];
    const dx = this.aimX - this.launchX;
    const dy = this.aimY - FLOOR_Y;
    const len = Math.hypot(dx, dy) || 1;
    let x = this.launchX, y = FLOOR_Y;
    let vx = (dx / len), vy = (dy / len);
    let dist = 0;
    while (dist < 520 && y > TOP_Y - ROW_STEP) {
      const step = 12;
      x += vx * step; y += vy * step; dist += step;
      if (x < BALL_R) { x = BALL_R; vx = -vx; }
      if (x > W - BALL_R) { x = W - BALL_R; vx = -vx; }
      pts.push([x, y]);
    }
    return pts;
  }

  private addScorePopup(x: number, y: number, text: string, color: string): void {
    this.scorePopups.push({ x, y, text, life: 0.9, maxLife: 0.9, color, scale: 1 });
  }

  private registerVisualHit(x: number, y: number, destroyed: boolean): void {
    this.totalHits++;
    this.visualCombo++;
    this.comboTimer = COMBO_WINDOW;
    if (this.visualCombo > this.highestCombo) this.highestCombo = this.visualCombo;

    const pts = DISPLAY_SCORE_MULT;
    let label = `+${pts}`;
    let color = '#80d8ff';
    if (destroyed) {
      this.blocksDestroyed++;
      label = `+${pts * 2}`;
      color = '#ffd54f';
    }
    if (this.visualCombo >= 10) {
      label = 'Excellent!';
      color = '#ffd700';
      this.comboBanner = `Combo ×${this.visualCombo}`;
      this.comboBannerT = 1.4;
      obSfx.perfectShot();
      this.particles.burst(x, y, Math.round(20 * settings.particleScale),
        ['#ffd700', '#ffffff', '#5ee89a'], { speed: 200, life: 0.6, size: 5, glow: true });
    } else if (this.visualCombo >= 5) {
      label = `Combo ×${this.visualCombo}`;
      color = '#ff9500';
      this.comboBanner = label;
      this.comboBannerT = 1.2;
      obSfx.comboHit(this.visualCombo);
      this.particles.burst(x, y, Math.round(14 * settings.particleScale),
        ['#ff9500', '#ffffff'], { speed: 170, life: 0.5, size: 4, glow: true });
    } else if (this.visualCombo >= 2) {
      label = `Combo ×${this.visualCombo}`;
      color = '#5ee89a';
      this.comboBanner = label;
      this.comboBannerT = 1.0;
      obSfx.comboHit(this.visualCombo);
    } else if (destroyed) {
      label = 'Perfect!';
      color = '#5ee89a';
    }
    this.addScorePopup(x, y - 8, label, color);
  }

  private updateVisuals(dt: number): void {
    this.time += dt;
    this.aimPulse += dt * 3;
    this.launcherPulse = Math.max(0, this.launcherPulse - dt * 2);
    this.comboBannerT = Math.max(0, this.comboBannerT - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.visualCombo > 0) this.visualCombo = 0;

    for (const p of this.bgParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += dt * 1.5;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
    }

    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.life -= dt;
      sp.y -= 42 * dt;
      if (sp.life <= 0) this.scorePopups.splice(i, 1);
    }

    for (let i = this.destroyAnims.length - 1; i >= 0; i--) {
      const d = this.destroyAnims[i];
      d.t += dt;
      if (d.t >= d.max) this.destroyAnims.splice(i, 1);
    }

    for (const b of this.blocks) {
      if (b.bounce > 0) b.bounce = Math.max(0, b.bounce - dt * 5);
    }

    for (const p of this.pickups) p.pulse += dt * 4;

    for (const ball of this.balls) {
      if (ball.launchFlash > 0) ball.launchFlash -= dt * 4;
      for (let i = ball.trail.length - 1; i >= 0; i--) {
        ball.trail[i].life -= dt * 3;
        if (ball.trail[i].life <= 0) ball.trail.splice(i, 1);
      }
    }
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.fx.update(dt);
    this.updateVisuals(dt);

    if (this.state === 'paused' || this.state === 'menu' || this.state === 'over') return;
    if (this.state !== 'firing') return;

    this.turnTime += dt;
    if (this.turnTime > 15 && this.toLaunch === 0) {
      for (const b of this.balls) {
        if (b.active) { b.vx *= 0.4; b.vy = BALL_SPEED; }
      }
    }

    if (this.toLaunch > 0) {
      this.launchTimer -= dt;
      if (this.launchTimer <= 0) {
        this.launchTimer = LAUNCH_INTERVAL;
        this.ballsFired++;
        this.balls.push({
          x: this.launchX, y: FLOOR_Y - BALL_R,
          vx: this.launchVx, vy: this.launchVy,
          active: true, returned: false,
          trail: [], launchFlash: 0.5,
        });
        this.particles.burst(this.launchX, FLOOR_Y - BALL_R,
          Math.round(6 * settings.particleScale), ['#1f74e0', '#5ee89a'],
          { speed: 100, life: 0.25, size: 3, glow: true });
        this.toLaunch--;
      }
    }

    for (const ball of this.balls) {
      if (!ball.active) continue;
      const steps = Math.max(1, Math.ceil((BALL_SPEED * dt) / BALL_R));
      const sdt = dt / steps;
      for (let s = 0; s < steps && ball.active; s++) this.stepBall(ball, sdt);
      if (ball.active && (this.time * 60 | 0) % 2 === 0) {
        ball.trail.push({ x: ball.x, y: ball.y, life: 1 });
        if (ball.trail.length > 8) ball.trail.shift();
      }
    }

    if (this.toLaunch === 0 && this.balls.length > 0 && this.balls.every((b) => b.returned)) {
      this.endTurn();
    }
  }

  private stepBall(ball: Ball, dt: number): void {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

    if (Math.abs(ball.vy) < 60) {
      ball.vy = ball.vy >= 0 ? 60 : -60;
      const sp = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / sp) * BALL_SPEED;
      ball.vy = (ball.vy / sp) * BALL_SPEED;
    }

    if (ball.y >= FLOOR_Y - BALL_R) {
      ball.y = FLOOR_Y - BALL_R;
      ball.active = false;
      ball.returned = true;
      if (this.firstReturnX < 0) this.firstReturnX = ball.x;
      return;
    }

    for (const p of this.pickups) {
      if (p.taken) continue;
      const px = colX(p.col) + BLOCK / 2;
      const py = p.y + BLOCK / 2;
      if (Math.hypot(ball.x - px, ball.y - py) < BALL_R + BLOCK * 0.28) {
        p.taken = true;
        this.pickupGain++;
        this.particles.burst(px, py, Math.round(16 * settings.particleScale),
          ['#5ee89a', '#1f74e0', '#ffffff'],
          { speed: 140, life: 0.45, size: 5, glow: true });
        this.addScorePopup(px, py, '+1', '#5ee89a');
        this.fx.flash('#5ee89a', 0.08);
        obSfx.pickup();
      }
    }

    for (const b of this.blocks) {
      if (b.hits <= 0) continue;
      const bx = colX(b.col), by = b.y;
      const closestX = Math.max(bx, Math.min(ball.x, bx + BLOCK));
      const closestY = Math.max(by, Math.min(ball.y, by + BLOCK));
      const ddx = ball.x - closestX;
      const ddy = ball.y - closestY;
      if (ddx * ddx + ddy * ddy > BALL_R * BALL_R) continue;
      const overlapX = BALL_R - Math.abs(ddx);
      const overlapY = BALL_R - Math.abs(ddy);
      if (overlapX < overlapY || ddy === 0) {
        ball.vx = -ball.vx;
        ball.x += ball.vx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y += ball.vy > 0 ? overlapY : -overlapY;
      }
      this.hitBlock(b, ball.x, ball.y);
      break;
    }
  }

  private hitBlock(b: Block, x: number, y: number): void {
    b.hits--;
    b.bounce = 0.3;
    this.score++;
    this.onScore(this.score, this.ballCount);
    const pal = blockPalette(b.max);
    const cx = colX(b.col) + BLOCK / 2;
    const cy = b.y + BLOCK / 2;
    if (b.hits <= 0) {
      this.blocks = this.blocks.filter((blk) => blk !== b);
      this.destroyAnims.push({ cx, cy, color: pal.mid, t: 0, max: 0.4 });
      this.registerVisualHit(cx, cy, true);
      this.particles.burst(cx, cy, Math.round(22 * settings.particleScale),
        [pal.glow, pal.top, '#ffffff', '#ffd54f'],
        { speed: 220, life: 0.55, size: 6, glow: true });
      this.fx.shake(5, 0.14);
      this.fx.flash(pal.glow, 0.15);
      obSfx.blockDestroy();
    } else {
      this.registerVisualHit(x, y, false);
      this.particles.burst(x, y, Math.round(8 * settings.particleScale),
        [pal.glow, '#ffffff'], { speed: 100, life: 0.3, size: 3, glow: true });
      this.fx.flash(pal.glow, 0.06);
      obSfx.blockHit();
    }
  }

  private endTurn(): void {
    this.launchX = Math.max(BALL_R + 2, Math.min(W - BALL_R - 2,
      this.firstReturnX >= 0 ? this.firstReturnX : this.launchX));
    this.ballCount += this.pickupGain;
    this.balls = [];
    this.pickups = this.pickups.filter((p) => !p.taken);
    this.addRow();
    this.onScore(this.score, this.ballCount);
    if (this.reachedFloor()) { this.gameOver(); return; }
    this.setState('ready');
  }

  private gameOver(): void {
    const record = this.score > this.best;
    if (record) this.best = this.score;
    this.fx.shake(10, 0.4);
    this.fx.flash('#ff3d6a', 0.25);
    obSfx.gameOver();
    obSfx.stopMusic();
    this.setState('over');
    this.onGameOver(this.score, record);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.fx.preRender(ctx);
    ctx.clearRect(-20, -20, W + 40, H + 40);
    this.drawBackground(ctx);

    this.drawDangerLine(ctx);

    for (const b of this.blocks) this.drawBlock(ctx, b);
    for (const d of this.destroyAnims) this.drawDestroyAnim(ctx, d);
    for (const p of this.pickups) if (!p.taken) this.drawPickup(ctx, p);

    if (this.state === 'ready' && this.aimActive) this.drawAimGuide(ctx);

    for (const ball of this.balls) {
      if (!ball.active && ball.returned) continue;
      this.drawBall(ctx, ball);
    }

    this.drawLauncher(ctx);
    this.particles.render(ctx);
    this.drawScorePopups(ctx);
    this.drawComboBanner(ctx);
    this.fx.postRender(ctx, W, H);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d2848');
    bg.addColorStop(0.45, '#123a5c');
    bg.addColorStop(1, '#0a2038');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#5ee89a';
    ctx.lineWidth = 1;
    const grid = 40;
    for (let x = 0; x < W; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H * 0.3, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const p of this.bgParticles) {
      const a = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, 'rgba(94, 232, 154, 0.9)');
      g.addColorStop(1, 'rgba(31, 116, 224, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const orb1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, 80);
    orb1.addColorStop(0, 'rgba(0, 200, 83, 0.08)');
    orb1.addColorStop(1, 'rgba(0, 200, 83, 0)');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, W, H);

    const orb2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, 100);
    orb2.addColorStop(0, 'rgba(31, 116, 224, 0.1)');
    orb2.addColorStop(1, 'rgba(31, 116, 224, 0)');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, W, H);
  }

  private drawDangerLine(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.strokeStyle = `rgba(255, 61, 106, ${0.35 + pulse * 0.3})`;
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 61, 106, 0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  private drawAimGuide(ctx: CanvasRenderingContext2D): void {
    const path = this.aimPath();
    const charge = this.chargeT;
    ctx.save();
    ctx.strokeStyle = AIM_LINE;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.5 + charge * 1.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(94, 232, 154, 0.6)';
    ctx.shadowBlur = 8 + charge * 6;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const [ex, ey] = path[path.length - 1];
    const dotPulse = 0.7 + 0.3 * Math.sin(this.aimPulse);
    ctx.fillStyle = `rgba(94, 232, 154, ${0.5 + charge * 0.3})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 4 * dotPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const a = t.life * 0.35 * (i / ball.trail.length);
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, BALL_R * 1.2);
      g.addColorStop(0, '#5ee89a');
      g.addColorStop(1, 'rgba(31, 116, 224, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (ball.launchFlash > 0) {
      ctx.globalAlpha = ball.launchFlash * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = 'rgba(94, 232, 154, 0.7)';
    ctx.shadowBlur = 12;
    const body = ctx.createRadialGradient(
      ball.x - BALL_R * 0.35, ball.y - BALL_R * 0.35, 0,
      ball.x, ball.y, BALL_R * 1.4,
    );
    body.addColorStop(0, '#8af0c0');
    body.addColorStop(0.4, '#1f74e0');
    body.addColorStop(1, '#0d47a1');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(ball.x - BALL_R * 0.3, ball.y - BALL_R * 0.3, BALL_R * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLauncher(ctx: CanvasRenderingContext2D): void {
    const ready = this.state === 'ready';
    const pulse = ready ? 0.5 + 0.5 * Math.sin(this.time * 3) : 0;
    const r = BALL_R + 2 + pulse * 2 + this.launcherPulse * 4;

    ctx.shadowColor = ready ? 'rgba(0, 200, 83, 0.6)' : 'rgba(31, 116, 224, 0.5)';
    ctx.shadowBlur = 14 + pulse * 6;

    const glow = ctx.createRadialGradient(
      this.launchX, FLOOR_Y, r * 0.5,
      this.launchX, FLOOR_Y, r * 2.2,
    );
    glow.addColorStop(0, ready ? 'rgba(0, 200, 83, 0.35)' : 'rgba(31, 116, 224, 0.25)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.launchX, FLOOR_Y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(
      this.launchX - 3, FLOOR_Y - 3, 0,
      this.launchX, FLOOR_Y, r,
    );
    body.addColorStop(0, ready ? '#88f0b8' : '#6eb0ff');
    body.addColorStop(0.5, ready ? LAUNCHER_READY : LAUNCHER_BUSY);
    body.addColorStop(1, ready ? '#007a33' : '#0d47a1');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(this.launchX, FLOOR_Y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(this.launchX - 2, FLOOR_Y - 2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    if (ready && this.chargeT > 0.1) {
      ctx.strokeStyle = `rgba(94, 232, 154, ${this.chargeT * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.launchX, FLOOR_Y, r + 4 + this.chargeT * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawBlock(ctx: CanvasRenderingContext2D, b: Block): void {
    const x = colX(b.col);
    const y = b.y - b.bounce * 6;
    const pal = blockPalette(b.max);
    const r = 12;
    const shrink = b.hits / b.max;

    ctx.save();
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    const grad = ctx.createLinearGradient(x, y, x, y + BLOCK);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(0.5, pal.mid);
    grad.addColorStop(1, pal.bot);
    roundRect(ctx, x, y, BLOCK, BLOCK, r);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.globalAlpha = 0.35;
    const shine = ctx.createLinearGradient(x, y, x, y + BLOCK * 0.45);
    shine.addColorStop(0, pal.shine);
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    roundRect(ctx, x + 2, y + 2, BLOCK - 4, BLOCK * 0.42, r - 2);
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, BLOCK - 1, BLOCK - 1, r);
    ctx.stroke();

    const barW = (BLOCK - 10) * shrink;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    roundRect(ctx, x + 5, y + BLOCK - 7, BLOCK - 10, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    roundRect(ctx, x + 5, y + BLOCK - 7, barW, 3, 1.5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${BLOCK * 0.4}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.fillText(String(b.hits), x + BLOCK / 2, y + BLOCK / 2);
    ctx.restore();
  }

  private drawDestroyAnim(ctx: CanvasRenderingContext2D, d: DestroyAnim): void {
    const t = d.t / d.max;
    const alpha = 1 - t;
    const expand = 1 + t * 1.8;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 2;
      const dist = BLOCK * 0.3 * expand;
      const px = d.cx + Math.cos(a) * dist;
      const py = d.cy + Math.sin(a) * dist;
      const sz = BLOCK * 0.18 * (1 - t * 0.5);
      ctx.fillStyle = i % 2 === 0 ? d.color : '#ffffff';
      roundRect(ctx, px - sz / 2, py - sz / 2, sz, sz, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: Pickup): void {
    const cx = colX(p.col) + BLOCK / 2;
    const cy = p.y + BLOCK / 2;
    const pulse = 0.85 + 0.15 * Math.sin(p.pulse);
    const rad = BLOCK * 0.3 * pulse;

    ctx.shadowColor = 'rgba(94, 232, 154, 0.6)';
    ctx.shadowBlur = 10;
    const ring = ctx.createRadialGradient(cx, cy, rad * 0.5, cx, cy, rad * 1.8);
    ring.addColorStop(0, 'rgba(94, 232, 154, 0.3)');
    ring.addColorStop(1, 'rgba(94, 232, 154, 0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5ee89a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#5ee89a';
    ctx.font = `800 ${BLOCK * 0.32}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+1', cx, cy + 1);
  }

  private drawScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const sp of this.scorePopups) {
      const t = sp.life / sp.maxLife;
      const alpha = Math.min(1, t * 2);
      const scale = 0.8 + (1 - t) * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sp.x, sp.y);
      ctx.scale(scale, scale);
      ctx.font = `800 ${sp.text.length > 6 ? 16 : 20}px 'Avenir Next', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = sp.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = sp.color;
      ctx.fillText(sp.text, 0, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeText(sp.text, 0, 0);
      ctx.restore();
    }
  }

  private drawComboBanner(ctx: CanvasRenderingContext2D): void {
    if (this.comboBannerT <= 0 || this.visualCombo < 2) return;
    const a = Math.min(1, this.comboBannerT * 2);
    const pulse = 1 + 0.08 * Math.sin(this.time * 12);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.22);
    ctx.scale(pulse, pulse);
    const fontSize = this.visualCombo >= 10 ? 30 : this.visualCombo >= 5 ? 26 : 22;
    ctx.font = `800 ${fontSize}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const color = this.visualCombo >= 10 ? '#ffd700' : this.visualCombo >= 5 ? '#ff9500' : '#5ee89a';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(this.comboBanner, 0, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeText(this.comboBanner, 0, 0);
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Brick Blitz — enterprise-grade breakout with paddle physics, ball dynamics,
// power-ups, and progressive brick patterns. Classic arcade with modern polish.

import { getHighScore, setHighScore } from '../../engine/storage';
import { Particles } from '../../engine/particles';
import { ScreenFx } from '../../engine/fx';
import { bbSfx } from './bbAudio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const PADDLE_W = 92;
const PADDLE_H = 18;
const PADDLE_Y = H - 40;
const PADDLE_SPEED = 420;

const BALL_RADIUS = 7;
const BALL_VISUAL_RADIUS = 9;
const BALL_SPEED = 310;
const MAX_BALL_SPEED = 500;
const BALL_ATTACH_GAP = 10;

const BRICK_W = 56;
const BRICK_H = 22;
const BRICK_ROWS_BASE = 4;
const BRICKS_PER_ROW = 7;
const BRICK_GAP = 3;
const BRICK_START_Y = 36;

const BRICK_PALETTE = [
  { top: '#ff6b8a', mid: '#ff3d6a', bot: '#c41e52', glow: '#ff8fab', shine: '#ffc4d4' },
  { top: '#ffb84d', mid: '#ff9500', bot: '#cc7700', glow: '#ffd080', shine: '#ffe8b0' },
  { top: '#4dc8ff', mid: '#00a8e8', bot: '#0077b6', glow: '#80d8ff', shine: '#b8ecff' },
  { top: '#5ee89a', mid: '#00c853', bot: '#009624', glow: '#88f0b8', shine: '#c0f8d8' },
  { top: '#b388ff', mid: '#7c4dff', bot: '#5e35b1', glow: '#d0b0ff', shine: '#e8d4ff' },
  { top: '#ff80ab', mid: '#f50057', bot: '#c51162', glow: '#ffb0cc', shine: '#ffd6e8' },
];

const COMBO_WINDOW = 0.85;

interface Brick {
  x: number;
  y: number;
  hp: number;
  color: number;
  breaking: boolean;
  breakAnim: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'paddle' | 'slow' | 'multi';
  vx: number;
  vy: number;
  rot: number;
  pulse: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  attached: boolean;
  trail: Array<{ x: number; y: number; life: number }>;
  impactFlash: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

interface BgParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'levelClear' | 'gameOver';

export class BrickBlitz {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('brick-blitz');
  combo = 0;
  highestCombo = 0;
  bricksDestroyed = 0;
  paddleHits = 0;
  brickHits = 0;

  get displayLevel(): number { return this.levelNumber; }
  get displayLives(): number { return this.lives; }
  get displayCombo(): number { return this.combo; }
  get accuracy(): number {
    const total = this.paddleHits + this.brickHits;
    return total > 0 ? Math.round((this.brickHits / total) * 100) : 100;
  }

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, levelReached: number, record: boolean) => void = () => {};

  private get ballAttachY(): number {
    return PADDLE_Y - PADDLE_H / 2 - BALL_RADIUS - BALL_ATTACH_GAP;
  }

  private get levelBallSpeed(): number {
    return BALL_SPEED * (1 + (this.levelNumber - 1) * 0.1);
  }

  private get levelMaxBallSpeed(): number {
    return MAX_BALL_SPEED * (1 + (this.levelNumber - 1) * 0.07);
  }

  private levelRows(): number {
    return Math.min(6, BRICK_ROWS_BASE + Math.floor((this.levelNumber - 1) / 2));
  }

  private brickHp(row: number): number {
    const tier = 1 + Math.floor((this.levelNumber - 1) / 2);
    const topRowBonus = this.levelNumber >= 4 && row === 0 ? 1 : 0;
    return Math.min(4, tier + topRowBonus);
  }

  private shouldPlaceBrick(row: number, col: number): boolean {
    if (this.levelNumber <= 2) return true;
    if (this.levelNumber === 3) return (row * 3 + col) % 7 !== 0;
    if (this.levelNumber === 4) return (row * 2 + col) % 5 !== 0;
    return (row + col) % 3 !== 0;
  }

  setPaddleX(canvasX: number): void {
    this.paddleX = Math.max(4, Math.min(W - 4 - this.paddleW, canvasX - this.paddleW / 2));
  }

  launchBall(): void {
    const ball = this.balls.find((b) => b.attached);
    if (!ball || this.state !== 'playing') return;
    ball.attached = false;
    const speed = this.levelBallSpeed;
    ball.vx = -140 + Math.random() * 280;
    ball.vy = -speed;
    bbSfx.launch();
  }

  releasePaddle(): void {
    this.paddleDir = 0;
  }

  private time = 0;
  private levelNumber = 1;
  private paddleX = W / 2 - PADDLE_W / 2;
  private paddleDir = 0;
  private paddleSquash = 0;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: PowerUp[] = [];
  private scorePopups: ScorePopup[] = [];
  private bgParticles: BgParticle[] = [];
  private particles = new Particles(500);
  private fx = new ScreenFx();
  private comboTimer = 0;
  private comboFlash = 0;
  private comboBanner = '';
  private comboBannerT = 0;
  private paddleW = PADDLE_W;
  private lives = 3;

  start(): void {
    this.levelNumber = 1;
    this.score = 0;
    this.time = 0;
    this.lives = 3;
    this.combo = 0;
    this.highestCombo = 0;
    this.bricksDestroyed = 0;
    this.paddleHits = 0;
    this.brickHits = 0;
    this.comboTimer = 0;
    this.comboFlash = 0;
    this.comboBanner = '';
    this.comboBannerT = 0;
    this.paddleX = W / 2 - PADDLE_W / 2;
    this.paddleW = PADDLE_W;
    this.paddleSquash = 0;
    this.balls = [{ x: W / 2, y: this.ballAttachY, vx: 0, vy: 0, attached: true, trail: [], impactFlash: 0 }];
    this.bricks = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.particles.clear();
    this.fx.reset();
    this.initBgParticles();
    this.generateLevel();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') {
      bbSfx.pause();
      this.setState('paused');
    }
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'left') this.paddleDir = -1;
    else if (a === 'right') this.paddleDir = 1;
    else if (a === 'tap' && this.balls[0]?.attached) {
      this.balls[0].attached = false;
      const speed = this.levelBallSpeed;
      this.balls[0].vx = -170 + Math.random() * 340;
      this.balls[0].vy = -speed;
      bbSfx.launch();
    } else if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.fx.update(dt);
    this.particles.update(dt);
    this.paddleSquash = Math.max(0, this.paddleSquash - dt * 6);
    this.comboFlash = Math.max(0, this.comboFlash - dt * 2.5);
    this.comboBannerT = Math.max(0, this.comboBannerT - dt);

    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.combo > 0) this.combo = 0;

    for (const p of this.bgParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.phase += dt * 0.8;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
    }

    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.life -= dt;
      sp.y -= 55 * dt;
      if (sp.life <= 0) this.scorePopups.splice(i, 1);
    }

    for (const brick of this.bricks) {
      if (brick.breaking) brick.breakAnim -= dt;
    }
    this.bricks = this.bricks.filter((b) => !b.breaking || b.breakAnim > 0);

    this.paddleX += this.paddleDir * PADDLE_SPEED * dt;
    this.paddleX = Math.max(4, Math.min(W - 4 - this.paddleW, this.paddleX));

    for (const ball of this.balls) {
      if (ball.impactFlash > 0) ball.impactFlash -= dt * 4;

      if (ball.attached) {
        ball.x = this.paddleX + this.paddleW / 2;
        ball.y = this.ballAttachY;
        ball.trail = [];
        continue;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      ball.trail.push({ x: ball.x, y: ball.y, life: 0.18 });
      if (ball.trail.length > 12) ball.trail.shift();
      for (const t of ball.trail) t.life -= dt;

      if (ball.x - BALL_RADIUS < 0) {
        ball.x = BALL_RADIUS;
        ball.vx = Math.abs(ball.vx);
        bbSfx.wallBounce();
      }
      if (ball.x + BALL_RADIUS > W) {
        ball.x = W - BALL_RADIUS;
        ball.vx = -Math.abs(ball.vx);
        bbSfx.wallBounce();
      }
      if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.vy = Math.abs(ball.vy);
        bbSfx.wallBounce();
      }

      if (
        ball.vy > 0 &&
        ball.y + BALL_RADIUS > PADDLE_Y &&
        ball.y - BALL_RADIUS < PADDLE_Y + PADDLE_H &&
        ball.x > this.paddleX &&
        ball.x < this.paddleX + this.paddleW
      ) {
        ball.y = PADDLE_Y - BALL_RADIUS;
        const hitPos = (ball.x - this.paddleX) / this.paddleW - 0.5;
        const targetSpeed = this.levelBallSpeed;
        ball.vx = hitPos * 420;
        const vxClamped = Math.min(Math.abs(ball.vx), targetSpeed * 0.85);
        ball.vx = Math.sign(ball.vx || hitPos) * vxClamped;
        ball.vy = -Math.sqrt(Math.max(targetSpeed * targetSpeed - ball.vx * ball.vx, 1));
        bbSfx.paddleHit();
        this.paddleSquash = 1;
        this.paddleHits++;
        this.fx.shake(3, 0.12);
        this.particles.burst(ball.x, ball.y, 6, ['#80d8ff', '#ffffff', '#4fc3f7'], { speed: 90, life: 0.25, size: 2.5, glow: true });
      }

      if (ball.y > H) {
        this.balls = this.balls.filter((b) => b !== ball);
        if (this.balls.length === 0) {
          this.lives--;
          if (this.lives <= 0) {
            bbSfx.gameOver();
            this.setState('gameOver');
            setHighScore('brick-blitz', this.score);
            this.onGameOver(this.score, this.levelNumber, false);
            return;
          }
          bbSfx.lifeLost();
          this.balls = [{ x: W / 2, y: this.ballAttachY, vx: 0, vy: 0, attached: true, trail: [], impactFlash: 0 }];
        }
        continue;
      }

      for (const brick of this.bricks) {
        if (brick.breaking) continue;
        const dx = ball.x - Math.max(brick.x, Math.min(ball.x, brick.x + BRICK_W));
        const dy = ball.y - Math.max(brick.y, Math.min(ball.y, brick.y + BRICK_H));
        if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
          brick.hp--;
          ball.impactFlash = 1;
          this.brickHits++;

          if (brick.hp <= 0) {
            brick.breaking = true;
            brick.breakAnim = 0.4;
            const cx = brick.x + BRICK_W / 2;
            const cy = brick.y + BRICK_H / 2;
            const pal = BRICK_PALETTE[brick.color % BRICK_PALETTE.length];

            this.combo++;
            this.comboTimer = COMBO_WINDOW;
            if (this.combo > this.highestCombo) this.highestCombo = this.combo;
            this.bricksDestroyed++;

            if (this.combo >= 2) {
              this.comboFlash = 0.6;
              this.comboBanner = `Combo ×${this.combo}`;
              this.comboBannerT = 1.2;
              if (this.combo >= 10) {
                this.fx.flash('#ffd700', 0.35);
                this.fx.shake(6, 0.2);
                bbSfx.comboHit(10);
              } else if (this.combo >= 5) {
                this.fx.flash('#ff9500', 0.25);
                this.fx.shake(4, 0.15);
                bbSfx.comboHit(5);
              } else {
                this.fx.flash('#ffffff', 0.12);
                bbSfx.comboHit(this.combo);
              }
              this.particles.burst(cx, cy, 12 + this.combo * 2, [pal.glow, '#ffffff', pal.top], { speed: 160, life: 0.5, size: 4, glow: true });
            }

            this.particles.burst(cx, cy, 14, [pal.top, pal.mid, pal.bot, '#ffffff'], { speed: 200, life: 0.55, size: 5, gravity: 320 });
            this.particles.burst(cx, cy, 8, [pal.glow, '#ffffff'], { speed: 120, life: 0.35, size: 3, glow: true });

            bbSfx.brickBreak(this.combo);
            this.score += 10;

            let label = '+10';
            let popColor = '#ffffff';
            if (this.combo >= 10) { label = 'Excellent!'; popColor = '#ffd700'; }
            else if (this.combo >= 5) { label = `Combo ×${this.combo}`; popColor = '#ff9500'; }
            else if (this.combo >= 3) { label = `Combo ×${this.combo}`; popColor = '#ffb84d'; }
            else if (this.combo >= 2) { label = '+20'; popColor = '#80d8ff'; }
            this.spawnScorePopup(cx, cy, label, popColor);

            if (Math.random() < 0.15) {
              this.powerUps.push({
                x: cx, y: cy,
                type: ['paddle', 'slow', 'multi'][Math.floor(Math.random() * 3)] as 'paddle' | 'slow' | 'multi',
                vx: 0, vy: 100, rot: Math.random() * Math.PI * 2, pulse: Math.random() * Math.PI * 2,
              });
            }
          }

          const overlapLeft = ball.x + BALL_RADIUS - brick.x;
          const overlapRight = brick.x + BRICK_W - (ball.x - BALL_RADIUS);
          const overlapTop = ball.y + BALL_RADIUS - brick.y;
          const overlapBottom = brick.y + BRICK_H - (ball.y - BALL_RADIUS);
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            ball.vx *= -1;
          } else {
            ball.vy *= -1;
          }
          this.fx.shake(2.5, 0.1);
          break;
        }
      }

      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const cap = this.levelMaxBallSpeed;
      if (speed > cap) {
        ball.vx = (ball.vx / speed) * cap;
        ball.vy = (ball.vy / speed) * cap;
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.y += p.vy * dt;
      p.rot += dt * 1.8;
      p.pulse += dt * 4;

      if (p.y > H) {
        this.powerUps.splice(i, 1);
        continue;
      }

      if (p.y + 14 > PADDLE_Y && p.x > this.paddleX && p.x < this.paddleX + this.paddleW) {
        this.powerUps.splice(i, 1);
        if (p.type === 'paddle') {
          this.paddleW = Math.min(PADDLE_W * 1.55, this.paddleW + 24);
        } else if (p.type === 'slow') {
          for (const b of this.balls) {
            b.vx *= 0.7;
            b.vy *= 0.7;
          }
        } else if (p.type === 'multi') {
          if (this.balls.length < 3) {
            const b = this.balls[0];
            this.balls.push({ x: b.x - 24, y: b.y, vx: b.vx - 90, vy: b.vy, attached: false, trail: [], impactFlash: 0 });
            this.balls.push({ x: b.x + 24, y: b.y, vx: b.vx + 90, vy: b.vy, attached: false, trail: [], impactFlash: 0 });
          }
        }
        bbSfx.powerUp();
        this.fx.shake(4, 0.15);
        this.fx.flash('#80d8ff', 0.15);
        this.particles.burst(p.x, p.y, 16, ['#4fc3f7', '#ffffff', '#00c853'], { speed: 140, life: 0.45, size: 4, glow: true });
      }
    }

    if (this.bricks.filter((b) => !b.breaking).length === 0) {
      bbSfx.levelClear();
      this.levelNumber++;
      this.score += 100 * this.levelNumber;
      this.setState('levelClear');
      this.onGameOver(this.score, this.levelNumber, setHighScore('brick-blitz', this.score));
      this.particles.burst(W / 2, H / 3, 40, ['#ffd700', '#ffffff', '#4fc3f7', '#00c853'], { speed: 220, life: 0.8, size: 5, glow: true });
      this.fx.flash('#ffffff', 0.3);
      setTimeout(() => {
        if (this.levelNumber > 5) {
          this.setState('gameOver');
        } else {
          this.generateLevel();
          this.setState('playing');
          this.balls = [{ x: W / 2, y: this.ballAttachY, vx: 0, vy: 0, attached: true, trail: [], impactFlash: 0 }];
        }
      }, 800);
    }
  }

  private generateLevel(): void {
    this.bricks = [];
    const colors = [0, 1, 2, 3, 4, 5];
    const rows = this.levelRows();
    const totalWidth = BRICKS_PER_ROW * BRICK_W + (BRICKS_PER_ROW - 1) * BRICK_GAP;
    const startX = (W - totalWidth) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICKS_PER_ROW; c++) {
        if (!this.shouldPlaceBrick(r, c)) continue;
        const x = startX + c * (BRICK_W + BRICK_GAP);
        const y = BRICK_START_Y + r * (BRICK_H + BRICK_GAP);
        this.bricks.push({
          x,
          y,
          hp: this.brickHp(r),
          color: colors[(r + c) % colors.length],
          breaking: false,
          breakAnim: 0,
        });
      }
    }
  }

  private spawnScorePopup(x: number, y: number, text: string, color: string): void {
    this.scorePopups.push({ x, y, text, life: 0.9, maxLife: 0.9, color, scale: 1 });
  }

  private initBgParticles(): void {
    this.bgParticles = [];
    for (let i = 0; i < 24; i++) {
      this.bgParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 18,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.08 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx);

    this.fx.preRender(ctx);
    this.drawBricks(ctx);
    this.drawPowerUps(ctx);
    this.drawPaddle(ctx);
    this.drawBalls(ctx);
    this.particles.render(ctx);
    this.drawScorePopups(ctx);
    this.drawComboBanner(ctx);
    this.fx.postRender(ctx, W, H);

    if (this.balls.some((b) => b.attached) && this.state === 'playing') {
      const pulse = 0.7 + Math.sin(this.time * 4) * 0.3;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 15px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(79,158,22,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText('Tap to launch', W / 2, this.ballAttachY - 18);
      ctx.restore();
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1628');
    bg.addColorStop(0.4, '#122240');
    bg.addColorStop(0.7, '#1a3060');
    bg.addColorStop(1, '#0d1f3c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.04;
    const hexSize = 28;
    for (let row = -1; row < H / hexSize + 2; row++) {
      for (let col = -1; col < W / hexSize + 2; col++) {
        const ox = col * hexSize * 1.75 + (row % 2) * hexSize * 0.875;
        const oy = row * hexSize * 1.5;
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const px = ox + Math.cos(a) * hexSize * 0.5;
          const py = oy + Math.sin(a) * hexSize * 0.5;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();

    const ray = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, H * 0.7);
    ray.addColorStop(0, 'rgba(79,158,22,0.12)');
    ray.addColorStop(0.5, 'rgba(31,116,224,0.06)');
    ray.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ray;
    ctx.fillRect(0, 0, W, H);

    const ray2 = ctx.createRadialGradient(W * 0.8, H * 0.3, 0, W * 0.8, H * 0.3, 200);
    ray2.addColorStop(0, 'rgba(124,77,255,0.08)');
    ray2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ray2;
    ctx.fillRect(0, 0, W, H);

    for (const p of this.bgParticles) {
      const a = p.alpha * (0.6 + Math.sin(p.phase) * 0.4);
      ctx.fillStyle = `rgba(180,220,255,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBricks(ctx: CanvasRenderingContext2D): void {
    for (const brick of this.bricks) {
      const pal = BRICK_PALETTE[brick.color % BRICK_PALETTE.length];
      const breakT = brick.breaking ? 1 - brick.breakAnim / 0.4 : 0;
      const scale = brick.breaking ? 1 + breakT * 0.3 : 1;
      const alpha = brick.breaking ? 1 - breakT : 1;
      const cx = brick.x + BRICK_W / 2;
      const cy = brick.y + BRICK_H / 2;
      const w = BRICK_W * scale;
      const h = BRICK_H * scale;
      const bx = cx - w / 2;
      const by = cy - h / 2;

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.shadowColor = pal.bot;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      const g = ctx.createLinearGradient(bx, by, bx, by + h);
      g.addColorStop(0, pal.top);
      g.addColorStop(0.45, pal.mid);
      g.addColorStop(1, pal.bot);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(bx, by, w, h, 5);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const shine = ctx.createLinearGradient(bx, by, bx, by + h * 0.45);
      shine.addColorStop(0, 'rgba(255,255,255,0.55)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.15)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 1, w - 4, h * 0.42, 4);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(bx + 0.5, by + 0.5, w - 1, h - 1, 5);
      ctx.stroke();

      if (brick.hp > 1 && !brick.breaking) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 3;
        ctx.fillText(String(brick.hp), cx, cy);
      }

      ctx.restore();
    }
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D): void {
    const configs = {
      paddle: { colors: ['#4fc3f7', '#1f74e0'], label: 'W', icon: '▬' },
      slow: { colors: ['#b388ff', '#7c4dff'], label: 'S', icon: '◷' },
      multi: { colors: ['#ffd54f', '#ff9500'], label: 'M', icon: '●' },
    };

    for (const p of this.powerUps) {
      const cfg = configs[p.type];
      const pulse = 1 + Math.sin(p.pulse) * 0.12;
      const r = 14 * pulse;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      ctx.shadowColor = cfg.colors[0];
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      g.addColorStop(0, cfg.colors[0]);
      g.addColorStop(0.6, cfg.colors[1]);
      g.addColorStop(1, cfg.colors[1] + 'cc');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.25, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(11 * pulse)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.icon, 0, 1);

      ctx.restore();
    }
  }

  private drawPaddle(ctx: CanvasRenderingContext2D): void {
    const squashY = this.paddleSquash * 3;
    const squashW = this.paddleSquash * 4;
    const px = this.paddleX - squashW / 2;
    const py = PADDLE_Y + squashY;
    const pw = this.paddleW + squashW;
    const ph = PADDLE_H - squashY * 0.6;

    ctx.save();
    ctx.shadowColor = 'rgba(31,116,224,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, '#5ee89a');
    g.addColorStop(0.35, '#00c853');
    g.addColorStop(0.7, '#1f74e0');
    g.addColorStop(1, '#0d47a1');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph / 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const shine = ctx.createLinearGradient(px, py, px, py + ph * 0.5);
    shine.addColorStop(0, 'rgba(255,255,255,0.6)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.roundRect(px + 3, py + 2, pw - 6, ph * 0.45, ph / 3);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px + 0.5, py + 0.5, pw - 1, ph - 1, ph / 2);
    ctx.stroke();

    const glow = ctx.createRadialGradient(px + pw / 2, py + ph, 0, px + pw / 2, py + ph, pw * 0.6);
    glow.addColorStop(0, 'rgba(0,200,83,0.25)');
    glow.addColorStop(1, 'rgba(0,200,83,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - pw * 0.1, py, pw * 1.2, ph + 8);

    ctx.restore();
  }

  private drawBalls(ctx: CanvasRenderingContext2D): void {
    for (const ball of this.balls) {
      for (const t of ball.trail) {
        if (t.life <= 0) continue;
        const a = (t.life / 0.18) * 0.35;
        ctx.fillStyle = `rgba(94,232,154,${a})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_VISUAL_RADIUS * 0.7 * (t.life / 0.18), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(ball.x, ball.y + BALL_VISUAL_RADIUS + 2, BALL_VISUAL_RADIUS * 0.8, BALL_VISUAL_RADIUS * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const glowR = BALL_VISUAL_RADIUS + 6;
      const outerGlow = ctx.createRadialGradient(ball.x, ball.y, BALL_VISUAL_RADIUS * 0.5, ball.x, ball.y, glowR);
      outerGlow.addColorStop(0, 'rgba(94,232,154,0.35)');
      outerGlow.addColorStop(1, 'rgba(94,232,154,0)');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createRadialGradient(
        ball.x - BALL_VISUAL_RADIUS * 0.35, ball.y - BALL_VISUAL_RADIUS * 0.35, 0,
        ball.x, ball.y, BALL_VISUAL_RADIUS,
      );
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, '#b8f0d0');
      g.addColorStop(0.55, '#5ee89a');
      g.addColorStop(0.85, '#00c853');
      g.addColorStop(1, '#007a33');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_VISUAL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(ball.x - BALL_VISUAL_RADIUS * 0.28, ball.y - BALL_VISUAL_RADIUS * 0.32, BALL_VISUAL_RADIUS * 0.22, BALL_VISUAL_RADIUS * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fill();

      if (ball.impactFlash > 0) {
        ctx.globalAlpha = ball.impactFlash * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_VISUAL_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const sp of this.scorePopups) {
      const t = 1 - sp.life / sp.maxLife;
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const scale = 1 + Math.sin(t * Math.PI) * 0.2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sp.x, sp.y);
      ctx.scale(scale, scale);
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = sp.color;
      ctx.fillText(sp.text, 0, 0);
      ctx.restore();
    }
  }

  private drawComboBanner(ctx: CanvasRenderingContext2D): void {
    if (this.comboBannerT <= 0 || this.combo < 2) return;
    const a = Math.min(1, this.comboBannerT * 2);
    const pulse = 1 + Math.sin(this.time * 12) * 0.06;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, H * 0.28);
    ctx.scale(pulse, pulse);

    const fontSize = this.combo >= 10 ? 32 : this.combo >= 5 ? 26 : 22;
    ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = this.combo >= 10 ? '#ffd700' : this.combo >= 5 ? '#ff9500' : '#4fc3f7';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.comboBanner, 0, 0);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.combo >= 10 ? '#ffd700' : '#4fc3f7';
    ctx.lineWidth = 1.5;
    ctx.strokeText(this.comboBanner, 0, 0);
    ctx.restore();
  }
}

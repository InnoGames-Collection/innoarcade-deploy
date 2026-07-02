// Brick Blitz — enterprise-grade breakout with paddle physics, ball dynamics,
// power-ups, and progressive brick patterns. Classic arcade with modern polish.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const PADDLE_W = 70;
const PADDLE_H = 12;
const PADDLE_Y = H - 32;
const PADDLE_SPEED = 400;

const BALL_RADIUS = 5;
const BALL_SPEED = 280;
const MAX_BALL_SPEED = 420;

const BRICK_W = 50;
const BRICK_H = 16;
const BRICK_ROWS = 4;
const BRICKS_PER_ROW = 8;
const BRICK_GAP = 2;

interface Brick {
  x: number;
  y: number;
  hp: number;
  color: number;
  breaking: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'paddle' | 'slow' | 'multi';
  vx: number;
  vy: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  attached: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'levelClear' | 'gameOver';

export class BrickBlitz {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('brick-blitz');

  get displayLevel(): number { return this.levelNumber; }
  get displayLives(): number { return this.lives; }

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, levelReached: number, record: boolean) => void = () => {};

  private time = 0;
  private levelNumber = 1;
  private paddleX = W / 2 - PADDLE_W / 2;
  private paddleDir = 0;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: PowerUp[] = [];
  private particles: Particle[] = [];
  private screenShake = 0;
  private paddleW = PADDLE_W;
  private lives = 3;

  start(): void {
    this.levelNumber = 1;
    this.score = 0;
    this.time = 0;
    this.lives = 3;
    this.paddleX = W / 2 - PADDLE_W / 2;
    this.paddleW = PADDLE_W;
    this.balls = [{ x: W / 2, y: PADDLE_Y - 20, vx: 0, vy: 0, attached: true }];
    this.bricks = [];
    this.powerUps = [];
    this.particles = [];
    this.screenShake = 0;
    this.generateLevel();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'left') this.paddleDir = -1;
    else if (a === 'right') this.paddleDir = 1;
    else if (a === 'tap' && this.balls[0]?.attached) {
      this.balls[0].attached = false;
      this.balls[0].vx = -150 + Math.random() * 300;
      this.balls[0].vy = -BALL_SPEED;
      sfx.jump();
    } else if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);

    this.paddleX += this.paddleDir * PADDLE_SPEED * dt;
    this.paddleX = Math.max(4, Math.min(W - 4 - this.paddleW, this.paddleX));

    for (const ball of this.balls) {
      if (ball.attached) {
        ball.x = this.paddleX + this.paddleW / 2;
        ball.y = PADDLE_Y - 20;
        continue;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Walls
      if (ball.x - BALL_RADIUS < 0) {
        ball.x = BALL_RADIUS;
        ball.vx = Math.abs(ball.vx);
        sfx.click();
      }
      if (ball.x + BALL_RADIUS > W) {
        ball.x = W - BALL_RADIUS;
        ball.vx = -Math.abs(ball.vx);
        sfx.click();
      }
      if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.vy = Math.abs(ball.vy);
        sfx.click();
      }

      // Paddle
      if (
        ball.vy > 0 &&
        ball.y + BALL_RADIUS > PADDLE_Y &&
        ball.y - BALL_RADIUS < PADDLE_Y + PADDLE_H &&
        ball.x > this.paddleX &&
        ball.x < this.paddleX + this.paddleW
      ) {
        ball.y = PADDLE_Y - BALL_RADIUS;
        const hitPos = (ball.x - this.paddleX) / this.paddleW - 0.5;
        ball.vx = hitPos * 400;
        ball.vy = -Math.sqrt(BALL_SPEED * BALL_SPEED - ball.vx * ball.vx);
        sfx.jump();
        this.screenShake = 0.15;
      }

      // Lost
      if (ball.y > H) {
        this.balls = this.balls.filter((b) => b !== ball);
        if (this.balls.length === 0) {
          this.lives--;
          if (this.lives <= 0) {
            sfx.crash();
            this.setState('gameOver');
            setHighScore('brick-blitz', this.score);
            this.onGameOver(this.score, this.levelNumber, false);
            return;
          }
          this.balls = [{ x: W / 2, y: PADDLE_Y - 20, vx: 0, vy: 0, attached: true }];
        }
        continue;
      }

      // Bricks
      for (const brick of this.bricks) {
        if (brick.breaking) continue;
        const dx = ball.x - Math.max(brick.x, Math.min(ball.x, brick.x + BRICK_W));
        const dy = ball.y - Math.max(brick.y, Math.min(ball.y, brick.y + BRICK_H));
        if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
          brick.hp--;
          if (brick.hp <= 0) {
            brick.breaking = true;
            for (let i = 0; i < 6; i++) this.spawnParticle(brick.x + BRICK_W / 2, brick.y + BRICK_H / 2, brick.color);
            sfx.coin();
            this.score += 10;
            if (Math.random() < 0.15) {
              this.powerUps.push({
                x: brick.x + BRICK_W / 2,
                y: brick.y + BRICK_H / 2,
                type: ['paddle', 'slow', 'multi'][Math.floor(Math.random() * 3)] as 'paddle' | 'slow' | 'multi',
                vx: 0,
                vy: 100,
              });
            }
          }

          // Bounce
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
          this.screenShake = 0.2;
          break;
        }
      }

      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > MAX_BALL_SPEED) {
        ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
        ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
      }
    }

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.y += p.vy * dt;

      if (p.y > H) {
        this.powerUps.splice(i, 1);
        continue;
      }

      if (p.y + 8 > PADDLE_Y && p.x > this.paddleX && p.x < this.paddleX + this.paddleW) {
        this.powerUps.splice(i, 1);
        if (p.type === 'paddle') {
          this.paddleW = Math.min(PADDLE_W * 1.5, this.paddleW + 20);
        } else if (p.type === 'slow') {
          for (const b of this.balls) {
            b.vx *= 0.7;
            b.vy *= 0.7;
          }
        } else if (p.type === 'multi') {
          if (this.balls.length < 3) {
            const b = this.balls[0];
            this.balls.push({ x: b.x - 20, y: b.y, vx: b.vx - 80, vy: b.vy, attached: false });
            this.balls.push({ x: b.x + 20, y: b.y, vx: b.vx + 80, vy: b.vy, attached: false });
          }
        }
        sfx.coin();
        this.screenShake = 0.25;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.bricks = this.bricks.filter((b) => !b.breaking);
    if (this.bricks.length === 0) {
      sfx.coin();
      this.levelNumber++;
      this.score += 100 * this.levelNumber;
      this.setState('levelClear');
      this.onGameOver(this.score, this.levelNumber, setHighScore('brick-blitz', this.score));
      setTimeout(() => {
        if (this.levelNumber > 5) {
          this.setState('gameOver');
        } else {
          this.generateLevel();
          this.setState('playing');
          this.balls = [{ x: W / 2, y: PADDLE_Y - 20, vx: 0, vy: 0, attached: true }];
        }
      }, 800);
    }
  }

  private generateLevel(): void {
    this.bricks = [];
    const colors = [0, 1, 2, 3];
    const startY = 40;

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICKS_PER_ROW; c++) {
        const x = 8 + c * (BRICK_W + BRICK_GAP);
        const y = startY + r * (BRICK_H + BRICK_GAP);
        this.bricks.push({
          x,
          y,
          hp: 1 + (this.levelNumber > 2 ? 1 : 0) + (this.levelNumber > 4 ? 1 : 0),
          color: colors[r % colors.length],
          breaking: false,
        });
      }
    }
  }

  private spawnParticle(x: number, y: number, color: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 120;
    const colors = ['#ff6b6b', '#ffa502', '#00d4ff', '#00ff88'];
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      life: 0.5 + Math.random() * 0.25,
      maxLife: 0.5 + Math.random() * 0.25,
      size: 3 + Math.random() * 3,
      color: colors[color],
    });
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Neon arena backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3d1635');
    bg.addColorStop(0.5, '#26133f');
    bg.addColorStop(1, '#141b3d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Soft glow behind the brick field
    const glow = ctx.createRadialGradient(W / 2, 140, 30, W / 2, 140, 320);
    glow.addColorStop(0, 'rgba(255, 107, 107, 0.16)');
    glow.addColorStop(1, 'rgba(255, 107, 107, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Faint grid lines for arcade depth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    this.drawHeader(ctx);
    this.drawBricks(ctx);
    this.drawPowerUps(ctx);
    this.drawPaddle(ctx);
    this.drawBalls(ctx);
    this.drawParticles(ctx);

    if (this.screenShake > 0) {
      ctx.fillStyle = `rgba(255, 100, 100, ${this.screenShake * 0.12})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    ctx.fillRect(0, 0, W, 30);

    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`Lvl ${this.levelNumber}`, 12, 22);

    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, W / 2, 22);

    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${'❤'.repeat(this.lives)}`, W - 12, 22);
  }

  private drawBricks(ctx: CanvasRenderingContext2D): void {
    const colors = ['#ff6b6b', '#ffa502', '#00d4ff', '#00ff88'];
    for (const brick of this.bricks) {
      const color = colors[brick.color % colors.length];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillRect(brick.x, brick.y, BRICK_W, BRICK_H);

      if (brick.hp > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(brick.hp), brick.x + BRICK_W / 2, brick.y + BRICK_H / 2);
      }
      ctx.shadowBlur = 0;
    }
  }

  private drawPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.powerUps) {
      const icon = p.type === 'paddle' ? '⬜' : p.type === 'slow' ? '🐢' : '⚡';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, p.x, p.y);
    }
  }

  private drawPaddle(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(this.paddleX, PADDLE_Y, this.paddleX, PADDLE_Y + PADDLE_H);
    g.addColorStop(0, '#6b9dff');
    g.addColorStop(1, '#3d5a99');
    ctx.fillStyle = g;
    ctx.shadowColor = '#6b9dff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(this.paddleX, PADDLE_Y, this.paddleW, PADDLE_H, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private drawBalls(ctx: CanvasRenderingContext2D): void {
    for (const ball of this.balls) {
      const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_RADIUS);
      g.addColorStop(0, '#ffff99');
      g.addColorStop(1, '#ff9933');
      ctx.fillStyle = g;
      ctx.shadowColor = '#ffff99';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - progress * progress;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

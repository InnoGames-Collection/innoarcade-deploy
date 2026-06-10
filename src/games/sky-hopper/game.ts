// Sky Hopper — vertical platform jumper with procedural generation, enemies,
// progressive difficulty, and satisfying physics. Enterprise-grade arcade action.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const PLAYER_W = 24;
const PLAYER_H = 24;
const PLAYER_SPEED = 300;
const PLAYER_JUMP_POWER = 450;

const PLATFORM_W = 60;
const PLATFORM_H = 12;
const PLATFORM_SPACING = 110;

interface Platform {
  x: number;
  y: number;
  w: number;
  moving: boolean;
  direction: number;
  speed: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
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

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export class SkyHopper {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('sky-hopper');

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private time = 0;
  private playerX = W / 2 - PLAYER_W / 2;
  private playerY = H - 100;
  private playerVy = 0;
  private playerDir = 0;

  private cameraY = H - 100;
  private platforms: Platform[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private screenShake = 0;

  start(): void {
    this.score = 0;
    this.time = 0;
    this.playerX = W / 2 - PLAYER_W / 2;
    this.playerY = H - 100;
    this.playerVy = 0;
    this.playerDir = 0;
    this.cameraY = H - 100;
    this.platforms = [];
    this.enemies = [];
    this.particles = [];
    this.screenShake = 0;
    this.generateInitialPlatforms();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    switch (a) {
      case 'left':
        this.playerDir = -1;
        break;
      case 'right':
        this.playerDir = 1;
        break;
      case 'pause':
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        break;
    }
  }

  private generateInitialPlatforms(): void {
    for (let i = 0; i < 8; i++) {
      const y = H - 100 - i * PLATFORM_SPACING;
      this.addPlatform(y);
    }
  }

  private addPlatform(y: number): void {
    const isMoving = Math.random() < (0.3 + this.score * 0.001);
    const w = isMoving ? 48 : PLATFORM_W;
    const x = Math.random() * (W - w);
    const speed = 80 + Math.random() * 120;
    const direction = Math.random() < 0.5 ? -1 : 1;

    this.platforms.push({
      x,
      y,
      w,
      moving: isMoving,
      direction,
      speed,
    });

    if (Math.random() < (0.05 + this.score * 0.002)) {
      const ex = Math.random() * (W - 30);
      this.enemies.push({
        x: ex,
        y: y - 60,
        vx: 150 * (Math.random() < 0.5 ? -1 : 1),
        w: 28,
        h: 20,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);

    this.playerX += this.playerDir * PLAYER_SPEED * dt;
    this.playerX = Math.max(0, Math.min(W - PLAYER_W, this.playerX));

    this.playerY += this.playerVy * dt;
    this.playerVy += 800 * dt;

    if (this.playerY >= H) {
      this.setState('gameOver');
      this.onGameOver(this.score, this.score > this.best);
      if (this.score > this.best) {
        setHighScore('sky-hopper', this.score);
        this.best = this.score;
      }
      return;
    }

    const onGround = this.checkPlatformCollision();
    if (onGround && this.playerVy > 0) {
      this.playerVy = -PLAYER_JUMP_POWER;
      sfx.click();
      this.burst(this.playerX + PLAYER_W / 2, this.playerY + PLAYER_H);
    }

    for (const enemy of this.enemies) {
      enemy.x += enemy.vx * dt;
      if (enemy.x < 0 || enemy.x + enemy.w > W) {
        enemy.vx *= -1;
      }

      const overlap =
        this.playerX < enemy.x + enemy.w &&
        this.playerX + PLAYER_W > enemy.x &&
        this.playerY < enemy.y + enemy.h &&
        this.playerY + PLAYER_H > enemy.y;

      if (overlap) {
        this.setState('gameOver');
        this.onGameOver(this.score, this.score > this.best);
        if (this.score > this.best) {
          setHighScore('sky-hopper', this.score);
          this.best = this.score;
        }
        return;
      }
    }

    for (const p of this.platforms) {
      if (!p.moving) continue;
      p.x += p.direction * p.speed * dt;
      if (p.x < 0 || p.x + p.w > W) p.direction *= -1;
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life += dt;
    }

    const highestPlatform = Math.min(...this.platforms.map((p) => p.y));
    const targetCameraY = highestPlatform - 150;
    this.cameraY += (targetCameraY - this.cameraY) * dt * 2;

    const difficulty = Math.floor(this.score / 500) + 1;
    const newGap = PLATFORM_SPACING * Math.max(0.6, 1 - difficulty * 0.02);

    this.platforms = this.platforms.filter((p) => p.y < this.cameraY + H + 100);
    this.enemies = this.enemies.filter((e) => e.y < this.cameraY + H + 100);
    this.particles = this.particles.filter((p) => p.life < p.maxLife);

    while (this.platforms.length < 8) {
      const lowestPlatform = Math.max(...this.platforms.map((p) => p.y));
      this.addPlatform(lowestPlatform - newGap);
    }
  }

  private checkPlatformCollision(): boolean {
    const nextY = this.playerY + PLAYER_H + 2;

    for (const p of this.platforms) {
      const overlap =
        this.playerX < p.x + p.w &&
        this.playerX + PLAYER_W > p.x &&
        this.playerY + PLAYER_H >= p.y &&
        nextY <= p.y + PLATFORM_H + 10;

      if (overlap && this.playerVy > 0) {
        this.playerY = p.y - PLAYER_H - 1;
        this.score += 10;
        return true;
      }
    }

    return false;
  }

  private burst(x: number, y: number): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 100 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.4,
        size: 4 + Math.random() * 2,
        color: `hsl(${Math.random() * 60 + 200}, 80%, 60%)`,
      });
    }
  }

  private setState(next: GameState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const shake = this.screenShake * 4;
    ctx.save();
    ctx.translate(
      shake * (Math.random() - 0.5),
      shake * (Math.random() - 0.5),
    );

    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(100, 150, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(10, 22, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const offsetY = this.cameraY;

    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Height: ${Math.max(0, Math.floor(this.score))}`, W / 2, 40);

    for (const p of this.platforms) {
      const y = p.y - offsetY;
      if (y < -50 || y > H + 50) continue;

      const isMoving = p.moving;
      ctx.fillStyle = isMoving ? '#4a9eff' : '#2a7acc';
      ctx.fillRect(p.x, y, p.w, PLATFORM_H);

      if (isMoving) {
        ctx.strokeStyle = '#6ab4ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 2, y - 2, p.w + 4, PLATFORM_H + 4);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(p.x + 6, y + 3, p.w - 12, 2);
      }
    }

    for (const e of this.enemies) {
      const y = e.y - offsetY;
      if (y < -50 || y > H + 50) continue;

      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(e.x, y, e.w, e.h);
      ctx.fillStyle = '#333';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💀', e.x + e.w / 2, y + e.h / 2);
    }

    const py = this.playerY - offsetY;
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(this.playerX, py, PLAYER_W, PLAYER_H);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐸', this.playerX + PLAYER_W / 2, py + PLAYER_H / 2);

    for (const p of this.particles) {
      const y = p.y - offsetY;
      const alpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(p.x, y, p.size * Math.max(0, alpha), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

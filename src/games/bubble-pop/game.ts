// Bubble Pop — bubble shooter with physics, matching, cascade clearing,
// and progressive difficulty. Enterprise-grade puzzle-action hybrid.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const BUBBLE_RADIUS = 16;
const LAUNCH_SPEED = 600;
const CANNON_Y = H - 60;

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#f38181'] as const;
type BubbleColor = typeof COLORS[number];

interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  falling: boolean;
  popping: boolean;
  popTime: number;
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

export class BubblePop {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('bubble-pop');

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private time = 0;
  private bubbles: Bubble[] = [];
  private particles: Particle[] = [];
  private screenShake = 0;
  private cannonAngle = 0;
  private nextBubbleColor: BubbleColor = this.randomColor();
  private firedBubble: Bubble | null = null;
  private cannonDir = 0;

  start(): void {
    this.score = 0;
    this.time = 0;
    this.bubbles = [];
    this.particles = [];
    this.screenShake = 0;
    this.cannonAngle = 0;
    this.nextBubbleColor = this.randomColor();
    this.firedBubble = null;
    this.cannonDir = 0;
    this.generateInitialBubbles();
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
        this.cannonDir = -1;
        break;
      case 'right':
        this.cannonDir = 1;
        break;
      case 'tap':
        this.fire();
        break;
      case 'pause':
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        break;
    }
  }

  private generateInitialBubbles(): void {
    const rows = 4;
    const cols = 6;
    const spacing = 34;
    const startX = (W - (cols - 1) * spacing) / 2;
    const startY = 80;

    for (let row = 0; row < rows; row++) {
      const yOffset = row % 2 === 1 ? spacing / 2 : 0;
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing + yOffset;
        const y = startY + row * spacing;
        if (x > 0 && x < W) {
          this.bubbles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            color: this.randomColor(),
            falling: false,
            popping: false,
            popTime: 0,
          });
        }
      }
    }
  }

  fire(): void {
    if (this.state !== 'playing' || this.firedBubble) return;

    const cannonX = W / 2;
    const vx = Math.cos(this.cannonAngle) * LAUNCH_SPEED;
    const vy = Math.sin(this.cannonAngle) * LAUNCH_SPEED;

    this.firedBubble = {
      x: cannonX,
      y: CANNON_Y,
      vx,
      vy,
      color: this.nextBubbleColor,
      falling: false,
      popping: false,
      popTime: 0,
    };

    this.nextBubbleColor = this.randomColor();
    sfx.click();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);

    this.cannonAngle += this.cannonDir * dt * 3;
    this.cannonAngle = Math.max(-Math.PI / 2.5, Math.min(-Math.PI + Math.PI / 2.5, this.cannonAngle));

    if (this.firedBubble) {
      const b = this.firedBubble;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 300 * dt;

      if (b.y < 0 || b.x < 0 || b.x > W) {
        this.firedBubble = null;
      }

      for (const bubble of this.bubbles) {
        if (bubble.popping || bubble.falling) continue;
        const dist = Math.hypot(b.x - bubble.x, b.y - bubble.y);
        if (dist < BUBBLE_RADIUS * 2) {
          this.firedBubble = null;
          this.checkMatch(bubble);
          break;
        }
      }
    }

    for (const b of this.bubbles) {
      if (b.falling) {
        b.y += 200 * dt;
        b.vy += 600 * dt;
      }

      if (b.popping) {
        b.popTime += dt;
      }
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life += dt;
    }

    this.bubbles = this.bubbles.filter(
      (b) => !b.popping || b.popTime < 0.2,
    );
    this.bubbles = this.bubbles.filter((b) => b.y < H + 100);
    this.particles = this.particles.filter((p) => p.life < p.maxLife);

    const hasStatic = this.bubbles.some((b) => !b.falling && !b.popping);
    if (!hasStatic && this.bubbles.length > 0) {
      this.setState('gameOver');
      this.onGameOver(this.score, this.score > this.best);
      if (this.score > this.best) {
        setHighScore('bubble-pop', this.score);
        this.best = this.score;
      }
    }
  }

  private checkMatch(hitBubble: Bubble): void {
    const matches: Bubble[] = [];
    const visited = new Set<Bubble>();
    const queue = [hitBubble];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current) || current.popping) continue;
      visited.add(current);

      if (current.color === hitBubble.color) {
        matches.push(current);

        for (const other of this.bubbles) {
          if (
            !visited.has(other) &&
            !other.popping &&
            !other.falling &&
            Math.hypot(current.x - other.x, current.y - other.y) < BUBBLE_RADIUS * 2.2
          ) {
            queue.push(other);
          }
        }
      }
    }

    if (matches.length >= 3) {
      const baseScore = 10 * matches.length;
      const comboBonus = Math.floor(Math.sqrt(matches.length)) * 5;
      this.score += baseScore + comboBonus;

      for (const b of matches) {
        b.popping = true;
        this.burst(b.x, b.y, b.color);
      }

      sfx.jump();
      this.screenShake = 0.15;

      setTimeout(() => {
        for (const b of matches) {
          const idx = this.bubbles.indexOf(b);
          if (idx >= 0) this.bubbles.splice(idx, 1);
        }
        this.updateGravity();
      }, 100);
    }
  }

  private updateGravity(): void {
    for (const b of this.bubbles) {
      if (b.popping || b.falling) continue;

      const hasSupport =
        b.y >= CANNON_Y - 10 ||
        this.bubbles.some(
          (other) =>
            !other.popping &&
            !other.falling &&
            other !== b &&
            Math.hypot(b.x - other.x, b.y - other.y) < BUBBLE_RADIUS * 2.2 &&
            other.y > b.y,
        );

      if (!hasSupport) {
        b.falling = true;
        b.vy = 0;
      }
    }
  }

  private burst(x: number, y: number, color: BubbleColor): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 120 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.5,
        size: 5 + Math.random() * 3,
        color,
      });
    }
  }

  private randomColor(): BubbleColor {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
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
    gradient.addColorStop(0, 'rgba(100, 200, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(10, 22, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.score}`, W / 2, 40);

    for (const b of this.bubbles) {
      if (b.popping) {
        const scale = Math.max(0, 1 - b.popTime / 0.2);
        ctx.globalAlpha = scale;
      } else {
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(b.x - 4, b.y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    if (this.firedBubble) {
      const b = this.firedBubble;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(W / 2, CANNON_Y, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, CANNON_Y);
    ctx.lineTo(
      W / 2 + Math.cos(this.cannonAngle) * 35,
      CANNON_Y + Math.sin(this.cannonAngle) * 35,
    );
    ctx.stroke();

    ctx.fillStyle = this.nextBubbleColor;
    ctx.beginPath();
    ctx.arc(W / 2, CANNON_Y + 50, BUBBLE_RADIUS * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('next', W / 2, CANNON_Y + 50);

    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0, alpha), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

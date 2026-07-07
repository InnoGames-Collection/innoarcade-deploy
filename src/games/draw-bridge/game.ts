import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;
const LEVELS = 3;

interface Point { x: number; y: number; }

interface LevelDef {
  gapStart: number;
  gapEnd: number;
  cliffY: number;
  goalX: number;
}

const LEVEL_DEFS: LevelDef[] = [
  { gapStart: 140, gapEnd: 340, cliffY: 420, goalX: 420 },
  { gapStart: 120, gapEnd: 360, cliffY: 380, goalX: 430 },
  { gapStart: 100, gapEnd: 380, cliffY: 440, goalX: 440 },
];

export type GameState = 'menu' | 'playing' | 'paused' | 'over';
type Phase = 'draw' | 'drive' | 'result';

export class DrawBridge {
  state: GameState = 'menu';
  score = 0;
  level = 1;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private phase: Phase = 'draw';
  private stroke: Point[] = [];
  private drawing = false;
  private car = { x: 60, y: 0, vx: 0, vy: 0, onBridge: false };
  private resultT = 0;

  start(): void {
    this.score = 0;
    this.level = 1;
    this.resetLevel();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  private def(): LevelDef {
    return LEVEL_DEFS[Math.min(this.level - 1, LEVEL_DEFS.length - 1)];
  }

  private resetLevel(): void {
    const d = this.def();
    this.phase = 'draw';
    this.stroke = [];
    this.drawing = false;
    this.car = { x: 70, y: d.cliffY - 20, vx: 0, vy: 0, onBridge: false };
    this.resultT = 0;
  }

  pointerDown(x: number, y: number): void {
    if (this.state !== 'playing' || this.phase !== 'draw') return;
    this.drawing = true;
    this.stroke = [{ x, y }];
  }

  pointerMove(x: number, y: number): void {
    if (!this.drawing || this.phase !== 'draw') return;
    const last = this.stroke[this.stroke.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 6) this.stroke.push({ x, y });
  }

  pointerUp(): void {
    this.drawing = false;
  }

  tapDrive(): void {
    if (this.state !== 'playing' || this.phase !== 'draw' || this.stroke.length < 4) return;
    this.phase = 'drive';
    this.car.vx = 140;
    sfx.click();
  }

  handleAction(a: Action): void {
    if (a === 'tap' && this.phase === 'draw') this.tapDrive();
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private bridgeYAt(x: number): number | null {
    if (this.stroke.length < 2) return null;
    for (let i = 0; i < this.stroke.length - 1; i++) {
      const a = this.stroke[i];
      const b = this.stroke[i + 1];
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      if (x < minX || x > maxX) continue;
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
    return null;
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    const d = this.def();

    if (this.phase === 'drive') {
      this.car.vy += 680 * dt;
      this.car.x += this.car.vx * dt;
      this.car.y += this.car.vy * dt;

      const by = this.bridgeYAt(this.car.x);
      if (by != null && this.car.y + 12 >= by && this.car.vy >= 0) {
        this.car.y = by - 12;
        this.car.vy = 0;
        this.car.onBridge = true;
      } else if (this.car.onBridge && by == null) {
        this.car.onBridge = false;
      }

      if (this.car.x >= d.goalX && this.car.y <= d.cliffY + 10) {
        this.phase = 'result';
        this.resultT = 0.8;
        this.score += 80 + this.level * 20;
        sfx.coin();
        return;
      }

      if (this.car.y > H + 40) {
        this.phase = 'result';
        this.resultT = 0.8;
        sfx.crash();
      }
    }

    if (this.phase === 'result') {
      this.resultT -= dt;
      if (this.resultT <= 0) {
        if (this.car.x >= d.goalX) {
          if (this.level >= LEVELS) {
            this.setState('over');
            this.onGameOver(this.score, this.score > this.best);
          } else {
            this.level++;
            this.resetLevel();
          }
        } else {
          this.setState('over');
          this.onGameOver(this.score, this.score > this.best);
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const d = this.def();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#d4e8f7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#5a8f3a';
    ctx.fillRect(0, d.cliffY, d.gapStart, H - d.cliffY);
    ctx.fillRect(d.gapEnd, d.cliffY, W - d.gapEnd, H - d.cliffY);

    ctx.fillStyle = '#4a7a2e';
    ctx.fillRect(d.gapStart - 8, d.cliffY - 20, 16, 24);
    ctx.fillRect(d.gapEnd - 8, d.cliffY - 20, 16, 24);

    if (this.stroke.length > 1) {
      ctx.strokeStyle = '#5c4033';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.stroke[0].x, this.stroke[0].y);
      for (let i = 1; i < this.stroke.length; i++) ctx.lineTo(this.stroke[i].x, this.stroke[i].y);
      ctx.stroke();
    }

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.car.x - 18, this.car.y - 10, 36, 20);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(this.car.x - 10, this.car.y + 10, 6, 0, Math.PI * 2);
    ctx.arc(this.car.x + 10, this.car.y + 10, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(d.goalX - 4, d.cliffY - 60, 8, 60);

    if (this.phase === 'draw') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H - 64, W, 64);
      ctx.fillStyle = '#4f9e16';
      ctx.fillRect(W / 2 - 80, H - 56, 160, 48);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DRAW · then DRIVE', W / 2, H - 28);
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

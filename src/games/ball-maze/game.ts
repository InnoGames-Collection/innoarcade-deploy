import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { drawGemCircle } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;

const CELL = 40;

type Cell = 0 | 1; // 0 wall, 1 path

const MAZES: Cell[][][] = [
  [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,0,1,1,1,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,0,1,1,1,0,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,1,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,1,1],
    [1,0,1,0,0,0,1,0,0,0,1,1],
    [1,0,1,1,1,1,1,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,1,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  [
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,1,0,0,0,1,0,0,0,1],
    [1,1,0,1,1,1,1,1,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class BallMaze {
  state: GameState = 'menu';
  score = 0;
  level = 1;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private maze = MAZES[0];
  private bx = 0;
  private by = 0;
  private goal = { x: 0, y: 0 };
  private tiltX = 0;
  private tiltY = 0;
  private time = 0;
  private won = false;

  start(): void {
    this.score = 0;
    this.level = 1;
    this.loadLevel();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (a === 'left') this.tiltX = -1;
    else if (a === 'right') this.tiltX = 1;
    else if (a === 'up') this.tiltY = -1;
    else if (a === 'down') this.tiltY = 1;
    else if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  releaseTilt(): void {
    this.tiltX = 0;
    this.tiltY = 0;
  }

  private loadLevel(): void {
    this.maze = MAZES[Math.min(this.level - 1, MAZES.length - 1)];
    this.bx = 1.5 * CELL;
    this.by = 1.5 * CELL;
    this.goal = { x: 10.5 * CELL, y: 7.5 * CELL };
    this.time = 0;
    this.won = false;
    this.tiltX = 0;
    this.tiltY = 0;
  }

  private blocked(x: number, y: number): boolean {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r < 0 || c < 0 || r >= this.maze.length || c >= this.maze[0].length) return true;
    return this.maze[r][c] === 0;
  }

  update(dt: number): void {
    if (this.state !== 'playing' || this.won) return;
    this.time += dt;
    const speed = 180;
    let nx = this.bx + this.tiltX * speed * dt;
    let ny = this.by + this.tiltY * speed * dt;
    if (!this.blocked(nx, this.by)) this.bx = nx;
    if (!this.blocked(this.bx, ny)) this.by = ny;

    if (Math.hypot(this.bx - this.goal.x, this.by - this.goal.y) < CELL * 0.6) {
      this.won = true;
      const bonus = Math.max(20, 120 - Math.floor(this.time * 10));
      this.score += bonus;
      sfx.coin();
      if (this.level >= MAZES.length) {
        window.setTimeout(() => this.gameOver(), 600);
      } else {
        window.setTimeout(() => { this.level++; this.loadLevel(); }, 600);
      }
    }
  }

  private gameOver(): void {
    this.setState('over');
    const record = this.score > this.best;
    if (record) this.best = this.score;
    this.onGameOver(this.score, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, W, H);

    const ox = (W - this.maze[0].length * CELL) / 2;
    const oy = (H - this.maze.length * CELL) / 2;

    for (let r = 0; r < this.maze.length; r++) {
      for (let c = 0; c < this.maze[0].length; c++) {
        const x = ox + c * CELL;
        const y = oy + r * CELL;
        ctx.fillStyle = this.maze[r][c] ? '#576574' : '#2f3640';
        ctx.fillRect(x, y, CELL - 1, CELL - 1);
      }
    }

    const gx = ox + this.goal.x - 1.5 * CELL + CELL / 2;
    const gy = oy + this.goal.y - 1.5 * CELL + CELL / 2;
    drawGemCircle(ctx, gx, gy, 14, '#2ecc71');

    const bx = ox + this.bx - 1.5 * CELL + CELL / 2;
    const by = oy + this.by - 1.5 * CELL + CELL / 2;
    drawGemCircle(ctx, bx, by, 12, '#e17055');
  }
}

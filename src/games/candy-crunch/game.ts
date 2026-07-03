// Candy Saga — match-3 with tap-to-swap and hub-themed board.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';

export const W = 480;
export const H = 560;

const COLS = 8;
const ROWS = 8;
const CELL = 56;
const GRID_X = (W - COLS * CELL) / 2;
const GRID_Y = 12;
const CANDY_TYPES = 5;
const FALL_SPEED = 900;

export const CANDY_COLORS = ['#ff4d8a', '#ff9f1a', '#8b5cf6', '#fbbf24', '#22c55e'];
export const CANDY_EMOJI = ['🍬', '🍭', '🍫', '🍯', '🌟'];

interface Level {
  number: number;
  targets: Array<{ type: number; count: number }>;
  movesAllowed: number;
}

interface Candy {
  type: number;
  row: number;
  col: number;
  y: number;
  targetY: number;
  matched: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'levelClear' | 'gameOver';

export interface GoalProgress {
  emoji: string;
  have: number;
  need: number;
  done: boolean;
}

export class CandyCrunch {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('candy-crunch');

  get displayLevel(): number { return this.levelNumber; }
  get movesLeft(): number { return Math.max(0, this.level.movesAllowed - this.movesUsed); }
  get movesTotal(): number { return this.level.movesAllowed; }

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, levelReached: number, record: boolean) => void = () => {};

  private level = this.levelAt(1);
  private levelNumber = 1;
  private grid: Candy[][] = [];
  private particles: Particle[] = [];
  private screenShake = 0;
  private comboCount = 0;
  private comboTime = 0;
  private movesUsed = 0;
  private collected: number[] = [];
  private selected: { r: number; c: number } | null = null;
  private busy = false;

  goalProgress(): GoalProgress[] {
    return this.level.targets.map((t, i) => ({
      emoji: CANDY_EMOJI[t.type],
      have: this.collected[i] ?? 0,
      need: t.count,
      done: (this.collected[i] ?? 0) >= t.count,
    }));
  }

  start(): void {
    if (this.state === 'levelClear') {
      this.nextLevel();
      return;
    }
    this.levelNumber = 1;
    this.level = this.levelAt(1);
    this.score = 0;
    this.movesUsed = 0;
    this.comboCount = 0;
    this.selected = null;
    this.busy = false;
    this.resetCollection();
    this.grid = this.newGrid();
    this.particles = [];
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  cellAt(x: number, y: number): { r: number; c: number } | null {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  tapCell(r: number, c: number): void {
    if (this.state !== 'playing' || this.busy) return;
    if (!this.grid[r]?.[c]) return;

    if (!this.selected) {
      this.selected = { r, c };
      sfx.click();
      return;
    }
    if (this.selected.r === r && this.selected.c === c) {
      this.selected = null;
      return;
    }
    const dr = Math.abs(this.selected.r - r);
    const dc = Math.abs(this.selected.c - c);
    if (dr + dc !== 1) {
      this.selected = { r, c };
      sfx.click();
      return;
    }
    void this.trySwap(this.selected.r, this.selected.c, r, c);
    this.selected = null;
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.comboCount = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.busy) return;

    let falling = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const candy = this.grid[r][c];
        if (candy.y < candy.targetY) {
          candy.y = Math.min(candy.targetY, candy.y + FALL_SPEED * dt);
          falling = true;
        }
      }
    }
    if (falling) return;

    void this.resolveBoard();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#eef6e3';
    ctx.fillRect(0, 0, W, H);

    if (this.grid.length === 0 && this.state === 'playing') {
      this.grid = this.newGrid();
    }

    this.drawBoardFrame(ctx);
    this.drawGrid(ctx);
    this.drawCandies(ctx);
    this.drawParticles(ctx);

    if (this.comboCount > 1) {
      ctx.fillStyle = '#4f9e16';
      ctx.font = 'bold 17px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.comboCount}x COMBO!`, W / 2, H - 8);
    }

    if (this.screenShake > 0) {
      ctx.fillStyle = `rgba(255, 100, 100, ${this.screenShake * 0.08})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private async trySwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
    this.busy = true;
    this.swapCells(r1, c1, r2, c2);
    sfx.click();

    const matched = this.findMatches();
    if (matched.length === 0) {
      this.swapCells(r1, c1, r2, c2);
      sfx.slide();
      this.busy = false;
      return;
    }

    this.movesUsed++;
    await this.clearMatches(matched);
    this.busy = false;
    await this.resolveBoard();
    this.checkLevelEnd();
  }

  private async resolveBoard(): Promise<void> {
    if (this.busy) return;
    const matched = this.findMatches();
    if (matched.length === 0) return;
    this.busy = true;
    await this.clearMatches(matched);
    this.busy = false;
    this.checkLevelEnd();
  }

  private async clearMatches(matched: Array<{ r: number; c: number }>): Promise<void> {
    for (const { r, c } of matched) {
      this.grid[r][c].matched = true;
      this.spawnParticles(r, c);
      this.addCollection(this.grid[r][c].type);
    }
    sfx.coin();
    this.screenShake = 0.25;
    this.comboCount++;
    this.comboTime = 0.6;

    const tier = 1 + Math.max(0, this.comboCount - 1) * 0.2;
    this.score += Math.round(matched.length * 12 * tier);

    await this.wait(160);
    this.applyGravity();
    await this.wait(120);

    const chain = this.findMatches();
    if (chain.length > 0) await this.clearMatches(chain);
  }

  private addCollection(type: number): void {
    for (let i = 0; i < this.level.targets.length; i++) {
      if (this.level.targets[i].type === type && (this.collected[i] ?? 0) < this.level.targets[i].count) {
        this.collected[i] = (this.collected[i] ?? 0) + 1;
        return;
      }
    }
  }

  private applyGravity(): void {
    for (let c = 0; c < COLS; c++) {
      const stack: Candy[] = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!this.grid[r][c].matched) stack.push(this.grid[r][c]);
      }
      const missing = ROWS - stack.length;
      for (let i = 0; i < missing; i++) {
        stack.push(this.makeCandy(0, c, GRID_Y - (missing - i) * CELL, GRID_Y));
      }
      for (let r = 0; r < ROWS; r++) {
        const candy = stack[ROWS - 1 - r];
        candy.row = r;
        candy.col = c;
        candy.matched = false;
        candy.targetY = GRID_Y + r * CELL;
        if (candy.y > candy.targetY) candy.y = candy.targetY;
        this.grid[r][c] = candy;
      }
    }
  }

  private makeCandy(row: number, col: number, y: number, targetY: number, type?: number): Candy {
    let t = type ?? Math.floor(Math.random() * CANDY_TYPES);
    if (type == null) {
      let tries = 0;
      while (this.wouldMatch(this.grid, row, col, t) && tries++ < 20) {
        t = Math.floor(Math.random() * CANDY_TYPES);
      }
    }
    return { type: t, row, col, y, targetY, matched: false };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private swapCells(r1: number, c1: number, r2: number, c2: number): void {
    const a = this.grid[r1][c1];
    const b = this.grid[r2][c2];
    this.grid[r1][c1] = b;
    this.grid[r2][c2] = a;
    a.row = r2; a.col = c2;
    b.row = r1; b.col = c1;
    [a.targetY, b.targetY] = [b.targetY, a.targetY];
    [a.y, b.y] = [b.y, a.y];
  }

  private levelAt(n: number): Level {
    const levels: Level[] = [
      { number: 1, targets: [{ type: 0, count: 2 }, { type: 1, count: 1 }], movesAllowed: 25 },
      { number: 2, targets: [{ type: 0, count: 2 }, { type: 1, count: 2 }], movesAllowed: 22 },
      { number: 3, targets: [{ type: 2, count: 3 }, { type: 3, count: 2 }], movesAllowed: 20 },
      { number: 4, targets: [{ type: 0, count: 2 }, { type: 1, count: 2 }, { type: 2, count: 2 }], movesAllowed: 18 },
      { number: 5, targets: [{ type: 0, count: 1 }, { type: 2, count: 2 }, { type: 4, count: 3 }], movesAllowed: 15 },
    ];
    return levels[Math.min(n - 1, levels.length - 1)];
  }

  private resetCollection(): void {
    this.collected = this.level.targets.map(() => 0);
  }

  private newGrid(): Candy[][] {
    const grid: Candy[][] = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = this.makeCandy(r, c, GRID_Y + r * CELL, GRID_Y + r * CELL);
      }
    }
    let guard = 0;
    while (this.findMatchesOn(grid).length > 0 && guard++ < 40) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          grid[r][c].type = Math.floor(Math.random() * CANDY_TYPES);
        }
      }
    }
    return grid;
  }

  private wouldMatch(grid: Candy[][], r: number, c: number, type: number): boolean {
    if (c >= 2 && grid[r][c - 1]?.type === type && grid[r][c - 2]?.type === type) return true;
    if (r >= 2 && grid[r - 1]?.[c]?.type === type && grid[r - 2]?.[c]?.type === type) return true;
    return false;
  }

  private findMatches(): Array<{ r: number; c: number }> {
    return this.findMatchesOn(this.grid);
  }

  private findMatchesOn(grid: Candy[][]): Array<{ r: number; c: number }> {
    const matched = new Set<string>();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r]?.[c];
        if (!cell) continue;
        const t = cell.type;
        if (c <= COLS - 3 && grid[r][c + 1]?.type === t && grid[r][c + 2]?.type === t) {
          matched.add(`${r},${c}`); matched.add(`${r},${c + 1}`); matched.add(`${r},${c + 2}`);
        }
        if (r <= ROWS - 3 && grid[r + 1]?.[c]?.type === t && grid[r + 2]?.[c]?.type === t) {
          matched.add(`${r},${c}`); matched.add(`${r + 1},${c}`); matched.add(`${r + 2},${c}`);
        }
      }
    }
    return Array.from(matched).map((s) => {
      const [rr, cc] = s.split(',').map(Number);
      return { r: rr, c: cc };
    });
  }

  private checkLevelEnd(): void {
    const done = this.level.targets.every((t, i) => (this.collected[i] ?? 0) >= t.count);

    if (done && this.movesUsed <= this.level.movesAllowed) {
      sfx.coin();
      this.score += (this.level.movesAllowed - this.movesUsed) * 50;
      this.setState('levelClear');
      this.onGameOver(this.score, this.levelNumber, setHighScore('candy-crunch', this.score));
      return;
    }

    if (this.movesUsed >= this.level.movesAllowed && !done) {
      sfx.crash();
      this.setState('gameOver');
      setHighScore('candy-crunch', this.score);
      this.onGameOver(this.score, this.levelNumber, false);
    }
  }

  private nextLevel(): void {
    this.levelNumber++;
    this.level = this.levelAt(this.levelNumber);
    this.movesUsed = 0;
    this.grid = this.newGrid();
    this.particles = [];
    this.comboCount = 0;
    this.selected = null;
    this.busy = false;
    this.resetCollection();
    this.setState('playing');
  }

  private spawnParticles(r: number, c: number): void {
    const cx = GRID_X + c * CELL + CELL / 2;
    const cy = GRID_Y + r * CELL + CELL / 2;
    const color = CANDY_COLORS[this.grid[r][c].type];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 140,
        vy: Math.sin(angle) * 140 - 40,
        life: 0.5, maxLife: 0.5,
        size: 5, color,
      });
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private drawBoardFrame(ctx: CanvasRenderingContext2D): void {
    const pad = 6;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(79, 158, 22, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(GRID_X - pad, GRID_Y - pad, COLS * CELL + pad * 2, ROWS * CELL + pad * 2, 14);
    ctx.fill();
    ctx.stroke();
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL;
        const y = GRID_Y + r * CELL;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f4faee' : '#eaf5e0';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }

  private drawCandies(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const candy = this.grid[r]?.[c];
        if (!candy || candy.matched) continue;

        const x = GRID_X + c * CELL;
        const cy = candy.y + CELL / 2;
        const cx = x + CELL / 2;
        const rad = CELL * 0.4;
        const color = CANDY_COLORS[candy.type];

        if (this.selected?.r === r && this.selected?.c === c) {
          ctx.strokeStyle = '#4f9e16';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 3, candy.y + 3, CELL - 6, CELL - 6);
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(cx - rad * 0.3, cy - rad * 0.3, rad * 0.28, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.floor(CELL * 0.44)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(CANDY_EMOJI[candy.type], cx, cy + 1);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

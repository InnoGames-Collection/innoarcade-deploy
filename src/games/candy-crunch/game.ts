// Candy Saga — match-3 with tap-to-swap, hub-themed canvas, level goals.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';

export const W = 480;
export const H = 720;

const COLS = 8;
const ROWS = 8;
const CELL = 52;
const GRID_X = (W - COLS * CELL) / 2;
const GRID_Y = 108;
const GOAL_H = 96;
const CANDY_TYPES = 5;
const FALL_SPEED = 900;

const CANDY_COLORS = ['#ff4d8a', '#ff9f1a', '#8b5cf6', '#fbbf24', '#22c55e'];
const CANDY_EMOJI = ['🍬', '🍭', '🍫', '🍯', '🌟'];

interface Level {
  number: number;
  targetCandies: string[];
  movesAllowed: number;
  title: string;
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
  private candiesCollected: Record<string, number> = {};
  private selected: { r: number; c: number } | null = null;
  private busy = false;

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
    this.grid = this.newGrid();
    this.particles = [];
    this.resetCollectionGoals();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  /** Map canvas coords to grid cell. */
  cellAt(x: number, y: number): { r: number; c: number } | null {
    const c = Math.floor((x - GRID_X) / CELL);
    const r = Math.floor((y - GRID_Y) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  /** Tap a cell — select or swap with neighbour. */
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

    const matched = this.findMatches();
    if (matched.length > 0) {
      void this.clearMatches(matched);
      return;
    }

    this.checkLevelEnd();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#eef6e3';
    ctx.fillRect(0, 0, W, H);
    this.drawGoalBar(ctx);
    this.drawGrid(ctx);
    this.drawCandies(ctx);
    this.drawParticles(ctx);

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
    this.checkLevelEnd();
  }

  private async clearMatches(matched: Array<{ r: number; c: number }>): Promise<void> {
    for (const { r, c } of matched) {
      this.grid[r][c].matched = true;
      this.spawnParticles(r, c);
    }
    sfx.coin();
    this.screenShake = 0.25;
    this.comboCount++;
    this.comboTime = 0.6;

    const tier = 1 + Math.max(0, this.comboCount - 1) * 0.2;
    this.score += Math.round(matched.length * 12 * tier);

    for (const { r, c } of matched) {
      const name = CANDY_EMOJI[this.grid[r][c].type];
      if (this.candiesCollected[name] !== undefined) {
        this.candiesCollected[name]++;
      }
    }

    await this.wait(160);
    this.applyGravity();
    await this.wait(120);

    const chain = this.findMatches();
    if (chain.length > 0) await this.clearMatches(chain);
  }

  private applyGravity(): void {
    for (let c = 0; c < COLS; c++) {
      const stack: Candy[] = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!this.grid[r][c].matched) stack.push(this.grid[r][c]);
      }
      const missing = ROWS - stack.length;
      for (let i = 0; i < missing; i++) {
        let type: number;
        do { type = Math.floor(Math.random() * CANDY_TYPES); } while (false);
        stack.push({
          type, row: 0, col: c,
          y: GRID_Y - (missing - i) * CELL,
          targetY: GRID_Y,
          matched: false,
        });
      }
      for (let r = 0; r < ROWS; r++) {
        const candy = stack[ROWS - 1 - r];
        candy.row = r;
        candy.col = c;
        candy.matched = false;
        candy.targetY = GRID_Y + r * CELL;
        this.grid[r][c] = candy;
      }
    }
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
      { number: 1, targetCandies: ['🍬', '🍬', '🍭'], movesAllowed: 25, title: 'Sweet Start' },
      { number: 2, targetCandies: ['🍬', '🍬', '🍭', '🍭'], movesAllowed: 22, title: 'Rising Rush' },
      { number: 3, targetCandies: ['🍫', '🍫', '🍫', '🍯', '🍯'], movesAllowed: 20, title: 'Chocolate Challenge' },
      { number: 4, targetCandies: ['🍬', '🍬', '🍭', '🍭', '🍫', '🍫'], movesAllowed: 18, title: 'Master Mix' },
      { number: 5, targetCandies: ['🍬', '🍭', '🍫', '🍯', '🌟', '🌟', '🌟'], movesAllowed: 15, title: 'Ultimate Challenge' },
    ];
    return levels[Math.min(n - 1, levels.length - 1)];
  }

  private resetCollectionGoals(): void {
    this.candiesCollected = {};
    for (const candy of this.level.targetCandies) {
      this.candiesCollected[candy] = 0;
    }
  }

  private newGrid(): Candy[][] {
    const grid: Candy[][] = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        let type: number;
        do {
          type = Math.floor(Math.random() * CANDY_TYPES);
        } while (this.wouldMatch(grid, r, c, type));
        grid[r][c] = {
          type, row: r, col: c,
          y: GRID_Y + r * CELL,
          targetY: GRID_Y + r * CELL,
          matched: false,
        };
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
    const matched = new Set<string>();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.grid[r][c].type;
        if (c <= COLS - 3 && this.grid[r][c + 1].type === t && this.grid[r][c + 2].type === t) {
          matched.add(`${r},${c}`); matched.add(`${r},${c + 1}`); matched.add(`${r},${c + 2}`);
        }
        if (r <= ROWS - 3 && this.grid[r + 1][c].type === t && this.grid[r + 2][c].type === t) {
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
    let done = true;
    for (const candy of this.level.targetCandies) {
      const needed = this.level.targetCandies.filter((c) => c === candy).length;
      if ((this.candiesCollected[candy] ?? 0) < needed) { done = false; break; }
    }

    if (done && this.movesUsed < this.level.movesAllowed) {
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
    this.resetCollectionGoals();
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
        size: 4, color,
      });
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private drawGoalBar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, GOAL_H);
    ctx.fillStyle = '#3d8010';
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${this.levelNumber}: ${this.level.title}`, W / 2, 28);

    ctx.font = '13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5a7248';
    ctx.fillText('Goal:', 14, 56);

    const unique = [...new Set(this.level.targetCandies)];
    let gx = 60;
    for (const candy of unique) {
      const needed = this.level.targetCandies.filter((c) => c === candy).length;
      const have = this.candiesCollected[candy] ?? 0;
      ctx.fillStyle = have >= needed ? '#3d8010' : '#c44';
      ctx.font = have >= needed ? 'bold 16px system-ui' : '16px system-ui';
      ctx.fillText(`${candy} ${have}/${needed}`, gx, 56);
      gx += 72;
    }

    if (this.comboCount > 1) {
      ctx.fillStyle = '#4f9e16';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.comboCount}x COMBO!`, W / 2, 84);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL;
        const y = GRID_Y + r * CELL;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#e8f5dc' : '#dff0d0';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.strokeStyle = 'rgba(79, 158, 22, 0.15)';
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
  }

  private drawCandies(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const candy = this.grid[r][c];
        if (!candy || candy.matched) continue;

        const cx = GRID_X + c * CELL + CELL / 2;
        const cy = candy.y + CELL / 2;
        const color = CANDY_COLORS[candy.type];
        const rad = CELL * 0.38;

        if (this.selected?.r === r && this.selected?.c === c) {
          ctx.strokeStyle = '#4f9e16';
          ctx.lineWidth = 3;
          ctx.strokeRect(GRID_X + c * CELL + 2, candy.y + 2, CELL - 4, CELL - 4);
        }

        const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, rad);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.35, color);
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `${Math.floor(CELL * 0.42)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(CANDY_EMOJI[candy.type], cx, cy + 1);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

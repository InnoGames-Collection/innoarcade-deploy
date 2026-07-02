// Candy Crunch — enterprise-grade match-3 with cascading, level progression,
// particles, and combo scoring. 8x8 grid with 5 candy types, match detection,
// gravity, and streak multipliers.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const COLS = 8;
const ROWS = 8;
const CELL_SIZE = 52;
const GRID_X = (W - COLS * CELL_SIZE) / 2;
const GRID_Y = 140;

const CANDY_TYPES = 5;
const MATCH_MIN = 3;
const SWAP_DURATION = 0.18;
const FALL_SPEED = 800; // px/sec
const MATCH_DURATION = 0.35;

interface Level {
  number: number;
  targetCandies: string[]; // e.g. ["red", "red", "blue", "blue", "blue"]
  movesAllowed: number;
  title: string;
}

interface Candy {
  type: number;
  x: number;
  y: number;
  targetY: number;
  matched: boolean;
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

export class CandyCrunch {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('candy-crunch');

  get displayLevel(): number { return this.levelNumber; }
  get movesLeft(): number { return Math.max(0, this.level.movesAllowed - this.movesUsed); }
  get movesTotal(): number { return this.level.movesAllowed; }

  onStateChange: (s: GameState) => void = () => {};
  onLevelChange: (level: Level, collected: Record<string, number>) => void = () => {};
  onGameOver: (score: number, levelReached: number, record: boolean) => void = () => {};

  private time = 0;
  private level: Level = this.levelAt(1);
  private levelNumber = 1;
  private grid: Candy[][] = [];
  private swapping: { r1: number; c1: number; r2: number; c2: number; progress: number } | null = null;
  private falling = true;
  private particles: Particle[] = [];
  private screenShake = 0;
  private comboCount = 0;
  private comboTime = 0;
  private candyNames = ['🍬', '🍭', '🍫', '🍯', '🍤'];
  private movesUsed = 0;
  private candiesCollected: Record<string, number> = {};

  start(): void {
    if (this.state === 'levelClear') {
      this.nextLevel();
      return;
    }
    this.levelNumber = 1;
    this.level = this.levelAt(this.levelNumber);
    this.score = 0;
    this.movesUsed = 0;
    this.time = 0;
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        let type: number;
        do {
          type = Math.floor(Math.random() * CANDY_TYPES);
        } while (this.wouldMatch(this.grid, r, c, type));
        const y = GRID_Y + r * CELL_SIZE;
        this.grid[r][c] = { type, x: c, y, targetY: y, matched: false };
      }
    }
    this.particles = [];
    this.screenShake = 0;
    this.comboCount = 0;
    this.candiesCollected = {};
    this.resetCollectionGoals();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (this.state === 'playing' && (a === 'tap' || ['left', 'right', 'up', 'down'].includes(a))) {
      this.handleTap(a as 'left' | 'right' | 'up' | 'down' | 'tap');
    }
  }

  update(dt: number): void {
    this.time += dt;
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

    if (this.swapping) {
      this.swapping.progress += dt / SWAP_DURATION;
      if (this.swapping.progress >= 1) this.swapping = null;
      return;
    }

    this.falling = false;
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        const candy = this.grid[r][c];
        if (candy.y < candy.targetY) {
          candy.y = Math.min(candy.targetY, candy.y + FALL_SPEED * dt);
          this.falling = true;
        }
      }
    }

    if (this.falling) return;

    const matched = this.findMatches();
    if (matched.length > 0) {
      for (const { r, c } of matched) {
        this.grid[r][c].matched = true;
        this.spawnMatchParticles(r, c);
      }
      sfx.coin();
      this.screenShake = 0.3;
      this.comboCount++;
      this.comboTime = 0.6;

      const baseScore = matched.length * 10;
      const comboMult = Math.min(1 + this.comboCount * 0.15, 3);
      this.score += Math.round(baseScore * comboMult);

      for (const { r, c } of matched) {
        const type = this.grid[r][c].type;
        const name = this.candyNames[type];
        if (this.candiesCollected[name] !== undefined) {
          this.candiesCollected[name]++;
        }
      }

      setTimeout(() => this.removeMatched(), MATCH_DURATION * 1000);
      return;
    }

    this.checkLevelClear();
  }

  private levelAt(n: number): Level {
    const levels: Level[] = [
      { number: 1, targetCandies: ['🍬', '🍬', '🍭'], movesAllowed: 25, title: 'Sweet Start' },
      { number: 2, targetCandies: ['🍬', '🍬', '🍭', '🍭'], movesAllowed: 22, title: 'Rising Rush' },
      { number: 3, targetCandies: ['🍫', '🍫', '🍫', '🍯', '🍯'], movesAllowed: 20, title: 'Chocolate Challenge' },
      { number: 4, targetCandies: ['🍬', '🍬', '🍭', '🍭', '🍫', '🍫'], movesAllowed: 18, title: 'Master Mix' },
      { number: 5, targetCandies: ['🍬', '🍭', '🍫', '🍯', '🍤', '🍤', '🍤'], movesAllowed: 15, title: 'Ultimate Challenge' },
    ];
    return levels[Math.min(n - 1, levels.length - 1)];
  }

  private resetCollectionGoals(): void {
    this.candiesCollected = {};
    for (const candy of this.level.targetCandies) {
      this.candiesCollected[candy] = (this.candiesCollected[candy] ?? 0);
    }
  }

  private checkLevelClear(): void {
    let done = true;
    for (const candy of this.level.targetCandies) {
      const needed = this.level.targetCandies.filter((c) => c === candy).length;
      if ((this.candiesCollected[candy] ?? 0) < needed) {
        done = false;
        break;
      }
    }

    if (done && this.movesUsed < this.level.movesAllowed) {
      sfx.coin();
      this.setState('levelClear');
      const bonus = (this.level.movesAllowed - this.movesUsed) * 50;
      this.score += bonus;
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
    this.resetCollectionGoals();
    this.onLevelChange(this.level, this.candiesCollected);
    this.setState('playing');
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
        grid[r][c] = { type, x: c, y: GRID_Y + r * CELL_SIZE, targetY: GRID_Y + r * CELL_SIZE, matched: false };
      }
    }
    return grid;
  }

  private wouldMatch(grid: Candy[][], r: number, c: number, type: number): boolean {
    let hCount = 1;
    for (let i = c - 1; i >= 0 && grid[r][i]?.type === type; i--) hCount++;
    for (let i = c + 1; i < COLS && grid[r][i]?.type === type; i++) hCount++;
    if (hCount >= MATCH_MIN) return true;

    let vCount = 1;
    for (let i = r - 1; i >= 0 && grid[i]?.[c]?.type === type; i--) vCount++;
    for (let i = r + 1; i < ROWS && grid[i]?.[c]?.type === type; i++) vCount++;
    return vCount >= MATCH_MIN;
  }

  private handleTap(action: 'left' | 'right' | 'up' | 'down' | 'tap'): void {
    if (this.swapping || this.falling) return;

    if (action === 'tap') return; // Center tap does nothing in Candy Crunch (directional swaps only)

    const dirs: Record<string, [number, number]> = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };
    const [dr, dc] = dirs[action];

    // Swap from center in the direction pressed.
    const centerR = Math.floor(ROWS / 2);
    const centerC = Math.floor(COLS / 2);
    const r2 = centerR + dr;
    const c2 = centerC + dc;

    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return;

    this.movesUsed++;
    this.swapping = { r1: centerR, c1: centerC, r2, c2, progress: 0 };
    this.swap(centerR, centerC, r2, c2);
    sfx.click();
  }

  private swap(r1: number, c1: number, r2: number, c2: number): void {
    [this.grid[r1][c1], this.grid[r2][c2]] = [this.grid[r2][c2], this.grid[r1][c1]];
    [this.grid[r1][c1].x, this.grid[r2][c2].x] = [this.grid[r2][c2].x, this.grid[r1][c1].x];
  }

  private findMatches(): Array<{ r: number; c: number }> {
    const matched = new Set<string>();

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c].matched) continue;
        let count = 1;
        let endC = c;
        while (endC + 1 < COLS && this.grid[r][endC + 1].type === this.grid[r][c].type && !this.grid[r][endC + 1].matched) {
          count++;
          endC++;
        }
        if (count >= MATCH_MIN) {
          for (let i = c; i <= endC; i++) matched.add(`${r},${i}`);
        }
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r][c].matched) continue;
        let count = 1;
        let endR = r;
        while (endR + 1 < ROWS && this.grid[endR + 1][c].type === this.grid[r][c].type && !this.grid[endR + 1][c].matched) {
          count++;
          endR++;
        }
        if (count >= MATCH_MIN) {
          for (let i = r; i <= endR; i++) matched.add(`${i},${c}`);
        }
      }
    }

    return Array.from(matched).map((s) => {
      const [r, c] = s.split(',').map(Number);
      return { r, c };
    });
  }

  private removeMatched(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c].matched) {
          // Remove by falling from top
          for (let rr = r; rr > 0; rr--) {
            this.grid[rr][c] = this.grid[rr - 1][c];
            this.grid[rr][c].targetY = GRID_Y + rr * CELL_SIZE;
          }
          // New candy at top
          let type: number;
          do {
            type = Math.floor(Math.random() * CANDY_TYPES);
          } while (this.wouldMatch(this.grid, 0, c, type));
          this.grid[0][c] = { type, x: c, y: GRID_Y - CELL_SIZE, targetY: GRID_Y, matched: false };
        }
      }
    }
  }

  private spawnMatchParticles(r: number, c: number): void {
    const cx = GRID_X + c * CELL_SIZE + CELL_SIZE / 2;
    const cy = GRID_Y + r * CELL_SIZE + CELL_SIZE / 2;
    const colors = ['#ff6b9d', '#ffa502', '#8b4789', '#ffb347', '#ff6b5a'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 140 + Math.random() * 100;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        life: 0.5 + Math.random() * 0.2,
        maxLife: 0.5 + Math.random() * 0.2,
        size: 4 + Math.random() * 3,
        color: colors[this.grid[r][c].type],
      });
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#eef6e3';
    ctx.fillRect(0, 0, W, H);

    this.drawHeader(ctx);
    this.drawGrid(ctx);
    this.drawCandies(ctx);
    this.drawParticles(ctx);

    if (this.screenShake > 0) {
      ctx.fillStyle = `rgba(255, 100, 100, ${this.screenShake * 0.1})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawHeader(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(0, 0, W, 130);

    ctx.fillStyle = '#3d8010';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Level ${this.levelNumber}: ${this.level.title}`, W / 2, 32);

    ctx.fillStyle = '#5a7248';
    ctx.font = '13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Goal:', 14, 68);
    let gx = 14;
    for (const candy of this.level.targetCandies) {
      const needed = this.level.targetCandies.filter((c) => c === candy).length;
      const have = this.candiesCollected[candy] ?? 0;
      ctx.fillStyle = have >= needed ? '#3d8010' : '#c44';
      ctx.font = have >= needed ? 'bold 15px system-ui' : '15px system-ui';
      ctx.fillText(`${candy}${have}/${needed}`, gx, 92);
      gx += 48;
    }

    if (this.comboCount > 0) {
      ctx.fillStyle = '#4f9e16';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255, 179, 71, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillText(`${this.comboCount}x COMBO!`, W / 2, 120);
      ctx.shadowBlur = 0;
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(30, 40, 60, 0.5)';
    ctx.strokeStyle = 'rgba(100, 140, 180, 0.2)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL_SIZE;
        const y = GRID_Y + r * CELL_SIZE;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  private drawCandies(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const candy = this.grid[r][c];
        if (!candy || candy.matched) continue;

        let x = GRID_X + candy.x * CELL_SIZE + CELL_SIZE / 2;
        let y = candy.y;

        if (this.swapping) {
          const { r1, c1, r2, c2, progress: p } = this.swapping;
          if ((candy.x === c1 && candy === this.grid[r1][c1]) || (candy.x === c2 && candy === this.grid[r2][c2])) {
            const isSwapped = candy.x === c2;
            const fromR = isSwapped ? r2 : r1;
            const fromC = isSwapped ? c2 : c1;
            const toR = isSwapped ? r1 : r2;
            const toC = isSwapped ? c1 : c2;
            x = GRID_X + (fromC + (toC - fromC) * p) * CELL_SIZE + CELL_SIZE / 2;
            y = GRID_Y + fromR * CELL_SIZE + (toR - fromR) * p * CELL_SIZE;
          }
        }

        const cellX = GRID_X + c * CELL_SIZE;
        const cellY = GRID_Y + r * CELL_SIZE;
        ctx.fillStyle = 'rgba(100, 140, 200, 0.15)';
        ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

        ctx.fillStyle = ['#ff6b9d', '#ffa502', '#8b4789', '#ffb347', '#ff6b5a'][candy.type];
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y + CELL_SIZE / 2, CELL_SIZE / 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = `${Math.floor(CELL_SIZE * 0.6)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.candyNames[candy.type], x, y + CELL_SIZE / 2);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - progress * progress;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

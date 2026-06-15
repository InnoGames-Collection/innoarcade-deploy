// Merge 2048 — slide-to-merge number puzzle.
//
// The board is a 4×4 logical grid of tiles. A move shifts every tile to the
// far edge, merging equal neighbours once each. The visual layer is decoupled
// from the logic: each tile carries an animated pixel position that eases
// toward its grid slot, so slides, merge-pops and spawn-scales all read as
// smooth motion without the logic ever caring about pixels.

import { Particles } from '../../engine/particles';
import { ScreenFx } from '../../engine/fx';
import { Tweens, Ease } from '../../engine/tween';
import { sfx } from '../../engine/audio';
import { settings } from '../../engine/settings';
import { profile } from '../../engine/profile';
import { recordEnginePlay } from '../../platform/gameHost';

export const W = 480;
export const H = 480;
export const SIZE = 4;
const PAD = 16;
const GAP = 14;
export const CELL = (W - PAD * 2 - GAP * (SIZE - 1)) / SIZE;

const GAME_ID = 'merge-2048';

export type GameState = 'menu' | 'playing' | 'over';
export type Dir = 'left' | 'right' | 'up' | 'down';

interface Tile {
  value: number;
  r: number;
  c: number;
  // Animated pixel position (top-left of the cell).
  px: number;
  py: number;
  fromX: number;
  fromY: number;
  anim: number; // 0..1 slide progress
  spawn: number; // 0..1 scale-in progress (1 = settled)
  pop: number; // merge pop timer (seconds remaining)
}

const TILE_COLORS: Record<number, [string, string]> = {
  2: ['#3a4170', '#eef1ff'],
  4: ['#46508f', '#eef1ff'],
  8: ['#5b8cff', '#0b1024'],
  16: ['#4f78e8', '#fff'],
  32: ['#f0a832', '#2a1c05'],
  64: ['#f08a2c', '#2a1505'],
  128: ['#e2563a', '#fff'],
  256: ['#e23a6e', '#fff'],
  512: ['#b23ae2', '#fff'],
  1024: ['#7b3ae2', '#fff'],
  2048: ['#36c0a8', '#04201b'],
};
function tileColor(v: number): [string, string] {
  return TILE_COLORS[v] ?? ['#2bd4b0', '#04201b'];
}

function cellX(c: number): number { return PAD + c * (CELL + GAP); }
function cellY(r: number): number { return PAD + r * (CELL + GAP); }

export class Merge2048 {
  state: GameState = 'menu';
  score = 0;
  best = profile.stats(GAME_ID).best;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};
  onScore: (score: number) => void = () => {};

  private tiles: Tile[] = [];
  private grid: (Tile | null)[][] = [];
  private particles = new Particles(300);
  private fx = new ScreenFx();
  private tweens = new Tweens();
  private locked = false; // ignore input mid-animation

  constructor() {
    this.fx.reducedMotion = settings.data.reducedMotion;
    this.reset();
  }

  private reset(): void {
    this.tiles = [];
    this.grid = Array.from({ length: SIZE }, () => Array<Tile | null>(SIZE).fill(null));
    this.score = 0;
    this.particles.clear();
    this.tweens.clear();
    this.locked = false;
  }

  start(): void {
    this.reset();
    this.spawnTile();
    this.spawnTile();
    this.setState('playing');
    this.onScore(this.score);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private emptyCells(): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) if (!this.grid[r][c]) out.push([r, c]);
    }
    return out;
  }

  private spawnTile(): void {
    const cells = this.emptyCells();
    if (!cells.length) return;
    const [r, c] = cells[(Math.random() * cells.length) | 0];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile: Tile = {
      value, r, c,
      px: cellX(c), py: cellY(r), fromX: cellX(c), fromY: cellY(r),
      anim: 1, spawn: 0, pop: 0,
    };
    this.grid[r][c] = tile;
    this.tiles.push(tile);
    this.tweens.to(0, 1, 0.18, (v) => { tile.spawn = v; }, { ease: Ease.outBack });
  }

  handleAction(a: Dir): void {
    if (this.state !== 'playing' || this.locked) return;
    this.move(a);
  }

  private move(dir: Dir): void {
    const vec = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
    const [dr, dc] = vec;
    // Traverse so the tile nearest the target edge moves first.
    const order = [0, 1, 2, 3];
    const rows = dr > 0 ? [...order].reverse() : order;
    const cols = dc > 0 ? [...order].reverse() : order;

    let moved = false;
    let gained = 0;
    const mergedThisMove = new Set<Tile>();

    for (const r of rows) {
      for (const c of cols) {
        const tile = this.grid[r][c];
        if (!tile) continue;
        let nr = r, nc = c;
        // Slide as far as possible.
        while (true) {
          const tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr >= SIZE || tc < 0 || tc >= SIZE) break;
          const target = this.grid[tr][tc];
          if (!target) { nr = tr; nc = tc; continue; }
          // Merge into an equal, not-yet-merged neighbour.
          if (target.value === tile.value && !mergedThisMove.has(target)) {
            nr = tr; nc = tc;
            this.mergeInto(tile, target, mergedThisMove);
            gained += target.value * 2;
            moved = true;
            tile.value = -1; // mark removed
          }
          break;
        }
        if (tile.value === -1) continue;
        if (nr !== r || nc !== c) {
          moved = true;
          this.grid[r][c] = null;
          this.grid[nr][nc] = tile;
          this.slideTo(tile, nr, nc);
        }
      }
    }

    if (!moved) {
      this.fx.shake(4, 0.12);
      return;
    }

    if (gained > 0) {
      this.score += gained;
      this.onScore(this.score);
      sfx.coin();
    } else {
      sfx.slide();
    }

    // Lock briefly so a fast player can't desync the animation, then spawn.
    this.locked = true;
    window.setTimeout(() => {
      this.spawnTile();
      this.locked = false;
      if (!this.hasMoves()) this.gameOver();
    }, 130);
  }

  private slideTo(tile: Tile, r: number, c: number): void {
    tile.r = r; tile.c = c;
    tile.fromX = tile.px; tile.fromY = tile.py;
    tile.anim = 0;
    const tx = cellX(c), ty = cellY(r);
    this.tweens.to(0, 1, 0.12, (v) => {
      tile.anim = v;
      tile.px = tile.fromX + (tx - tile.fromX) * v;
      tile.py = tile.fromY + (ty - tile.fromY) * v;
    }, { ease: Ease.outQuad });
  }

  private mergeInto(mover: Tile, survivor: Tile, merged: Set<Tile>): void {
    // The mover slides into the survivor's cell, then is removed; the survivor
    // doubles and pops.
    merged.add(survivor);
    const tx = cellX(survivor.c), ty = cellY(survivor.r);
    mover.fromX = mover.px; mover.fromY = mover.py;
    this.tweens.to(0, 1, 0.12, (v) => {
      mover.px = mover.fromX + (tx - mover.fromX) * v;
      mover.py = mover.fromY + (ty - mover.fromY) * v;
    }, {
      ease: Ease.outQuad,
      onDone: () => {
        this.tiles = this.tiles.filter((t) => t !== mover);
        survivor.value *= 2;
        survivor.pop = 0.18;
        const [bg] = tileColor(survivor.value);
        const cx = tx + CELL / 2, cy = ty + CELL / 2;
        this.particles.burst(cx, cy, Math.round(12 * settings.particleScale), [bg, '#ffffff'], {
          speed: 150, life: 0.5, size: 5, glow: true,
        });
        if (survivor.value >= 128) this.fx.shake(6, 0.18);
      },
    });
  }

  private hasMoves(): boolean {
    if (this.emptyCells().length) return true;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = this.grid[r][c]?.value;
        if (v === this.grid[r]?.[c + 1]?.value) return true;
        if (v === this.grid[r + 1]?.[c]?.value) return true;
      }
    }
    return false;
  }

  private gameOver(): void {
    const record = profile.recordRun(GAME_ID, this.score);
    void recordEnginePlay(GAME_ID, this.score);
    this.best = profile.stats(GAME_ID).best;
    this.fx.shake(8, 0.3);
    this.setState('over');
    this.onGameOver(this.score, record);
  }

  update(dt: number): void {
    this.tweens.update(dt);
    this.particles.update(dt);
    this.fx.update(dt);
    for (const t of this.tiles) {
      if (t.pop > 0) t.pop = Math.max(0, t.pop - dt);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.fx.preRender(ctx);
    // Board background.
    roundRect(ctx, 0, 0, W, H, 18);
    ctx.fillStyle = '#161b34';
    ctx.fill();
    // Empty cells.
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        roundRect(ctx, cellX(c), cellY(r), CELL, CELL, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
      }
    }
    // Tiles.
    for (const t of this.tiles) this.drawTile(ctx, t);
    this.particles.render(ctx);
    this.fx.postRender(ctx, W, H);
  }

  private drawTile(ctx: CanvasRenderingContext2D, t: Tile): void {
    const [bg, fg] = tileColor(t.value);
    const pop = t.pop > 0 ? 1 + Math.sin((1 - t.pop / 0.18) * Math.PI) * 0.12 : 1;
    const scale = (t.spawn < 1 ? t.spawn : 1) * pop;
    const cx = t.px + CELL / 2, cy = t.py + CELL / 2;
    const s = CELL * scale;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -s / 2, -s / 2, s, s, 12);
    ctx.fillStyle = bg;
    ctx.fill();
    if (t.value >= 8) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -s / 2, -s / 2, s, s * 0.4, 12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = fg;
    ctx.font = `700 ${tileFont(t.value) * scale}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(t.value), 0, 2);
    ctx.restore();
  }
}

function tileFont(v: number): number {
  if (v < 100) return 44;
  if (v < 1000) return 36;
  return 28;
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

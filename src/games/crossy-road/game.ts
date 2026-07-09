// Crossy Road — grid hopper with roads, rivers, and logs. Canvas arcade game.
import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { drawIllustratedCar } from '../_shared/premiumCanvas';

export const W = 480;
export const H = 720;
export const COLS = 8;
export const CELL = W / COLS;

type RowKind = 'grass' | 'road' | 'river';

interface Car {
  row: number;
  x: number;
  w: number;
  speed: number;
}

interface Log {
  row: number;
  x: number;
  w: number;
  speed: number;
}

interface Row {
  z: number;
  kind: RowKind;
  dir: number;
  speed: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class CrossyRoad {
  state: GameState = 'menu';
  score = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private px = Math.floor(COLS / 2);
  private pz = 0;
  private maxZ = 0;
  private camZ = 0;
  private rows: Row[] = [];
  private cars: Car[] = [];
  private logs: Log[] = [];
  private rnd = mulberry32(42);
  private hopT = 0;
  private fromPx = 0;
  private fromPz = 0;
  private idleT = 0;
  private tutorialT = 6;

  start(): void {
    this.score = 0;
    this.px = Math.floor(COLS / 2);
    this.pz = 0;
    this.maxZ = 0;
    this.camZ = 0;
    this.rows = [];
    this.cars = [];
    this.logs = [];
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.hopT = 0;
    this.idleT = 0;
    this.tutorialT = 6;
    for (let z = -4; z <= 12; z++) this.ensureRow(z);
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    if (this.state !== 'playing' || this.hopT > 0) return;
    if (a === 'up') this.hop(0, 1);
    else if (a === 'down') this.hop(0, -1);
    else if (a === 'left') this.hop(-1, 0);
    else if (a === 'right') this.hop(1, 0);
    else if (a === 'pause') this.pause();
  }

  private hop(dx: number, dz: number): void {
    if (dx && (this.px + dx < 0 || this.px + dx >= COLS)) return;
    if (dz < 0 && this.pz + dz < 0) return;
    this.fromPx = this.px;
    this.fromPz = this.pz;
    this.px += dx;
    this.pz += dz;
    this.hopT = 0.14;
    this.idleT = 0;
    sfx.click();
    if (this.pz > this.maxZ) {
      this.maxZ = this.pz;
      this.score = this.maxZ;
    }
    for (let z = this.pz - 2; z <= this.pz + 14; z++) this.ensureRow(z);
  }

  private ensureRow(z: number): void {
    if (this.rows.some((r) => r.z === z)) return;
    let kind: RowKind = 'grass';
    if (z > 0) {
      const roll = this.rnd();
      if (roll < 0.42) kind = 'road';
      else if (roll < 0.62) kind = 'river';
    }
    const dir = this.rnd() < 0.5 ? -1 : 1;
    const speed = 60 + this.rnd() * 80 + Math.min(this.score * 2, 120);
    this.rows.push({ z, kind, dir, speed });
    if (kind === 'road') {
      const n = 1 + Math.floor(this.rnd() * 2);
      for (let i = 0; i < n; i++) {
        this.cars.push({
          row: z,
          x: this.rnd() * W,
          w: CELL * (1.2 + this.rnd() * 0.8),
          speed: speed * dir,
        });
      }
    }
    if (kind === 'river') {
      this.logs.push({
        row: z,
        x: this.rnd() * W,
        w: CELL * (1.5 + this.rnd()),
        speed: speed * dir * 0.85,
      });
    }
  }

  private rowAt(z: number): Row {
    return this.rows.find((r) => r.z === z) ?? { z, kind: 'grass', dir: 1, speed: 0 };
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt);
      if (this.hopT === 0) this.checkLanding();
    } else {
      this.idleT += dt;
      if (this.idleT > 14) this.die();
    }

    if (this.tutorialT > 0) this.tutorialT -= dt;

    for (const c of this.cars) {
      c.x += c.speed * dt;
      if (c.x < -120) c.x = W + 60;
      if (c.x > W + 60) c.x = -120;
    }
    for (const l of this.logs) {
      l.x += l.speed * dt;
      if (l.x < -140) l.x = W + 80;
      if (l.x > W + 80) l.x = -140;
    }

    const row = this.rowAt(this.pz);
    if (row.kind === 'river' && this.hopT === 0) {
      const log = this.logs.find((l) => l.row === this.pz && this.px * CELL + CELL / 2 >= l.x && this.px * CELL + CELL / 2 <= l.x + l.w);
      if (log) {
        const shift = log.speed * dt / CELL;
        this.px += shift;
        if (this.px < 0 || this.px >= COLS) this.die();
      } else {
        this.die();
      }
    }

    if (row.kind === 'road') this.checkCarHit();

    const targetCam = this.pz * CELL - H * 0.55;
    this.camZ += (targetCam - this.camZ) * Math.min(1, dt * 6);
    this.rows = this.rows.filter((r) => r.z > this.pz - 8);
    this.cars = this.cars.filter((c) => c.row > this.pz - 8);
    this.logs = this.logs.filter((l) => l.row > this.pz - 8);
  }

  private checkLanding(): void {
    this.checkCarHit();
    const row = this.rowAt(this.pz);
    if (row.kind === 'river') {
      const cx = this.px * CELL + CELL / 2;
      const onLog = this.logs.some((l) => l.row === this.pz && cx >= l.x && cx <= l.x + l.w);
      if (!onLog) this.die();
    }
  }

  private checkCarHit(): void {
    const row = this.rowAt(this.pz);
    if (row.kind !== 'road') return;
    const cx = this.px * CELL + CELL / 2;
    for (const c of this.cars) {
      if (c.row !== this.pz) continue;
      if (cx >= c.x && cx <= c.x + c.w) this.die();
    }
  }

  private die(): void {
    if (this.state !== 'playing') return;
    sfx.crash();
    this.setState('over');
    this.onGameOver(this.score, this.score > this.best);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#87c06a';
    ctx.fillRect(0, 0, W, H);

    const visRows = Math.ceil(H / CELL) + 2;
    const baseZ = Math.floor(this.camZ / CELL);

    for (let i = -1; i < visRows; i++) {
      const z = baseZ + i;
      const row = this.rowAt(z);
      const sy = H - (z * CELL - this.camZ) - CELL;
      if (sy < -CELL || sy > H + CELL) continue;

      if (row.kind === 'grass') ctx.fillStyle = z <= 0 ? '#6ab04c' : '#7ec850';
      else if (row.kind === 'road') ctx.fillStyle = '#4a4a4a';
      else ctx.fillStyle = '#3498db';
      ctx.fillRect(0, sy, W, CELL + 1);

      if (row.kind === 'road') {
        ctx.fillStyle = '#f0c040';
        for (let x = 0; x < W; x += 40) ctx.fillRect(x, sy + CELL / 2 - 2, 18, 4);
      }

      for (const c of this.cars) {
        if (c.row !== z) continue;
        drawIllustratedCar(ctx, c.x, sy + 8, c.w, CELL - 16, '#e74c3c');
      }

      for (const l of this.logs) {
        if (l.row !== z) continue;
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(l.x, sy + 10, l.w, CELL - 20);
      }
    }

    const t = this.hopT > 0 ? 1 - this.hopT / 0.14 : 1;
    const drawPx = this.hopT > 0 ? this.fromPx + (this.px - this.fromPx) * t : this.px;
    const drawPz = this.hopT > 0 ? this.fromPz + (this.pz - this.fromPz) * t : this.pz;
    const py = H - (drawPz * CELL - this.camZ) - CELL;
    const hopBounce = this.hopT > 0 ? Math.sin(t * Math.PI) * 10 : 0;

    ctx.font = `${CELL - 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐔', drawPx * CELL + CELL / 2, py + CELL / 2 - hopBounce);

    if (this.state === 'playing' && this.tutorialT > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, H - 56, W, 56);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui,sans-serif';
      ctx.fillText('Swipe or tap arrows to hop forward', W / 2, H - 28);
    } else if (this.state === 'playing' && this.idleT > 10) {
      ctx.fillStyle = 'rgba(231,76,60,0.85)';
      ctx.font = 'bold 14px system-ui,sans-serif';
      ctx.fillText('Hop soon!', W / 2, 28);
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

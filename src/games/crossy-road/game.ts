// Crossy Road — grid hopper with roads, rivers, and logs. Canvas arcade game.
import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { gridToIso, lerpCamera } from './iso';
import { renderWorld } from './render';
import {
  CAM_LERP,
  CELL,
  COLS,
  H,
  HOP_DUR,
  IDLE_LIMIT,
  PREMIUM_RENDER,
  W,
  type Car,
  type GameState,
  type Log,
  type Row,
  type WorldSnapshot,
  hopProgress,
  playerGridPos,
} from './types';

export type { GameState } from './types';
export { W, H, COLS, CELL, PREMIUM_RENDER } from './types';

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
  private camIsoX = 0;
  private camIsoY = 0;
  private camBob = 0;
  private rows: Row[] = [];
  private cars: Car[] = [];
  private logs: Log[] = [];
  private rnd = mulberry32(42);
  private hopT = 0;
  private fromPx = 0;
  private fromPz = 0;
  private idleT = 0;
  private tutorialT = 6;
  private animT = 0;

  start(): void {
    this.score = 0;
    this.px = Math.floor(COLS / 2);
    this.pz = 0;
    this.maxZ = 0;
    this.camZ = 0;
    const startIso = gridToIso(this.px + 0.5, this.pz + 0.5);
    this.camIsoX = startIso.x;
    this.camIsoY = startIso.y;
    this.camBob = 0;
    this.rows = [];
    this.cars = [];
    this.logs = [];
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.hopT = 0;
    this.idleT = 0;
    this.tutorialT = 6;
    this.animT = 0;
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
    this.hopT = HOP_DUR;
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
    let kind: Row['kind'] = 'grass';
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
    this.animT += dt;

    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt);
      if (this.hopT === 0) this.checkLanding();
    } else {
      this.idleT += dt;
      if (this.idleT > IDLE_LIMIT) this.die();
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
      const log = this.logs.find(
        (l) => l.row === this.pz
          && this.px * CELL + CELL / 2 >= l.x
          && this.px * CELL + CELL / 2 <= l.x + l.w,
      );
      if (log) {
        const shift = log.speed * dt / CELL;
        this.px += shift;
        if (this.px < 0 || this.px >= COLS) this.die();
      } else {
        this.die();
      }
    }

    if (row.kind === 'road') this.checkCarHit();

    this.updateCamera(dt);

    this.rows = this.rows.filter((r) => r.z > this.pz - 8);
    this.cars = this.cars.filter((c) => c.row > this.pz - 8);
    this.logs = this.logs.filter((l) => l.row > this.pz - 8);
  }

  private updateCamera(dt: number): void {
    if (PREMIUM_RENDER) {
      const snap = this.buildSnapshot();
      const { gx, gz } = playerGridPos(snap);
      const target = gridToIso(gx, gz);
      const cam = { x: this.camIsoX, y: this.camIsoY };
      lerpCamera(cam, target.x, target.y, dt, CAM_LERP);
      this.camIsoX = cam.x;
      this.camIsoY = cam.y;
      const p = hopProgress(this.hopT);
      this.camBob = this.hopT > 0 ? Math.sin(p * Math.PI) * 3 : 0;
    } else {
      const targetCam = this.pz * CELL - H * 0.55;
      this.camZ += (targetCam - this.camZ) * Math.min(1, dt * 6);
      this.camBob = 0;
    }
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

  buildSnapshot(): WorldSnapshot {
    return {
      state: this.state,
      px: this.px,
      pz: this.pz,
      fromPx: this.fromPx,
      fromPz: this.fromPz,
      hopT: this.hopT,
      idleT: this.idleT,
      tutorialT: this.tutorialT,
      camZ: this.camZ,
      camIsoX: this.camIsoX,
      camIsoY: this.camIsoY,
      camBob: this.camBob,
      animT: this.animT,
      rows: this.rows,
      cars: this.cars,
      logs: this.logs,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    renderWorld(ctx, this.buildSnapshot());
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

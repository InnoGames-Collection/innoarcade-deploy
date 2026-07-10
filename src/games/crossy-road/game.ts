// Crossy Road — grid hopper with roads, rivers, and logs. Canvas arcade game.
import { Juice } from '../../engine/juice';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import { crossyRoadAudio } from './crossyRoadAudio';
import { classicCamTarget, classicGridToScreen } from './classic';
import { resetQualityTier } from './render/quality';
import { renderWorld } from './render';
import {
  CELL,
  COLS,
  EAGLE_DUR,
  H,
  HOP_DUR,
  IDLE_LIMIT,
  CAMP_LIMIT,
  PREMIUM_RENDER,
  W,
  type Car,
  type Coin,
  type GameState,
  type Log,
  type Row,
  type VehicleKind,
  type WorldSnapshot,
  hopProgress,
  playerGridPos,
} from './types';

const VEHICLE_KINDS: VehicleKind[] = [
  'sedan', 'suv', 'taxi', 'bus', 'police', 'van', 'minibus',
];

const COIN_SPAWN_CHANCE = 0.38;

export type { GameState } from './types';
export { W, H, COLS, CELL, PREMIUM_RENDER } from './types';

export class CrossyRoad {
  state: GameState = 'menu';
  score = 0;
  coins = 0;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private px = Math.floor(COLS / 2);
  private pz = 0;
  private maxZ = 0;
  private camZ = 0;
  private camBob = 0;
  private rows: Row[] = [];
  private cars: Car[] = [];
  private logs: Log[] = [];
  private coinItems: Coin[] = [];
  private rnd = mulberry32(42);
  private hopT = 0;
  private fromPx = 0;
  private fromPz = 0;
  private idleT = 0;
  private campT = 0;
  private eagleT = 0;
  private lastHopDz = 0;
  private tutorialT = 6;
  private animT = 0;
  private juice = new Juice();

  start(): void {
    this.score = 0;
    this.coins = 0;
    this.px = Math.floor(COLS / 2);
    this.pz = 0;
    this.maxZ = 0;
    this.camZ = 0;
    this.camBob = 0;
    this.rows = [];
    this.cars = [];
    this.logs = [];
    this.coinItems = [];
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.hopT = 0;
    this.idleT = 0;
    this.campT = 0;
    this.eagleT = 0;
    this.lastHopDz = 0;
    this.tutorialT = 6;
    this.animT = 0;
    this.juice = new Juice();
    resetQualityTier();
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
    if (this.state !== 'playing' || this.hopT > 0 || this.eagleT > 0) return;
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
    this.lastHopDz = dz;
    if (dz > 0 || (dz === 0 && dx !== 0)) this.campT = 0;
    crossyRoadAudio.hop();
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
          kind: VEHICLE_KINDS[Math.floor(this.rnd() * VEHICLE_KINDS.length)]!,
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
    if (kind === 'grass' && z > 0 && this.rnd() < COIN_SPAWN_CHANCE) {
      const col = Math.floor(this.rnd() * COLS);
      const taken = this.coinItems.some((c) => c.row === z && c.col === col);
      if (!taken) this.coinItems.push({ row: z, col });
    }
  }

  private rowAt(z: number): Row {
    return this.rows.find((r) => r.z === z) ?? { z, kind: 'grass', dir: 1, speed: 0 };
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.animT += dt;
    this.juice.update(dt);

    if (this.eagleT > 0) {
      this.eagleT = Math.max(0, this.eagleT - dt);
      if (this.eagleT === 0) {
        this.die();
        return;
      }
    }

    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt);
      if (this.hopT === 0) this.checkLanding();
    } else if (this.eagleT <= 0) {
      this.idleT += dt;
      if (this.lastHopDz <= 0) {
        this.campT += dt;
        if (this.campT >= CAMP_LIMIT) {
          this.eagleT = EAGLE_DUR;
        }
      }
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
    if (this.eagleT <= 0 && row.kind === 'river' && this.hopT === 0) {
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

    if (this.eagleT <= 0 && row.kind === 'road') this.checkCarHit();

    this.updateCamera(dt);

    this.rows = this.rows.filter((r) => r.z > this.pz - 8);
    this.cars = this.cars.filter((c) => c.row > this.pz - 8);
    this.logs = this.logs.filter((l) => l.row > this.pz - 8);
    this.coinItems = this.coinItems.filter((c) => c.row > this.pz - 8);
  }

  private updateCamera(dt: number): void {
    const snap = this.buildSnapshot();
    const { gz } = playerGridPos(snap);
    const targetCam = classicCamTarget(gz);
    this.camZ += (targetCam - this.camZ) * Math.min(1, dt * 6);
    const p = hopProgress(this.hopT);
    this.camBob = this.hopT > 0 ? Math.sin(p * Math.PI) * 3 : 0;
  }

  private screenAtGrid(gx: number, gz: number): { x: number; y: number } {
    return classicGridToScreen(gx, gz, this.camZ, this.camBob);
  }

  private checkLanding(): void {
    this.checkCarHit();
    const row = this.rowAt(this.pz);
    if (row.kind === 'river') {
      const cx = this.px * CELL + CELL / 2;
      const onLog = this.logs.some((l) => l.row === this.pz && cx >= l.x && cx <= l.x + l.w);
      if (!onLog) this.die();
    }
    this.spawnLandingParticles(row.kind);
    this.tryCollectCoin();
  }

  private tryCollectCoin(): void {
    const idx = this.coinItems.findIndex((c) => c.row === this.pz && c.col === this.px);
    if (idx < 0) return;
    this.coinItems.splice(idx, 1);
    this.coins += 1;
    crossyRoadAudio.coin();

    const p = this.screenAtGrid(this.px + 0.5, this.pz + 0.5);
    this.juice.burst(p.x, p.y, '#f1c40f', 12, 130, 4);
  }

  private spawnLandingParticles(kind: Row['kind']): void {
    let sx: number;
    let sy: number;
    if (PREMIUM_RENDER) {
      const p = gridToScreen(
        this.px + 0.5,
        this.pz + 0.5,
        { x: this.camIsoX, y: this.camIsoY },
        { x: W / 2, y: H * SCREEN_ANCHOR_Y },
        this.camBob,
      );
      sx = p.x;
      sy = p.y;
    } else {
      sx = this.px * CELL + CELL / 2;
      sy = H - (this.pz * CELL - this.camZ) - CELL / 2;
    }
    if (kind === 'river') {
      this.juice.burst(sx, sy, '#5ecae8', 10, 120, 3);
      crossyRoadAudio.splash();
    } else if (kind === 'grass') {
      this.juice.burst(sx, sy, '#8ed85c', 8, 100, 3);
      crossyRoadAudio.dust();
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
    crossyRoadAudio.gameOver();
    this.juice.shake(0.5);
    this.juice.flashOverlay('rgba(231,76,60,0.45)', 0.4);
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
      campT: this.campT,
      eagleT: this.eagleT,
      coinsCollected: this.coins,
      rows: this.rows,
      cars: this.cars,
      logs: this.logs,
      coins: this.coinItems,
    };
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.juice.applyShake(ctx);
    renderWorld(ctx, this.buildSnapshot());
    this.juice.drawParticles(ctx);
    this.juice.drawFlash(ctx, W, H);
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

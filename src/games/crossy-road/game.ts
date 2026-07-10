// Crossy Road — grid hopper with roads, rivers, and logs. Canvas arcade game.
import { sfx } from '../../engine/audio';
import { Juice } from '../../engine/juice';
import type { Action } from '../../engine/input';
import { mulberry32 } from '../_lq/lq';
import {
  drawChicken,
  drawCoin,
  drawEagle,
  drawIsoGrassCell,
  drawIsoRoadCell,
  drawIsoRiverCell,
  drawLog,
  drawVehicle,
  type VehicleKind,
} from './rendering';
import {
  cellCenterScreen,
  cellDiamondScreen,
  gridToIso,
  gridToScreen,
  lerpCamera,
  paintDepth,
  type IsoCamera,
  type ScreenOrigin,
} from './iso';

export const W = 480;
export const H = 720;
export const COLS = 8;
export const CELL = W / COLS;
const HOP_DUR = 0.16;
const CAMP_LIMIT = 5;
const CAM_LERP = 4.2;
const SCREEN_ANCHOR_Y = 0.55;

type RowKind = 'grass' | 'road' | 'river';

interface Car {
  row: number;
  x: number;
  w: number;
  speed: number;
  kind: VehicleKind;
}

interface Log {
  row: number;
  x: number;
  w: number;
  speed: number;
}

interface Coin {
  row: number;
  col: number;
  spin: number;
}

interface Row {
  z: number;
  kind: RowKind;
  dir: number;
  speed: number;
}

interface EagleState {
  t: number;
  grabX: number;
  grabY: number;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

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
  private camIso: IsoCamera = { x: 0, y: 0 };
  private rows: Row[] = [];
  private cars: Car[] = [];
  private logs: Log[] = [];
  private coinItems: Coin[] = [];
  private rnd = mulberry32(42);
  private hopT = 0;
  private fromPx = 0;
  private fromPz = 0;
  private campT = 0;
  private tutorialT = 6;
  private animT = 0;
  private eagle: EagleState | null = null;
  private juice = new Juice();
  private onRiver = false;

  start(): void {
    this.score = 0;
    this.coins = 0;
    this.px = Math.floor(COLS / 2);
    this.pz = 0;
    this.maxZ = 0;
    const startIso = gridToIso(this.px + 0.5, this.pz + 0.5, CELL);
    this.camIso = { x: startIso.x, y: startIso.y };
    this.rows = [];
    this.cars = [];
    this.logs = [];
    this.coinItems = [];
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.hopT = 0;
    this.campT = 0;
    this.tutorialT = 6;
    this.animT = 0;
    this.eagle = null;
    this.juice = new Juice();
    this.onRiver = false;
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
    if (this.state !== 'playing' || this.hopT > 0 || this.eagle) return;
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

    if (dz > 0) {
      this.campT = 0;
    } else if (dz === 0 && dx !== 0) {
      this.campT = 0;
    }

    sfx.jump();
    if (this.pz > this.maxZ) {
      this.maxZ = this.pz;
      this.score = this.maxZ;
    }
    for (let z = this.pz - 2; z <= this.pz + 14; z++) this.ensureRow(z);
  }

  private pickVehicleKind(): VehicleKind {
    const roll = this.rnd();
    if (roll < 0.45) return 'minibus';
    if (roll < 0.75) return 'bus';
    return 'telecomVan';
  }

  private rowDir(z: number): number {
    const prev = this.rows.find((r) => r.z === z - 1);
    let dir = this.rnd() < 0.5 ? -1 : 1;
    if (prev && (prev.kind === 'road' || prev.kind === 'river') && this.rnd() < 0.68) {
      dir = -prev.dir;
    }
    return dir;
  }

  private rowSpeed(kind: RowKind): number {
    const ramp = Math.min(this.score * 1.8, 110);
    if (kind === 'road') return 55 + this.rnd() * 95 + ramp;
    if (kind === 'river') return 38 + this.rnd() * 72 + ramp * 0.7;
    return 0;
  }

  private maybeSpawnCoin(z: number, kind: RowKind): void {
    if (kind === 'river' || z <= 0) return;
    if (this.coinItems.some((c) => c.row === z)) return;
    if (this.rnd() > 0.38) return;
    const col = Math.floor(this.rnd() * COLS);
    if (this.coinItems.some((c) => c.row === z && c.col === col)) return;
    this.coinItems.push({ row: z, col, spin: this.rnd() * Math.PI * 2 });
  }

  private ensureRow(z: number): void {
    if (this.rows.some((r) => r.z === z)) return;
    let kind: RowKind = 'grass';
    if (z > 0) {
      const roll = this.rnd();
      if (roll < 0.42) kind = 'road';
      else if (roll < 0.62) kind = 'river';
    }
    const dir = this.rowDir(z);
    const speed = this.rowSpeed(kind);
    this.rows.push({ z, kind, dir, speed });
    this.maybeSpawnCoin(z, kind);

    if (kind === 'road') {
      const n = 1 + Math.floor(this.rnd() * 2);
      for (let i = 0; i < n; i++) {
        const kindV = this.pickVehicleKind();
        const w = kindV === 'bus'
          ? CELL * (2.2 + this.rnd() * 0.6)
          : CELL * (1.15 + this.rnd() * 0.75);
        const laneSpeed = speed * dir * (0.85 + this.rnd() * 0.3);
        this.cars.push({
          row: z,
          x: this.rnd() * W,
          w,
          speed: laneSpeed,
          kind: kindV,
        });
      }
    }
    if (kind === 'river') {
      const logCount = 1 + Math.floor(this.rnd() * 1.5);
      for (let i = 0; i < logCount; i++) {
        const logSpeed = speed * dir * (0.75 + this.rnd() * 0.45);
        this.logs.push({
          row: z,
          x: this.rnd() * W,
          w: CELL * (1.4 + this.rnd() * 0.9),
          speed: logSpeed,
        });
      }
    }
  }

  private rowAt(z: number): Row {
    return this.rows.find((r) => r.z === z) ?? { z, kind: 'grass', dir: 1, speed: 0 };
  }

  private screenOrigin(): ScreenOrigin {
    return { x: W / 2, y: H * SCREEN_ANCHOR_Y };
  }

  private playerGridPos(): { gx: number; gz: number } {
    const hopProgress = this.hopT > 0 ? 1 - this.hopT / HOP_DUR : 1;
    const gx = this.hopT > 0
      ? this.fromPx + (this.px - this.fromPx) * hopProgress + 0.5
      : this.px + 0.5;
    const gz = this.hopT > 0
      ? this.fromPz + (this.pz - this.fromPz) * hopProgress + 0.5
      : this.pz + 0.5;
    return { gx, gz };
  }

  private atScreen(gridX: number, gridY: number): { x: number; y: number } {
    return gridToScreen(gridX, gridY, CELL, this.camIso, this.screenOrigin());
  }

  private updateCamera(dt: number): void {
    const { gx, gz } = this.playerGridPos();
    const target = gridToIso(gx, gz, CELL);
    lerpCamera(this.camIso, target.x, target.y, dt, CAM_LERP);
  }

  private spawnLandingFx(): void {
    const row = this.rowAt(this.pz);
    const pos = this.atScreen(this.px + 0.5, this.pz + 0.85);
    if (row.kind === 'river' || this.onRiver) {
      this.juice.burst(pos.x, pos.y, 'rgba(180,220,255,0.85)', 6, 90, 3);
      this.juice.burst(pos.x, pos.y, 'rgba(52,152,219,0.7)', 4, 60, 2);
    } else {
      this.juice.burst(pos.x, pos.y, 'rgba(180,150,100,0.55)', 5, 70, 2.5);
      this.juice.burst(pos.x, pos.y, 'rgba(120,180,80,0.45)', 3, 50, 2);
    }
  }

  private collectCoins(): void {
    const hit = this.coinItems.find((c) => c.row === this.pz && c.col === this.px);
    if (!hit) return;
    this.coinItems = this.coinItems.filter((c) => c !== hit);
    this.coins += 1;
    sfx.coin();
    const pos = this.atScreen(this.px + 0.5, this.pz + 0.5);
    this.juice.burst(pos.x, pos.y, '#f2b21a', 8, 100, 3);
  }

  private startEagle(): void {
    if (this.eagle) return;
    const pos = this.atScreen(this.px + 0.5, this.pz + 0.5);
    this.eagle = { t: 0, grabX: pos.x, grabY: pos.y };
    sfx.slide();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;
    this.animT += dt;

    if (this.eagle) {
      this.eagle.t += dt;
      if (this.eagle.t >= 1.1) this.die('eagle');
      this.juice.update(dt);
      return;
    }

    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt);
      if (this.hopT === 0) {
        this.spawnLandingFx();
        this.collectCoins();
        this.checkLanding();
      }
    } else {
      this.campT += dt;
      if (this.campT >= CAMP_LIMIT) this.startEagle();
    }

    if (this.tutorialT > 0) this.tutorialT -= dt;

    for (const c of this.cars) {
      c.x += c.speed * dt;
      if (c.x < -160) c.x = W + 80;
      if (c.x > W + 80) c.x = -160;
    }
    for (const l of this.logs) {
      l.x += l.speed * dt;
      if (l.x < -160) l.x = W + 90;
      if (l.x > W + 90) l.x = -160;
    }
    for (const c of this.coinItems) c.spin += dt * 5;

    const row = this.rowAt(this.pz);
    const wasRiver = this.onRiver;
    this.onRiver = row.kind === 'river' && this.hopT === 0;

    if (this.onRiver) {
      const log = this.logs.find(
        (l) => l.row === this.pz
          && this.px * CELL + CELL / 2 >= l.x
          && this.px * CELL + CELL / 2 <= l.x + l.w,
      );
      if (log) {
        const shift = log.speed * dt / CELL;
        const prevPx = this.px;
        this.px += shift;
        if (this.px < 0 || this.px >= COLS) this.die('water');
        if (!wasRiver && Math.abs(shift) > 0.001) {
          const pos = this.atScreen(this.px + 0.5, this.pz + 0.85);
          this.juice.burst(pos.x, pos.y, 'rgba(160,210,255,0.6)', 2, 40, 1.5);
        } else if (Math.abs(this.px - prevPx) > 0.02 && Math.random() < dt * 3) {
          const pos = this.atScreen(this.px + 0.5, this.pz + 0.9);
          this.juice.burst(pos.x, pos.y, 'rgba(130,200,255,0.5)', 1, 25, 1.2);
        }
      } else {
        this.die('water');
      }
    }

    if (row.kind === 'road' && this.hopT === 0) this.checkCarHit();

    this.updateCamera(dt);

    this.juice.update(dt);
    this.rows = this.rows.filter((r) => r.z > this.pz - 8);
    this.cars = this.cars.filter((c) => c.row > this.pz - 8);
    this.logs = this.logs.filter((l) => l.row > this.pz - 8);
    this.coinItems = this.coinItems.filter((c) => c.row > this.pz - 8);
  }

  private checkLanding(): void {
    this.checkCarHit();
    const row = this.rowAt(this.pz);
    if (row.kind === 'river') {
      const cx = this.px * CELL + CELL / 2;
      const onLog = this.logs.some((l) => l.row === this.pz && cx >= l.x && cx <= l.x + l.w);
      if (!onLog) this.die('water');
    }
  }

  private checkCarHit(): void {
    const row = this.rowAt(this.pz);
    if (row.kind !== 'road') return;
    const cx = this.px * CELL + CELL / 2;
    const pad = CELL * 0.12;
    for (const c of this.cars) {
      if (c.row !== this.pz) continue;
      if (cx >= c.x + pad && cx <= c.x + c.w - pad) this.die('car');
    }
  }

  private die(_reason: 'car' | 'water' | 'eagle' | 'idle' = 'car'): void {
    if (this.state !== 'playing') return;
    sfx.crash();
    this.juice.shake(0.35);
    this.juice.flashOverlay('rgba(231,76,60,0.25)', 0.4);
    this.setState('over');
    this.onGameOver(this.score, this.score > this.best);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#87c06a';
    ctx.fillRect(0, 0, W, H);

    const origin = this.screenOrigin();
    const cam = this.camIso;
    const { gx: playerGx, gz: playerGz } = this.playerGridPos();
    const hopProgress = this.hopT > 0 ? 1 - this.hopT / HOP_DUR : 1;

    type DrawItem = { depth: number; draw: () => void };
    const queue: DrawItem[] = [];

    const zMin = this.pz - 12;
    const zMax = this.pz + 16;

    for (let z = zMin; z <= zMax; z++) {
      const row = this.rowAt(z);
      for (let col = 0; col < COLS; col++) {
        const corners = cellDiamondScreen(col, z, CELL, cam, origin);
        const depth = paintDepth(z, col);
        queue.push({
          depth,
          draw: () => {
            if (row.kind === 'grass') drawIsoGrassCell(ctx, corners, z <= 0);
            else if (row.kind === 'road') drawIsoRoadCell(ctx, corners);
            else drawIsoRiverCell(ctx, corners, this.animT, col);
          },
        });
      }
    }

    for (const coin of this.coinItems) {
      const center = cellCenterScreen(coin.col, coin.row, CELL, cam, origin);
      const depth = paintDepth(coin.row, coin.col) + 0.1;
      queue.push({
        depth,
        draw: () => drawCoin(ctx, center.x, center.y, coin.spin),
      });
    }

    for (const c of this.cars) {
      const gridCx = (c.x + c.w / 2) / CELL;
      const center = gridToScreen(gridCx, c.row + 0.5, CELL, cam, origin);
      const depth = paintDepth(c.row, gridCx);
      const facingRight = c.speed > 0;
      const drawW = c.w * 0.55;
      const drawH = CELL * 0.55;
      queue.push({
        depth,
        draw: () => drawVehicle(
          ctx,
          c.kind,
          center.x - drawW / 2,
          center.y - drawH / 2,
          drawW,
          drawH,
          facingRight,
        ),
      });
    }

    for (const l of this.logs) {
      const gridCx = (l.x + l.w / 2) / CELL;
      const center = gridToScreen(gridCx, l.row + 0.5, CELL, cam, origin);
      const depth = paintDepth(l.row, gridCx);
      const drawW = l.w * 0.55;
      const drawH = CELL * 0.5;
      queue.push({
        depth,
        draw: () => drawLog(
          ctx,
          center.x - drawW / 2,
          center.y - drawH / 2,
          drawW,
          drawH,
        ),
      });
    }

    if (!this.eagle) {
      const playerCenter = gridToScreen(playerGx, playerGz, CELL, cam, origin);
      queue.push({
        depth: paintDepth(playerGz, playerGx) + 0.5,
        draw: () => drawChicken(
          ctx,
          playerCenter.x,
          playerCenter.y,
          CELL,
          hopProgress,
          this.hopT > 0,
        ),
      });
    }

    queue.sort((a, b) => a.depth - b.depth);

    ctx.save();
    this.juice.applyShake(ctx);
    for (const item of queue) item.draw();
    this.juice.drawParticles(ctx);
    ctx.restore();

    if (this.eagle) {
      const e = this.eagle;
      const p = Math.min(1, e.t / 1.1);
      const ease = 1 - Math.pow(1 - Math.min(1, p * 1.15), 3);
      const ex = e.grabX + (origin.x - e.grabX) * (1 - ease) * 0.15;
      const ey = -60 + (e.grabY - 30) * ease;
      const scale = 0.6 + ease * 0.9;
      drawEagle(ctx, ex, ey, scale, this.animT * 12);

      if (p > 0.55) {
        const grabP = (p - 0.55) / 0.45;
        const chickenY = e.grabY - grabP * 80;
        const chickenScale = 1 - grabP * 0.35;
        ctx.save();
        ctx.translate(e.grabX, chickenY);
        ctx.scale(chickenScale, chickenScale);
        ctx.font = `${CELL - 6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐔', 0, 0);
        ctx.restore();
      } else {
        drawChicken(ctx, e.grabX, e.grabY, CELL, 1, false);
      }
    }

    this.juice.drawFlash(ctx, W, H);
    this.drawHud(ctx);
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    if (this.state !== 'playing') return;

    if (this.tutorialT > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.roundRect(12, H - 52, W - 24, 40, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Swipe or tap arrows to hop forward', W / 2, H - 28);
    }

    if (this.campT > 3 && !this.eagle) {
      const warn = Math.min(1, (this.campT - 3) / (CAMP_LIMIT - 3));
      const pulse = 0.7 + Math.sin(this.animT * 10) * 0.3;
      ctx.fillStyle = `rgba(231,76,60,${0.55 + warn * 0.35 * pulse})`;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 72, 14, 144, 30, 15);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const left = Math.max(0, CAMP_LIMIT - this.campT);
      ctx.fillText(left > 0.5 ? `Move! ${left.toFixed(1)}s` : 'Eagle incoming!', W / 2, 29);
    }
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

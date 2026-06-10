// Temple Dash — 3-lane endless runner with a pseudo-3D perspective:
// objects live at a world distance `z`; the camera projects them by
// p = P_NEAR / (P_NEAR + zRel), which scales position and size toward
// a vanishing point at the horizon.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const HORIZON_Y = 250;
const NEAR_Y = H + 60; // screen y of the near plane (zRel = 0), just below view
const P_NEAR = 4; // perspective constant
const LANE_SPREAD = 170; // px between lane centers at the near plane
const TRACK_EDGE = 1.6; // track half-width in lane units
const PLAYER_Z = 2; // player depth in front of the camera
const VIEW_Z = 60; // spawn/draw distance
const HIT_RANGE = 0.7;

const BASE_SPEED = 13; // z units / second
const MAX_SPEED = 30;
const ACCEL = 0.22; // speed gain / second
const LANE_LERP = 9; // lanes / second

const JUMP_DURATION = 0.55;
const JUMP_HEIGHT = 140; // px at near-plane scale
const SLIDE_DURATION = 0.62;

const TIE_GAP = 4;
const PILLAR_GAP = 12;
const TAU = Math.PI * 2;

type ObstacleKind = 'block' | 'low' | 'high';

interface Obstacle {
  kind: ObstacleKind;
  lane: number;
  z: number; // world distance coordinate
}

interface Coin {
  lane: number;
  z: number;
  taken: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class TempleDash {
  state: GameState = 'menu';
  score = 0;
  coinsCollected = 0;
  best = getHighScore('temple-dash');

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, coins: number, record: boolean) => void = () => {};

  private time = 0;
  private elapsed = 0;
  private dist = 0;
  private speed = BASE_SPEED;
  private lane = 0;
  private laneF = 0;
  private jumpT = -1; // -1 = grounded, otherwise seconds into the jump
  private slideT = -1;
  private runPhase = 0;
  private obstacles: Obstacle[] = [];
  private coins: Coin[] = [];
  private spawnCursor = 25;
  private overAt = 0;

  start(): void {
    this.score = 0;
    this.coinsCollected = 0;
    this.elapsed = 0;
    this.dist = 0;
    this.speed = BASE_SPEED;
    this.lane = 0;
    this.laneF = 0;
    this.jumpT = -1;
    this.slideT = -1;
    this.obstacles = [];
    this.coins = [];
    this.spawnCursor = 25;
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  handleAction(a: Action): void {
    switch (this.state) {
      case 'menu':
        if (a === 'tap') this.start();
        break;
      case 'over':
        // Small delay so a frantic last-second swipe doesn't instantly restart.
        if (a === 'tap' && this.time - this.overAt > 0.8) this.start();
        break;
      case 'playing':
        if (a === 'left') this.lane = Math.max(-1, this.lane - 1);
        else if (a === 'right') this.lane = Math.min(1, this.lane + 1);
        else if (a === 'up' && this.jumpT < 0) {
          this.jumpT = 0;
          this.slideT = -1;
          sfx.jump();
        } else if (a === 'down' && this.jumpT < 0 && this.slideT < 0) {
          this.slideT = 0;
          sfx.slide();
        }
        break;
      case 'paused':
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.elapsed += dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.elapsed * ACCEL);
    this.dist += this.speed * dt;
    this.runPhase += dt * (6 + this.speed * 0.3);

    const delta = this.lane - this.laneF;
    const step = LANE_LERP * dt;
    this.laneF += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;

    if (this.jumpT >= 0 && (this.jumpT += dt) >= JUMP_DURATION) this.jumpT = -1;
    if (this.slideT >= 0 && (this.slideT += dt) >= SLIDE_DURATION) this.slideT = -1;

    while (this.spawnCursor < this.dist + VIEW_Z) this.spawnPattern();

    const pz = this.dist + PLAYER_Z;
    for (const o of this.obstacles) {
      if (Math.abs(o.z - pz) > HIT_RANGE) continue;
      if (Math.abs(o.lane - this.laneF) > 0.5) continue;
      if (o.kind === 'low' && this.airborne()) continue;
      if (o.kind === 'high' && this.slideT >= 0) continue;
      this.gameOver();
      return;
    }

    for (const c of this.coins) {
      if (c.taken) continue;
      if (Math.abs(c.z - pz) > 0.9 || Math.abs(c.lane - this.laneF) > 0.5) continue;
      c.taken = true;
      this.coinsCollected++;
      sfx.coin();
    }

    this.obstacles = this.obstacles.filter((o) => o.z > this.dist - 2);
    this.coins = this.coins.filter((c) => !c.taken && c.z > this.dist - 2);
    this.score = Math.floor(this.dist) + this.coinsCollected * 10;
  }

  private airborne(): boolean {
    if (this.jumpT < 0) return false;
    const progress = this.jumpT / JUMP_DURATION;
    return progress > 0.2 && progress < 0.85;
  }

  private gameOver(): void {
    sfx.crash();
    this.overAt = this.time;
    const record = setHighScore('temple-dash', this.score);
    if (record) this.best = this.score;
    this.setState('over');
    this.onGameOver(this.score, this.coinsCollected, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private spawnPattern(): void {
    const z = this.spawnCursor;
    const lanes = [-1, 0, 1];
    const lane = lanes[(Math.random() * 3) | 0];
    const r = Math.random();

    if (r < 0.32) {
      this.obstacles.push({ kind: 'block', lane, z });
    } else if (r < 0.5) {
      // Two walls, one guaranteed free lane.
      const free = lanes[(Math.random() * 3) | 0];
      for (const l of lanes) if (l !== free) this.obstacles.push({ kind: 'block', lane: l, z });
    } else if (r < 0.66) {
      this.obstacles.push({ kind: 'low', lane, z });
    } else if (r < 0.82) {
      this.obstacles.push({ kind: 'high', lane, z });
    } else {
      for (let i = 0; i < 5; i++) this.coins.push({ lane, z: z + i * 1.6, taken: false });
      this.spawnCursor += 8; // leave room after the coin trail
    }

    const minGap = this.speed * 0.55;
    this.spawnCursor += minGap + Math.random() * minGap;
  }

  // --- projection helpers -------------------------------------------------

  private p(zRel: number): number {
    return P_NEAR / (P_NEAR + Math.max(zRel, 0.05));
  }

  private sy(zRel: number): number {
    return HORIZON_Y + (NEAR_Y - HORIZON_Y) * this.p(zRel);
  }

  private sx(laneOff: number, zRel: number): number {
    return W / 2 + laneOff * LANE_SPREAD * this.p(zRel);
  }

  // --- rendering -----------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    this.drawSky(ctx);
    this.drawGround(ctx);
    this.drawPillars(ctx);
    this.drawObjects(ctx);
    this.drawPlayer(ctx);

    if (this.state === 'over') {
      const a = Math.max(0, 0.45 - (this.time - this.overAt));
      if (a > 0) {
        ctx.fillStyle = `rgba(200, 40, 30, ${a})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, '#191b45');
    g.addColorStop(0.5, '#5d3a6b');
    g.addColorStop(1, '#d97f3e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON_Y + 2);

    ctx.fillStyle = 'rgba(255, 214, 140, 0.25)';
    ctx.beginPath();
    ctx.arc(W / 2, HORIZON_Y - 28, 62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(W / 2, HORIZON_Y - 28, 33, 0, TAU);
    ctx.fill();

    // Step-pyramid silhouette on the horizon.
    ctx.fillStyle = '#33204a';
    let y = HORIZON_Y;
    for (const w of [230, 165, 104, 50]) {
      ctx.fillRect(W / 2 - w / 2, y - 18, w, 18);
      y -= 18;
    }
    // Jungle ridges left and right.
    ctx.beginPath();
    ctx.moveTo(-10, HORIZON_Y);
    ctx.lineTo(85, HORIZON_Y - 48);
    ctx.lineTo(205, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W + 10, HORIZON_Y);
    ctx.lineTo(W - 85, HORIZON_Y - 48);
    ctx.lineTo(W - 205, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#23402c';
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    const zf = 300;
    ctx.fillStyle = '#b3905f';
    ctx.beginPath();
    ctx.moveTo(this.sx(-TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, 0), this.sy(0));
    ctx.lineTo(this.sx(-TRACK_EDGE, 0), this.sy(0));
    ctx.closePath();
    ctx.fill();

    // Cross ties scroll toward the camera as `dist` grows.
    ctx.strokeStyle = 'rgba(90, 66, 40, 0.35)';
    for (
      let wz = Math.floor(this.dist / TIE_GAP) * TIE_GAP + TIE_GAP;
      wz < this.dist + 90;
      wz += TIE_GAP
    ) {
      const zr = wz - this.dist;
      ctx.lineWidth = Math.max(1, 5 * this.p(zr));
      ctx.beginPath();
      ctx.moveTo(this.sx(-TRACK_EDGE, zr), this.sy(zr));
      ctx.lineTo(this.sx(TRACK_EDGE, zr), this.sy(zr));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(80, 60, 38, 0.5)';
    ctx.lineWidth = 2;
    for (const l of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(this.sx(l, zf), this.sy(zf));
      ctx.lineTo(this.sx(l, 0), this.sy(0));
      ctx.stroke();
    }

    for (const side of [-TRACK_EDGE, TRACK_EDGE]) {
      ctx.strokeStyle = '#7c6240';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.sx(side, zf), this.sy(zf));
      ctx.lineTo(this.sx(side, 0), this.sy(0));
      ctx.stroke();
    }
  }

  private drawPillars(ctx: CanvasRenderingContext2D): void {
    for (
      let wz = Math.floor(this.dist / PILLAR_GAP) * PILLAR_GAP + PILLAR_GAP;
      wz < this.dist + VIEW_Z + 20;
      wz += PILLAR_GAP
    ) {
      const zr = wz - this.dist;
      if (zr < 0.5) continue;
      const pr = this.p(zr);
      const y = this.sy(zr);
      for (const side of [-1, 1]) {
        const x = this.sx(side * 2.4, zr);
        const w = 40 * pr;
        const h = 250 * pr;
        ctx.fillStyle = '#8d7a5e';
        ctx.fillRect(x - w / 2, y - h, w, h);
        ctx.fillStyle = '#a8956f';
        ctx.fillRect(x - w * 0.75, y - h - 16 * pr, w * 1.5, 16 * pr);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(x + w / 6, y - h, w / 3, h);
      }
    }
  }

  private drawObjects(ctx: CanvasRenderingContext2D): void {
    const items: Array<{ z: number; draw: () => void }> = [];
    for (const o of this.obstacles) items.push({ z: o.z, draw: () => this.drawObstacle(ctx, o) });
    for (const c of this.coins) items.push({ z: c.z, draw: () => this.drawCoin(ctx, c) });
    items.sort((a, b) => b.z - a.z); // far first
    for (const item of items) item.draw();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
    const zr = o.z - this.dist;
    if (zr < 0.2 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const y = this.sy(zr);
    const x = this.sx(o.lane, zr);
    const laneW = LANE_SPREAD * pr;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);

    if (o.kind === 'block') {
      const w = laneW * 0.92;
      const h = 175 * pr;
      ctx.fillStyle = '#6e6156';
      ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = '#857767';
      ctx.fillRect(x - w / 2, y - h, w, 10 * pr);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.lineWidth = Math.max(1, 2 * pr);
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y - (h * i) / 3);
        ctx.lineTo(x + w / 2, y - (h * i) / 3);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x - w / 6, y - h);
      ctx.lineTo(x - w / 6, y - (h * 2) / 3);
      ctx.moveTo(x + w / 6, y - (h * 2) / 3);
      ctx.lineTo(x + w / 6, y - h / 3);
      ctx.moveTo(x - w / 6, y - h / 3);
      ctx.lineTo(x - w / 6, y);
      ctx.stroke();
    } else if (o.kind === 'low') {
      const w = laneW * 0.85;
      const h = 62 * pr;
      const n = 3;
      const sw = w / n;
      ctx.fillStyle = '#8a5a33';
      ctx.strokeStyle = '#5d3a1e';
      ctx.lineWidth = Math.max(1, 2 * pr);
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + i * sw, y);
        ctx.lineTo(x - w / 2 + (i + 0.5) * sw, y - h);
        ctx.lineTo(x - w / 2 + (i + 1) * sw, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Overhead beam — slide under it.
      const w = laneW * 0.95;
      const postW = 10 * pr;
      const ph = 150 * pr;
      const bh = 34 * pr;
      ctx.fillStyle = '#5d4f41';
      ctx.fillRect(x - w / 2, y - ph, postW, ph);
      ctx.fillRect(x + w / 2 - postW, y - ph, postW, ph);
      ctx.fillRect(x - w / 2, y - ph, w, bh);
      ctx.fillStyle = '#6f6152';
      ctx.fillRect(x - w / 2, y - ph, w, 8 * pr);
      ctx.fillStyle = '#4a3e33';
      const teeth = 4;
      for (let i = 0; i < teeth; i++) {
        const tx = x - w / 2 + ((i + 0.5) * w) / teeth;
        ctx.beginPath();
        ctx.moveTo(tx - 7 * pr, y - ph + bh);
        ctx.lineTo(tx, y - ph + bh + 14 * pr);
        ctx.lineTo(tx + 7 * pr, y - ph + bh);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCoin(ctx: CanvasRenderingContext2D, c: Coin): void {
    const zr = c.z - this.dist;
    if (zr < 0.2 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const bob = Math.sin(this.time * 5 + c.z) * 5 * pr;
    const x = this.sx(c.lane, zr);
    const cy = this.sy(zr) - 30 * pr + bob;
    const r = 15 * pr;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);
    ctx.fillStyle = '#f6c945';
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#a87b16';
    ctx.lineWidth = Math.max(1, 3 * pr);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, cy, r * 0.55, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const pr = this.p(PLAYER_Z);
    const x = this.sx(this.laneF, PLAYER_Z);
    const groundY = this.sy(PLAYER_Z);
    const jumping = this.jumpT >= 0;
    const sliding = this.slideT >= 0;
    const jp = jumping ? this.jumpT / JUMP_DURATION : 0;
    const lift = jumping ? Math.sin(Math.PI * jp) * JUMP_HEIGHT * pr : 0;

    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 - 0.15 * Math.sin(Math.PI * jp)})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, 34 * pr * (1 - 0.3 * Math.sin(Math.PI * jp)), 9 * pr, 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(x, groundY - lift);
    ctx.scale(pr, pr * (sliding ? 0.55 : 1));
    const running = this.state === 'playing';
    const swing = running ? Math.sin(this.runPhase) : Math.sin(this.time * 2) * 0.15;

    ctx.strokeStyle = '#4a3826';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4, -62);
    ctx.lineTo(jumping ? -12 : -6 + swing * 22, jumping ? -28 : -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -62);
    ctx.lineTo(jumping ? 12 : 6 - swing * 22, jumping ? -28 : -6);
    ctx.stroke();

    ctx.fillStyle = '#c64a3b';
    ctx.beginPath();
    ctx.roundRect(-17, -120, 34, 62, 10);
    ctx.fill();

    ctx.strokeStyle = '#c64a3b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-13, -106);
    ctx.lineTo(-15 - swing * 20, -74);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, -106);
    ctx.lineTo(15 + swing * 20, -74);
    ctx.stroke();

    ctx.fillStyle = '#e2a36b';
    ctx.beginPath();
    ctx.arc(0, -136, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#42301f';
    ctx.beginPath();
    ctx.arc(0, -140, 17, Math.PI, TAU);
    ctx.fill();

    ctx.restore();
  }
}

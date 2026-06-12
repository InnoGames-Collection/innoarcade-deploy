// Orbit Blast — a 99-Balls-style aim-and-shoot blaster, built as the platform's
// flagship tournament game: one pure-skill score, short fair rounds, endlessly
// replayable. You aim a volley of orbs from the bottom; they ricochet off walls
// and numbered blocks, knocking each block's counter down until it shatters.
// Every turn the wall of blocks descends one row — survive as long as you can.
//
// Physics use sub-stepped circle-vs-AABB sweeps so fast orbs never tunnel
// through a block. The logic is self-contained; main.ts owns pointer aiming and
// the tournament leaderboard hookup.

import { Particles } from '../../engine/particles';
import { ScreenFx } from '../../engine/fx';
import { sfx } from '../../engine/audio';
import { settings } from '../../engine/settings';
import { profile } from '../../engine/profile';

export const W = 480;
export const H = 640;

const GAME_ID = 'orbit-blast';
const COLS = 7;
const GAP = 8;
const BLOCK = (W - GAP * (COLS + 1)) / COLS;
const TOP_Y = 76;
const FLOOR_Y = H - 46;
const ROW_STEP = BLOCK + GAP;
const BALL_R = 7;
const BALL_SPEED = 640;
const LAUNCH_INTERVAL = 0.045; // seconds between orbs in a volley

export type GameState = 'menu' | 'ready' | 'firing' | 'over';

interface Ball {
  x: number; y: number; vx: number; vy: number;
  active: boolean; returned: boolean;
}
interface Block { col: number; y: number; hits: number; max: number; }
interface Pickup { col: number; y: number; taken: boolean; }

function colX(col: number): number { return GAP + col * (BLOCK + GAP); }

// Block colour ramps from cool (low) to hot (high) by toughness.
function blockColor(max: number): string {
  const t = Math.min(1, max / 40);
  const hue = 210 - t * 210; // blue → red as blocks get tougher
  return `hsl(${hue}, 70%, 55%)`;
}

export class OrbitBlast {
  state: GameState = 'menu';
  score = 0;
  best = profile.stats(GAME_ID).best;
  ballCount = 1;
  level = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};
  onScore: (score: number, balls: number) => void = () => {};

  private balls: Ball[] = [];
  private blocks: Block[] = [];
  private pickups: Pickup[] = [];
  private launchX = W / 2;
  private firstReturnX = -1;
  private pickupGain = 0;

  // Aiming
  aimActive = false;
  private aimX = W / 2;
  private aimY = FLOOR_Y - 200;

  // Volley launch queue
  private toLaunch = 0;
  private launchTimer = 0;
  private launchVx = 0;
  private launchVy = 0;
  private turnTime = 0; // anti-soft-lock: caps how long a volley can run

  private particles = new Particles(500);
  private fx = new ScreenFx();

  constructor() {
    this.fx.reducedMotion = settings.data.reducedMotion;
  }

  start(): void {
    this.score = 0;
    this.level = 0;
    this.ballCount = 1;
    this.balls = [];
    this.blocks = [];
    this.pickups = [];
    this.launchX = W / 2;
    this.pickupGain = 0;
    this.particles.clear();
    this.fx.reset();
    this.addRow();
    this.addRow();
    this.setState('ready');
    this.onScore(this.score, this.ballCount);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  // --- Wall management ------------------------------------------------------
  private addRow(): void {
    this.level++;
    // Push existing blocks/pickups down one step.
    for (const b of this.blocks) b.y += ROW_STEP;
    for (const p of this.pickups) p.y += ROW_STEP;
    // Spawn a fresh top row: most columns get a block, one or two get an orb
    // pickup, occasionally a gap.
    const cols = [...Array(COLS).keys()];
    const pickupCol = cols[(Math.random() * COLS) | 0];
    for (const col of cols) {
      if (col === pickupCol) {
        this.pickups.push({ col, y: TOP_Y, taken: false });
        continue;
      }
      if (Math.random() < 0.22) continue; // gap
      const max = 1 + Math.floor(Math.random() * (this.level + 1));
      this.blocks.push({ col, y: TOP_Y, hits: max, max });
    }
  }

  private reachedFloor(): boolean {
    return this.blocks.some((b) => b.y + BLOCK >= FLOOR_Y);
  }

  // --- Aiming ---------------------------------------------------------------
  setAim(x: number, y: number): void {
    if (this.state !== 'ready') return;
    this.aimActive = true;
    this.aimX = x;
    this.aimY = Math.min(y, FLOOR_Y - 12); // must aim upward
  }

  release(): void {
    if (this.state !== 'ready' || !this.aimActive) return;
    const dx = this.aimX - this.launchX;
    const dy = this.aimY - FLOOR_Y;
    const len = Math.hypot(dx, dy);
    if (len < 8 || dy > -8) { this.aimActive = false; return; } // ignore flat/short aims
    this.launchVx = (dx / len) * BALL_SPEED;
    this.launchVy = (dy / len) * BALL_SPEED;
    this.toLaunch = this.ballCount;
    this.launchTimer = 0;
    this.turnTime = 0;
    this.firstReturnX = -1;
    this.pickupGain = 0;
    this.aimActive = false;
    this.setState('firing');
    sfx.click();
  }

  // Predicted aim path (straight, bouncing off side walls) for the dashed guide.
  aimPath(): Array<[number, number]> {
    const pts: Array<[number, number]> = [[this.launchX, FLOOR_Y]];
    const dx = this.aimX - this.launchX;
    const dy = this.aimY - FLOOR_Y;
    const len = Math.hypot(dx, dy) || 1;
    let x = this.launchX, y = FLOOR_Y;
    let vx = (dx / len), vy = (dy / len);
    let dist = 0;
    while (dist < 520 && y > TOP_Y - ROW_STEP) {
      const step = 12;
      x += vx * step; y += vy * step; dist += step;
      if (x < BALL_R) { x = BALL_R; vx = -vx; }
      if (x > W - BALL_R) { x = W - BALL_R; vx = -vx; }
      pts.push([x, y]);
    }
    return pts;
  }

  // --- Simulation -----------------------------------------------------------
  update(dt: number): void {
    this.particles.update(dt);
    this.fx.update(dt);
    if (this.state !== 'firing') return;

    // Hard cap: if a volley somehow drags on (e.g. a near-horizontal orb),
    // pull every airborne orb straight home so the turn can never soft-lock.
    this.turnTime += dt;
    if (this.turnTime > 15 && this.toLaunch === 0) {
      for (const b of this.balls) {
        if (b.active) { b.vx *= 0.4; b.vy = BALL_SPEED; }
      }
    }

    // Feed the volley out over time.
    if (this.toLaunch > 0) {
      this.launchTimer -= dt;
      if (this.launchTimer <= 0) {
        this.launchTimer = LAUNCH_INTERVAL;
        this.balls.push({
          x: this.launchX, y: FLOOR_Y - BALL_R,
          vx: this.launchVx, vy: this.launchVy,
          active: true, returned: false,
        });
        this.toLaunch--;
      }
    }

    for (const ball of this.balls) {
      if (!ball.active) continue;
      // Sub-step so fast orbs can't skip a block.
      const steps = Math.max(1, Math.ceil((BALL_SPEED * dt) / BALL_R));
      const sdt = dt / steps;
      for (let s = 0; s < steps && ball.active; s++) this.stepBall(ball, sdt);
    }

    // End the turn once every orb is home and none are still queued.
    if (this.toLaunch === 0 && this.balls.length > 0 && this.balls.every((b) => b.returned)) {
      this.endTurn();
    }
  }

  private stepBall(ball: Ball, dt: number): void {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Walls.
    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

    // Never let an orb settle into a purely horizontal path — keep a minimum
    // vertical speed so it always eventually returns home.
    if (Math.abs(ball.vy) < 60) {
      ball.vy = ball.vy >= 0 ? 60 : -60;
      const sp = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = (ball.vx / sp) * BALL_SPEED;
      ball.vy = (ball.vy / sp) * BALL_SPEED;
    }

    // Floor → orb returns home.
    if (ball.y >= FLOOR_Y - BALL_R) {
      ball.y = FLOOR_Y - BALL_R;
      ball.active = false;
      ball.returned = true;
      if (this.firstReturnX < 0) this.firstReturnX = ball.x;
      return;
    }

    // Pickups.
    for (const p of this.pickups) {
      if (p.taken) continue;
      const px = colX(p.col) + BLOCK / 2;
      const py = p.y + BLOCK / 2;
      if (Math.hypot(ball.x - px, ball.y - py) < BALL_R + BLOCK * 0.28) {
        p.taken = true;
        this.pickupGain++;
        this.particles.burst(px, py, Math.round(10 * settings.particleScale), ['#36c0a8', '#fff'], {
          speed: 130, life: 0.4, size: 4, glow: true,
        });
        sfx.coin();
      }
    }

    // Blocks (circle vs AABB).
    for (const b of this.blocks) {
      if (b.hits <= 0) continue;
      const bx = colX(b.col), by = b.y;
      const closestX = Math.max(bx, Math.min(ball.x, bx + BLOCK));
      const closestY = Math.max(by, Math.min(ball.y, by + BLOCK));
      const ddx = ball.x - closestX;
      const ddy = ball.y - closestY;
      if (ddx * ddx + ddy * ddy > BALL_R * BALL_R) continue;
      // Reflect on the axis of least penetration and push out.
      const overlapX = BALL_R - Math.abs(ddx);
      const overlapY = BALL_R - Math.abs(ddy);
      if (overlapX < overlapY || ddy === 0) {
        ball.vx = -ball.vx;
        ball.x += ball.vx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y += ball.vy > 0 ? overlapY : -overlapY;
      }
      this.hitBlock(b, ball.x, ball.y);
      break;
    }
  }

  private hitBlock(b: Block, x: number, y: number): void {
    b.hits--;
    this.score++;
    this.onScore(this.score, this.ballCount);
    const color = blockColor(b.max);
    if (b.hits <= 0) {
      this.blocks = this.blocks.filter((blk) => blk !== b);
      this.particles.burst(colX(b.col) + BLOCK / 2, b.y + BLOCK / 2,
        Math.round(16 * settings.particleScale), [color, '#ffffff'],
        { speed: 200, life: 0.5, size: 5, glow: true });
      this.fx.shake(4, 0.12);
      sfx.crash();
    } else {
      this.particles.burst(x, y, Math.round(4 * settings.particleScale), [color],
        { speed: 90, life: 0.25, size: 3, glow: true });
      sfx.click();
    }
  }

  private endTurn(): void {
    this.launchX = Math.max(BALL_R + 2, Math.min(W - BALL_R - 2,
      this.firstReturnX >= 0 ? this.firstReturnX : this.launchX));
    this.ballCount += this.pickupGain;
    this.balls = [];
    this.pickups = this.pickups.filter((p) => !p.taken);
    this.addRow();
    this.onScore(this.score, this.ballCount);
    if (this.reachedFloor()) { this.gameOver(); return; }
    this.setState('ready');
  }

  private gameOver(): void {
    const record = profile.recordRun(GAME_ID, this.score);
    this.best = profile.stats(GAME_ID).best;
    this.fx.shake(10, 0.4);
    this.setState('over');
    this.onGameOver(this.score, record);
  }

  // --- Render ---------------------------------------------------------------
  render(ctx: CanvasRenderingContext2D): void {
    this.fx.preRender(ctx);
    ctx.clearRect(-20, -20, W + 40, H + 40);

    // Danger line near the floor.
    ctx.strokeStyle = 'rgba(226,86,58,0.5)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const b of this.blocks) this.drawBlock(ctx, b);
    for (const p of this.pickups) if (!p.taken) this.drawPickup(ctx, p);

    // Aim guide.
    if (this.state === 'ready' && this.aimActive) {
      const path = this.aimPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([2, 10]);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const [x, y] = path[i];
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Orbs.
    ctx.globalCompositeOperation = 'lighter';
    for (const ball of this.balls) {
      if (!ball.active && ball.returned) continue;
      ctx.fillStyle = '#9ec2ff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R * 1.8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Launcher base.
    ctx.fillStyle = '#5b8cff';
    ctx.beginPath();
    ctx.arc(this.launchX, FLOOR_Y, BALL_R + 3, 0, Math.PI * 2);
    ctx.fill();

    this.particles.render(ctx);
    this.fx.postRender(ctx, W, H);
  }

  private drawBlock(ctx: CanvasRenderingContext2D, b: Block): void {
    const x = colX(b.col), y = b.y;
    const color = blockColor(b.max);
    roundRect(ctx, x, y, BLOCK, BLOCK, 10);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, y, BLOCK, BLOCK * 0.4, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${BLOCK * 0.42}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(b.hits), x + BLOCK / 2, y + BLOCK / 2 + 1);
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: Pickup): void {
    const cx = colX(p.col) + BLOCK / 2;
    const cy = p.y + BLOCK / 2;
    ctx.strokeStyle = '#36c0a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, BLOCK * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#36c0a8';
    ctx.font = `700 ${BLOCK * 0.3}px 'Avenir Next', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+1', cx, cy + 1);
  }
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

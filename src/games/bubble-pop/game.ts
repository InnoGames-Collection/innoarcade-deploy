// Bubble Pop — pointer-aim bubble shooter with match-3 clears and hub theme.

import { bpSfx } from './bpAudio';
import { getHighScore, setHighScore } from '../../engine/storage';
import {
  type FloatText, type ImpactFlash, type ComboBanner, type FxParticle,
  spawnFloatText, spawnComboBanner, spawnImpact, spawnPopBurst, spawnImpactBurst,
  updateFloatTexts, updateImpacts, updateComboBanners, updateFxParticles,
  drawFloatTexts, drawComboBanners, drawImpacts, drawFxParticles,
  matchLabel, scoreLabel,
} from './bpEffects';
import {
  type BgParticle, type CannonState,
  initBgParticles, updateBgParticles,
  drawPremiumBackground, drawPlayfieldFrame, drawPlayfieldInterior, applyPlayfieldClip,
  getPlayfieldWalls,
  VISUAL_SCALE,
  drawPremiumBubble, drawPremiumCannon, drawAimGuide,
} from './bpRender';

export const W = 480;
export const H = 720;

const BUBBLE_R = 16;
const LAUNCH_SPEED = 520;
const CANNON_X = W / 2;
const CANNON_Y = H - 72;
const DANGER_Y = CANNON_Y - 36;
const PLAYFIELD_TOP = 60;
const PLAYFIELD_BOTTOM = CANNON_Y + 20;
const PLAYFIELD_WALLS = getPlayfieldWalls(
  W, PLAYFIELD_TOP, PLAYFIELD_BOTTOM, BUBBLE_R * VISUAL_SCALE,
);

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#c084fc'] as const;
type BubbleColor = typeof COLORS[number];

interface Bubble {
  x: number;
  y: number;
  color: BubbleColor;
  popping: boolean;
  popTime: number;
  falling: boolean;
  vy: number;
}

interface Flight {
  x: number; y: number; vx: number; vy: number; color: BubbleColor;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export class BubblePop {
  state: GameState = 'menu';
  score = 0;
  best = getHighScore('bubble-pop');

  /** Presentation stats for game-over screen (do not affect gameplay). */
  displayCombo = 0;
  statMaxCombo = 0;
  statShotsFired = 0;
  statShotsMatched = 0;
  statBubblesCleared = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private time = 0;
  private bubbles: Bubble[] = [];
  private screenShake = 0;
  private aimAngle = -Math.PI / 2;
  private aimActive = false;
  private nextColor: BubbleColor = this.randomColor();
  private flight: Flight | null = null;

  private bgParticles: BgParticle[] = initBgParticles(W, H);
  private fxParticles: FxParticle[] = [];
  private floatTexts: FloatText[] = [];
  private impacts: ImpactFlash[] = [];
  private comboBanners: ComboBanner[] = [];

  private cannonRecoil = 0;
  private nextSwap = 0;
  private comboChain = 0;
  private comboTimer = 0;
  private baseRotation = 0;
  private lightPulse = 0;

  start(): void {
    this.score = 0;
    this.time = 0;
    this.bubbles = [];
    this.fxParticles = [];
    this.floatTexts = [];
    this.impacts = [];
    this.comboBanners = [];
    this.screenShake = 0;
    this.aimAngle = -Math.PI / 2;
    this.aimActive = false;
    this.nextColor = this.randomColor();
    this.flight = null;
    this.cannonRecoil = 0;
    this.nextSwap = 0;
    this.comboChain = 0;
    this.comboTimer = 0;
    this.displayCombo = 0;
    this.statMaxCombo = 0;
    this.statShotsFired = 0;
    this.statShotsMatched = 0;
    this.statBubblesCleared = 0;
    this.buildGrid();
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  get accuracy(): number {
    if (this.statShotsFired === 0) return 100;
    return Math.round((this.statShotsMatched / this.statShotsFired) * 100);
  }

  /** Aim cannon toward canvas point. */
  setAim(x: number, y: number): void {
    if (this.state !== 'playing' || this.flight) return;
    const dx = x - CANNON_X;
    const dy = y - CANNON_Y;
    if (dy > -12) return;
    let angle = Math.atan2(dy, dx);
    angle = Math.max(-Math.PI + 0.15, Math.min(-0.15, angle));
    this.aimAngle = angle;
    this.aimActive = true;
    this.baseRotation = Math.sin(this.time * 0.8) * 0.03;
  }

  clearAim(): void {
    this.aimActive = false;
  }

  fire(): void {
    if (this.state !== 'playing' || this.flight) return;
    this.flight = {
      x: CANNON_X,
      y: CANNON_Y,
      vx: Math.cos(this.aimAngle) * LAUNCH_SPEED,
      vy: Math.sin(this.aimAngle) * LAUNCH_SPEED,
      color: this.nextColor,
    };
    this.nextColor = this.randomColor();
    this.aimActive = false;
    this.cannonRecoil = 1;
    this.nextSwap = 1;
    this.statShotsFired += 1;
    bpSfx.launch();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.screenShake = Math.max(0, this.screenShake - dt * 8);
    this.cannonRecoil = Math.max(0, this.cannonRecoil - dt * 5);
    if (this.nextSwap > 0) this.nextSwap = Math.max(0, this.nextSwap - dt * 3.5);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) {
      this.comboChain = 0;
      this.displayCombo = 0;
    }
    this.lightPulse = Math.max(0, this.lightPulse - dt * 2);
    updateBgParticles(this.bgParticles, dt, W, H);

    if (this.flight) {
      const f = this.flight;
      const steps = 3;
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const prevX = f.x;
        const prevY = f.y;
        f.x += f.vx * sdt;
        f.y += f.vy * sdt;
        if (f.x < PLAYFIELD_WALLS.left) {
          f.x = PLAYFIELD_WALLS.left;
          f.vx = Math.abs(f.vx);
          spawnImpact(this.impacts, f.x, f.y, f.color);
          spawnImpactBurst(this.fxParticles, f.x, f.y, f.color);
          bpSfx.wallBounce();
        }
        if (f.x > PLAYFIELD_WALLS.right) {
          f.x = PLAYFIELD_WALLS.right;
          f.vx = -Math.abs(f.vx);
          spawnImpact(this.impacts, f.x, f.y, f.color);
          spawnImpactBurst(this.fxParticles, f.x, f.y, f.color);
          bpSfx.wallBounce();
        }
        if (f.y < PLAYFIELD_WALLS.top) {
          this.stickBubble(f.x, PLAYFIELD_WALLS.top, f.color);
          spawnImpact(this.impacts, f.x, f.y, f.color);
          this.flight = null;
          break;
        }
        const hit = this.findCollision(f.x, f.y);
        if (hit) {
          spawnImpact(this.impacts, f.x, f.y, f.color);
          spawnImpactBurst(this.fxParticles, f.x, f.y, f.color);
          bpSfx.impact();
          this.stickTo(hit, f);
          this.flight = null;
          break;
        }
        if (Math.hypot(f.x - prevX, f.y - prevY) > 0.01) { /* keep for future trail */ }
      }
    }

    for (const b of this.bubbles) {
      if (b.falling) {
        b.y += b.vy * dt;
        b.vy += 640 * dt;
      }
      if (b.popping) b.popTime += dt;
    }

    this.floatTexts = updateFloatTexts(this.floatTexts, dt);
    this.impacts = updateImpacts(this.impacts, dt);
    this.comboBanners = updateComboBanners(this.comboBanners, dt);
    this.fxParticles = updateFxParticles(this.fxParticles, dt);

    this.bubbles = this.bubbles.filter((b) => !b.popping || b.popTime < 0.22);
    this.bubbles = this.bubbles.filter((b) => !b.falling || b.y < H + 60);

    const lowest = this.bubbles.reduce((m, b) => (!b.falling && !b.popping ? Math.max(m, b.y) : m), 0);
    if (lowest >= DANGER_Y) this.endRun();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const shake = this.screenShake * 3;
    ctx.save();
    ctx.translate(shake * (Math.random() - 0.5), shake * (Math.random() - 0.5));

    drawPremiumBackground(
      ctx, W, H, this.time, this.bgParticles,
      PLAYFIELD_TOP - 28, PLAYFIELD_BOTTOM + 8,
    );
    drawPlayfieldFrame(ctx, W, PLAYFIELD_TOP, PLAYFIELD_BOTTOM, DANGER_Y, this.time);
    drawPlayfieldInterior(ctx, W, PLAYFIELD_TOP, PLAYFIELD_BOTTOM);

    ctx.save();
    applyPlayfieldClip(ctx, W, PLAYFIELD_TOP, PLAYFIELD_BOTTOM);
    this.drawGridBubbles(ctx);

    if (this.flight) {
      this.drawBubble(ctx, this.flight.x, this.flight.y, this.flight.color, 1);
    }

    if (this.aimActive && !this.flight) {
      drawAimGuide(ctx, CANNON_X, CANNON_Y, this.aimAngle, PLAYFIELD_WALLS, this.time);
    }

    drawImpacts(ctx, this.impacts);
    drawFxParticles(ctx, this.fxParticles);
    drawFloatTexts(ctx, this.floatTexts);
    ctx.restore();

    const cannonState: CannonState = {
      aimAngle: this.aimAngle,
      recoil: this.cannonRecoil,
      breath: this.time,
      baseRotation: this.baseRotation,
      nextColor: this.nextColor,
      nextSwap: this.nextSwap,
      time: this.time,
    };
    drawPremiumCannon(ctx, CANNON_X, CANNON_Y, cannonState, BUBBLE_R, (x, y, c, s) => {
      this.drawBubble(ctx, x, y, c, s);
    });

    drawComboBanners(ctx, W, this.comboBanners);

    if (this.lightPulse > 0) {
      ctx.save();
      ctx.globalAlpha = this.lightPulse * 0.25;
      ctx.fillStyle = 'rgba(94,232,154,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    ctx.restore();
  }

  private buildGrid(): void {
    const rows = 5;
    const cols = 8;
    const spacing = BUBBLE_R * 2 + 2;
    const startX = (W - (cols - 1) * spacing) / 2;
    const startY = 88;

    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 1 ? spacing / 2 : 0;
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing + offset;
        const y = startY + row * (spacing * 0.86);
        if (x > BUBBLE_R && x < W - BUBBLE_R) {
          this.bubbles.push({
            x, y, color: this.randomColor(),
            popping: false, popTime: 0, falling: false, vy: 0,
          });
        }
      }
    }
  }

  private stickBubble(x: number, y: number, color: BubbleColor): void {
    const b: Bubble = { x, y, color, popping: false, popTime: 0, falling: false, vy: 0 };
    this.bubbles.push(b);
    this.resolveMatches(b);
  }

  private stickTo(hit: Bubble, f: Flight): void {
    const dx = f.x - hit.x;
    const dy = f.y - hit.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = hit.x + (dx / len) * (BUBBLE_R * 2);
    const y = hit.y + (dy / len) * (BUBBLE_R * 2);
    this.stickBubble(x, y, f.color);
  }

  private findCollision(x: number, y: number): Bubble | null {
    for (const b of this.bubbles) {
      if (b.popping || b.falling) continue;
      if (Math.hypot(x - b.x, y - b.y) < BUBBLE_R * 1.85) return b;
    }
    return null;
  }

  private resolveMatches(origin: Bubble): void {
    const group = this.floodSameColor(origin);
    if (group.length < 3) return;

    const mult = 1 + Math.max(0, group.length - 3) * 0.15;
    const points = Math.round(group.length * 12 * mult);
    this.score += points;
    this.statShotsMatched += 1;
    this.statBubblesCleared += group.length;

    this.comboChain += 1;
    this.comboTimer = 3;
    this.displayCombo = this.comboChain;
    this.statMaxCombo = Math.max(this.statMaxCombo, this.comboChain);
    this.lightPulse = Math.min(1, 0.3 + this.comboChain * 0.08);

    bpSfx.pop(group.length);
    if (this.comboChain >= 2) {
      bpSfx.combo(this.comboChain);
      spawnComboBanner(this.comboBanners, this.comboChain);
    }

    const label = matchLabel(group.length);
    if (label) {
      spawnFloatText(this.floatTexts, origin.x, origin.y - 20, label, '#ffd54f', 1.2);
    }
    spawnFloatText(
      this.floatTexts, origin.x, origin.y - (label ? 44 : 20),
      scoreLabel(points), '#fff', 1,
    );

    this.screenShake = 0.15 + Math.min(0.25, group.length * 0.02);

    for (const b of group) {
      b.popping = true;
      b.popTime = 0;
      spawnPopBurst(this.fxParticles, b.x, b.y, b.color, 0.8 + group.length * 0.05);
    }

    window.setTimeout(() => {
      for (const b of group) {
        const i = this.bubbles.indexOf(b);
        if (i >= 0) this.bubbles.splice(i, 1);
      }
      this.dropFloaters();
    }, 140);
  }

  private floodSameColor(start: Bubble): Bubble[] {
    const out: Bubble[] = [];
    const seen = new Set<Bubble>();
    const q = [start];
    while (q.length) {
      const cur = q.pop()!;
      if (seen.has(cur) || cur.popping || cur.falling) continue;
      seen.add(cur);
      if (cur.color !== start.color) continue;
      out.push(cur);
      for (const other of this.bubbles) {
        if (!seen.has(other) && !other.popping && !other.falling &&
          Math.hypot(cur.x - other.x, cur.y - other.y) < BUBBLE_R * 2.15) {
          q.push(other);
        }
      }
    }
    return out;
  }

  private dropFloaters(): void {
    for (const b of this.bubbles) {
      if (b.popping || b.falling) continue;
      const supported = this.bubbles.some((other) =>
        !other.popping && !other.falling && other !== b &&
        Math.hypot(b.x - other.x, b.y - other.y) < BUBBLE_R * 2.15 &&
        other.y > b.y + 4,
      );
      if (!supported) {
        b.falling = true;
        b.vy = 40;
        this.score += 5;
        this.statBubblesCleared += 1;
        spawnFloatText(this.floatTexts, b.x, b.y, '+5', '#5ee89a', 0.85);
        bpSfx.drop();
      }
    }
  }

  private endRun(): void {
    const record = this.score > this.best;
    if (record) {
      setHighScore('bubble-pop', this.score);
      this.best = this.score;
    }
    bpSfx.gameOver();
    this.setState('gameOver');
    this.onGameOver(this.score, record);
  }

  private drawGridBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bubbles) {
      const scale = b.popping ? Math.max(0, 1 - b.popTime / 0.22) : 1;
      this.drawBubble(ctx, b.x, b.y, b.color, scale);
    }
  }

  private drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number): void {
    drawPremiumBubble(ctx, x, y, color, scale, BUBBLE_R);
  }

  private randomColor(): BubbleColor {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  private setState(next: GameState): void {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }
}

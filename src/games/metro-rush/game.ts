// Metro Rush — enterprise-grade subway runner with particles, screen shake, and
// sophisticated train/platform hazards. Reuses the 3-lane runner core with a
// polished urban aesthetic.

import { sfx } from '../../engine/audio';
import { getHighScore, setHighScore } from '../../engine/storage';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

const HORIZON_Y = 200;
const NEAR_Y = H + 80;
const P_NEAR = 3.5;
const LANE_SPREAD = 150;
const TRACK_EDGE = 1.8;
const PLAYER_Z = 2;
const VIEW_Z = 65;
const HIT_RANGE = 0.75;

const BASE_SPEED = 14;
const MAX_SPEED = 32;
const ACCEL = 0.25;
const LANE_LERP = 11;

const JUMP_DURATION = 0.52;
const JUMP_HEIGHT = 160;
const SLIDE_DURATION = 0.58;

type HazardKind = 'train' | 'gap' | 'closing' | 'crossing';

interface Hazard {
  kind: HazardKind;
  lane: number;
  z: number;
  width?: number;
  startClosing?: number;
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

interface Token {
  lane: number;
  z: number;
  taken: boolean;
}

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class MetroRush {
  state: GameState = 'menu';
  score = 0;
  tokensCollected = 0;
  best = getHighScore('metro-rush');

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, tokens: number, record: boolean) => void = () => {};

  private time = 0;
  private elapsed = 0;
  private dist = 0;
  private speed = BASE_SPEED;
  private lane = 0;
  private laneF = 0;
  private jumpT = -1;
  private slideT = -1;
  private runPhase = 0;
  private hazards: Hazard[] = [];
  private tokens: Token[] = [];
  private particles: Particle[] = [];
  private spawnCursor = 30;
  private overAt = 0;
  private screenShake = 0;

  start(): void {
    this.score = 0;
    this.tokensCollected = 0;
    this.elapsed = 0;
    this.dist = 0;
    this.speed = BASE_SPEED;
    this.lane = 0;
    this.laneF = 0;
    this.jumpT = -1;
    this.slideT = -1;
    this.hazards = [];
    this.tokens = [];
    this.particles = [];
    this.spawnCursor = 30;
    this.screenShake = 0;
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
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.state !== 'playing') return;

    this.elapsed += dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.elapsed * ACCEL);
    this.dist += this.speed * dt;
    this.runPhase += dt * (7 + this.speed * 0.35);
    this.screenShake = Math.max(0, this.screenShake - dt * 8);

    const delta = this.lane - this.laneF;
    const step = LANE_LERP * dt;
    this.laneF += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;

    if (this.jumpT >= 0 && (this.jumpT += dt) >= JUMP_DURATION) this.jumpT = -1;
    if (this.slideT >= 0 && (this.slideT += dt) >= SLIDE_DURATION) this.slideT = -1;

    while (this.spawnCursor < this.dist + VIEW_Z) this.spawnPattern();

    const pz = this.dist + PLAYER_Z;
    for (const h of this.hazards) {
      if (Math.abs(h.z - pz) > HIT_RANGE) continue;
      const laneOff = Math.abs(h.lane - this.laneF);
      let collision = h.kind === 'train' ? laneOff < 0.45 : h.kind === 'gap' && laneOff < 0.48;
      if (h.kind === 'closing' && h.startClosing !== undefined) {
        const closing = Math.max(0, (this.time - h.startClosing) / 0.4);
        if (closing >= 1 && laneOff < 0.3) collision = true;
        else if (closing < 1 && closing > 0.3 && laneOff > 0.2) collision = true;
      }
      if (h.kind === 'crossing' && (this.jumpT < 0 || this.slideT < 0)) collision = true;

      if (collision) {
        this.gameOver();
        return;
      }
    }

    for (const t of this.tokens) {
      if (t.taken) continue;
      if (Math.abs(t.z - pz) > 0.85 || Math.abs(t.lane - this.laneF) > 0.48) continue;
      t.taken = true;
      this.tokensCollected++;
      for (let i = 0; i < 6; i++) this.spawnParticle(this.sx(t.lane, 0), this.sy(1));
      sfx.coin();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.hazards = this.hazards.filter((h) => h.z > this.dist - 2);
    this.tokens = this.tokens.filter((t) => !t.taken && t.z > this.dist - 2);
    this.score = Math.floor(this.dist) + this.tokensCollected * 15;
  }

  private gameOver(): void {
    sfx.crash();
    this.screenShake = 0.35;
    for (let i = 0; i < 12; i++) this.spawnParticle(W / 2, H / 2);
    this.overAt = this.time;
    const record = setHighScore('metro-rush', this.score);
    if (record) this.best = this.score;
    this.setState('over');
    this.onGameOver(this.score, this.tokensCollected, record);
  }

  private setState(s: GameState): void {
    this.state = s;
    this.onStateChange(s);
  }

  private spawnPattern(): void {
    const z = this.spawnCursor;
    const r = Math.random();
    const freeType = (Math.random() * 3) | 0;
    const free = [-1, 0, 1][freeType];

    if (r < 0.25) {
      // Fast train in one lane, safe to dodge.
      const lane = [-1, 0, 1][(Math.random() * 3) | 0];
      this.hazards.push({ kind: 'train', lane, z });
      for (let i = 0; i < 3; i++) {
        this.tokens.push({ lane: (lane + 2) % 3 - 1, z: z + i * 0.9, taken: false });
      }
    } else if (r < 0.42) {
      // Platform gap — must jump.
      const lane = [-1, 0, 1][(Math.random() * 3) | 0];
      this.hazards.push({ kind: 'gap', lane, z });
    } else if (r < 0.58) {
      // Closing doors — must not be in middle lane when they close.
      const lane = free;
      this.hazards.push({ kind: 'closing', lane, z, startClosing: this.time + z / this.speed });
    } else if (r < 0.72) {
      // Crossing hazard — must jump or slide.
      const lane = free;
      this.hazards.push({ kind: 'crossing', lane, z });
    } else {
      // Token cluster.
      for (let i = 0; i < 4; i++) {
        this.tokens.push({ lane: free, z: z + i * 1.1, taken: false });
      }
      this.spawnCursor += 10;
    }

    const minGap = this.speed * 0.6;
    this.spawnCursor += minGap + Math.random() * minGap;
  }

  private spawnParticle(x: number, y: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 160;
    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.6 + Math.random() * 0.3,
      size: 3 + Math.random() * 4,
      color: ['#00d4ff', '#20e0e0', '#5af0e0', '#00e5ff'][(Math.random() * 4) | 0],
    });
  }

  private p(zRel: number): number {
    return P_NEAR / (P_NEAR + Math.max(zRel, 0.05));
  }

  private sy(zRel: number): number {
    return HORIZON_Y + (NEAR_Y - HORIZON_Y) * this.p(zRel);
  }

  private sx(laneOff: number, zRel: number): number {
    return W / 2 + laneOff * LANE_SPREAD * this.p(zRel);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, W, H);

    this.drawEnvironment(ctx);
    this.drawTracks(ctx);
    this.drawHazards(ctx);
    this.drawTokens(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);

    if (this.screenShake > 0) {
      ctx.fillStyle = `rgba(255, 100, 80, ${this.screenShake * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state === 'over') {
      const a = Math.max(0, 0.5 - (this.time - this.overAt) * 1.2);
      if (a > 0) {
        ctx.fillStyle = `rgba(30, 20, 50, ${a})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  private drawEnvironment(ctx: CanvasRenderingContext2D): void {
    // Night sky with city lights.
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, '#0d0f1a');
    g.addColorStop(0.7, '#1a1f3a');
    g.addColorStop(1, '#2a1f45');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    // City skyline silhouette.
    ctx.fillStyle = '#0a0d15';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    for (let x = 0; x <= W; x += 40) {
      const h = 20 + Math.sin(x * 0.06 + this.dist) * 15;
      ctx.lineTo(x, HORIZON_Y - h);
    }
    ctx.lineTo(W, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // Glowing windows.
    ctx.fillStyle = '#ffdd44';
    for (let i = 0; i < 14; i++) {
      const x = (i * 35 - (this.dist * 12) % (W + 70)) % (W + 70) - 35;
      const row = (i % 3) * 8;
      ctx.globalAlpha = 0.4 + Math.sin(this.time * 2 + i) * 0.2;
      ctx.fillRect(x + 5, HORIZON_Y - 35 + row, 6, 5);
      ctx.fillRect(x + 15, HORIZON_Y - 35 + row, 6, 5);
    }
    ctx.globalAlpha = 1;

    // Subway tunnel ahead.
    const g2 = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    g2.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g2.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, HORIZON_Y * 0.2, W, HORIZON_Y * 0.8);
  }

  private drawTracks(ctx: CanvasRenderingContext2D): void {
    const zf = 300;

    // Platform surface.
    ctx.fillStyle = '#1a2332';
    ctx.beginPath();
    ctx.moveTo(this.sx(-TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, 0), this.sy(0));
    ctx.lineTo(this.sx(-TRACK_EDGE, 0), this.sy(0));
    ctx.closePath();
    ctx.fill();

    // Platform edge highlight.
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.sx(-TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(-TRACK_EDGE, 0), this.sy(0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.sx(TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, 0), this.sy(0));
    ctx.stroke();

    // Advancing track marks (tactile feedback).
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let wz = Math.floor(this.dist / 2) * 2; wz < this.dist + 90; wz += 2) {
      const zr = wz - this.dist;
      ctx.beginPath();
      ctx.moveTo(this.sx(-TRACK_EDGE * 0.7, zr), this.sy(zr));
      ctx.lineTo(this.sx(TRACK_EDGE * 0.7, zr), this.sy(zr));
      ctx.stroke();
    }

    // Lane dividers.
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    for (const laneX of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(this.sx(laneX, zf), this.sy(zf));
      ctx.lineTo(this.sx(laneX, 0), this.sy(0));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Tunnel walls with lighting.
    for (const side of [-1, 1]) {
      ctx.strokeStyle = side < 0 ? '#4a5a7a' : '#3a4a6a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.sx(side * TRACK_EDGE * 1.15, zf), this.sy(zf));
      ctx.lineTo(this.sx(side * TRACK_EDGE * 1.15, 0), this.sy(0));
      ctx.stroke();
    }

    // Neon glow.
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(100, 180, 255, 0.6)';
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.sx(-0.5, zf), this.sy(zf));
    ctx.lineTo(this.sx(-0.5, 0), this.sy(0));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.sx(0.5, zf), this.sy(zf));
    ctx.lineTo(this.sx(0.5, 0), this.sy(0));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawHazards(ctx: CanvasRenderingContext2D): void {
    const items: Array<{ z: number; draw: () => void }> = [];
    for (const h of this.hazards) {
      items.push({ z: h.z, draw: () => this.drawHazard(ctx, h) });
    }
    items.sort((a, b) => b.z - a.z);
    for (const item of items) item.draw();
  }

  private drawHazard(ctx: CanvasRenderingContext2D, h: Hazard): void {
    const zr = h.z - this.dist;
    if (zr < 0.1 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const y = this.sy(zr);
    const x = this.sx(h.lane, zr);
    const laneW = LANE_SPREAD * pr;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 10);

    if (h.kind === 'train') {
      const w = laneW * 0.88;
      const h_ = 200 * pr;
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(x - w / 2, y - h_, w, h_);
      ctx.fillStyle = '#1a2a3a';
      ctx.fillRect(x - w / 2, y - h_ * 0.5, w, h_ * 0.5);
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = Math.max(1, 2 * pr);
      ctx.shadowColor = 'rgba(0, 212, 255, 0.6)';
      ctx.shadowBlur = 8;
      for (let i = 0; i < 3; i++) {
        ctx.strokeRect(
          x - w / 2 + (i * w) / 3.5,
          y - h_ * 0.7,
          w / 3.5,
          h_ * 0.4,
        );
      }
      ctx.shadowBlur = 0;
    } else if (h.kind === 'gap') {
      const w = laneW * 0.8;
      const gh = 30 * pr;
      ctx.fillStyle = 'rgba(20, 10, 0, 0.9)';
      ctx.fillRect(x - w / 2, y - gh, w, gh);
      ctx.strokeStyle = '#ff6b4a';
      ctx.lineWidth = Math.max(1, 2 * pr);
      ctx.strokeRect(x - w / 2, y - gh, w, gh);
    } else if (h.kind === 'closing') {
      if (h.startClosing !== undefined) {
        const elapsed = this.time - h.startClosing;
        const closing = Math.max(0, Math.min(1, elapsed / 0.4));
        const w = laneW * (1 - closing * 0.85);
        const dh = 180 * pr;
        ctx.fillStyle = '#3a4a5a';
        ctx.shadowColor = 'rgba(255, 100, 50, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fillRect(x - w / 2, y - dh, w, dh);
        ctx.fillStyle = '#ff6433';
        ctx.fillRect(x - w / 2, y - dh, w, 8 * pr);
        ctx.shadowBlur = 0;
      }
    } else {
      // Crossing train car (horizontal).
      const w = 140 * pr;
      const h_ = 60 * pr;
      ctx.fillStyle = '#2a3545';
      ctx.fillRect(x - w / 2, y - h_ / 2, w, h_);
      ctx.fillStyle = '#ff8866';
      ctx.fillRect(x - w / 2, y - h_ * 0.35, w, 6 * pr);
      ctx.strokeStyle = '#ff8866';
      ctx.lineWidth = Math.max(1, 2 * pr);
      for (let i = 0; i < 2; i++) {
        ctx.strokeRect(x - w / 2 + 20 * pr + i * 50 * pr, y - h_ * 0.25, 25 * pr, 25 * pr);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTokens(ctx: CanvasRenderingContext2D): void {
    for (const t of this.tokens) {
      const zr = t.z - this.dist;
      if (zr < 0.1 || zr > VIEW_Z) return;
      const pr = this.p(zr);
      const bob = Math.sin(this.time * 6 + t.z) * 6 * pr;
      const x = this.sx(t.lane, zr);
      const cy = this.sy(zr) - 35 * pr + bob;
      const r = 12 * pr;
      ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0099cc';
      ctx.lineWidth = Math.max(1, 2 * pr);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const pr = this.p(PLAYER_Z);
    const x = this.sx(this.laneF, PLAYER_Z);
    const groundY = this.sy(PLAYER_Z);
    const jumping = this.jumpT >= 0;
    const sliding = this.slideT >= 0;
    const jp = jumping ? this.jumpT / JUMP_DURATION : 0;
    const lift = jumping ? Math.sin(Math.PI * jp) * JUMP_HEIGHT * pr : 0;

    // Shadow.
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 - 0.15 * Math.sin(Math.PI * jp)})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, 36 * pr, 8 * pr, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, groundY - lift);
    ctx.scale(pr, pr * (sliding ? 0.52 : 1));
    const running = this.state === 'playing';
    const swing = running ? Math.sin(this.runPhase) : Math.sin(this.time * 2) * 0.15;

    // Backpack/rig.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-16, -110, 32, 50);

    // Body.
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.roundRect(-14, -60, 28, 60, 6);
    ctx.fill();

    // Arms.
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -40);
    ctx.lineTo(-12 - swing * 24, jumping ? -20 : -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -40);
    ctx.lineTo(12 + swing * 24, jumping ? -20 : -8);
    ctx.stroke();

    // Legs.
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-10 - swing * 18, jumping ? -8 : 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(10 + swing * 18, jumping ? -8 : 25);
    ctx.stroke();

    // Head.
    ctx.fillStyle = '#e0a070';
    ctx.beginPath();
    ctx.arc(0, -72, 14, 0, Math.PI * 2);
    ctx.fill();

    // Cap/hat.
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(0, -78, 14, 0, Math.PI);
    ctx.closePath();
    ctx.fill();

    // Eyes.
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5, -74, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -74, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - progress * progress;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

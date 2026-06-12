// Temple Dash — flagship 3-lane endless runner. Pseudo-3D projection (objects at
// world distance z, projected toward a horizon vanishing point), authored vector
// sprites (see art.ts), procedural parallax biomes that crossfade with distance,
// power-ups, coin economy, skins, achievements and music. Built on the shared
// engine: AssetStore, Animator, Particles, ScreenFx, Tweens, profile, settings.

import { sfx } from '../../engine/audio';
import { profile } from '../../engine/profile';
import { achievements } from '../../engine/achievements';
import { settings } from '../../engine/settings';
import { Particles } from '../../engine/particles';
import { ScreenFx } from '../../engine/fx';
import { Animator } from '../../engine/anim';
import type { AssetStore } from '../../engine/assets';
import type { Action } from '../../engine/input';
import { FRAME_JUMP, FRAME_RUN, FRAME_SLIDE, SKINS } from './art';

export const W = 480;
export const H = 720;
export const GAME_ID = 'temple-dash';

const HORIZON_Y = 250;
const NEAR_Y = H + 60;
const P_NEAR = 4;
const LANE_SPREAD = 170;
const TRACK_EDGE = 1.6;
const PLAYER_Z = 2;
const VIEW_Z = 60;
const HIT_RANGE = 0.7;

const BASE_SPEED = 13;
const MAX_SPEED = 32;
const ACCEL = 0.24;
const LANE_LERP = 9;

const JUMP_DURATION = 0.55;
const JUMP_HEIGHT = 150;
const SLIDE_DURATION = 0.62;

const TIE_GAP = 4;
const BIOME_LEN = 420; // world distance per biome
const MAGNET_TIME = 7;
const MULT_TIME = 8;
const COIN_VALUE = 5;
const TAU = Math.PI * 2;

type ObstacleKind = 'block' | 'hurdle' | 'beam';
type PowerKind = 'magnet' | 'shield' | 'mult';

interface Obstacle { kind: ObstacleKind; lane: number; z: number; }
interface Coin { lane: number; z: number; taken: boolean; pull: number; }
interface PowerUp { kind: PowerKind; lane: number; z: number; taken: boolean; }

interface Biome { name: string; sky: [string, string, string]; sun: string; far: string; mid: string; ground: string; tie: string; }

const BIOMES: Biome[] = [
  { name: 'Jungle', sky: ['#191b45', '#5d3a6b', '#d97f3e'], sun: '#ffd98a', far: '#33204a', mid: '#1f3a24', ground: '#b3905f', tie: 'rgba(90,66,40,0.35)' },
  { name: 'Desert', sky: ['#2a2350', '#9a5a55', '#f0b15a'], sun: '#fff0c0', far: '#6e4a52', mid: '#b9824a', ground: '#d8b37a', tie: 'rgba(120,90,50,0.3)' },
  { name: 'Cavern', sky: ['#0a0f1e', '#241a40', '#3a2a5a'], sun: '#7fe0d0', far: '#1c2540', mid: '#2a2150', ground: '#6f6486', tie: 'rgba(40,30,70,0.4)' },
  { name: 'Frost', sky: ['#12233f', '#2a5a7a', '#9fd0e0'], sun: '#eaffff', far: '#274a64', mid: '#3a6f86', ground: '#bcd6e0', tie: 'rgba(80,120,140,0.3)' },
];

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpHex(c1: string, c2: string, t: number): string {
  const a = hex(c1), b = hex(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class TempleDash {
  state: GameState = 'menu';
  score = 0;
  coins = 0;
  best = profile.stats(GAME_ID).best;

  // HUD-visible power-up state.
  magnetT = 0;
  multT = 0;
  shield = false;
  biomeName = BIOMES[0].name;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, coins: number, record: boolean) => void = () => {};

  private particles = new Particles(500);
  private fx = new ScreenFx();
  private anim: Animator;

  private time = 0;
  private elapsed = 0;
  private dist = 0;
  private speed = BASE_SPEED;
  private lane = 0;
  private laneF = 0;
  private jumpT = -1;
  private slideT = -1;
  private invuln = 0;
  private obstacles: Obstacle[] = [];
  private coinsArr: Coin[] = [];
  private powerups: PowerUp[] = [];
  private spawnCursor = 25;
  private overAt = 0;
  private skinId: string;

  constructor(private assets: AssetStore) {
    this.skinId = profile.selectedSkin(GAME_ID, 'scout');
    this.anim = new Animator(
      {
        run: { frames: [FRAME_RUN, FRAME_RUN + 1, FRAME_RUN + 2, FRAME_RUN + 3], fps: 12 },
        jump: { frames: [FRAME_JUMP], fps: 1, loop: false },
        slide: { frames: [FRAME_SLIDE], fps: 1, loop: false },
      },
      'run',
    );
    this.fx.reducedMotion = settings.data.reducedMotion;
    settings.onChange((s) => { this.fx.reducedMotion = s.reducedMotion; });
  }

  setSkin(id: string): void {
    this.skinId = id;
    profile.selectSkin(GAME_ID, id);
  }

  start(): void {
    this.skinId = profile.selectedSkin(GAME_ID, 'scout');
    this.score = 0; this.coins = 0;
    this.elapsed = 0; this.dist = 0; this.speed = BASE_SPEED;
    this.lane = 0; this.laneF = 0;
    this.jumpT = -1; this.slideT = -1; this.invuln = 0;
    this.magnetT = 0; this.multT = 0; this.shield = false;
    this.obstacles = []; this.coinsArr = []; this.powerups = [];
    this.spawnCursor = 25;
    this.particles.clear(); this.fx.reset();
    this.anim.play('run', true);
    profile.stats(GAME_ID); // ensure record exists
    this.setState('playing');
    sfx.startMusic([262, 0, 330, 392, 0, 330, 294, 0], 104);
  }

  pause(): void { if (this.state === 'playing') { this.setState('paused'); sfx.stopMusic(); } }
  resume(): void { if (this.state === 'paused') { this.setState('playing'); sfx.startMusic([262, 0, 330, 392, 0, 330, 294, 0], 104); } }

  handleAction(a: Action): void {
    switch (this.state) {
      case 'menu': if (a === 'tap') this.start(); break;
      case 'over': if (a === 'tap' && this.time - this.overAt > 0.8) this.start(); break;
      case 'playing':
        if (a === 'left') this.lane = Math.max(-1, this.lane - 1);
        else if (a === 'right') this.lane = Math.min(1, this.lane + 1);
        else if (a === 'up' && this.jumpT < 0) { this.jumpT = 0; this.slideT = -1; this.anim.play('jump', true); sfx.jump(); }
        else if (a === 'down' && this.jumpT < 0 && this.slideT < 0) { this.slideT = 0; this.anim.play('slide', true); sfx.slide(); }
        break;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    this.particles.update(dt);
    if (this.state !== 'playing') return;
    if (this.fx.frozen()) return; // hit-stop

    this.elapsed += dt;
    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.elapsed * ACCEL);
    this.dist += this.speed * dt;
    this.anim.update(dt * (this.speed / BASE_SPEED));

    if (this.invuln > 0) this.invuln -= dt;
    if (this.magnetT > 0) this.magnetT -= dt;
    if (this.multT > 0) this.multT -= dt;

    // Biome readout (safe modulo guards any non-positive distance).
    const bi = ((Math.floor(this.dist / BIOME_LEN) % BIOMES.length) + BIOMES.length) % BIOMES.length;
    this.biomeName = BIOMES[bi].name;

    const delta = this.lane - this.laneF;
    const step = LANE_LERP * dt;
    this.laneF += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;

    if (this.jumpT >= 0 && (this.jumpT += dt) >= JUMP_DURATION) { this.jumpT = -1; this.anim.play('run', true); }
    if (this.slideT >= 0 && (this.slideT += dt) >= SLIDE_DURATION) { this.slideT = -1; this.anim.play('run', true); }

    while (this.spawnCursor < this.dist + VIEW_Z) this.spawnPattern();

    const pz = this.dist + PLAYER_Z;

    // Obstacle collisions.
    for (const o of this.obstacles) {
      if (Math.abs(o.z - pz) > HIT_RANGE) continue;
      if (Math.abs(o.lane - this.laneF) > 0.5) continue;
      if (o.kind === 'hurdle' && this.airborne()) continue;
      if (o.kind === 'beam' && this.slideT >= 0) continue;
      if (this.invuln > 0) continue;
      if (this.shield) {
        this.shield = false; this.invuln = 1.1;
        this.fx.flash('#9fd0ff', 0.5); this.fx.shake(10, 0.3); sfx.crash();
        this.particles.burst(this.sx(o.lane, PLAYER_Z), this.sy(PLAYER_Z) - 40, 18, ['#9fd0ff', '#dff0ff'], { speed: 240, glow: true });
        continue;
      }
      this.gameOver();
      return;
    }

    // Coins (with magnet pull).
    for (const c of this.coinsArr) {
      if (c.taken) continue;
      if (this.magnetT > 0 && c.z - this.dist < 14 && c.z > this.dist) {
        c.pull = Math.min(1, c.pull + dt * 3);
        c.lane = lerp(c.lane, this.laneF, c.pull);
      }
      if (Math.abs(c.z - pz) > 0.9 || Math.abs(c.lane - this.laneF) > 0.55) continue;
      c.taken = true;
      this.coins += this.multT > 0 ? 2 : 1;
      this.particles.burst(this.sx(c.lane, PLAYER_Z), this.sy(PLAYER_Z) - 36, 7, ['#ffe9a6', '#f1c40f', '#fff'], { speed: 150, glow: true, life: 0.5 });
      sfx.coin();
    }

    // Power-ups.
    for (const p of this.powerups) {
      if (p.taken) continue;
      if (Math.abs(p.z - pz) > 0.9 || Math.abs(p.lane - this.laneF) > 0.55) continue;
      p.taken = true;
      this.applyPower(p.kind);
    }

    this.obstacles = this.obstacles.filter((o) => o.z > this.dist - 2);
    this.coinsArr = this.coinsArr.filter((c) => !c.taken && c.z > this.dist - 2);
    this.powerups = this.powerups.filter((p) => !p.taken && p.z > this.dist - 2);

    const distScore = Math.floor(this.dist);
    this.score = distScore + this.coins * COIN_VALUE;

    achievements.setProgress('td-dist-1k', distScore);
    achievements.setProgress('td-dist-3k', distScore);
  }

  private applyPower(kind: PowerKind): void {
    sfx.coin();
    this.fx.flash('#ffffff', 0.3);
    if (kind === 'magnet') { this.magnetT = MAGNET_TIME; achievements.progress('td-powerups'); }
    else if (kind === 'shield') { this.shield = true; achievements.progress('td-powerups'); }
    else { this.multT = MULT_TIME; achievements.progress('td-powerups'); }
    this.particles.burst(this.sx(this.laneF, PLAYER_Z), this.sy(PLAYER_Z) - 50, 16, ['#ffce54', '#fff', '#fc6e51'], { speed: 220, glow: true });
  }

  private airborne(): boolean {
    if (this.jumpT < 0) return false;
    const k = this.jumpT / JUMP_DURATION;
    return k > 0.18 && k < 0.86;
  }

  private gameOver(): void {
    sfx.crash(); sfx.stopMusic();
    this.fx.shake(16, 0.5); this.fx.flash('#c8281e', 0.5); this.fx.hitStop(0.08);
    this.particles.burst(this.sx(this.laneF, PLAYER_Z), this.sy(PLAYER_Z) - 50, 26, ['#e0533a', '#ffce54', '#fff'], { speed: 300, gravity: 700, glow: true });
    this.overAt = this.time;
    profile.addCoins(this.coins);
    const record = profile.recordRun(GAME_ID, this.score);
    if (record) this.best = this.score;
    this.setState('over');
    this.onGameOver(this.score, this.coins, record);
  }

  private setState(s: GameState): void { this.state = s; this.onStateChange(s); }

  private spawnPattern(): void {
    const z = this.spawnCursor;
    const lanes = [-1, 0, 1];
    const lane = lanes[(Math.random() * 3) | 0];
    const r = Math.random();

    if (r < 0.28) {
      this.obstacles.push({ kind: 'block', lane, z });
    } else if (r < 0.44) {
      const free = lanes[(Math.random() * 3) | 0];
      for (const l of lanes) if (l !== free) this.obstacles.push({ kind: 'block', lane: l, z });
    } else if (r < 0.58) {
      this.obstacles.push({ kind: 'hurdle', lane, z });
    } else if (r < 0.72) {
      this.obstacles.push({ kind: 'beam', lane, z });
    } else if (r < 0.78 && this.dist > 60) {
      const kinds: PowerKind[] = ['magnet', 'shield', 'mult'];
      this.powerups.push({ kind: kinds[(Math.random() * 3) | 0], lane, z, taken: false });
    } else {
      const cl = lanes[(Math.random() * 3) | 0];
      for (let i = 0; i < 5; i++) this.coinsArr.push({ lane: cl, z: z + i * 1.6, taken: false, pull: 0 });
      this.spawnCursor += 8;
    }

    const minGap = this.speed * 0.55;
    this.spawnCursor += minGap + Math.random() * minGap;
  }

  // --- projection ---
  private p(zRel: number): number { return P_NEAR / (P_NEAR + Math.max(zRel, 0.05)); }
  private sy(zRel: number): number { return HORIZON_Y + (NEAR_Y - HORIZON_Y) * this.p(zRel); }
  private sx(laneOff: number, zRel: number): number { return W / 2 + laneOff * LANE_SPREAD * this.p(zRel); }

  private biomeBlend(): { from: Biome; to: Biome; t: number } {
    const f = this.dist / BIOME_LEN;
    const i = Math.floor(f) % BIOMES.length;
    const frac = f - Math.floor(f);
    const t = Math.max(0, (frac - 0.8) / 0.2); // crossfade in the last 20% of a biome
    return { from: BIOMES[i], to: BIOMES[(i + 1) % BIOMES.length], t };
  }

  // --- rendering ---
  render(ctx: CanvasRenderingContext2D): void {
    this.fx.preRender(ctx);
    this.drawSky(ctx);
    this.drawGround(ctx);
    this.drawScene(ctx);
    this.drawPlayer(ctx);
    this.particles.render(ctx);
    this.fx.postRender(ctx, W, H);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const { from, to, t } = this.biomeBlend();
    const sky = (i: 0 | 1 | 2): string => lerpHex(from.sky[i], to.sky[i], t);
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, sky(0)); g.addColorStop(0.5, sky(1)); g.addColorStop(1, sky(2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON_Y + 2);

    // Sun glow.
    const sun = lerpHex(from.sun, to.sun, t);
    ctx.fillStyle = sun;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(W / 2, HORIZON_Y - 26, 70, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(W / 2, HORIZON_Y - 26, 34, 0, TAU); ctx.fill();

    // Parametric far + mid ridgelines (procedural silhouettes, scroll w/ distance).
    this.drawRidge(ctx, lerpHex(from.far, to.far, t), 0.0008, 70, 0.9);
    this.drawRidge(ctx, lerpHex(from.mid, to.mid, t), 0.0022, 46, 1.7);
  }

  private drawRidge(ctx: CanvasRenderingContext2D, color: string, freq: number, amp: number, scroll: number): void {
    const off = this.dist * scroll;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    for (let x = 0; x <= W; x += 16) {
      const n = Math.sin((x + off) * freq * 12) + 0.5 * Math.sin((x + off) * freq * 31 + 1.3);
      ctx.lineTo(x, HORIZON_Y - amp * (0.5 + 0.5 * n));
    }
    ctx.lineTo(W, HORIZON_Y); ctx.closePath(); ctx.fill();
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const { from, to, t } = this.biomeBlend();
    ctx.fillStyle = lerpHex('#23402c', to === from ? '#23402c' : '#23402c', 0);
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    const zf = 300;
    ctx.fillStyle = lerpHex(from.ground, to.ground, t);
    ctx.beginPath();
    ctx.moveTo(this.sx(-TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, zf), this.sy(zf));
    ctx.lineTo(this.sx(TRACK_EDGE, 0), this.sy(0));
    ctx.lineTo(this.sx(-TRACK_EDGE, 0), this.sy(0));
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = lerpHex(from.tie.startsWith('rgba') ? '#5a4228' : from.tie, '#5a4228', 0);
    ctx.strokeStyle = from.tie;
    for (let wz = Math.floor(this.dist / TIE_GAP) * TIE_GAP + TIE_GAP; wz < this.dist + 90; wz += TIE_GAP) {
      const zr = wz - this.dist;
      ctx.lineWidth = Math.max(1, 5 * this.p(zr));
      ctx.beginPath();
      ctx.moveTo(this.sx(-TRACK_EDGE, zr), this.sy(zr));
      ctx.lineTo(this.sx(TRACK_EDGE, zr), this.sy(zr));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(80,60,38,0.5)';
    ctx.lineWidth = 2;
    for (const l of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(this.sx(l, zf), this.sy(zf));
      ctx.lineTo(this.sx(l, 0), this.sy(0));
      ctx.stroke();
    }
    for (const side of [-TRACK_EDGE, TRACK_EDGE]) {
      ctx.strokeStyle = '#7c6240'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.sx(side, zf), this.sy(zf));
      ctx.lineTo(this.sx(side, 0), this.sy(0));
      ctx.stroke();
    }
  }

  private drawScene(ctx: CanvasRenderingContext2D): void {
    const items: Array<{ z: number; draw: () => void }> = [];
    for (const o of this.obstacles) items.push({ z: o.z, draw: () => this.drawObstacle(ctx, o) });
    for (const c of this.coinsArr) items.push({ z: c.z, draw: () => this.drawCoin(ctx, c) });
    for (const p of this.powerups) items.push({ z: p.z, draw: () => this.drawPowerUp(ctx, p) });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.draw();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
    const zr = o.z - this.dist;
    if (zr < 0.2 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const x = this.sx(o.lane, zr);
    const y = this.sy(zr);
    const size = LANE_SPREAD * pr * 1.05;
    const frame = o.kind === 'block' ? 0 : o.kind === 'hurdle' ? 1 : 2;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);
    this.assets.draw(ctx, 'obstacles', frame, x - size / 2, y - size, size, size);
    ctx.globalAlpha = 1;
  }

  private drawCoin(ctx: CanvasRenderingContext2D, c: Coin): void {
    const zr = c.z - this.dist;
    if (zr < 0.2 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const bob = Math.sin(this.time * 5 + c.z) * 6 * pr;
    const x = this.sx(c.lane, zr);
    const cy = this.sy(zr) - 34 * pr + bob;
    const size = 46 * pr;
    const frame = Math.floor(this.time * 12 + c.z) % 6;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);
    this.assets.draw(ctx, 'coin', frame, x - size / 2, cy - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  private drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp): void {
    const zr = p.z - this.dist;
    if (zr < 0.2 || zr > VIEW_Z) return;
    const pr = this.p(zr);
    const bob = Math.sin(this.time * 4 + p.z) * 7 * pr;
    const x = this.sx(p.lane, zr);
    const cy = this.sy(zr) - 46 * pr + bob;
    const size = 60 * pr;
    const frame = p.kind === 'magnet' ? 0 : p.kind === 'shield' ? 1 : 2;
    ctx.globalAlpha = Math.min(1, (VIEW_Z - zr) / 8);
    // Halo.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * Math.min(1, (VIEW_Z - zr) / 8);
    ctx.fillStyle = p.kind === 'shield' ? '#4a90d9' : p.kind === 'magnet' ? '#d63031' : '#f1c40f';
    ctx.beginPath(); ctx.arc(x, cy, size * 0.55, 0, TAU); ctx.fill();
    ctx.restore();
    this.assets.draw(ctx, 'powerups', frame, x - size / 2, cy - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const pr = this.p(PLAYER_Z);
    const x = this.sx(this.laneF, PLAYER_Z);
    const groundY = this.sy(PLAYER_Z);
    const jumping = this.jumpT >= 0;
    const jp = jumping ? this.jumpT / JUMP_DURATION : 0;
    const lift = jumping ? Math.sin(Math.PI * jp) * JUMP_HEIGHT * pr : 0;
    const size = 180 * pr;

    // Shadow.
    ctx.fillStyle = `rgba(0,0,0,${0.3 - 0.15 * Math.sin(Math.PI * jp)})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, 36 * pr * (1 - 0.25 * Math.sin(Math.PI * jp)), 9 * pr, 0, 0, TAU);
    ctx.fill();

    // Shield bubble.
    if (this.shield) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(this.time * 6);
      ctx.fillStyle = '#5aa0e0';
      ctx.beginPath(); ctx.arc(x, groundY - lift - size * 0.32, size * 0.42, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // Magnet aura.
    if (this.magnetT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.time * 8);
      ctx.strokeStyle = '#d63031'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, groundY - lift - size * 0.3, size * 0.5, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    const blink = this.invuln > 0 && Math.floor(this.time * 18) % 2 === 0;
    if (!blink) {
      const sheet = `char_${this.skinId}`;
      this.anim.draw(this.assets, sheet, ctx, x, groundY - lift - size / 2, size, size);
    }
  }
}

// Achievement definitions for Temple Dash (registered by main.ts).
export const TD_ACHIEVEMENTS = [
  { id: 'td-dist-1k', game: GAME_ID, titleEn: 'Trailblazer', titleAm: 'መንገድ ጠራጊ', descEn: 'Run 1,000m in a single dash', descAm: 'በአንድ ሩጫ 1,000ሜ ይሩጡ', goal: 1000, reward: 100, icon: '🏃' },
  { id: 'td-dist-3k', game: GAME_ID, titleEn: 'Pathfinder', titleAm: 'መንገድ አግኚ', descEn: 'Run 3,000m in a single dash', descAm: 'በአንድ ሩጫ 3,000ሜ ይሩጡ', goal: 3000, reward: 300, icon: '🗺️' },
  { id: 'td-powerups', game: GAME_ID, titleEn: 'Power Hungry', titleAm: 'ኃይል ወዳድ', descEn: 'Collect 25 power-ups', descAm: '25 ኃይል-መሙያዎች ይሰብስቡ', goal: 25, reward: 200, icon: '⚡' },
];

export { SKINS };

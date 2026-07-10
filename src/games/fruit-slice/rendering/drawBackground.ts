// Premium orchard environment — parallax layers, painterly canvas art.

import { RW as W, RH as H } from './types';

interface Cloud { x: number; y: number; s: number; spd: number; }
interface Leaf { x: number; y: number; ph: number; amp: number; sz: number; }
interface Butterfly { x: number; y: number; ph: number; wing: number; hue: number; }
interface Bird { x: number; y: number; spd: number; wing: number; }
interface Pollen { x: number; y: number; ph: number; sz: number; }

export class OrchardBackground {
  private clouds: Cloud[] = [];
  private leaves: Leaf[] = [];
  private butterflies: Butterfly[] = [];
  private birds: Bird[] = [];
  private pollen: Pollen[] = [];
  private birdTimer = 9;
  private farLayer: HTMLCanvasElement | null = null;
  private nearLayer: HTMLCanvasElement | null = null;
  private frameBuf: HTMLCanvasElement | null = null;

  constructor() {
    for (let i = 0; i < 5; i++) {
      this.clouds.push({ x: Math.random() * W, y: 24 + Math.random() * 75, s: 0.7 + Math.random() * 0.8, spd: 4.5 + Math.random() * 8 });
    }
    for (let i = 0; i < 10; i++) {
      this.leaves.push({ x: Math.random() * W, y: 130 + Math.random() * 350, ph: Math.random() * 6.28, amp: 2 + Math.random() * 3, sz: 7 + Math.random() * 11 });
    }
    for (let i = 0; i < 3; i++) {
      this.butterflies.push({ x: Math.random() * W, y: 190 + Math.random() * 250, ph: Math.random() * 6.28, wing: 0, hue: 25 + Math.random() * 60 });
    }
    for (let i = 0; i < 14; i++) {
      this.pollen.push({ x: Math.random() * W, y: 210 + Math.random() * 400, ph: Math.random() * 6.28, sz: 0.6 + Math.random() * 1.5 });
    }
    this.buildStaticLayers();
  }

  private canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')!];
  }

  private buildStaticLayers(): void {
    const [far, fctx] = this.canvas();
    this.paintSkyGradient(fctx);
    this.paintFarMountains(fctx);
    this.paintDistantVillage(fctx);
    this.farLayer = far;

    const [near, nctx] = this.canvas();
    this.paintGround(nctx);
    this.paintFence(nctx);
    this.paintFlowerBeds(nctx);
    this.paintMarket(nctx);
    this.nearLayer = near;
  }

  private frameCtx(): CanvasRenderingContext2D {
    if (!this.frameBuf) {
      const [c, ctx] = this.canvas();
      this.frameBuf = c;
      return ctx;
    }
    return this.frameBuf.getContext('2d')!;
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.spd * dt;
      if (c.x > W + 65) { c.x = -65; c.y = 24 + Math.random() * 75; }
    }
    for (const b of this.butterflies) {
      b.ph += dt * 0.7;
      b.wing += dt * 10;
      b.x += Math.sin(b.ph) * 14 * dt;
      b.y += Math.cos(b.ph * 0.7) * 9 * dt;
      if (b.x < -14) b.x = W + 14;
      if (b.x > W + 14) b.x = -14;
    }
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birds.push({ x: -22, y: 50 + Math.random() * 85, spd: 75 + Math.random() * 50, wing: 0 });
      this.birdTimer = 13 + Math.random() * 22;
    }
    for (const b of this.birds) { b.x += b.spd * dt; b.wing += dt * 14; }
    this.birds = this.birds.filter((b) => b.x < W + 32);
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    const fc = this.frameCtx();
    fc.clearRect(0, 0, W, H);

    if (this.farLayer) fc.drawImage(this.farLayer, 0, 0);
    this.paintSun(fc, time);
    this.paintSunRays(fc, time);
    for (const c of this.clouds) this.paintCloud(fc, c.x, c.y, c.s);
    this.paintMidTrees(fc, time);
    if (this.nearLayer) fc.drawImage(this.nearLayer, 0, 0);

    const haze = fc.createLinearGradient(0, H * 0.32, 0, H * 0.7);
    haze.addColorStop(0, 'rgba(186,230,253,0)');
    haze.addColorStop(1, 'rgba(220,252,231,0.14)');
    fc.fillStyle = haze;
    fc.fillRect(0, 0, W, H);

    this.paintAmbient(fc, time);
    ctx.drawImage(this.frameBuf!, 0, 0);
  }

  renderMenu(ctx: CanvasRenderingContext2D, time: number): void {
    this.render(ctx, time);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Sky & sun ──────────────────────────────────────────────

  private paintSkyGradient(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0ea5e9');
    g.addColorStop(0.22, '#38bdf8');
    g.addColorStop(0.48, '#7dd3fc');
    g.addColorStop(0.72, '#bae6fd');
    g.addColorStop(1, '#d9f99d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  private paintSun(ctx: CanvasRenderingContext2D, time: number): void {
    const sx = W * 0.73;
    const sy = 78 + Math.sin(time * 0.27) * 2;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 100);
    halo.addColorStop(0, 'rgba(255,250,210,0.95)');
    halo.addColorStop(0.35, 'rgba(255,220,100,0.4)');
    halo.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H * 0.5);
    ctx.fillStyle = '#fff0a0';
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.7)';
    ctx.beginPath();
    ctx.arc(sx - 6, sy - 6, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  private paintSunRays(ctx: CanvasRenderingContext2D, time: number): void {
    const sx = W * 0.73;
    const sy = 78;
    ctx.save();
    ctx.globalAlpha = 0.065 + Math.sin(time * 0.4) * 0.02;
    ctx.translate(sx, sy);
    ctx.rotate(time * 0.05);
    for (let i = 0; i < 7; i++) {
      ctx.rotate((Math.PI * 2) / 7);
      const ray = ctx.createLinearGradient(0, 30, 0, 270);
      ray.addColorStop(0, 'rgba(255,240,170,0.6)');
      ray.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(-9, 32);
      ctx.lineTo(9, 32);
      ctx.lineTo(2.5, 270);
      ctx.lineTo(-2.5, 270);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private paintCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    const r = 16 * s;
    const body = ctx.createRadialGradient(x, y - r * 0.1, r * 0.2, x, y, r * 1.4);
    body.addColorStop(0, 'rgba(255,255,255,0.98)');
    body.addColorStop(0.7, 'rgba(245,250,255,0.9)');
    body.addColorStop(1, 'rgba(230,240,255,0.5)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.85, y - r * 0.15, r * 0.7, 0, Math.PI * 2);
    ctx.arc(x + r * 1.6, y + r * 0.05, r * 0.78, 0, Math.PI * 2);
    ctx.arc(x + r * 0.4, y + r * 0.12, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Mountains & village (far parallax) ─────────────────────

  private paintFarMountains(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.82;
    const mg = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.58);
    mg.addColorStop(0, '#94c5d8');
    mg.addColorStop(1, '#6a9cb5');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5);
    ctx.lineTo(W * 0.12, H * 0.34);
    ctx.lineTo(W * 0.28, H * 0.44);
    ctx.lineTo(W * 0.46, H * 0.31);
    ctx.lineTo(W * 0.64, H * 0.4);
    ctx.lineTo(W * 0.82, H * 0.33);
    ctx.lineTo(W, H * 0.47);
    ctx.lineTo(W, H * 0.57);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b0d4e8';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.53);
    ctx.lineTo(W * 0.18, H * 0.43);
    ctx.lineTo(W * 0.38, H * 0.49);
    ctx.lineTo(W * 0.58, H * 0.41);
    ctx.lineTo(W, H * 0.51);
    ctx.lineTo(W, H * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private paintDistantVillage(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalAlpha = 0.75;
    const by = H * 0.55;
    const houses = [
      { x: 52, w: 32, h: 26, roof: '#b45309' },
      { x: 96, w: 36, h: 30, roof: '#92400e' },
      { x: 332, w: 34, h: 28, roof: '#c2410c' },
      { x: 378, w: 30, h: 24, roof: '#d97706' },
    ];
    for (const h of houses) {
      const wall = ctx.createLinearGradient(h.x, by - h.h, h.x, by);
      wall.addColorStop(0, '#fef3c7');
      wall.addColorStop(1, '#e8d5b0');
      ctx.fillStyle = wall;
      ctx.fillRect(h.x, by - h.h, h.w, h.h);
      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.moveTo(h.x - 5, by - h.h);
      ctx.lineTo(h.x + h.w / 2, by - h.h - 16);
      ctx.lineTo(h.x + h.w + 5, by - h.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(h.x + h.w * 0.3, by - h.h * 0.55, 10, 10);
    }
    ctx.restore();
  }

  // ── Trees (mid parallax, animated sway) ────────────────────

  private paintMidTrees(ctx: CanvasRenderingContext2D, time: number): void {
    const trees = [
      { x: 32, kind: 'mango', h: 136 },
      { x: 112, kind: 'apple', h: 116 },
      { x: 192, kind: 'orange', h: 126 },
      { x: 272, kind: 'banana', h: 106 },
      { x: 352, kind: 'mango', h: 130 },
      { x: 424, kind: 'apple', h: 110 },
    ];
    const base = H * 0.6;
    for (const t of trees) {
      const sway = Math.sin(time * 1.05 + t.x * 0.017) * 2.2;
      this.paintTree(ctx, t.x + sway, base, t.h, t.kind);
    }
  }

  private paintTree(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, kind: string): void {
    const trunk = ctx.createLinearGradient(x - 5, base - h * 0.42, x + 5, base);
    trunk.addColorStop(0, '#6b4423');
    trunk.addColorStop(1, '#4a2f17');
    ctx.fillStyle = trunk;
    ctx.fillRect(x - 5, base - h * 0.42, 10, h * 0.42);

    const cy = base - h * 0.46;
    const r = h * 0.35;
    let crown = '#2d9a4e';
    let fc = '#ef4444';
    if (kind === 'mango') { crown = '#38a85a'; fc = '#f59e0b'; }
    if (kind === 'orange') { crown = '#32a050'; fc = '#f97316'; }
    if (kind === 'banana') {
      ctx.fillStyle = '#ca9a0a';
      ctx.beginPath();
      ctx.ellipse(x + 13, cy + 6, 6.5, 19, 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    const cg = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.25, 2, x, cy, r);
    cg.addColorStop(0, '#72e08a');
    cg.addColorStop(0.5, crown);
    cg.addColorStop(1, '#14532d');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (kind !== 'banana') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.3;
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.4, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Ground, fence, flowers, market (near layer) ────────────

  private paintGround(ctx: CanvasRenderingContext2D): void {
    const gy = H * 0.7;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#4ade80');
    g.addColorStop(0.25, '#22c55e');
    g.addColorStop(0.7, '#16a34a');
    g.addColorStop(1, '#15803d');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = 'rgba(21,100,40,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const gx = (i * 51) % W;
      const gy2 = gy + 16 + (i * 19) % (H - gy - 26);
      ctx.beginPath();
      ctx.moveTo(gx, gy2);
      ctx.quadraticCurveTo(gx + 2, gy2 - 5, gx + 5, gy2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(34,120,50,0.15)';
    for (let i = 0; i < 8; i++) {
      const px = 30 + i * 58;
      ctx.beginPath();
      ctx.ellipse(px, gy + 8, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintFence(ctx: CanvasRenderingContext2D): void {
    const fy = H * 0.72;
    const wood = ctx.createLinearGradient(0, fy - 22, 0, fy);
    wood.addColorStop(0, '#a67c00');
    wood.addColorStop(1, '#7a5c10');
    ctx.strokeStyle = wood;
    ctx.lineWidth = 2.5;
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x, fy - 20);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, fy - 12);
    ctx.lineTo(W, fy - 12);
    ctx.moveTo(0, fy - 5);
    ctx.lineTo(W, fy - 5);
    ctx.stroke();
  }

  private paintFlowerBeds(ctx: CanvasRenderingContext2D): void {
    const cols = ['#f472b6', '#facc15', '#fb923c', '#c084fc', '#ffffff'];
    const pts: [number, number][] = [
      [26, H * 0.76], [84, H * 0.8], [152, H * 0.77], [242, H * 0.81],
      [312, H * 0.76], [392, H * 0.79], [444, H * 0.77],
    ];
    for (let i = 0; i < pts.length; i++) {
      const [fx, fy] = pts[i];
      ctx.fillStyle = '#166534';
      ctx.fillRect(fx, fy, 2, 7);
      ctx.fillStyle = cols[i % cols.length];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + 1 + Math.cos(a) * 4.2, fy + Math.sin(a) * 4.2, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(fx + 1, fy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private paintMarket(ctx: CanvasRenderingContext2D): void {
    const mx = W * 0.35;
    const my = H * 0.66;
    const wall = ctx.createLinearGradient(mx, my - 50, mx, my);
    wall.addColorStop(0, '#9a6324');
    wall.addColorStop(1, '#6b4220');
    ctx.fillStyle = wall;
    ctx.fillRect(mx, my - 50, 108, 50);
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(mx - 10, my - 50);
    ctx.lineTo(mx + 54, my - 74);
    ctx.lineTo(mx + 118, my - 50);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx + 54, my - 74);
    ctx.lineTo(mx + 54, my - 50);
    ctx.stroke();
    const crateCols = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#c49a6c';
      ctx.fillRect(mx + 10 + i * 24, my - 17, 18, 13);
      ctx.fillStyle = crateCols[i];
      ctx.beginPath();
      ctx.arc(mx + 19 + i * 24, my - 23, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 10px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FRUITS', mx + 54, my - 57);
  }

  // ── Ambient life ───────────────────────────────────────────

  private paintAmbient(ctx: CanvasRenderingContext2D, time: number): void {
    for (const l of this.leaves) {
      const ox = Math.sin(time * 1.3 + l.ph) * l.amp;
      const oy = Math.cos(time * 0.95 + l.ph) * l.amp * 0.4;
      ctx.save();
      ctx.translate(l.x + ox, l.y + oy);
      ctx.rotate(Math.sin(time + l.ph) * 0.25);
      ctx.fillStyle = `rgba(60,180,80,${0.2 + Math.sin(l.ph) * 0.07})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.sz * 0.36, l.sz * 0.85, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const b of this.butterflies) {
      const wing = Math.abs(Math.sin(b.wing)) * 4.5 + 1.5;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = `hsla(${b.hue},88%,58%,0.78)`;
      ctx.beginPath();
      ctx.ellipse(-wing, 0, wing, 3.2, -0.25, 0, Math.PI * 2);
      ctx.ellipse(wing, 0, wing, 3.2, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const bird of this.birds) {
      const wing = Math.sin(bird.wing) * 4;
      ctx.strokeStyle = 'rgba(40,40,60,0.5)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bird.x - 6, bird.y);
      ctx.quadraticCurveTo(bird.x, bird.y - wing - 3, bird.x + 6, bird.y);
      ctx.stroke();
    }
    for (const p of this.pollen) {
      const dy = Math.sin(time * 0.5 + p.ph) * 6;
      ctx.fillStyle = `rgba(255,248,200,${0.16 + Math.sin(p.ph) * 0.06})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y + dy, p.sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Tropical fruit orchard — layered parallax with static caches for 60 FPS.
// Distant layers use desaturation + haze instead of expensive canvas blur.

export const BG_W = 480;
export const BG_H = 720;

interface Cloud { x: number; y: number; scale: number; speed: number; }
interface Leaf { x: number; y: number; phase: number; amp: number; size: number; }
interface Butterfly { x: number; y: number; phase: number; wing: number; hue: number; }
interface Bird { x: number; y: number; speed: number; wing: number; }
interface Pollen { x: number; y: number; phase: number; size: number; }

export class OrchardBackground {
  private clouds: Cloud[] = [];
  private leaves: Leaf[] = [];
  private butterflies: Butterfly[] = [];
  private birds: Bird[] = [];
  private pollen: Pollen[] = [];
  private nextBird = 10;
  private farCache: HTMLCanvasElement | null = null;
  private nearCache: HTMLCanvasElement | null = null;
  private frameCache: HTMLCanvasElement | null = null;

  constructor() {
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * BG_W,
        y: 28 + Math.random() * 80,
        scale: 0.65 + Math.random() * 0.85,
        speed: 5 + Math.random() * 9,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.leaves.push({
        x: Math.random() * BG_W,
        y: 140 + Math.random() * 360,
        phase: Math.random() * Math.PI * 2,
        amp: 2 + Math.random() * 3,
        size: 7 + Math.random() * 12,
      });
    }
    for (let i = 0; i < 3; i++) {
      this.butterflies.push({
        x: Math.random() * BG_W,
        y: 200 + Math.random() * 260,
        phase: Math.random() * Math.PI * 2,
        wing: 0,
        hue: 28 + Math.random() * 55,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.pollen.push({
        x: Math.random() * BG_W,
        y: 220 + Math.random() * 380,
        phase: Math.random() * Math.PI * 2,
        size: 0.7 + Math.random() * 1.6,
      });
    }
    this.buildStaticCaches();
  }

  private mkCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = BG_W;
    c.height = BG_H;
    return [c, c.getContext('2d')!];
  }

  private buildStaticCaches(): void {
    const [far, fctx] = this.mkCanvas();
    this.drawSkyBase(fctx);
    this.drawMountains(fctx, 0.72);
    this.drawVillage(fctx, 0.78);
    this.farCache = far;

    const [near, nctx] = this.mkCanvas();
    this.drawGround(nctx);
    this.drawFences(nctx);
    this.drawFlowers(nctx);
    this.drawMarket(nctx);
    this.nearCache = near;
  }

  private ensureFrameCache(): CanvasRenderingContext2D {
    if (!this.frameCache) {
      const [c, ctx] = this.mkCanvas();
      this.frameCache = c;
      return ctx;
    }
    return this.frameCache.getContext('2d')!;
  }

  update(dt: number): void {
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > BG_W + 70) { c.x = -70; c.y = 28 + Math.random() * 80; }
    }
    for (const b of this.butterflies) {
      b.phase += dt * 0.75;
      b.wing += dt * 11;
      b.x += Math.sin(b.phase) * 16 * dt;
      b.y += Math.cos(b.phase * 0.65) * 10 * dt;
      if (b.x < -16) b.x = BG_W + 16;
      if (b.x > BG_W + 16) b.x = -16;
    }
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.birds.push({ x: -24, y: 55 + Math.random() * 90, speed: 80 + Math.random() * 55, wing: 0 });
      this.nextBird = 14 + Math.random() * 20;
    }
    for (const bird of this.birds) {
      bird.x += bird.speed * dt;
      bird.wing += dt * 15;
    }
    this.birds = this.birds.filter((b) => b.x < BG_W + 36);
  }

  render(ctx: CanvasRenderingContext2D, time: number): void {
    const fc = this.ensureFrameCache();
    fc.clearRect(0, 0, BG_W, BG_H);

    if (this.farCache) fc.drawImage(this.farCache, 0, 0);
    this.drawSun(fc, time);
    this.drawSunRays(fc, time);
    for (const c of this.clouds) this.drawCloud(fc, c.x, c.y, c.scale);

    // Mid parallax — trees sway independently
    this.drawTrees(fc, time);

    if (this.nearCache) fc.drawImage(this.nearCache, 0, 0);

    // Atmospheric depth haze over distant mid-ground
    const haze = fc.createLinearGradient(0, BG_H * 0.35, 0, BG_H * 0.72);
    haze.addColorStop(0, 'rgba(186, 230, 253, 0)');
    haze.addColorStop(1, 'rgba(220, 252, 231, 0.12)');
    fc.fillStyle = haze;
    fc.fillRect(0, 0, BG_W, BG_H);

    this.drawAmbient(fc, time);
    ctx.drawImage(this.frameCache!, 0, 0);
  }

  renderMenu(ctx: CanvasRenderingContext2D, time: number): void {
    this.render(ctx, time);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, BG_W, BG_H);
  }

  private drawSkyBase(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, BG_H);
    g.addColorStop(0, '#38bdf8');
    g.addColorStop(0.3, '#7dd3fc');
    g.addColorStop(0.6, '#bae6fd');
    g.addColorStop(1, '#d9f99d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BG_W, BG_H);
  }

  private drawSun(ctx: CanvasRenderingContext2D, time: number): void {
    const sunX = BG_W * 0.76;
    const sunY = 88 + Math.sin(time * 0.28) * 2.5;
    const glow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 110);
    glow.addColorStop(0, 'rgba(255, 248, 200, 0.9)');
    glow.addColorStop(0.4, 'rgba(255, 220, 100, 0.35)');
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BG_W, BG_H * 0.55);
    ctx.fillStyle = '#ffeb7a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 240, 0.65)';
    ctx.beginPath();
    ctx.arc(sunX - 7, sunY - 7, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSunRays(ctx: CanvasRenderingContext2D, time: number): void {
    const sunX = BG_W * 0.76;
    const sunY = 88;
    ctx.save();
    ctx.globalAlpha = 0.07 + Math.sin(time * 0.45) * 0.025;
    ctx.translate(sunX, sunY);
    ctx.rotate(time * 0.06);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      const ray = ctx.createLinearGradient(0, 0, 0, 260);
      ray.addColorStop(0, 'rgba(255, 240, 160, 0.55)');
      ray.addColorStop(1, 'rgba(255, 240, 160, 0)');
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(-10, 36);
      ctx.lineTo(10, 36);
      ctx.lineTo(3, 260);
      ctx.lineTo(-3, 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    const r = 17 * s;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.85, y - r * 0.18, r * 0.72, 0, Math.PI * 2);
    ctx.arc(x + r * 1.65, y, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x + r * 0.45, y + r * 0.12, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMountains(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#7eb3c9';
    ctx.beginPath();
    ctx.moveTo(0, BG_H * 0.5);
    ctx.lineTo(BG_W * 0.14, BG_H * 0.36);
    ctx.lineTo(BG_W * 0.3, BG_H * 0.46);
    ctx.lineTo(BG_W * 0.48, BG_H * 0.33);
    ctx.lineTo(BG_W * 0.66, BG_H * 0.42);
    ctx.lineTo(BG_W * 0.84, BG_H * 0.35);
    ctx.lineTo(BG_W, BG_H * 0.48);
    ctx.lineTo(BG_W, BG_H * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9ec9db';
    ctx.beginPath();
    ctx.moveTo(0, BG_H * 0.54);
    ctx.lineTo(BG_W * 0.2, BG_H * 0.44);
    ctx.lineTo(BG_W * 0.4, BG_H * 0.5);
    ctx.lineTo(BG_W * 0.6, BG_H * 0.43);
    ctx.lineTo(BG_W, BG_H * 0.52);
    ctx.lineTo(BG_W, BG_H * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawVillage(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    const baseY = BG_H * 0.56;
    const houses = [
      { x: 55, w: 30, h: 24, roof: '#c45c3e' },
      { x: 98, w: 34, h: 28, roof: '#9a4e2a' },
      { x: 338, w: 32, h: 26, roof: '#b85c38' },
      { x: 382, w: 28, h: 22, roof: '#cd6b4a' },
    ];
    for (const h of houses) {
      ctx.fillStyle = '#faf0e0';
      ctx.fillRect(h.x, baseY - h.h, h.w, h.h);
      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.moveTo(h.x - 5, baseY - h.h);
      ctx.lineTo(h.x + h.w / 2, baseY - h.h - 15);
      ctx.lineTo(h.x + h.w + 5, baseY - h.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(h.x + h.w * 0.32, baseY - h.h * 0.55, 9, 9);
    }
    ctx.restore();
  }

  private drawTrees(ctx: CanvasRenderingContext2D, time: number): void {
    const trees = [
      { x: 36, type: 'mango', h: 138 },
      { x: 118, type: 'apple', h: 118 },
      { x: 198, type: 'orange', h: 128 },
      { x: 278, type: 'banana', h: 108 },
      { x: 358, type: 'mango', h: 132 },
      { x: 428, type: 'apple', h: 112 },
    ];
    const baseY = BG_H * 0.61;
    for (const t of trees) {
      const sway = Math.sin(time * 1.1 + t.x * 0.018) * 2.5;
      this.drawTree(ctx, t.x + sway, baseY, t.h, t.type);
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, type: string): void {
    ctx.fillStyle = '#5c3d1e';
    ctx.fillRect(x - 5, baseY - height * 0.44, 10, height * 0.44);
    const crownY = baseY - height * 0.48;
    const crownR = height * 0.36;
    let crown = '#2f9e4f';
    let fc = '#e63946';
    if (type === 'mango') { crown = '#3da858'; fc = '#f5a623'; }
    if (type === 'orange') { crown = '#34944a'; fc = '#ff8c42'; }
    if (type === 'banana') {
      ctx.fillStyle = '#d4a017';
      ctx.beginPath();
      ctx.ellipse(x + 14, crownY + 8, 7, 20, 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    const grad = ctx.createRadialGradient(x - crownR * 0.28, crownY - crownR * 0.22, 3, x, crownY, crownR);
    grad.addColorStop(0, '#6fd47a');
    grad.addColorStop(0.55, crown);
    grad.addColorStop(1, '#1a6b32');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, crownY, crownR, 0, Math.PI * 2);
    ctx.fill();
    if (type !== 'banana') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * crownR * 0.5, crownY + Math.sin(a) * crownR * 0.42, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawMarket(ctx: CanvasRenderingContext2D): void {
    const mx = BG_W * 0.36;
    const my = BG_H * 0.67;
    ctx.fillStyle = '#7a4f25';
    ctx.fillRect(mx, my - 48, 104, 48);
    ctx.fillStyle = '#9a5c2e';
    ctx.beginPath();
    ctx.moveTo(mx - 8, my - 48);
    ctx.lineTo(mx + 52, my - 70);
    ctx.lineTo(mx + 112, my - 48);
    ctx.closePath();
    ctx.fill();
    const crates = ['#e63946', '#ff8c42', '#ffd60a', '#22c55e'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#c49a6c';
      ctx.fillRect(mx + 10 + i * 23, my - 17, 17, 13);
      ctx.fillStyle = crates[i];
      ctx.beginPath();
      ctx.arc(mx + 18 + i * 23, my - 23, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const gy = BG_H * 0.71;
    const g = ctx.createLinearGradient(0, gy, 0, BG_H);
    g.addColorStop(0, '#65c466');
    g.addColorStop(0.35, '#4ade80');
    g.addColorStop(1, '#2d9a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, BG_W, BG_H - gy);
    ctx.strokeStyle = 'rgba(34, 120, 50, 0.28)';
    for (let i = 0; i < 16; i++) {
      const gx = (i * 53) % BG_W;
      const gyy = gy + 18 + (i * 17) % (BG_H - gy - 28);
      ctx.beginPath();
      ctx.moveTo(gx, gyy);
      ctx.quadraticCurveTo(gx + 2, gyy - 5, gx + 5, gyy);
      ctx.stroke();
    }
  }

  private drawFences(ctx: CanvasRenderingContext2D): void {
    const fy = BG_H * 0.73;
    ctx.strokeStyle = '#9a7b2e';
    ctx.lineWidth = 2.5;
    for (let x = 0; x < BG_W; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x, fy - 20);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, fy - 13);
    ctx.lineTo(BG_W, fy - 13);
    ctx.moveTo(0, fy - 5);
    ctx.lineTo(BG_W, fy - 5);
    ctx.stroke();
  }

  private drawFlowers(ctx: CanvasRenderingContext2D): void {
    const colors = ['#fb7185', '#fde047', '#fb923c', '#c084fc', '#fff'];
    const spots: [number, number][] = [
      [28, BG_H * 0.77], [88, BG_H * 0.81], [158, BG_H * 0.78],
      [248, BG_H * 0.82], [318, BG_H * 0.77], [398, BG_H * 0.8], [448, BG_H * 0.78],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [fx, fy] = spots[i];
      ctx.fillStyle = '#228b3a';
      ctx.fillRect(fx, fy, 2, 7);
      ctx.fillStyle = colors[i % colors.length];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + 1 + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(fx + 1, fy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawAmbient(ctx: CanvasRenderingContext2D, time: number): void {
    for (const l of this.leaves) {
      const ox = Math.sin(time * 1.4 + l.phase) * l.amp;
      const oy = Math.cos(time * 1.0 + l.phase) * l.amp * 0.45;
      ctx.save();
      ctx.translate(l.x + ox, l.y + oy);
      ctx.rotate(Math.sin(time + l.phase) * 0.28);
      ctx.fillStyle = `rgba(74, 180, 90, ${0.22 + Math.sin(l.phase) * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size * 0.38, l.size * 0.9, 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const b of this.butterflies) {
      const wing = Math.abs(Math.sin(b.wing)) * 5 + 2;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = `hsla(${b.hue}, 85%, 58%, 0.75)`;
      ctx.beginPath();
      ctx.ellipse(-wing, 0, wing, 3.5, -0.28, 0, Math.PI * 2);
      ctx.ellipse(wing, 0, wing, 3.5, 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const bird of this.birds) {
      const wing = Math.sin(bird.wing) * 4.5;
      ctx.strokeStyle = 'rgba(45, 45, 65, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bird.x - 7, bird.y);
      ctx.quadraticCurveTo(bird.x, bird.y - wing - 3, bird.x + 7, bird.y);
      ctx.stroke();
    }
    for (const p of this.pollen) {
      const dy = Math.sin(time * 0.55 + p.phase) * 7;
      ctx.fillStyle = `rgba(255, 248, 200, ${0.18 + Math.sin(p.phase) * 0.07})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y + dy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

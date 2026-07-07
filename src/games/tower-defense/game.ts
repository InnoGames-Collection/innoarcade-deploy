import { sfx } from '../../engine/audio';
import type { Action } from '../../engine/input';

export const W = 480;
export const H = 720;

interface Point { x: number; y: number; }

interface Enemy {
  x: number;
  y: number;
  pathIdx: number;
  hp: number;
  maxHp: number;
  speed: number;
}

interface Tower {
  x: number;
  y: number;
  type: 0 | 1;
  cooldown: number;
}

interface Shot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dmg: number;
}

const PATH: Point[] = [
  { x: 0, y: 360 }, { x: 120, y: 360 }, { x: 120, y: 200 },
  { x: 300, y: 200 }, { x: 300, y: 520 }, { x: 460, y: 520 },
];

const BUILD_SPOTS: Point[] = [
  { x: 180, y: 300 }, { x: 60, y: 300 }, { x: 180, y: 140 },
  { x: 240, y: 240 }, { x: 360, y: 160 }, { x: 360, y: 280 },
  { x: 240, y: 460 }, { x: 360, y: 460 }, { x: 240, y: 580 },
];

export type GameState = 'menu' | 'playing' | 'paused' | 'over';

export class TowerDefense {
  state: GameState = 'menu';
  score = 0;
  wave = 1;
  lives = 10;
  coins = 120;
  best = 0;

  onStateChange: (s: GameState) => void = () => {};
  onGameOver: (score: number, record: boolean) => void = () => {};

  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private shots: Shot[] = [];
  private spawnLeft = 0;
  private spawnTimer = 0;
  private waveBreak = 2;
  private selectedTower: 0 | 1 = 0;

  start(): void {
    this.score = 0;
    this.wave = 1;
    this.lives = 10;
    this.coins = 120;
    this.enemies = [];
    this.towers = [];
    this.shots = [];
    this.spawnLeft = 6;
    this.spawnTimer = 0.5;
    this.waveBreak = 1;
    this.setState('playing');
  }

  pause(): void {
    if (this.state === 'playing') this.setState('paused');
  }

  resume(): void {
    if (this.state === 'paused') this.setState('playing');
  }

  setTowerType(t: 0 | 1): void { this.selectedTower = t; }

  handleTap(x: number, y: number): boolean {
    if (this.state !== 'playing') return false;
    for (const spot of BUILD_SPOTS) {
      if (Math.hypot(spot.x - x, spot.y - y) > 36) continue;
      if (this.towers.some((t) => Math.hypot(t.x - spot.x, t.y - spot.y) < 8)) return false;
      const cost = this.selectedTower === 0 ? 50 : 90;
      if (this.coins < cost) return false;
      this.coins -= cost;
      this.towers.push({ x: spot.x, y: spot.y, type: this.selectedTower, cooldown: 0 });
      sfx.click();
      return true;
    }
    return false;
  }

  handleAction(a: Action): void {
    if (a === 'pause') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
  }

  private spawnEnemy(): void {
    const hp = 30 + this.wave * 12;
    this.enemies.push({
      x: PATH[0].x,
      y: PATH[0].y,
      pathIdx: 0,
      hp,
      maxHp: hp,
      speed: 55 + this.wave * 4,
    });
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnLeft--;
        this.spawnTimer = Math.max(0.35, 0.9 - this.wave * 0.04);
      }
    } else if (this.enemies.length === 0) {
      this.waveBreak -= dt;
      if (this.waveBreak <= 0) {
        this.wave++;
        this.spawnLeft = 5 + this.wave;
        this.spawnTimer = 0.6;
        this.waveBreak = 2.5;
        this.coins += 30 + this.wave * 5;
        if (this.wave > 12) {
          this.setState('over');
          this.onGameOver(this.score, this.score > this.best);
        }
      }
    }

    for (const e of this.enemies) {
      const next = PATH[Math.min(e.pathIdx + 1, PATH.length - 1)];
      const dx = next.x - e.x;
      const dy = next.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        if (e.pathIdx >= PATH.length - 2) {
          e.hp = 0;
          this.lives--;
          if (this.lives <= 0) {
            sfx.crash();
            this.setState('over');
            this.onGameOver(this.score, this.score > this.best);
            return;
          }
        } else {
          e.pathIdx++;
        }
      } else {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      }
    }

    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0 && e.pathIdx < PATH.length - 2) {
        this.score += 10 + this.wave;
        this.coins += 8;
        sfx.coin();
        return false;
      }
      return e.hp > 0;
    });

    for (const t of this.towers) {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      let best: Enemy | null = null;
      let bestD = Infinity;
      const range = t.type === 0 ? 110 : 150;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= range && d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        const dmg = t.type === 0 ? 18 : 32;
        this.shots.push({ x: t.x, y: t.y, tx: best.x, ty: best.y, dmg });
        t.cooldown = t.type === 0 ? 0.55 : 0.95;
      }
    }

    for (const s of this.shots) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy);
      const step = 320 * dt;
      if (dist <= step) {
        for (const e of this.enemies) {
          if (Math.hypot(e.x - s.tx, e.y - s.ty) < 20) {
            e.hp -= s.dmg;
            break;
          }
        }
        s.x = s.tx;
        s.y = s.ty;
      } else {
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
      }
    }
    this.shots = this.shots.filter((s) => Math.hypot(s.x - s.tx, s.y - s.ty) > 2);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2d4a2a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#c9a86c';
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();

    for (const spot of BUILD_SPOTS) {
      const occupied = this.towers.some((t) => Math.hypot(t.x - spot.x, t.y - spot.y) < 8);
      ctx.fillStyle = occupied ? 'rgba(0,0,0,0.2)' : 'rgba(79,158,22,0.35)';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const t of this.towers) {
      ctx.fillStyle = t.type === 0 ? '#5b8cff' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.type === 0 ? 'A' : 'C', t.x, t.y + 4);
    }

    for (const s of this.shots) {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this.enemies) {
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
      ctx.fill();
      const w = 28;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x - w / 2, e.y - 24, w, 5);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(e.x - w / 2, e.y - 24, w * (e.hp / e.maxHp), 5);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 88, W, 88);
    const btnW = W / 2 - 12;
    ctx.fillStyle = this.selectedTower === 0 ? '#4f9e16' : '#3a5a9c';
    ctx.fillRect(8, H - 80, btnW, 72);
    ctx.fillStyle = this.selectedTower === 1 ? '#4f9e16' : '#8c3a3a';
    ctx.fillRect(W / 2 + 4, H - 80, btnW, 72);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Archer 50', 8 + btnW / 2, H - 48);
    ctx.fillText('Cannon 90', W / 2 + 4 + btnW / 2, H - 48);
    ctx.font = '12px system-ui,sans-serif';
    ctx.fillText(`Coins: ${this.coins}`, W / 2, H - 18);
  }

  private setState(s: GameState): void {
    this.state = s;
    if (s === 'over' && this.score > this.best) this.best = this.score;
    this.onStateChange(s);
  }
}

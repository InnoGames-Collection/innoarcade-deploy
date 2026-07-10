import * as THREE from 'three';
import {
  BALL_CONTACT_R, RING_HEIGHT, RING_INNER, RING_R, THEME,
} from './constants';
import { createWedgeGeometry } from './geometry';
import { easeOutQuad } from './easing';

const POOL = 140;
const SHARD_POOL = 56;
const SPLAT_POOL = 24;

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: THREE.Color;
}

export class ParticleSystem {
  private readonly points: THREE.Points;
  private readonly pool: Particle[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private spawnBudget = 40;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(POOL * 3);
    this.colors = new Float32Array(POOL * 3);
    this.sizes = new Float32Array(POOL);

    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false, life: 0, maxLife: 1,
        px: 0, py: 0, pz: 0,
        vx: 0, vy: 0, vz: 0, size: 0.08,
        color: new THREE.Color(),
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  beginFrame(): void {
    this.spawnBudget = 40;
  }

  private spawn(
    x: number, y: number, z: number,
    color: THREE.Color,
    vx: number, vy: number, vz: number,
    size: number, life: number,
  ): boolean {
    if (this.spawnBudget <= 0) return false;
    for (const p of this.pool) {
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = life;
      p.px = x; p.py = y; p.pz = z;
      p.vx = vx; p.vy = vy; p.vz = vz;
      p.size = size;
      p.color.copy(color);
      this.spawnBudget--;
      return true;
    }
    return false;
  }

  burst(x: number, y: number, z: number, color: string | number, count = 14, spread = 5): void {
    const c = new THREE.Color(color);
    let spawned = 0;
    for (let i = 0; i < count && spawned < count; i++) {
      const a = (Math.PI * 2 * spawned) / count + Math.random() * 0.5;
      const sp = spread * (0.3 + Math.random() * 0.7);
      if (this.spawn(
        x, y, z, c,
        Math.cos(a) * sp,
        Math.random() * sp * 0.6 + 1.5,
        Math.sin(a) * sp * 0.35,
        0.06 + Math.random() * 0.1,
        0.35 + Math.random() * 0.35,
      )) spawned++;
    }
    this.syncBuffers();
  }

  emitLanding(x: number, y: number, z: number, color: string, impact: number): void {
    if (impact < 6) return;
    const c = new THREE.Color(color);
    const n = Math.min(2, 1 + Math.floor(impact / 12));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 0.8;
      this.spawn(x, y, z, c, Math.cos(a) * sp, Math.random() * 0.4, Math.sin(a) * sp * 0.25, 0.03, 0.2);
    }
    this.syncBuffers();
  }

  emitBreakDust(x: number, y: number, z: number, color: string, count = 10): void {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 4;
      this.spawn(x, y, z, c, Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp * 0.5, 0.07, 0.45);
    }
    this.syncBuffers();
  }

  comboBurst(x: number, y: number, z: number, mult: number): void {
    if (mult < 3) return;
    const hue = (mult * 0.12) % 1;
    const col = new THREE.Color().setHSL(hue, 0.85, 0.52);
    this.burst(x, y, z, col.getHex(), 4 + mult, 2.5 + mult * 0.3);
  }

  feverRing(x: number, y: number, z: number): void {
    this.burst(x, y, z, THEME.fever, 12, 5);
  }

  landing(x: number, y: number, z: number, color: string, impact = 8): void {
    this.emitLanding(x, y, z, color, impact);
  }

  confetti(x: number, y: number, z: number): void {
    const cols = ['#ff5c8a', '#00d4ff', '#ffd93d', '#7cff6b', '#ff8c42'];
    for (let i = 0; i < cols.length; i++) {
      this.burst(x, y + i * 0.2, z, cols[i], 16, 8);
    }
  }

  private syncBuffers(): void {
    let idx = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      this.positions[idx * 3] = p.px;
      this.positions[idx * 3 + 1] = p.py;
      this.positions[idx * 3 + 2] = p.pz;
      this.colors[idx * 3] = p.color.r;
      this.colors[idx * 3 + 1] = p.color.g;
      this.colors[idx * 3 + 2] = p.color.b;
      this.sizes[idx] = p.size;
      idx++;
    }
    for (let i = idx; i < POOL; i++) this.sizes[i] = 0;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    let idx = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;
      p.vy -= 12 * dt;
      this.positions[idx * 3] = p.px;
      this.positions[idx * 3 + 1] = p.py;
      this.positions[idx * 3 + 2] = p.pz;
      this.colors[idx * 3] = p.color.r;
      this.colors[idx * 3 + 1] = p.color.g;
      this.colors[idx * 3 + 2] = p.color.b;
      this.sizes[idx] = p.size * t;
      idx++;
    }
    for (let i = idx; i < POOL; i++) this.sizes[i] = 0;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.sizes.fill(0);
    (this.points.geometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Shard {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotV: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class SmashShards {
  private readonly group = new THREE.Group();
  private readonly pool: Shard[] = [];
  private readonly wedgeGeos: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    for (let i = 0; i < 6; i++) {
      this.wedgeGeos.push(createWedgeGeometry(0.22 + i * 0.08, i * 0.4));
    }

    for (let i = 0; i < SHARD_POOL; i++) {
      const geo = this.wedgeGeos[i % this.wedgeGeos.length];
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.35,
        metalness: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({
        mesh, vx: 0, vy: 0, vz: 0,
        rotV: new THREE.Vector3(),
        life: 0, maxLife: 1,
      });
    }
  }

  burst(
    relY: number,
    color: string,
    towerAngle: number,
    count = 14,
    contactAngle?: number,
  ): void {
    const c = new THREE.Color(color);
    const span = RING_R - RING_INNER;
    const origin = contactAngle ?? towerAngle + Math.PI / 2;
    let spawned = 0;
    for (const s of this.pool) {
      if (s.life > 0 && s.life < s.maxLife) continue;
      const angle = origin + (spawned / count - 0.5) * 1.2 + (Math.random() - 0.5) * 0.5;
      const dist = RING_INNER + span * (0.2 + Math.random() * 0.75);
      s.mesh.position.set(
        Math.cos(angle) * dist,
        relY + (Math.random() - 0.5) * 0.12,
        Math.sin(angle) * dist,
      );
      s.mesh.rotation.set(Math.random() * Math.PI, angle, Math.random() * 0.4);
      const outward = 3 + Math.random() * 5;
      s.vx = Math.cos(angle) * outward;
      s.vy = 2 + Math.random() * 5;
      s.vz = Math.sin(angle) * outward * 0.85;
      s.rotV.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
      );
      s.life = 0.001;
      s.maxLife = 0.55 + Math.random() * 0.4;
      (s.mesh.material as THREE.MeshStandardMaterial).color.copy(c);
      s.mesh.scale.setScalar(0.65 + Math.random() * 0.75);
      s.mesh.visible = true;
      spawned++;
      if (spawned >= count) break;
    }
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.mesh.visible = false;
        s.life = 0;
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      const scale = easeOutQuad(t);
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 18 * dt;
      s.vx *= 0.98;
      s.vz *= 0.98;
      s.mesh.rotation.x += s.rotV.x * dt;
      s.mesh.rotation.y += s.rotV.y * dt;
      s.mesh.rotation.z += s.rotV.z * dt;
      s.mesh.scale.setScalar(scale * 0.95);
    }
  }

  clear(): void {
    for (const s of this.pool) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }
}

interface Splat {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class LandingSplats {
  private readonly pool: Splat[] = [];
  private readonly geo = new THREE.CircleGeometry(0.48, 24);

  constructor() {
    for (let i = 0; i < SPLAT_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 5;
      this.pool.push({ mesh, life: 0, maxLife: 1 });
    }
  }

  place(parent: THREE.Group, color: string, contactAngle: number): void {
    for (const s of this.pool) {
      if (s.life > 0 && s.life < s.maxLife) continue;
      if (s.mesh.parent && s.mesh.parent !== parent) s.mesh.parent.remove(s.mesh);
      parent.add(s.mesh);
      const jitter = (Math.random() - 0.5) * 0.1;
      s.mesh.position.set(
        Math.cos(contactAngle) * BALL_CONTACT_R + jitter,
        RING_HEIGHT * 0.48,
        Math.sin(contactAngle) * BALL_CONTACT_R + jitter * 0.6,
      );
      s.mesh.rotation.z = Math.random() * Math.PI * 2;
      const scale = 0.72 + Math.random() * 0.28;
      s.mesh.scale.set(scale, scale, 1);
      (s.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.82;
      s.mesh.visible = true;
      s.life = 0.001;
      s.maxLife = 999;
      return;
    }
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (s.life <= 0) continue;
      s.life += dt;
      // Paint splats stay until platform recycles (cleared via clear()).
    }
  }

  clear(): void {
    for (const s of this.pool) {
      s.life = 0;
      s.mesh.visible = false;
      s.mesh.removeFromParent();
    }
  }
}

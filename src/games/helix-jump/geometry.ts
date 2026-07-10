import * as THREE from 'three';
import { RING_COLORS, RING_HEIGHT, RING_INNER, RING_THICKNESS, RING_R, THEME } from './constants';

const PLATFORM_OUTER = RING_R + RING_THICKNESS * 0.5;
const PLATFORM_INNER = RING_INNER;
const GEO_CACHE = new Map<string, THREE.BufferGeometry>();

function geoKey(start: number, arc: number): string {
  return `${RING_INNER.toFixed(2)}_${start.toFixed(3)}_${arc.toFixed(3)}`;
}

export function platformArc(gapArc: number): number {
  return Math.PI * 2 - gapArc;
}

export function createPlatformGeometry(startAngle: number, arcLength: number): THREE.BufferGeometry {
  const key = geoKey(startAngle, arcLength);
  const cached = GEO_CACHE.get(key);
  if (cached) return cached;

  const segments = Math.max(16, Math.ceil(arcLength * 8));
  const shape = new THREE.Shape();
  const outerPts: THREE.Vector2[] = [];
  const innerPts: THREE.Vector2[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + arcLength * t;
    outerPts.push(new THREE.Vector2(Math.cos(a) * PLATFORM_OUTER, Math.sin(a) * PLATFORM_OUTER));
  }
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const a = startAngle + arcLength * t;
    innerPts.push(new THREE.Vector2(Math.cos(a) * PLATFORM_INNER, Math.sin(a) * PLATFORM_INNER));
  }

  shape.moveTo(outerPts[0].x, outerPts[0].y);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i].x, outerPts[i].y);
  for (const p of innerPts) shape.lineTo(p.x, p.y);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: RING_HEIGHT,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: segments,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -RING_HEIGHT * 0.5, 0);
  geo.computeVertexNormals();

  if (GEO_CACHE.size > 80) {
    const first = GEO_CACHE.keys().next().value;
    if (first) {
      GEO_CACHE.get(first)?.dispose();
      GEO_CACHE.delete(first);
    }
  }
  GEO_CACHE.set(key, geo);
  return geo;
}

export function createWedgeGeometry(arcLength: number, startAngle = 0): THREE.BufferGeometry {
  return createPlatformGeometry(startAngle, Math.max(0.18, Math.min(0.75, arcLength)));
}

export function makePlatformMaterial(color: THREE.Color, danger = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: danger ? 0.28 : 0.38,
    metalness: danger ? 0.06 : 0.04,
    emissive: color.clone().multiplyScalar(danger ? 0.06 : 0.04),
    emissiveIntensity: danger ? 0.25 : 0.12,
  });
}
export function ringColor(index: number, danger: boolean): THREE.Color {
  if (danger) return new THREE.Color(THEME.danger);
  return new THREE.Color(RING_COLORS[Math.abs(index) % RING_COLORS.length]);
}

export function makeGradientBackground(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, THEME.bgTop);
  g.addColorStop(0.42, THEME.bgMid);
  g.addColorStop(1, THEME.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function clearGeometryCache(): void {
  for (const g of GEO_CACHE.values()) g.dispose();
  GEO_CACHE.clear();
}

export { PLATFORM_INNER, PLATFORM_OUTER };

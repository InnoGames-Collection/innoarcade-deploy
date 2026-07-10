import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  BALL_R, BALL_SCREEN_Y, BALL_WORLD_X, BALL_WORLD_Z,
  H, PILLAR_HEIGHT, PILLAR_R, THEME, W,
} from './constants';
import {
  BallTrail, BokehField, LandingSplats, ParticleSystem, SmashShards, SpeedLines,
} from './effects';
import { approachZone, ballAngle, breakAnimScale } from './physics';
import {
  createPlatformGeometry, makeGradientBackground, makePlatformMaterial,
  platformArc, ringAccentColor, ringColor,
} from './geometry';
import { ringWorldY } from './towerGenerator';
import type { BallState, Ring } from './types';
import type { BallSkin } from './skins';
import { CameraController } from './camera';

interface RingVisual {
  ringId: number;
  safeKey: string;
  dangerKey: string;
  group: THREE.Group;
  safeMesh: THREE.Mesh;
  safeMat: THREE.MeshStandardMaterial;
  dangerMesh: THREE.Mesh;
  dangerMat: THREE.MeshStandardMaterial;
}

const USE_BLOOM = false;

export class HelixWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly cameraCtrl: CameraController;
  readonly particles: ParticleSystem;
  readonly shards: SmashShards;
  readonly trail: BallTrail;
  readonly splats: LandingSplats;
  readonly speedLines: SpeedLines;
  readonly bokeh: BokehField;

  private readonly helix = new THREE.Group();
  private readonly tower = new THREE.Group();
  private readonly ballRig = new THREE.Group();
  private readonly ball: THREE.Mesh;
  private readonly ballHalo: THREE.Mesh;
  private readonly ballMat: THREE.MeshStandardMaterial;
  private readonly ballGlow: THREE.PointLight;
  private readonly ballShadow: THREE.Mesh;
  private readonly pillar: THREE.Mesh;
  private readonly ringPool: RingVisual[] = [];
  private readonly freeRings: RingVisual[] = [];
  private feverLight = 0;
  private flashMesh: THREE.Mesh | null = null;
  private flashOpacity = 0;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = makeGradientBackground();
    this.scene.fog = new THREE.Fog(0x6b4a7a, 18, 58);

    this.cameraCtrl = new CameraController(W / H);

    const amb = new THREE.AmbientLight(0xffffff, 0.68);
    this.scene.add(amb);

    const hemi = new THREE.HemisphereLight(0xb8e4ff, 0xffd6ec, 0.58);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff8f0, 1.2);
    sun.position.set(6, 14, 10);
    sun.castShadow = true;
    const shadowRes = dpr > 1.5 ? 512 : 1024;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xc8e8ff, 0.38);
    fill.position.set(-8, 6, -6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd6ec, 0.25);
    rim.position.set(0, 4, -10);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({
        color: 0xf0e8ff,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0.35,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(PILLAR_R, PILLAR_R * 1.02, PILLAR_HEIGHT, 28),
      new THREE.MeshStandardMaterial({
        color: THEME.pillar,
        roughness: 0.32,
        metalness: 0.12,
        emissive: THEME.pillarGlow,
        emissiveIntensity: 0.12,
      }),
    );
    this.pillar.castShadow = true;
    this.pillar.receiveShadow = true;
    this.pillar.position.y = 0;
    this.helix.add(this.pillar);
    this.helix.add(this.tower);
    this.scene.add(this.helix);

    this.ballRig.position.set(BALL_WORLD_X, BALL_SCREEN_Y, BALL_WORLD_Z);
    this.scene.add(this.ballRig);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 0.95, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.set(BALL_WORLD_X, BALL_SCREEN_Y - BALL_R - 0.05, BALL_WORLD_Z);
    this.ballShadow.renderOrder = 5;
    this.scene.add(this.ballShadow);

    const ballGeo = new THREE.SphereGeometry(BALL_R, 36, 36);
    this.ballMat = new THREE.MeshStandardMaterial({
      color: 0xb24bf3,
      roughness: 0.1,
      metalness: 0.06,
      emissive: 0x3a1060,
      emissiveIntensity: 0.32,
    });
    this.ball = new THREE.Mesh(ballGeo, this.ballMat);
    this.ball.castShadow = true;
    this.ball.receiveShadow = false;
    this.ball.renderOrder = 30;
    this.ball.position.set(0, 0, 0);
    this.ballRig.add(this.ball);

    this.ballHalo = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.38, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.ballHalo.renderOrder = 28;
    this.ballHalo.position.set(0, 0, -0.02);
    this.ballRig.add(this.ballHalo);

    this.ballGlow = new THREE.PointLight(0xb24bf3, 0.85, 6);
    this.ballGlow.position.z = 0.2;
    this.ball.add(this.ballGlow);

    this.bokeh = new BokehField(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.shards = new SmashShards(this.scene);
    this.trail = new BallTrail();
    this.ballRig.add(this.trail.group);
    this.speedLines = new SpeedLines(this.ballRig);
    this.splats = new LandingSplats();

    const flashGeo = new THREE.PlaneGeometry(40, 60);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    this.flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh.position.set(0, 0, 8);
    this.flashMesh.renderOrder = 999;
    this.scene.add(this.flashMesh);

    if (USE_BLOOM) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.cameraCtrl.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), 0.28, 0.45, 0.72);
      this.composer.addPass(this.bloomPass);
    }

    for (let i = 0; i < 28; i++) this.freeRings.push(this.createRingVisual());
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.cameraCtrl.resize(W / H);
    this.composer?.setSize(W, H);
  }

  private createRingVisual(): RingVisual {
    const safeGeo = createPlatformGeometry(0, Math.PI * 1.6);
    const safeCol = ringColor(0, false);
    const safeMat = makePlatformMaterial(safeCol, false);
    const safeMesh = new THREE.Mesh(safeGeo, safeMat);
    safeMesh.castShadow = true;
    safeMesh.receiveShadow = true;

    const dangerGeo = createPlatformGeometry(0, 0.5);
    const dangerCol = ringColor(-1, true);
    const dangerMat = makePlatformMaterial(dangerCol, true);
    const dangerMesh = new THREE.Mesh(dangerGeo, dangerMat);
    dangerMesh.castShadow = true;
    dangerMesh.receiveShadow = true;
    dangerMesh.position.y = 0.015;
    dangerMesh.visible = false;

    const group = new THREE.Group();
    group.add(safeMesh);
    group.add(dangerMesh);

    return {
      ringId: -1,
      safeKey: '',
      dangerKey: '',
      group,
      safeMesh,
      safeMat,
      dangerMesh,
      dangerMat,
    };
  }

  syncRings(
    rings: Ring[],
    _gapArc: number,
    ballY: number,
    time: number,
    towerAngle: number,
    approachId = -1,
  ): void {
    this.helix.position.set(0, 0, 0);

    const activeIds = new Set(rings.filter((r) => !r.broken || r.breakAnim < 1).map((r) => r.id));

    for (let i = this.ringPool.length - 1; i >= 0; i--) {
      const rv = this.ringPool[i];
      if (!activeIds.has(rv.ringId)) {
        this.tower.remove(rv.group);
        this.freeRings.push(rv);
        this.ringPool.splice(i, 1);
      }
    }

    for (const ring of rings) {
      if (ring.broken && ring.breakAnim >= 1) continue;
      let rv = this.ringPool.find((r) => r.ringId === ring.id);
      if (!rv) {
        rv = this.freeRings.pop() ?? this.createRingVisual();
        rv.ringId = ring.id;
        this.ringPool.push(rv);
        this.tower.add(rv.group);
      }

      const solid = platformArc(ring.gapArc);
      const safeStart = ring.gapStart + ring.gapArc;
      const safeKey = `${safeStart.toFixed(3)}_${solid.toFixed(3)}`;
      if (rv.safeKey !== safeKey) {
        rv.safeKey = safeKey;
        rv.safeMesh.geometry = createPlatformGeometry(safeStart, solid);
      }

      const safeCol = ringColor(ring.colorIndex, false);
      const accentCol = ringAccentColor(ring.colorIndex);
      const phase = ring.id * 0.62;
      const breathe = 0.09 + Math.sin(time * 2.6 + phase) * 0.045;

      rv.safeMat.color.copy(safeCol);
      rv.safeMat.emissive.copy(accentCol);
      rv.safeMat.emissiveIntensity = 0.11 + breathe;

      if (ring.dangerArc > 0) {
        const dKey = `${ring.dangerStart.toFixed(3)}_${ring.dangerArc.toFixed(3)}`;
        if (rv.dangerKey !== dKey) {
          rv.dangerKey = dKey;
          rv.dangerMesh.geometry = createPlatformGeometry(ring.dangerStart, ring.dangerArc);
        }
        const dangerPulse = 0.26 + Math.sin(time * 5.5 + phase * 1.3) * 0.14;
        rv.dangerMat.color.set(THEME.danger);
        rv.dangerMat.emissive.set(THEME.danger);
        rv.dangerMat.emissiveIntensity = dangerPulse;
        rv.dangerMesh.visible = true;
      } else {
        rv.dangerKey = '';
        rv.dangerMesh.visible = false;
      }

      const isApproach = ring.id === approachId;
      const zone = isApproach ? approachZone(ring, towerAngle) : 'none';

      if (isApproach) {
        const alert = 0.5 + 0.5 * Math.sin(time * 9.5);
        if (zone === 'gap') {
          rv.safeMat.emissive.set(THEME.accent);
          rv.safeMat.emissiveIntensity = 0.22 + alert * 0.18;
        } else if (zone === 'danger') {
          rv.dangerMat.emissive.set(THEME.danger);
          rv.dangerMat.emissiveIntensity = 0.42 + alert * 0.22;
        } else if (zone === 'safe') {
          rv.safeMat.emissive.copy(accentCol);
          rv.safeMat.emissiveIntensity = 0.16 + alert * 0.1;
        }
      }

      rv.group.position.y = ballY - ringWorldY(ring, time);
      if (ring.broken) {
        const scale = breakAnimScale(ring.breakAnim);
        rv.group.scale.set(scale, scale, scale);
        const fade = 1 - ring.breakAnim * 0.85;
        rv.safeMat.opacity = fade;
        rv.safeMat.transparent = true;
        rv.dangerMat.opacity = fade;
        rv.dangerMat.transparent = true;
      } else {
        rv.group.scale.set(1, 1, 1);
        rv.safeMat.opacity = 1;
        rv.safeMat.transparent = false;
        rv.dangerMat.opacity = 1;
        rv.dangerMat.transparent = false;
      }
    }
  }

  updateBall(ball: BallState, skin: BallSkin, fever: boolean, dt: number, combo = 0): void {
    this.ballRig.position.set(BALL_WORLD_X, BALL_SCREEN_Y, BALL_WORLD_Z);
    this.ballShadow.position.set(BALL_WORLD_X, BALL_SCREEN_Y - BALL_R - 0.05, BALL_WORLD_Z);
    const shadowScale = 1 + Math.min(0.2, Math.abs(ball.vy) * 0.008);
    this.ballShadow.scale.set(shadowScale, shadowScale, 1);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity =
      0.18 + Math.min(0.1, Math.abs(ball.vy) * 0.004);
    this.ball.position.set(0, 0, 0);
    this.ballHalo.position.set(0, 0, -0.02);

    let sx = 1;
    let sy = 1;
    if (ball.squash < 0.94) {
      const flat = ball.squash;
      sx = 1 + (1 - flat) * 0.2;
      sy = flat + (1 - flat) * 0.04;
    } else if (ball.vy > 1.8) {
      const st = ball.stretch;
      sy = 1 + st;
      sx = 1 - st * 0.38;
    } else if (ball.vy < -1.8) {
      const st = Math.min(0.1, Math.abs(ball.vy) / 32);
      sy = 1 + st * 0.45;
      sx = 1 - st * 0.22;
    }
    this.ball.scale.set(sx, sy, sx);
    this.ballHalo.scale.set(sx * 1.05, sy * 1.05, sx * 1.05);
    this.ball.rotation.x = ball.rollAngle * 0.35;
    this.ball.rotation.z = ball.vy > 0 ? ball.rollAngle * 0.12 : -ball.rollAngle * 0.2;

    const col = new THREE.Color(skin.color);
    this.ballMat.color.copy(col);
    if (fever) {
      this.feverLight = Math.min(1, this.feverLight + dt * 3);
      this.ballMat.emissive.set(THEME.fever);
      this.ballMat.emissiveIntensity = 0.55 + Math.sin(performance.now() * 0.014) * 0.15;
      this.ballGlow.color.set(THEME.fever);
      this.ballGlow.intensity = 1.8;
      (this.ballHalo.material as THREE.MeshBasicMaterial).color.set(THEME.fever);
      (this.ballHalo.material as THREE.MeshBasicMaterial).opacity = 0.22 + this.feverLight * 0.12;
      if (this.bloomPass) this.bloomPass.strength = 0.48;
    } else {
      this.feverLight = Math.max(0, this.feverLight - dt * 4);
      this.ballMat.emissive.copy(col).multiplyScalar(0.22);
      this.ballMat.emissiveIntensity = 0.2 + Math.min(0.15, combo * 0.02);
      this.ballGlow.color.copy(col);
      this.ballGlow.intensity = 0.75 + Math.min(0.35, Math.abs(ball.vy) * 0.025);
      (this.ballHalo.material as THREE.MeshBasicMaterial).color.copy(col);
      const fallGlow = ball.vy > 3 ? Math.min(0.2, (ball.vy - 3) * 0.018) : 0;
      (this.ballHalo.material as THREE.MeshBasicMaterial).opacity = 0.1 + fallGlow;
      if (this.bloomPass) this.bloomPass.strength = 0.3 + Math.min(0.08, Math.abs(ball.vy) * 0.003);
    }

    this.trail.push(ball.vy, skin.color, combo, fever);
    this.speedLines.setIntensity(combo, fever, ball.vy);
  }

  addLandingSplat(ringId: number, color: string, towerAngle: number): void {
    const rv = this.ringPool.find((r) => r.ringId === ringId);
    if (!rv) return;
    this.splats.place(rv.group, color, ballAngle(towerAngle));
  }

  ringOffset(ballY: number, ringY: number): number {
    return ballY - ringY;
  }

  /** Scene Y of a gameplay ring relative to the fixed ball. */
  ringScreenY(ballY: number, ringY: number): number {
    return ballY - ringY;
  }

  setTowerAngle(angle: number): void {
    this.helix.rotation.y = -angle;
  }

  flash(color: string, amount: number): void {
    if (!this.flashMesh) return;
    (this.flashMesh.material as THREE.MeshBasicMaterial).color.set(color);
    this.flashOpacity = Math.max(this.flashOpacity, amount);
  }

  updateEffects(dt: number): void {
    this.particles.beginFrame();
    this.particles.update(dt);
    this.shards.update(dt);
    this.trail.update(dt);
    this.speedLines.update(dt);
    this.splats.update(dt);
    this.bokeh.update(dt);

    if (this.flashMesh && this.flashOpacity > 0) {
      this.flashOpacity = Math.max(0, this.flashOpacity - dt * 2.8);
      (this.flashMesh.material as THREE.MeshBasicMaterial).opacity = this.flashOpacity * 0.45;
    }
  }

  render(): void {
    this.cameraCtrl.applyView();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.cameraCtrl.camera);
  }

  clear(): void {
    this.particles.clear();
    this.shards.clear();
    this.trail.clear();
    this.speedLines.clear();
    this.splats.clear();
    for (const rv of this.ringPool) {
      this.tower.remove(rv.group);
      this.freeRings.push(rv);
    }
    this.ringPool.length = 0;
    this.feverLight = 0;
    this.flashOpacity = 0;
  }

  dispose(): void {
    this.renderer.dispose();
    this.composer?.dispose();
    this.clear();
  }
}

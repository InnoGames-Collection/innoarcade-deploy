// Adaptive render quality — auto-detect device tier, optional runtime downgrade.

export type QualityTier = 'high' | 'medium' | 'low';

export interface RenderQuality {
  tier: QualityTier;
  maxDpr: number;
  rowsBehind: number;
  rowsAhead: number;
  splitTerrainPasses: boolean;
  grassDecor: boolean;
  grassBlades: boolean;
  roadDetails: boolean;
  riverDetails: boolean;
  entityShadows: boolean;
  mountainLayers: number;
  cloudCount: number;
  simpleVoxels: boolean;
  mountainStep: number;
}

const PRESETS: Record<QualityTier, RenderQuality> = {
  high: {
    tier: 'high',
    maxDpr: 2,
    rowsBehind: 12,
    rowsAhead: 16,
    splitTerrainPasses: true,
    grassDecor: true,
    grassBlades: true,
    roadDetails: true,
    riverDetails: true,
    entityShadows: true,
    mountainLayers: 3,
    cloudCount: 4,
    simpleVoxels: false,
    mountainStep: 8,
  },
  medium: {
    tier: 'medium',
    maxDpr: 2,
    rowsBehind: 10,
    rowsAhead: 14,
    splitTerrainPasses: true,
    grassDecor: true,
    grassBlades: false,
    roadDetails: true,
    riverDetails: true,
    entityShadows: true,
    mountainLayers: 2,
    cloudCount: 2,
    simpleVoxels: false,
    mountainStep: 12,
  },
  low: {
    tier: 'low',
    maxDpr: 1.5,
    rowsBehind: 8,
    rowsAhead: 12,
    splitTerrainPasses: false,
    grassDecor: false,
    grassBlades: false,
    roadDetails: false,
    riverDetails: false,
    entityShadows: false,
    mountainLayers: 1,
    cloudCount: 0,
    simpleVoxels: true,
    mountainStep: 16,
  },
};

const TIER_ORDER: QualityTier[] = ['high', 'medium', 'low'];

function detectInitialTier(): QualityTier {
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  if (!mobile && cores >= 6 && dpr <= 2 && (mem === undefined || mem >= 4)) {
    return 'high';
  }
  if (cores >= 4 && dpr <= 2.5 && (mem === undefined || mem >= 3)) {
    return 'medium';
  }
  return 'low';
}

let activeTier: QualityTier = detectInitialTier();

let frameSamples = 0;
let frameMsTotal = 0;
let downgradeCooldown = 0;

export function getRenderQuality(): Readonly<RenderQuality> {
  return PRESETS[activeTier];
}

export function getQualityTier(): QualityTier {
  return activeTier;
}

export function getMaxDpr(): number {
  return PRESETS[activeTier].maxDpr;
}

/** Feed frame delta (seconds) for adaptive downgrade on sustained slow frames. */
export function reportFrameTime(dt: number): void {
  if (downgradeCooldown > 0) {
    downgradeCooldown -= dt;
    return;
  }
  if (activeTier === 'low') return;

  frameSamples += 1;
  frameMsTotal += dt * 1000;

  if (frameSamples < 90) return;

  const avgMs = frameMsTotal / frameSamples;
  frameSamples = 0;
  frameMsTotal = 0;

  if (avgMs > 20) downgradeTier();
}

function downgradeTier(): void {
  const idx = TIER_ORDER.indexOf(activeTier);
  if (idx >= TIER_ORDER.length - 1) return;
  activeTier = TIER_ORDER[idx + 1]!;
  downgradeCooldown = 4;
  frameSamples = 0;
  frameMsTotal = 0;
}

export function resetQualityTier(): void {
  activeTier = detectInitialTier();
  frameSamples = 0;
  frameMsTotal = 0;
  downgradeCooldown = 0;
}

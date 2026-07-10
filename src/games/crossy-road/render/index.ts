// Renderer dispatch — premium isometric vs legacy flat.

import { PREMIUM_RENDER } from '../types';
import type { WorldSnapshot } from '../types';
import { renderLegacy } from './legacyRenderer';
import { renderPremium } from './premiumRenderer';

export function renderWorld(ctx: CanvasRenderingContext2D, snapshot: WorldSnapshot): void {
  if (PREMIUM_RENDER) renderPremium(ctx, snapshot);
  else renderLegacy(ctx, snapshot);
}

export { renderLegacy, renderPremium };

// Premium renderer — classic layout (horizontal roads, vertical hops) + voxel polish.

import {
  classicCellCorners,
  classicEntityY,
  classicGridToScreen,
  classicPaintDepth,
  classicPlayerCenter,
} from '../classic';
import {
  CELL,
  COLS,
  hopProgress,
  rowAt,
  type WorldSnapshot,
} from '../types';
import { hopArcHeight, hopSquash } from './animation';
import { drawBackground } from './background';
import { drawEagleSwoop } from './eagle';
import { drawGrassDecor } from './decorations';
import { getRenderQuality } from './quality';
import { drawTerrainCell } from './terrain';
import { drawPremiumHud } from './ui';
import {
  drawDropShadow,
  drawVoxelChicken,
  drawVoxelCoin,
  drawVoxelLog,
  drawVoxelVehicle,
} from './voxel';

const ENTITY_UNIT = CELL * 0.92;

type DrawItem = { depth: number; draw: () => void };
const terrainQueue: DrawItem[] = [];
const entityQueue: DrawItem[] = [];

export function renderPremium(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  const quality = getRenderQuality();
  drawBackground(ctx, s, quality);

  const camZ = s.camZ;
  const bob = s.camBob;
  const t = hopProgress(s.hopT);

  terrainQueue.length = 0;
  entityQueue.length = 0;

  const zMin = s.pz - quality.rowsBehind;
  const zMax = s.pz + quality.rowsAhead;
  const terrainDetail = {
    grassBlades: quality.grassBlades,
    roadDetails: quality.roadDetails,
    riverDetails: quality.riverDetails,
  };

  // Pass 1 — terrain (sorted by screen Y)
  for (let z = zMin; z <= zMax; z++) {
    const row = rowAt(s.rows, z);
    const isStart = z <= 0;
    const rowY = classicEntityY(z, camZ, bob);
    for (let col = 0; col < COLS; col++) {
      const corners = classicCellCorners(col, z, camZ, bob);
      const depth = classicPaintDepth(rowY, col);
      const opts = { isStart, animT: s.animT, col, row: z, ...terrainDetail };

      if (quality.splitTerrainPasses) {
        terrainQueue.push({
          depth,
          draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, sidesOnly: true }),
        });
        terrainQueue.push({
          depth: depth + 0.01,
          draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, topOnly: true }),
        });
      } else {
        terrainQueue.push({
          depth,
          draw: () => drawTerrainCell(ctx, corners, row.kind, opts),
        });
      }

      if (quality.grassDecor && row.kind === 'grass') {
        terrainQueue.push({
          depth: depth + 0.02,
          draw: () => drawGrassDecor(ctx, col, z, camZ, bob, s.animT, isStart),
        });
      }
    }
  }

  terrainQueue.sort((a, b) => a.depth - b.depth);
  for (let i = 0; i < terrainQueue.length; i++) terrainQueue[i]!.draw();

  // Pass 2 — entities always above terrain
  const simpleVoxels = quality.simpleVoxels;
  const shadows = quality.entityShadows;

  for (const coin of s.coins) {
    if (coin.row < zMin || coin.row > zMax) continue;
    const center = classicGridToScreen(coin.col + 0.5, coin.row, camZ, bob);
    entityQueue.push({
      depth: classicPaintDepth(center.y, coin.col),
      draw: () => drawVoxelCoin(ctx, center.x, center.y, ENTITY_UNIT, s.animT, coin.col, simpleVoxels),
    });
  }

  for (const c of s.cars) {
    if (c.row < zMin || c.row > zMax) continue;
    const cx = c.x + c.w * 0.5;
    const cy = classicEntityY(c.row, camZ, bob);
    const gridSpan = c.w / CELL;
    const facingRight = c.speed > 0;
    entityQueue.push({
      depth: classicPaintDepth(cy, cx),
      draw: () => {
        if (shadows) {
          drawDropShadow(ctx, cx, cy + CELL * 0.22, gridSpan * CELL * 0.38, CELL * 0.08);
        }
        drawVoxelVehicle(
          ctx, cx, cy, gridSpan, c.kind, facingRight, ENTITY_UNIT, s.animT, simpleVoxels,
        );
      },
    });
  }

  for (const l of s.logs) {
    if (l.row < zMin || l.row > zMax) continue;
    const cx = l.x + l.w * 0.5;
    const cy = classicEntityY(l.row, camZ, bob);
    const gridSpan = l.w / CELL;
    const gridCx = cx / CELL;
    entityQueue.push({
      depth: classicPaintDepth(cy, cx),
      draw: () => {
        if (shadows) {
          drawDropShadow(ctx, cx, cy + CELL * 0.2, gridSpan * CELL * 0.36, CELL * 0.07);
        }
        drawVoxelLog(ctx, cx, cy, gridSpan, ENTITY_UNIT, s.animT, gridCx, simpleVoxels);
      },
    });
  }

  const playerCenter = classicPlayerCenter(s);
  const arcZ = hopArcHeight(t, CELL * 0.5);
  const squash = hopSquash(t);
  const shadowAlpha = s.hopT > 0 ? 0.12 + (1 - t) * 0.1 : 0.28;

  if (shadows) {
    entityQueue.push({
      depth: classicPaintDepth(playerCenter.y, playerCenter.x) - 0.01,
      draw: () => drawDropShadow(
        ctx,
        playerCenter.x,
        playerCenter.y + CELL * 0.24,
        CELL * 0.24,
        CELL * 0.1,
        shadowAlpha,
      ),
    });
  }

  if (s.eagleT <= 0) {
    entityQueue.push({
      depth: classicPaintDepth(playerCenter.y, playerCenter.x),
      draw: () => drawVoxelChicken(
        ctx,
        playerCenter.x,
        playerCenter.y,
        ENTITY_UNIT,
        arcZ,
        squash,
        s.animT,
        simpleVoxels,
      ),
    });
  }

  entityQueue.sort((a, b) => a.depth - b.depth);
  for (let i = 0; i < entityQueue.length; i++) entityQueue[i]!.draw();

  drawPremiumHud(ctx, s);

  if (s.eagleT > 0) {
    drawEagleSwoop(ctx, s, playerCenter.x, playerCenter.y - arcZ * 0.5);
  }
}

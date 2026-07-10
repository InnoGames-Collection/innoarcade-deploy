// Premium renderer — classic layout (horizontal roads, vertical hops) + voxel polish.

import {
  classicCellCorners,
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

const ENTITY_UNIT = CELL * 0.55;

type DrawItem = { depth: number; draw: () => void };
const drawQueue: DrawItem[] = [];

export function renderPremium(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  const quality = getRenderQuality();
  drawBackground(ctx, s, quality);

  const camZ = s.camZ;
  const bob = s.camBob;
  const t = hopProgress(s.hopT);

  drawQueue.length = 0;

  const zMin = s.pz - quality.rowsBehind;
  const zMax = s.pz + quality.rowsAhead;
  const terrainDetail = {
    grassBlades: quality.grassBlades,
    roadDetails: quality.roadDetails,
    riverDetails: quality.riverDetails,
  };

  for (let z = zMin; z <= zMax; z++) {
    const row = rowAt(s.rows, z);
    const isStart = z <= 0;
    for (let col = 0; col < COLS; col++) {
      const corners = classicCellCorners(col, z, camZ, bob);
      const depth = classicPaintDepth(z, col);
      const opts = { isStart, animT: s.animT, col, row: z, ...terrainDetail };

      if (quality.splitTerrainPasses) {
        drawQueue.push({
          depth,
          draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, sidesOnly: true }),
        });
        drawQueue.push({
          depth: depth + 0.02,
          draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, topOnly: true }),
        });
      } else {
        drawQueue.push({
          depth,
          draw: () => drawTerrainCell(ctx, corners, row.kind, opts),
        });
      }

      if (quality.grassDecor && row.kind === 'grass') {
        drawQueue.push({
          depth: depth + 0.03,
          draw: () => drawGrassDecor(ctx, col, z, camZ, bob, s.animT, isStart),
        });
      }
    }
  }

  for (const coin of s.coins) {
    if (coin.row < zMin || coin.row > zMax) continue;
    const center = classicGridToScreen(coin.col + 0.5, coin.row + 0.5, camZ, bob);
    const depth = classicPaintDepth(coin.row, coin.col) + 0.15;
    drawQueue.push({
      depth,
      draw: () => drawVoxelCoin(ctx, center.x, center.y, ENTITY_UNIT, s.animT, coin.col),
    });
  }

  const simpleVoxels = quality.simpleVoxels;
  const shadows = quality.entityShadows;

  for (const c of s.cars) {
    if (c.row < zMin || c.row > zMax) continue;
    const gridCx = (c.x + c.w * 0.5) / CELL;
    const center = classicGridToScreen(gridCx, c.row + 0.5, camZ, bob);
    const depth = classicPaintDepth(c.row, gridCx) + 0.2;
    const gridSpan = c.w / CELL;
    const facingRight = c.speed > 0;
    drawQueue.push({
      depth,
      draw: () => {
        if (shadows) {
          drawDropShadow(
            ctx,
            center.x,
            center.y + CELL * 0.14,
            gridSpan * ENTITY_UNIT * 0.42,
            CELL * 0.07,
          );
        }
        drawVoxelVehicle(
          ctx,
          center.x,
          center.y,
          gridSpan,
          c.kind,
          facingRight,
          ENTITY_UNIT,
          s.animT,
          simpleVoxels,
        );
      },
    });
  }

  for (const l of s.logs) {
    if (l.row < zMin || l.row > zMax) continue;
    const gridCx = (l.x + l.w * 0.5) / CELL;
    const center = classicGridToScreen(gridCx, l.row + 0.5, camZ, bob);
    const depth = classicPaintDepth(l.row, gridCx) + 0.2;
    const gridSpan = l.w / CELL;
    drawQueue.push({
      depth,
      draw: () => {
        if (shadows) {
          drawDropShadow(ctx, center.x, center.y + CELL * 0.12, gridSpan * ENTITY_UNIT * 0.4, CELL * 0.06);
        }
        drawVoxelLog(ctx, center.x, center.y, gridSpan, ENTITY_UNIT, s.animT, gridCx);
      },
    });
  }

  const playerCenter = classicPlayerCenter(s);
  const arcZ = hopArcHeight(t, CELL * 0.45);
  const squash = hopSquash(t);
  const shadowAlpha = s.hopT > 0 ? 0.1 + (1 - t) * 0.08 : 0.22;

  if (shadows) {
    drawQueue.push({
      depth: classicPaintDepth(s.pz, s.px) + 0.5,
      draw: () => drawDropShadow(
        ctx,
        playerCenter.x,
        playerCenter.y + CELL * 0.18,
        CELL * 0.2,
        CELL * 0.09,
        shadowAlpha,
      ),
    });
  }
  drawQueue.push({
    depth: classicPaintDepth(s.pz, s.px) + 0.55,
    draw: () => {
      if (s.eagleT <= 0) {
        drawVoxelChicken(
          ctx,
          playerCenter.x,
          playerCenter.y - arcZ,
          ENTITY_UNIT,
          arcZ,
          squash,
          s.animT,
        );
      }
    },
  });

  drawQueue.sort((a, b) => a.depth - b.depth);
  for (let i = 0; i < drawQueue.length; i++) {
    drawQueue[i]!.draw();
  }

  drawPremiumHud(ctx, s);

  if (s.eagleT > 0) {
    drawEagleSwoop(ctx, s, playerCenter.x, playerCenter.y - arcZ);
  }
}

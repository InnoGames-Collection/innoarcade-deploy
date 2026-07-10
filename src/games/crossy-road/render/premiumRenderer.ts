// Premium isometric renderer — Phase 1: 3D slabs, smooth camera, entity placement.

import { drawIllustratedCar } from '../../_shared/premiumCanvas';
import {
  cellDiamondScreen,
  gridToScreen,
  paintDepth,
  type IsoCamera,
  type ScreenOrigin,
} from '../iso';
import {
  CELL,
  COLS,
  H,
  hopProgress,
  playerGridPos,
  rowAt,
  SCREEN_ANCHOR_Y,
  W,
  type WorldSnapshot,
} from '../types';
import { drawTerrainCell } from './terrain';

export function renderPremium(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#8ed4f8');
  sky.addColorStop(0.45, '#b8e8a0');
  sky.addColorStop(1, '#87c06a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const camera: IsoCamera = { x: s.camIsoX, y: s.camIsoY };
  const origin: ScreenOrigin = { x: W / 2, y: H * SCREEN_ANCHOR_Y };
  const bob = s.camBob;
  const { gx: playerGx, gz: playerGz } = playerGridPos(s);
  const t = hopProgress(s.hopT);

  type DrawItem = { depth: number; draw: () => void };
  const queue: DrawItem[] = [];

  const zMin = s.pz - 12;
  const zMax = s.pz + 16;

  for (let z = zMin; z <= zMax; z++) {
    const row = rowAt(s.rows, z);
    for (let col = 0; col < COLS; col++) {
      const corners = cellDiamondScreen(col, z, camera, origin, bob);
      const depth = paintDepth(z, col);
      const opts = { isStart: z <= 0, animT: s.animT, col };
      queue.push({ depth, draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, sidesOnly: true }) });
      queue.push({ depth: depth + 0.02, draw: () => drawTerrainCell(ctx, corners, row.kind, { ...opts, topOnly: true }) });
    }
  }

  for (const c of s.cars) {
    const gridCx = (c.x + c.w * 0.5) / CELL;
    const center = gridToScreen(gridCx, c.row + 0.5, camera, origin, bob);
    const depth = paintDepth(c.row, gridCx) + 0.2;
    const drawW = c.w * 0.55;
    const drawH = CELL * 0.55;
    queue.push({
      depth,
      draw: () => drawIllustratedCar(
        ctx,
        center.x - drawW / 2,
        center.y - drawH / 2,
        drawW,
        drawH,
        '#e74c3c',
      ),
    });
  }

  for (const l of s.logs) {
    const gridCx = (l.x + l.w * 0.5) / CELL;
    const center = gridToScreen(gridCx, l.row + 0.5, camera, origin, bob);
    const depth = paintDepth(l.row, gridCx) + 0.2;
    const drawW = l.w * 0.55;
    const drawH = CELL * 0.5;
    queue.push({
      depth,
      draw: () => {
        ctx.fillStyle = '#8B5A2B';
        ctx.beginPath();
        ctx.roundRect(center.x - drawW / 2, center.y - drawH / 2, drawW, drawH, 6);
        ctx.fill();
      },
    });
  }

  const playerCenter = gridToScreen(playerGx, playerGz, camera, origin, bob);
  const hopBounce = s.hopT > 0 ? Math.sin(t * Math.PI) * 12 : 0;
  queue.push({
    depth: paintDepth(playerGz, playerGx) + 0.55,
    draw: () => {
      ctx.font = `${CELL - 6}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🐔', playerCenter.x, playerCenter.y - hopBounce);
    },
  });

  queue.sort((a, b) => a.depth - b.depth);
  for (const item of queue) item.draw();

  drawHudHints(ctx, s);
}

function drawHudHints(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  if (s.state !== 'playing') return;

  if (s.tutorialT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(12, H - 52, W - 24, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '600 13px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Swipe or tap arrows to hop forward', W / 2, H - 28);
  } else if (s.idleT > 10) {
    const pulse = 0.7 + Math.sin(s.animT * 10) * 0.3;
    ctx.fillStyle = `rgba(231,76,60,${0.55 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 64, 14, 128, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hop soon!', W / 2, 29);
  }
}

// Legacy flat 2D renderer — original prototype visuals.

import { drawIllustratedCar } from '../../_shared/premiumCanvas';
import {
  CELL,
  H,
  W,
  hopProgress,
  rowAt,
  type WorldSnapshot,
} from '../types';

export function renderLegacy(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  ctx.fillStyle = '#87c06a';
  ctx.fillRect(0, 0, W, H);

  const visRows = Math.ceil(H / CELL) + 2;
  const baseZ = Math.floor(s.camZ / CELL);

  for (let i = -1; i < visRows; i++) {
    const z = baseZ + i;
    const row = rowAt(s.rows, z);
    const sy = H - (z * CELL - s.camZ) - CELL;
    if (sy < -CELL || sy > H + CELL) continue;

    if (row.kind === 'grass') ctx.fillStyle = z <= 0 ? '#6ab04c' : '#7ec850';
    else if (row.kind === 'road') ctx.fillStyle = '#4a4a4a';
    else ctx.fillStyle = '#3498db';
    ctx.fillRect(0, sy, W, CELL + 1);

    if (row.kind === 'road') {
      ctx.fillStyle = '#f0c040';
      for (let x = 0; x < W; x += 40) ctx.fillRect(x, sy + CELL / 2 - 2, 18, 4);
    }

    for (const c of s.cars) {
      if (c.row !== z) continue;
      drawIllustratedCar(ctx, c.x, sy + 8, c.w, CELL - 16, '#e74c3c');
    }

    for (const l of s.logs) {
      if (l.row !== z) continue;
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(l.x, sy + 10, l.w, CELL - 20);
    }

    for (const coin of s.coins) {
      if (coin.row !== z) continue;
      const cx = coin.col * CELL + CELL / 2;
      const bob = Math.sin(s.animT * 4 + coin.col) * 4;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(cx, sy + CELL / 2 - bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4a017';
      ctx.font = 'bold 11px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, sy + CELL / 2 - bob);
    }
  }

  if (s.eagleT > 0) {
    const drawPx = s.px * CELL + CELL / 2;
    ctx.fillStyle = '#5d4037';
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦅', W / 2 + (drawPx - W / 2) * 0.5, 80);
    return;
  }

  const t = hopProgress(s.hopT);
  const drawPx = s.hopT > 0 ? s.fromPx + (s.px - s.fromPx) * t : s.px;
  const drawPz = s.hopT > 0 ? s.fromPz + (s.pz - s.fromPz) * t : s.pz;
  const py = H - (drawPz * CELL - s.camZ) - CELL;
  const hopBounce = s.hopT > 0 ? Math.sin(t * Math.PI) * 10 : 0;

  ctx.font = `${CELL - 8}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐔', drawPx * CELL + CELL / 2, py + CELL / 2 - hopBounce);

  drawHudHints(ctx, s);
}

function drawHudHints(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  if (s.state !== 'playing') return;

  if (s.tutorialT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H - 56, W, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Swipe or tap arrows to hop forward', W / 2, H - 28);
  } else if (s.idleT > 10) {
    ctx.fillStyle = 'rgba(231,76,60,0.85)';
    ctx.font = 'bold 14px system-ui,sans-serif';
    ctx.fillText('Hop soon!', W / 2, 28);
  }
}

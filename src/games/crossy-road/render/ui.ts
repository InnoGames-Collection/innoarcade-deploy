// Premium in-canvas HUD — idle countdown, glass banners.

import { CAMP_LIMIT, IDLE_LIMIT, W, type WorldSnapshot } from '../types';

const ET_GREEN = '#4f9e16';

function drawIdleWarning(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  const remaining = Math.max(0, Math.ceil(IDLE_LIMIT - s.idleT));
  const urgency = (s.idleT - 8) / (IDLE_LIMIT - 8);
  const pulse = 0.75 + Math.sin(s.animT * 12) * 0.25;
  const w = 148;
  const h = 36;
  const x = W / 2 - w / 2;
  const y = 16;

  ctx.save();
  ctx.globalAlpha = 0.85 + urgency * 0.15;

  const bg = ctx.createLinearGradient(x, y, x + w, y);
  bg.addColorStop(0, `rgba(231,76,60,${0.55 + pulse * 0.3})`);
  bg.addColorStop(0.5, `rgba(241,196,15,${0.5 + pulse * 0.25})`);
  bg.addColorStop(1, `rgba(231,76,60,${0.55 + pulse * 0.3})`);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = '700 12px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Hop soon! ${remaining}s`, W / 2, y + h / 2);

  const ringR = 13;
  const ringX = x + w - 22;
  const ringY = y + h / 2;
  const progress = remaining / IDLE_LIMIT;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = ET_GREEN;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ringX, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawCampWarning(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  const remaining = Math.max(0, Math.ceil(CAMP_LIMIT - s.campT));
  const urgency = s.campT / CAMP_LIMIT;
  const pulse = 0.75 + Math.sin(s.animT * 14) * 0.25;
  const w = 168;
  const h = 36;
  const x = W / 2 - w / 2;
  const y = 58;

  ctx.save();
  ctx.globalAlpha = 0.9 + urgency * 0.1;
  ctx.fillStyle = `rgba(155,89,182,${0.55 + pulse * 0.35})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '700 12px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🦅 Eagle incoming! ${remaining}s`, W / 2, y + h / 2);
  ctx.restore();
}

export function drawPremiumHud(ctx: CanvasRenderingContext2D, s: WorldSnapshot): void {
  if (s.state !== 'playing') return;
  if (s.eagleT <= 0 && s.campT > 3) drawCampWarning(ctx, s);
  else if (s.idleT > 8) drawIdleWarning(ctx, s);
}

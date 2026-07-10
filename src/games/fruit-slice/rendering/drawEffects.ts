// Swipe trail, combo bursts, screen effects.

import { RW as W, RH as H } from './types';

export function drawSliceTrail(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  age: number,
  maxAge: number,
): void {
  if (points.length < 2) return;
  const a = Math.max(0, 1 - age / maxAge);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Motion-blur underglow
  ctx.strokeStyle = `rgba(80,160,255,${a * 0.3})`;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(170,215,255,${a * 0.55})`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // Core blade
  ctx.strokeStyle = `rgba(255,255,255,${a * 0.97})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  // Sparks along path
  for (let i = 1; i < points.length; i += 2) {
    const p = points[i];
    ctx.fillStyle = `rgba(220,240,255,${a * 0.75})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawComboEffect(
  ctx: CanvasRenderingContext2D,
  combo: number,
  flashT: number,
  cx: number,
  cy: number,
): void {
  if (combo < 2 || flashT <= 0) return;
  const a = Math.min(1, flashT * 3);
  ctx.save();
  ctx.globalAlpha = a * 0.38;

  if (combo >= 20) {
    const hue = (Date.now() / 18) % 360;
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 210);
    g.addColorStop(0, `hsla(${hue},92%,62%,0.55)`);
    g.addColorStop(0.5, `hsla(${(hue + 70) % 360},85%,55%,0.22)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (combo >= 10) {
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 190);
    g.addColorStop(0, 'rgba(255,215,0,0.65)');
    g.addColorStop(0.45, 'rgba(255,180,0,0.28)');
    g.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + flashT * 3.5;
      ctx.fillStyle = `rgba(255,235,120,${a * 0.65})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * 75 * (1 - flashT), cy + Math.sin(ang) * 55 * (1 - flashT), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (combo >= 5) {
    ctx.strokeStyle = `rgba(255,255,120,${a * 0.75})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 180;
      ctx.beginPath();
      ctx.moveTo(cx + ox, 0);
      ctx.lineTo(cx + ox + (Math.random() - 0.5) * 28, 190);
      ctx.stroke();
    }
  } else if (combo >= 3) {
    const g = ctx.createRadialGradient(cx, cy, 18, cx, cy, 125);
    g.addColorStop(0, `rgba(255,130,40,${a * 0.42})`);
    g.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 125, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 85);
    g.addColorStop(0, `rgba(255,220,150,${a * 0.32})`);
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

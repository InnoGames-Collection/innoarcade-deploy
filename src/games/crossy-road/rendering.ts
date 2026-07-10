// Crossy Road — canvas rendering helpers (vehicles, player, VFX).

export type VehicleKind = 'minibus' | 'bus' | 'telecomVan';

export function drawDropShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.22,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function glossBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  mid: string,
  dark: string,
  radius = 6,
): void {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawWheels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n = 2): void {
  const wheelY = y + h * 0.88;
  const slots = n === 4 ? [0.18, 0.38, 0.62, 0.82] : [0.22, 0.78];
  ctx.fillStyle = '#1a1a1a';
  for (const slot of slots) {
    ctx.beginPath();
    ctx.ellipse(x + w * slot, wheelY, w * 0.09, h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(x + w * slot, wheelY, w * 0.045, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
  }
}

export function drawMinibus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  facingRight: boolean,
): void {
  ctx.save();
  if (!facingRight) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  glossBody(ctx, x, y + h * 0.12, w, h * 0.78, '#7ec8ff', '#1f74e0', '#0d4a9e', 7);
  ctx.fillStyle = '#f4f8ff';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.06, y + h * 0.16, w * 0.88, h * 0.22, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,230,255,0.9)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.roundRect(x + w * (0.1 + i * 0.28), y + h * 0.2, w * 0.2, h * 0.14, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + h * 0.42, w * 0.08, h * 0.12, 2);
  ctx.fill();
  drawWheels(ctx, x, y, w, h, 2);
  ctx.restore();
}

export function drawBus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  facingRight: boolean,
): void {
  ctx.save();
  if (!facingRight) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  glossBody(ctx, x, y + h * 0.08, w, h * 0.84, '#ffe08a', '#f39c12', '#b86a08', 8);
  ctx.fillStyle = '#fff8e8';
  const winCount = Math.max(4, Math.floor(w / 28));
  for (let i = 0; i < winCount; i++) {
    ctx.beginPath();
    ctx.roundRect(x + w * (0.06 + (i / winCount) * 0.86), y + h * 0.18, w * 0.12, h * 0.22, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x, y + h * 0.08, w, h * 0.06);
  drawWheels(ctx, x, y, w, h, 4);
  ctx.restore();
}

export function drawTelecomVan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  facingRight: boolean,
): void {
  ctx.save();
  if (!facingRight) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }
  glossBody(ctx, x, y + h * 0.14, w, h * 0.76, '#ffffff', '#eef4ea', '#c8d4c0', 7);
  ctx.fillStyle = '#4f9e16';
  ctx.fillRect(x, y + h * 0.38, w, h * 0.14);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(7, h * 0.16)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ethio telecom', x + w * 0.52, y + h * 0.45);
  ctx.fillStyle = 'rgba(200,220,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.12, y + h * 0.2, w * 0.35, h * 0.14, 3);
  ctx.fill();
  drawWheels(ctx, x, y, w, h, 2);
  ctx.restore();
}

export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  kind: VehicleKind,
  x: number,
  y: number,
  w: number,
  h: number,
  facingRight: boolean,
): void {
  const cx = x + w / 2;
  const cy = y + h * 0.92;
  drawDropShadow(ctx, cx, cy, w * 0.38, h * 0.1, 0.2);
  if (kind === 'minibus') drawMinibus(ctx, x, y, w, h, facingRight);
  else if (kind === 'bus') drawBus(ctx, x, y, w, h, facingRight);
  else drawTelecomVan(ctx, x, y, w, h, facingRight);
}

export function drawLog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cx = x + w / 2;
  const cy = y + h * 0.92;
  drawDropShadow(ctx, cx, cy, w * 0.42, h * 0.08, 0.18);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#c4884a');
  g.addColorStop(0.5, '#8B5A2B');
  g.addColorStop(1, '#5c3418');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.15, w, h * 0.7, h * 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x + w * 0.15, y + h * 0.5, h * 0.12, h * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + w - w * 0.15, y + h * 0.5, h * 0.12, h * 0.22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spin: number,
  size = 14,
): void {
  const squash = 0.55 + Math.abs(Math.cos(spin)) * 0.45;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(squash, 1);
  const g = ctx.createRadialGradient(-size * 0.2, -size * 0.25, 0, 0, 0, size);
  g.addColorStop(0, '#fff4a8');
  g.addColorStop(0.5, '#f2b21a');
  g.addColorStop(1, '#c8860a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a86a08';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff8dc';
  ctx.font = `bold ${size * 0.9}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ብ', 0, 1);
  ctx.restore();
}

export function hopSquash(hopProgress: number): { sx: number; sy: number; lift: number } {
  const p = hopProgress;
  let sx = 1;
  let sy = 1;
  let lift = 0;
  if (p < 0.18) {
    const t = p / 0.18;
    sx = 1.18 - t * 0.18;
    sy = 0.82 + t * 0.18;
  } else if (p < 0.72) {
    const t = (p - 0.18) / 0.54;
    sx = 1 - 0.1 * Math.sin(t * Math.PI);
    sy = 1 + 0.22 * Math.sin(t * Math.PI);
    lift = Math.sin(t * Math.PI) * 12;
  } else {
    const t = (p - 0.72) / 0.28;
    sx = 0.92 + t * 0.08;
    sy = 1.22 - t * 0.22;
    lift = (1 - t) * 4;
  }
  return { sx, sy, lift };
}

export function drawChicken(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  hopProgress: number,
  isHopping: boolean,
): void {
  const { sx, sy, lift } = isHopping ? hopSquash(hopProgress) : { sx: 1, sy: 1, lift: 0 };
  const baseY = cy - lift;
  drawDropShadow(ctx, cx, baseY + cell * 0.38, cell * 0.28, cell * 0.08, 0.26);

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(sx, sy);
  ctx.font = `${cell - 6}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐔', 0, 0);
  ctx.restore();
}

export function drawEagle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  wingPhase: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const wing = Math.sin(wingPhase) * 0.35;
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ecf0f1';
  ctx.beginPath();
  ctx.ellipse(8, -4, 10, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.lineTo(24, 0);
  ctx.lineTo(16, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(44,62,80,0.85)';
  ctx.beginPath();
  ctx.ellipse(-10, wing * 8, 18, 6 + Math.abs(wing) * 4, -0.5 + wing, 0, Math.PI * 2);
  ctx.ellipse(10, wing * 8, 18, 6 + Math.abs(wing) * 4, 0.5 - wing, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGrassRow(
  ctx: CanvasRenderingContext2D,
  sy: number,
  w: number,
  cell: number,
  isStart: boolean,
): void {
  const top = isStart ? '#6ab04c' : '#7ec850';
  const g = ctx.createLinearGradient(0, sy, 0, sy + cell);
  g.addColorStop(0, top);
  g.addColorStop(1, isStart ? '#5a9a3e' : '#6eb844');
  ctx.fillStyle = g;
  ctx.fillRect(0, sy, w, cell + 1);
  if (!isStart) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 5; i++) {
      const gx = ((i * 97 + sy) % w);
      ctx.fillRect(gx, sy + cell * 0.3, 3, cell * 0.35);
    }
  }
}

export function drawRoadRow(ctx: CanvasRenderingContext2D, sy: number, w: number, cell: number): void {
  const g = ctx.createLinearGradient(0, sy, 0, sy + cell);
  g.addColorStop(0, '#555');
  g.addColorStop(1, '#3d3d3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, sy, w, cell + 1);
  ctx.fillStyle = '#f0c040';
  for (let x = 0; x < w; x += 40) ctx.fillRect(x, sy + cell / 2 - 2, 18, 4);
}

export function drawRiverRow(ctx: CanvasRenderingContext2D, sy: number, w: number, cell: number, t: number): void {
  const g = ctx.createLinearGradient(0, sy, 0, sy + cell);
  g.addColorStop(0, '#5dade2');
  g.addColorStop(1, '#2980b9');
  ctx.fillStyle = g;
  ctx.fillRect(0, sy, w, cell + 1);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = -((t * 40) % 30); x < w; x += 30) {
    ctx.fillRect(x, sy + cell * 0.35, 14, 3);
  }
}

type IsoCorner = { x: number; y: number };

function traceDiamond(ctx: CanvasRenderingContext2D, corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner]): void {
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
}

export function fillIsoCell(
  ctx: CanvasRenderingContext2D,
  corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner],
  fill: string | CanvasGradient,
): void {
  traceDiamond(ctx, corners);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeIsoCell(
  ctx: CanvasRenderingContext2D,
  corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner],
  stroke: string,
  lineWidth = 1,
): void {
  traceDiamond(ctx, corners);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function drawIsoGrassCell(
  ctx: CanvasRenderingContext2D,
  corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner],
  isStart: boolean,
): void {
  const top = isStart ? '#6ab04c' : '#7ec850';
  const bottom = isStart ? '#5a9a3e' : '#6eb844';
  const cx = (corners[0].x + corners[2].x) / 2;
  const g = ctx.createLinearGradient(cx, corners[0].y, cx, corners[2].y);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  fillIsoCell(ctx, corners, g);
}

export function drawIsoRoadCell(
  ctx: CanvasRenderingContext2D,
  corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner],
): void {
  const cx = (corners[0].x + corners[2].x) / 2;
  const g = ctx.createLinearGradient(cx, corners[0].y, cx, corners[2].y);
  g.addColorStop(0, '#555');
  g.addColorStop(1, '#3d3d3d');
  fillIsoCell(ctx, corners, g);
  strokeIsoCell(ctx, corners, 'rgba(240,192,64,0.35)', 1);
}

export function drawIsoRiverCell(
  ctx: CanvasRenderingContext2D,
  corners: [IsoCorner, IsoCorner, IsoCorner, IsoCorner],
  t: number,
  col: number,
): void {
  const cx = (corners[0].x + corners[2].x) / 2;
  const g = ctx.createLinearGradient(cx, corners[0].y, cx, corners[2].y);
  g.addColorStop(0, '#5dade2');
  g.addColorStop(1, '#2980b9');
  fillIsoCell(ctx, corners, g);
  const shimmer = corners[0].x + ((t * 40 + col * 17) % 30);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(shimmer, (corners[0].y + corners[2].y) / 2 - 2, 14, 3);
}

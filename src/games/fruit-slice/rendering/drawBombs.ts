// Bomb rendering — stylized metal sphere with fuse.

export function drawBomb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number, time: number,
): void {
  const pulse = 1 + Math.sin(time * 7) * 0.025;
  const r = radius * pulse;

  const body = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, 2, x, y, r);
  body.addColorStop(0, '#666');
  body.addColorStop(0.45, '#333');
  body.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.22, y - r * 0.28, r * 0.18, r * 0.11, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#a67c00';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + 5, y - r - 9, x + 3, y - r - 15);
  ctx.stroke();

  if (Math.sin(time * 18) > 0.4) {
    const spark = ctx.createRadialGradient(x + 3, y - r - 15, 0, x + 3, y - r - 15, 5);
    spark.addColorStop(0, '#fff');
    spark.addColorStop(0.4, '#ff8800');
    spark.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(x + 3, y - r - 15, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.85)}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💣', x, y + 1);
}

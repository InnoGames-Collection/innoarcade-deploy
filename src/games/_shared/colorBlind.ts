// Shape glyphs for color-blind accessibility on canvas games (one per color index).

export const CB_SHAPES = ['●', '■', '▲', '◆', '✚', '✦', '⬟', '⬢'] as const;

export function drawColorBlindGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size = 10,
): void {
  const shape = CB_SHAPES[colorIndex % CB_SHAPES.length];
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.font = `bold ${size}px system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(shape, x, y);
  ctx.fillText(shape, x, y);
  ctx.restore();
}

// Floating score popups — presentation only, no gameplay impact.

import type { ScorePopup } from './types';

export function updateScorePopups(popups: ScorePopup[], dt: number): void {
  for (const p of popups) {
    p.life += dt;
    p.y -= 42 * dt;
    p.x += p.drift * dt;
  }
}

export function drawScorePopups(ctx: CanvasRenderingContext2D, popups: ScorePopup[]): void {
  for (const p of popups) {
    const t = p.life / p.maxLife;
    if (t >= 1) continue;
    const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    const scale = 0.85 + Math.min(t * 4, 1) * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);

    const isCombo = p.text.startsWith('Combo');
    const isPerfect = p.text.includes('Perfect') || p.text.includes('Excellent') || p.text.includes('Great');

    if (isPerfect || isCombo) {
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
      glow.addColorStop(0, isPerfect ? 'rgba(255,220,80,0.35)' : 'rgba(100,200,255,0.25)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `bold ${isPerfect ? 22 : isCombo ? 18 : 16}px system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'rgba(0,40,20,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, 0, 0);

    if (isPerfect) {
      const grad = ctx.createLinearGradient(-30, -10, 30, 10);
      grad.addColorStop(0, '#ffd700');
      grad.addColorStop(0.5, '#fff8dc');
      grad.addColorStop(1, '#ffb347');
      ctx.fillStyle = grad;
    } else if (isCombo) {
      const grad = ctx.createLinearGradient(-30, -10, 30, 10);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(1, '#22c55e');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(p.text, 0, 0);

    ctx.restore();
  }
}

/** Build popup text from points and combo — presentation helper. */
export function scorePopupText(points: number, combo: number): string {
  if (combo >= 20) return 'Great Combo!';
  if (combo >= 10) return 'Excellent!';
  if (combo >= 5) return 'Perfect Slice!';
  if (combo >= 3) return `Combo x${combo}`;
  if (combo >= 2) return `Combo x${combo}`;
  return `+${points}`;
}

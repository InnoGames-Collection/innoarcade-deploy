import { CX, H, THEME, W } from './constants';
import { easeOutCubic } from './easing';
import type { GameState } from './types';

export interface HudState {
  state: GameState;
  score: number;
  displayScore: number;
  combo: number;
  feverLeft: number;
  multiplier: number;
  depth: number;
  feverThreshold: number;
  scorePop: { amount: number; ttl: number };
}

export function drawHud(ctx: CanvasRenderingContext2D, hud: HudState): void {
  ctx.clearRect(0, 0, W, H);
  if (hud.state !== 'playing') return;

  const fever = hud.feverLeft > 0;
  const comboActive = hud.combo > 1;

  ctx.textAlign = 'left';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(40,40,60,0.5)';
  ctx.fillText(`Level ${hud.depth}`, 16, H - 16);

  if (hud.scorePop.ttl > 0 && hud.scorePop.amount > 0) {
    const t = hud.scorePop.ttl / 0.85;
    const y = 108 + (1 - t) * 18;
    const alpha = Math.min(1, t * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = fever ? THEME.fever : THEME.accent;
    ctx.fillText(`+${hud.scorePop.amount}`, CX, y);
    ctx.restore();
  }

  if (comboActive || fever) {
    const cx = CX;
    const cy = 36;
    const r = 22;
    const progress = fever
      ? hud.feverLeft / 2.8
      : hud.combo / hud.feverThreshold;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    const ringGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    ringGrad.addColorStop(0, fever ? '#ff9f1c' : THEME.accent);
    ringGrad.addColorStop(1, fever ? THEME.fever : '#00d4ff');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = fever ? THEME.fever : '#ffffff';
    ctx.fillText(fever ? 'FEVER' : `×${hud.combo}`, cx, cy + 5);
  }

  if (comboActive) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    const grad = ctx.createLinearGradient(CX - 60, 0, CX + 60, 0);
    if (fever) {
      grad.addColorStop(0, '#ff9f1c');
      grad.addColorStop(0.5, THEME.fever);
      grad.addColorStop(1, '#ff6b6b');
    } else {
      grad.addColorStop(0, THEME.accent);
      grad.addColorStop(1, '#00d4ff');
    }
    ctx.fillStyle = grad;
    const label = fever ? `FEVER ×${hud.multiplier}` : `COMBO ×${hud.combo}`;
    ctx.shadowColor = fever ? 'rgba(255,217,61,0.55)' : 'rgba(0,212,170,0.4)';
    ctx.shadowBlur = 14;
    ctx.fillText(label, CX, 78);
    ctx.shadowBlur = 0;
  }

  ctx.textAlign = 'center';
  ctx.font = '600 12px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(40,40,60,0.45)';
  ctx.fillText('Drag to rotate', CX, H - 14);
}

export function drawFlash(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function tickDisplayScore(current: number, target: number, dt: number): number {
  if (current === target) return target;
  const step = Math.max(1, Math.ceil(Math.abs(target - current) * easeOutCubic(Math.min(1, dt * 8))));
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

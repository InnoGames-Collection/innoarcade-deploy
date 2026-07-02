// Spin Wheel — tap Play for a timed spin with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

const host = createHost('spin-wheel');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function chance(ratePct: number): boolean {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] / 0x100000000) * 100 < ratePct;
}
function randInt(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

const canvas = $('#sw-canvas') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const spinBtn = $('#sw-spin-btn') as HTMLButtonElement;
const message = $('#sw-message');

const SEGS = [
  { label: 'WIN', color: '#4f9e16', tc: '#ffffff' },
  { label: 'LOSE', color: '#eef6e3', tc: '#5f7262' },
  { label: 'WIN', color: '#3d8010', tc: '#ffffff' },
  { label: 'LOSE', color: '#ffffff', tc: '#5f7262' },
  { label: 'WIN', color: '#6bb824', tc: '#ffffff' },
  { label: 'LOSE', color: '#eef6e3', tc: '#5f7262' },
  { label: 'WIN', color: '#4f9e16', tc: '#ffffff' },
  { label: 'LOSE', color: '#ffffff', tc: '#5f7262' },
];
const N = SEGS.length;
const segAng = (2 * Math.PI) / N;

let isSpinning = false;
let currentRotation = 0;
let runStart = 0;
let spinFrame = 0;

const shell = wireFreeCasualShell(host, resetRound, { headerSlots: [] });

function resetRound(): void {
  cancelAnimationFrame(spinFrame);
  isSpinning = false;
  spinBtn.disabled = false;
  message.textContent = '';
  canvas.style.transition = '';
  currentRotation = 0;
  canvas.style.transform = '';
  drawWheel();
}

function drawWheel(): void {
  const sz = (canvas.width = canvas.height = canvas.offsetWidth * 2 || 480);
  const cx = sz / 2;
  const cy = sz / 2;
  const r = sz / 2 - 4;
  ctx.clearRect(0, 0, sz, sz);
  SEGS.forEach((seg, i) => {
    const s = i * segAng - Math.PI / 2;
    const e = s + segAng;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s, e);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 45, 14, 0.12)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s + segAng / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = seg.tc;
    ctx.font = `bold ${sz * 0.048}px sans-serif`;
    ctx.fillText(seg.label, r * 0.82, sz * 0.016);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = '#4f9e16';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, sz * 0.1, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e6efdc';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function segmentOffsetDeg(index: number): number {
  return 360 - (index * (360 / N) + 360 / N / 2);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function spinOnPlay(): void {
  if (isSpinning) return;
  isSpinning = true;
  spinBtn.disabled = true;
  message.textContent = '';
  runStart = Date.now();
  sfx.click();
  canvas.style.transition = '';

  const isWin = chance(host.winRate);
  const segIndex = isWin ? randInt(4) * 2 : randInt(4) * 2 + 1;
  const duration = 5000 + randInt(3000);
  const startRot = currentRotation;
  const extraSpins = 4 + randInt(2);
  const targetMod = segmentOffsetDeg(segIndex);
  const endRot = Math.ceil(startRot / 360) * 360 + extraSpins * 360 + targetMod;

  const t0 = performance.now();
  const tickSound = setInterval(() => sfx.click(), 180);

  const frame = (now: number): void => {
    const progress = Math.min(1, (now - t0) / duration);
    const eased = easeInOutCubic(progress);
    currentRotation = startRot + (endRot - startRot) * eased;
    canvas.style.transform = `rotate(${currentRotation}deg)`;
    if (progress < 1) {
      spinFrame = requestAnimationFrame(frame);
    } else {
      clearInterval(tickSound);
      currentRotation = endRot;
      canvas.style.transform = `rotate(${currentRotation}deg)`;
      let summary: string;
      if (isWin) {
        summary = t('sw.won').replace('{p}', String(host.winPoints));
        sfx.coin();
      } else {
        summary = t('sw.tryAgain');
        sfx.crash();
      }
      message.textContent = summary;
      shell.finishPlay(isWin ? host.winPoints : 0, isWin, '', Date.now() - runStart);
      isSpinning = false;
      spinBtn.disabled = true;
    }
  };
  spinFrame = requestAnimationFrame(frame);
}

spinBtn.addEventListener('click', () => spinOnPlay());

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
window.addEventListener('resize', drawWheel);
resetRound();

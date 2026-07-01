// Spin Wheel — hold-to-charge wheel with hub casual shell.

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
  { label: 'WIN', color: '#2F0999', tc: '#ffffff' },
  { label: 'LOSE', color: '#A11FAB', tc: '#ffffff' },
  { label: 'WIN', color: '#D18A04', tc: '#2F0999' },
  { label: 'LOSE', color: '#0B6655', tc: '#ffffff' },
  { label: 'WIN', color: '#A11FAB', tc: '#ffffff' },
  { label: 'LOSE', color: '#2F0999', tc: '#ffffff' },
  { label: 'WIN', color: '#0B6655', tc: '#ffffff' },
  { label: 'LOSE', color: '#D18A04', tc: '#2F0999' },
];
const N = SEGS.length;
const segAng = (2 * Math.PI) / N;

let isSpinning = false;
let currentRotation = 0;
let isHolding = false;
let spinSpeed = 0;
let spinInterval: ReturnType<typeof setInterval> | null = null;
let runStart = 0;

const shell = wireFreeCasualShell(host, resetRound);

function resetRound(): void {
  isSpinning = false;
  isHolding = false;
  spinSpeed = 0;
  if (spinInterval) clearInterval(spinInterval);
  spinBtn.disabled = false;
  message.textContent = t('sw.holdStart');
  message.style.color = '#ffffff';
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
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s, e);
    ctx.closePath();
    ctx.clip();
    const shine = ctx.createLinearGradient(0, 0, sz, sz);
    shine.addColorStop(0, 'rgba(255,255,255,0.4)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0.1)');
    shine.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    shine.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, sz, sz);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s + segAng / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = seg.tc;
    ctx.font = `bold ${sz * 0.05}px sans-serif`;
    ctx.fillText(seg.label, r * 0.82, sz * 0.018);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = '#D18A04';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, sz * 0.12, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
}

function startHolding(e: Event): void {
  if (isSpinning || isHolding) return;
  e.preventDefault();
  runStart = Date.now();
  isHolding = true;
  spinSpeed = 0;
  sfx.click();
  message.textContent = t('sw.spinning');
  message.style.color = '#D18A04';
  spinInterval = setInterval(() => {
    if (!isHolding) return;
    spinSpeed += 0.6;
    if (spinSpeed > 20) spinSpeed = 20;
    currentRotation += spinSpeed;
    canvas.style.transform = `rotate(${currentRotation}deg)`;
  }, 30);
}

function releaseSpin(): void {
  if (!isHolding) return;
  isHolding = false;
  if (spinInterval) clearInterval(spinInterval);
  if (spinSpeed > 0) spin(spinSpeed);
  else {
    message.textContent = t('sw.holdStart');
    message.style.color = '#ffffff';
  }
}

function spin(speed: number): void {
  if (isSpinning) return;
  isSpinning = true;
  spinBtn.disabled = true;
  message.textContent = t('sw.slowing');
  message.style.color = '#ffffff';

  const isWin = chance(host.winRate);
  const wi = isWin ? randInt(4) * 2 : randInt(4) * 2 + 1;
  const finalDeg = 360 - (wi * (360 / N) + 360 / N / 2);

  let currentSpeed = speed;
  const slowInterval = setInterval(() => {
    const deceleration = currentSpeed > 10 ? 0.4 : currentSpeed > 5 ? 0.3 : 0.15;
    currentSpeed -= deceleration;
    if (currentSpeed <= 0.5) {
      clearInterval(slowInterval);
      const fullSpins = Math.floor(currentRotation / 360) + 4;
      const finalRotation = fullSpins * 360 + finalDeg;
      currentRotation = finalRotation;
      canvas.style.transition = 'transform 1.8s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
      canvas.style.transform = `rotate(${finalRotation}deg)`;
      setTimeout(() => {
        canvas.style.transition = '';
        let summary: string;
        if (isWin) {
          summary = t('sw.won').replace('{p}', String(host.winPoints));
          message.textContent = summary;
          message.style.color = '#D18A04';
          sfx.coin();
        } else {
          summary = t('sw.tryAgain');
          message.textContent = summary;
          message.style.color = '#ffffff';
          sfx.crash();
        }
        shell.finishPlay(isWin ? 1 : 0, isWin, summary, Date.now() - runStart);
        isSpinning = false;
        spinBtn.disabled = true;
        spinSpeed = 0;
      }, 1900);
    } else {
      currentRotation += currentSpeed;
      canvas.style.transform = `rotate(${currentRotation}deg)`;
    }
  }, 30);
}

spinBtn.addEventListener('mousedown', (e) => startHolding(e));
spinBtn.addEventListener('touchstart', (e) => startHolding(e), { passive: false });
window.addEventListener('mouseup', releaseSpin);
window.addEventListener('touchend', releaseSpin);

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();
window.addEventListener('resize', drawWheel);

// Scratch Card — chance scratch game with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

const host = createHost('scratch-card');
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

const canvas = $('#sc-canvas') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const message = $('#sc-message');
const resetBtn = $('#sc-reset-btn') as HTMLButtonElement;
const timerBar = $('#sc-timer-bar');
const timerText = $('#sc-timer-text');

let isScratched = false;
let hasReported = false;
let gameActive = false;
let timeLeft = 6.0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let isWin = false;
let slots: string[] = [];
let runStart = 0;

const SYMBOLS = ['💎', '⭐', '💰', '🍒', '🍀', '🍎'];

const shell = wireFreeCasualShell(host, () => initGame());

function initGame(): void {
  if (timerInterval) clearInterval(timerInterval);
  isScratched = false;
  hasReported = false;
  gameActive = false;
  timeLeft = 6.0;

  timerBar.style.width = '100%';
  timerBar.style.background = 'linear-gradient(90deg, #ff4444, #ff8800)';
  timerText.textContent = '6.0s';

  isWin = chance(host.winRate);

  const w = canvas.offsetWidth || 300;
  const h = canvas.offsetHeight || 185;
  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(2, 2);
  ctx.fillStyle = '#5b6d80';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#4c5c6d';
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⏳ SCRATCH FAST ⏳', w / 2, h / 2);

  canvas.style.display = 'block';
  message.textContent = t('sc.tapStart');
  message.style.color = '';
  resetBtn.disabled = false;
  resetBtn.textContent = t('sc.start');

  slots = [];
  if (isWin) {
    const winSym = SYMBOLS[randInt(SYMBOLS.length)];
    slots.push(winSym, winSym, winSym);
    const others = SYMBOLS.filter((s) => s !== winSym);
    for (let i = 0; i < 3; i++) slots.push(others.splice(randInt(others.length), 1)[0]);
  } else {
    const temp = [...SYMBOLS];
    for (let i = 0; i < 3; i++) {
      const sym = temp.splice(randInt(temp.length), 1)[0];
      slots.push(sym, sym);
    }
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const grid = $('#sc-grid');
  grid.innerHTML = '';
  slots.forEach((sym) => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'sc-slot';
    slotDiv.textContent = sym;
    grid.appendChild(slotDiv);
  });
}

function startBlastTimer(): void {
  if (gameActive || isScratched) return;
  gameActive = true;
  runStart = Date.now();
  resetBtn.disabled = true;
  resetBtn.textContent = t('sc.scratchNow');
  message.textContent = t('sc.hurry');
  sfx.click();
  timerInterval = setInterval(() => {
    timeLeft -= 0.05;
    if (timeLeft <= 0) {
      timeLeft = 0;
      if (timerInterval) clearInterval(timerInterval);
      triggerBlastLoss();
    }
    timerText.textContent = timeLeft.toFixed(1) + 's';
    timerBar.style.width = (timeLeft / 6.0) * 100 + '%';
    if (timeLeft <= 2.0) timerBar.style.background = '#ff1111';
  }, 50);
}

function triggerBlastLoss(): void {
  gameActive = false;
  isScratched = true;
  const w = canvas.width / 2;
  const h = canvas.height / 2;
  ctx.fillStyle = '#ff3333';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('💥 BLASTED! 💥', w / 2, h / 2);
  sfx.crash();
  message.textContent = t('sc.blasted');
  message.style.color = '#ff4444';
  void report(false);
}

let lastScratchSoundTime = 0;
function playScratchSound(): void {
  const now = Date.now();
  if (now - lastScratchSoundTime > 60) {
    sfx.slide();
    lastScratchSoundTime = now;
  }
}

function scratch(e: MouseEvent | TouchEvent): void {
  if (!gameActive || isScratched) return;
  playScratchSound();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width / 2;
  const scaleY = canvas.height / rect.height / 2;
  const point = 'touches' in e ? e.touches[0] : e;
  const cx = ((point?.clientX ?? 0) - rect.left);
  const cy = ((point?.clientY ?? 0) - rect.top);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx * scaleX, cy * scaleY, 28, 0, Math.PI * 2);
  ctx.fill();
  checkRevealed();
}

function checkRevealed(): void {
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let clearedCount = 0;
  for (let i = 3; i < id.data.length; i += 4) {
    if (id.data[i] === 0) clearedCount++;
  }
  const percentage = clearedCount / (id.data.length / 4);
  if (percentage >= 0.5) {
    gameActive = false;
    isScratched = true;
    if (timerInterval) clearInterval(timerInterval);
    canvas.style.display = 'none';
    if (isWin) {
      const counts: Record<string, number> = {};
      slots.forEach((s) => (counts[s] = (counts[s] || 0) + 1));
      const winSym = Object.keys(counts).find((k) => counts[k] >= 3);
      document.querySelectorAll<HTMLElement>('.sc-slot').forEach((slot) => {
        if (slot.textContent === winSym) slot.classList.add('matched');
      });
      sfx.coin();
      message.textContent = t('sc.jackpot');
      message.style.color = '#f4d03f';
    } else {
      sfx.crash();
      message.textContent = t('sc.noMatch');
      message.style.color = '#aaa';
    }
    void report(isWin);
  }
}

function report(win: boolean): void {
  if (hasReported) return;
  hasReported = true;
  const summary = message.textContent;
  shell.finishPlay(win ? host.winPoints : 0, win, summary ?? '', Date.now() - runStart);
}

canvas.addEventListener('mousedown', () => { if (!gameActive && !isScratched) startBlastTimer(); });
canvas.addEventListener('touchstart', () => { if (!gameActive && !isScratched) startBlastTimer(); });
canvas.addEventListener('mousemove', (e) => { if (e.buttons === 1) scratch(e); });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); scratch(e); }, { passive: false });
resetBtn.addEventListener('click', () => {
  if (!gameActive && !isScratched) startBlastTimer();
});

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

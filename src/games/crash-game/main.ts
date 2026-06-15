// Crash Game — ported from the awetar build (tournament mode).
//
// A rocket climbs a rising multiplier; cash out before it crashes. The crash
// point is decided up-front by a CSPRNG at the configured win rate (the old
// build trusted a forgeable server flag). The reward scales with the multiplier
// the player banks — points = round(winPoints × cashout) — and accumulates to
// the leaderboard. Entry fee is charged once per tournament window.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';

const host = createHost('crash-game');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function chance(ratePct: number): boolean {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] / 0x100000000) * 100 < ratePct;
}

interface Star { x: number; y: number; size: number; speed: number; alpha: number; }
interface Flame { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; life: number; }
interface Spark { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; decay: number; }
interface Pt { x: number; y: number; }

const multEl = $('#cg-multiplier');
const chart = $('#cg-chart');
const canvas = $('#cg-canvas') as unknown as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const message = $('#cg-message');
const btn = $('#cg-btn') as HTMLButtonElement;
const autoInput = $('#cg-auto-cashout') as HTMLInputElement;

let multiplier = 1.0;
let isPlaying = false;
let hasCashedOut = false;
let crashPoint = 2;
let gameInterval: ReturnType<typeof setInterval> | undefined;
let rX = 0;
let rY = 0;
let targetRX = 0;
let targetRY = 0;
let stars: Star[] = [];
let thrusterParticles: Flame[] = [];
let explosionParticles: Spark[] = [];
let pathPoints: Pt[] = [];
let scrollX = 0;
let scrollY = 0;
let isExploding = false;
let animationFrameId: number | null = null;
let crashHistory = [1.45, 2.84, 1.08, 4.12, 1.67];
let cashoutMultiplier = 1.0;
let sessionPoints = 0;

function setHUD(): void {
  $('#cg-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('arc.free');
  $('#cg-hud-win').textContent = `+${host.winPoints} ${t('arc.pts')}`;
}

function renderTournament(): void {
  const strip = $('#cg-tourney');
  if (!host.isTournament || !host.tournament) { strip.style.display = 'none'; return; }
  const title = getLang() === 'am' ? host.tournament.titleAm : host.tournament.titleEn;
  $('#cg-t-name').textContent = `${title} · ${t('arc.endsIn')} ${host.countdownText()}`;
  const standing = host.standing();
  $('#cg-rank').textContent = standing ? `#${standing.rank}` : '#—';
}

function drawHistory(): void {
  const histEl = $('#cg-history');
  histEl.innerHTML = '';
  crashHistory.slice(-5).reverse().forEach((val) => {
    const badge = document.createElement('span');
    badge.className = `cg-badge ${val >= 2.0 ? 'high' : 'low'}`;
    badge.textContent = val.toFixed(2) + 'x';
    histEl.appendChild(badge);
  });
}

function resizeCanvas(): void {
  const rect = chart.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function initStars(): void {
  stars = [];
  for (let i = 0; i < 45; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 1 + Math.random() * 2,
      speed: 0.3 + Math.random() * 1.8,
      alpha: 0.2 + Math.random() * 0.8,
    });
  }
}

function animate(): void {
  if (!canvas.width || !canvas.height) resizeCanvas();

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (isPlaying && !isExploding) {
    scrollX += 1.5 + multiplier * 0.8;
    scrollY += 0.8 + multiplier * 0.5;
  }

  ctx.strokeStyle = 'rgba(209,138,4,0.15)';
  ctx.lineWidth = 1.5;
  const gridSize = 80;
  const offsetX = -scrollX % gridSize;
  const offsetY = scrollY % gridSize;
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  stars.forEach((star) => {
    if (isPlaying && !isExploding) {
      star.x -= star.speed * (1.2 + multiplier * 0.4);
      star.y += star.speed * (0.6 + multiplier * 0.2);
      if (star.x < 0) { star.x = canvas.width; star.y = Math.random() * canvas.height; }
      if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; }
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  if (isPlaying && !isExploding) {
    rX += (targetRX - rX) * 0.18;
    rY += (targetRY - rY) * 0.18;
    if (pathPoints.length === 0 || Math.abs(pathPoints[pathPoints.length - 1].x - rX) > 4) {
      pathPoints.push({ x: rX, y: rY });
    }
  }

  if (pathPoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    if (!isExploding) ctx.lineTo(rX, rY);
    ctx.strokeStyle = isExploding ? '#fca5a5' : '#D18A04';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = isExploding ? '#fca5a5' : '#D18A04';
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineTo(isExploding ? pathPoints[pathPoints.length - 1].x : rX, canvas.height);
    ctx.lineTo(pathPoints[0].x, canvas.height);
    ctx.closePath();
    const pathGrad = ctx.createLinearGradient(0, rY, 0, canvas.height);
    pathGrad.addColorStop(0, isExploding ? 'rgba(252,165,165,0.15)' : 'rgba(209,138,4,0.18)');
    pathGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pathGrad;
    ctx.fill();
  }

  if (isPlaying && !isExploding) {
    const angle = -0.38;
    const exhaustX = rX - Math.cos(angle) * 32;
    const exhaustY = rY - Math.sin(angle) * 32;
    for (let p = 0; p < 2; p++) {
      thrusterParticles.push({
        x: exhaustX,
        y: exhaustY,
        vx: -Math.cos(angle) * (2 + Math.random() * 4) + (Math.random() - 0.5) * 1.5,
        vy: -Math.sin(angle) * (2 + Math.random() * 4) + (Math.random() - 0.5) * 1.5,
        size: 4 + Math.random() * 6,
        color: ['#D18A04', '#A11FAB', '#FFFFFF', '#FFD700'][Math.floor(Math.random() * 4)],
        alpha: 1,
        life: 1,
      });
    }
  }

  thrusterParticles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.size *= 0.94;
    p.life -= 0.04;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    if (p.life <= 0 || p.size < 0.5) thrusterParticles.splice(idx, 1);
  });
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;

  if (isPlaying && !isExploding) {
    ctx.save();
    ctx.translate(rX, rY);
    ctx.rotate(-0.35 + Math.sin(Date.now() * 0.005) * 0.05);
    ctx.shadowColor = '#D18A04';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.bezierCurveTo(15, -12, -15, -12, -22, -6);
    ctx.lineTo(-22, 6);
    ctx.bezierCurveTo(-15, 12, 15, 12, 35, 0);
    ctx.fill();
    ctx.fillStyle = '#2F0999';
    ctx.beginPath();
    ctx.arc(6, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#D18A04';
    ctx.beginPath();
    ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#A11FAB';
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-26, -20);
    ctx.lineTo(-20, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(-26, 20);
    ctx.lineTo(-20, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.fillRect(-26, -4, 4, 8);
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  explosionParticles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.alpha -= p.decay;
    if (p.alpha > 0) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - p.alpha) * 1.5), 0, Math.PI * 2);
      ctx.fill();
    } else {
      explosionParticles.splice(idx, 1);
    }
  });
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;

  animationFrameId = requestAnimationFrame(animate);
}

async function startGame(): Promise<void> {
  if (isPlaying) {
    cashOut();
    return;
  }
  // Enter the tournament (charge entry once per window) before takeoff.
  const begin = await host.begin();
  if (!begin.ok) {
    message.textContent = begin.reason === 'auth' ? t('arc.signIn') : t('arc.needCoins');
    return;
  }
  setHUD();

  isPlaying = true;
  hasCashedOut = false;
  isExploding = false;
  multiplier = 1.0;
  cashoutMultiplier = 1.0;

  const isWin = chance(host.winRate);
  crashPoint = isWin ? 1.8 + Math.random() * 8.2 : 1.01 + Math.random() * 1.49;

  thrusterParticles = [];
  explosionParticles = [];
  pathPoints = [];

  autoInput.disabled = true;
  multEl.textContent = '1.00x';
  multEl.style.color = '#fff';
  multEl.style.textShadow = '0 0 20px rgba(209,138,4,0.5)';
  message.textContent = t('cg.takeoff');
  btn.textContent = t('cg.cashOut');
  btn.classList.add('cashout');
  btn.disabled = false;

  rX = canvas.width * 0.08;
  rY = canvas.height * 0.85;
  targetRX = rX;
  targetRY = rY;

  let tickCount = 0;
  sfx.click();
  gameInterval = setInterval(() => {
    tickCount++;
    multiplier += 0.05 + tickCount * 0.0015;
    multEl.textContent = multiplier.toFixed(2) + 'x';
    targetRX = canvas.width * 0.08 + tickCount * 5.8;
    targetRY = canvas.height * 0.85 - tickCount * 4.2;
    targetRX = Math.min(targetRX, canvas.width * 0.82);
    targetRY = Math.max(targetRY, canvas.height * 0.15);

    const autoVal = parseFloat(autoInput.value);
    if (!isNaN(autoVal) && autoVal > 1.0 && multiplier >= autoVal) {
      cashOut();
      return;
    }
    if (multiplier >= crashPoint) crash();
  }, 75);
}

function cashOut(): void {
  if (!isPlaying || hasCashedOut) return;
  hasCashedOut = true;
  cashoutMultiplier = multiplier;
  isPlaying = false;
  clearInterval(gameInterval);

  crashHistory.push(multiplier);
  drawHistory();
  autoInput.disabled = false;

  sfx.coin();
  const points = Math.round(host.winPoints * cashoutMultiplier);
  sessionPoints += points;
  message.textContent = t('cg.cashedOut')
    .replace('{m}', multiplier.toFixed(2))
    .replace('{p}', String(points));
  multEl.style.color = '#D18A04';
  multEl.style.textShadow = '0 0 30px rgba(209,138,4,0.8)';
  btn.textContent = t('arc.playAgain');
  btn.classList.remove('cashout');

  void host.finish(sessionPoints, true).then((res) => {
      if (host.isTournament && res.rank) $('#cg-rank').textContent = `#${res.rank}`;
    });
}

function crash(): void {
  clearInterval(gameInterval);
  isPlaying = false;
  isExploding = true;

  crashHistory.push(multiplier);
  drawHistory();
  autoInput.disabled = false;

  sfx.crash();
  message.textContent = t('cg.crashed');
  multEl.style.color = '#fca5a5';
  multEl.style.textShadow = '0 0 35px rgba(252,165,165,0.8)';
  btn.textContent = t('arc.playAgain');
  btn.classList.remove('cashout');

  for (let i = 0; i < 75; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 12;
    explosionParticles.push({
      x: rX,
      y: rY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 10,
      color: ['#fca5a5', '#D18A04', '#A11FAB', '#FFD700', '#ffffff'][Math.floor(Math.random() * 5)],
      alpha: 1.0,
      decay: 0.012 + Math.random() * 0.018,
    });
  }

  host.finish(sessionPoints, false);
}

btn.addEventListener('click', () => void startGame());
window.addEventListener('resize', () => {
  resizeCanvas();
  initStars();
});

// --- Language switch --------------------------------------------------------
const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
  setHUD();
  renderTournament();
}
function pick(lang: Lang): void {
  setLang(lang);
  applyTranslations();
  if (!isPlaying) {
    message.textContent = t('cg.instr');
    btn.textContent = t('cg.start');
  }
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
message.textContent = t('cg.instr');
syncLangButtons();
setHUD();
resizeCanvas();
initStars();
drawHistory();
if (animationFrameId) cancelAnimationFrame(animationFrameId);
animate();

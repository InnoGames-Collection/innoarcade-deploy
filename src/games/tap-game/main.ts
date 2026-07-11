// Tap Game — reflex tapping with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import './polish.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { tapSfx } from './sounds';
import {
  animateCountUp,
  animateHudScore,
  centerOf,
  createRunStats,
  launchConfetti,
  paintRunStats,
  popupForType,
  recordTap,
  resetStreak,
  spawnParticles,
  spawnRipple,
  spawnScorePopup,
  spawnSparkles,
  type RunStats,
} from './fx';

const host = createHost('tap-game');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const SCORE_MULT = 10;
const winRate = host.winRate;
const targetScore = (winRate >= 70 ? 4 : winRate <= 30 ? 7 : 5) * SCORE_MULT;

let score = 0;
let timeLeft = 10;
let isPlaying = false;
let timerInterval: ReturnType<typeof setInterval> | undefined;
let runStart = 0;
let runStats: RunStats = createRunStats();

const area = $('#tg-area');
const message = $('#tg-message');
const scoreHud = () => document.getElementById('fpStat-score');

function targetSize(): number {
  const v = getComputedStyle(area).getPropertyValue('--tg-target-size').trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 72;
}

function displayScore(): number {
  return score * SCORE_MULT;
}

function play(type: 'tap' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'tap': tapSfx.tap(); break;
    case 'click': tapSfx.click(); break;
    case 'win': tapSfx.win(); break;
    case 'lose': tapSfx.lose(); break;
  }
}

function updateHud(): void {
  shell.setHeader({
    time: String(timeLeft),
    score: String(displayScore()),
  });
  animateHudScore(scoreHud(), displayScore());
}

function visualFeedback(
  btn: HTMLElement,
  type: 'regular' | 'golden' | 'poison',
): void {
  const { x, y } = centerOf(btn, area);
  const { pts, label } = popupForType(type);
  const colors = {
    regular: '#4f9e16',
    golden: '#ffd700',
    poison: '#a855f7',
  };
  spawnRipple(area, x, y, colors[type]);
  spawnScorePopup(area, x, y - 10, pts, label);
  spawnParticles(area, x, y, colors[type], type === 'golden' ? 14 : 8);
  if (type === 'golden') spawnSparkles(area, x, y);
  btn.classList.add('tg-tapped');
  setTimeout(() => btn.classList.remove('tg-tapped'), 150);
}

function spawnTarget(type: 'regular' | 'golden' | 'poison' = 'regular'): void {
  if (!isPlaying) return;
  const btn = document.createElement('div');
  btn.className = `tg-target-btn ${type}`;
  const inner = document.createElement('div');
  inner.className = 'tg-target-inner';
  inner.textContent = type === 'golden' ? '👑' : type === 'poison' ? '💀' : '🎯';
  btn.appendChild(inner);

  const aW = area.offsetWidth || 290;
  const aH = area.offsetHeight || 290;
  const tSz = targetSize();
  btn.style.left = Math.random() * (aW - tSz) + 'px';
  btn.style.top = Math.random() * (aH - tSz) + 'px';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;
    if (type === 'regular') {
      score += 1;
      play('tap');
      recordTap('regular', runStats);
      visualFeedback(btn, 'regular');
      btn.remove();
      spawnTarget('regular');
      if (Math.random() < 0.25) spawnTarget('golden');
      if (Math.random() < 0.2) spawnTarget('poison');
    } else if (type === 'golden') {
      score += 3;
      tapSfx.golden();
      recordTap('golden', runStats);
      visualFeedback(btn, 'golden');
      btn.remove();
    } else {
      score = Math.max(0, score - 2);
      play('lose');
      recordTap('poison', runStats);
      visualFeedback(btn, 'poison');
      btn.remove();
      area.classList.add('tg-flash');
      setTimeout(() => area.classList.remove('tg-flash'), 120);
    }
    updateHud();
  });

  area.appendChild(btn);
  if (type === 'golden') {
    setTimeout(() => { if (btn.parentNode) btn.remove(); }, 1800);
  } else if (type === 'poison') {
    setTimeout(() => { if (btn.parentNode) btn.remove(); }, 2000);
  }
}

function resetPlayfield(): void {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = undefined;
  isPlaying = false;
  score = 0;
  timeLeft = 10;
  runStats = createRunStats();
  resetStreak();
  message.textContent = '';
  message.classList.remove('tg-go-msg');
  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
  updateHud();
}

const shell = wireFreeCasualShell(host, startGame, {
  pauseable: true,
  onPause: () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = undefined;
    isPlaying = false;
  },
  onResume: () => {
    if (shell.getPhase() !== 'playing') return;
    isPlaying = true;
    timerInterval = setInterval(tickTimer, 1000);
  },
  onAbandon: resetPlayfield,
});

function tickTimer(): void {
  timeLeft--;
  updateHud();
  if (timeLeft <= 3 && timeLeft > 0) tapSfx.countdown();
  if (timeLeft <= 0) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = undefined;
    endGame();
  }
}

async function startGame(): Promise<void> {
  resetPlayfield();
  play('click');
  isPlaying = true;
  runStart = Date.now();
  message.textContent = '🔥 ' + t('tg.go');
  message.classList.add('tg-go-msg');
  updateHud();

  spawnTarget('regular');
  timerInterval = setInterval(tickTimer, 1000);
}

function endGame(): void {
  isPlaying = false;
  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
  const finalScore = displayScore();
  const isWin = finalScore >= targetScore;
  const durationMs = Date.now() - runStart;
  play(isWin ? 'win' : 'lose');
  const summary = isWin
    ? '🎉 ' + t('tg.win').replace('{s}', String(finalScore))
    : t('tg.lose').replace('{s}', String(finalScore)).replace('{n}', String(targetScore));
  message.textContent = summary;
  message.classList.remove('tg-go-msg');

  paintRunStats(
    document.getElementById('tgStatTaps'),
    document.getElementById('tgStatStreak'),
    document.getElementById('tgStatAccuracy'),
    document.getElementById('tgStatReaction'),
    runStats,
    durationMs,
  );

  shell.finishPlay(finalScore, isWin, '', durationMs);

  const finalEl = document.getElementById('finalScore');
  if (finalEl) animateCountUp(finalEl, finalScore);

  const overPanel = document.querySelector('#overOverlay .game-panel');
  if (isWin && overPanel) launchConfetti(overPanel as HTMLElement);
}

function initBgParticles(): void {
  const layer = document.querySelector('.tg-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'tg-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 30}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${6 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

document.documentElement.lang = getLang();
applyTranslations();
initBgParticles();
shell.refreshMenu();

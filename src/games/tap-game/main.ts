// Tap Game — reflex tapping with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

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

const area = $('#tg-area');
const message = $('#tg-message');
const hint = $('#tg-hint');

function displayScore(): number {
  return score * SCORE_MULT;
}

function play(type: 'tap' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'tap': case 'click': sfx.click(); break;
    case 'win': sfx.coin(); break;
    case 'lose': sfx.crash(); break;
  }
}

function updateHud(): void {
  shell.setHeader({
    time: String(timeLeft),
    score: String(displayScore()),
  });
}

function spawnTarget(type: 'regular' | 'golden' | 'poison' = 'regular'): void {
  if (!isPlaying) return;
  const btn = document.createElement('div');
  btn.className = `tg-target-btn ${type}`;
  btn.textContent = type === 'golden' ? '👑' : type === 'poison' ? '💀' : '🎯';

  const aW = area.offsetWidth || 290;
  const aH = area.offsetHeight || 290;
  const tSz = 60;
  btn.style.left = Math.random() * (aW - tSz) + 'px';
  btn.style.top = Math.random() * (aH - tSz) + 'px';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isPlaying) return;
    if (type === 'regular') {
      score += 1;
      play('tap');
      btn.remove();
      spawnTarget('regular');
      if (Math.random() < 0.25) spawnTarget('golden');
      if (Math.random() < 0.2) spawnTarget('poison');
    } else if (type === 'golden') {
      score += 3;
      play('win');
      btn.remove();
    } else {
      score = Math.max(0, score - 2);
      play('lose');
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
  message.textContent = '';
  hint.style.display = '';
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
  hint.style.display = 'none';
  updateHud();

  spawnTarget('regular');
  timerInterval = setInterval(tickTimer, 1000);
}

function endGame(): void {
  isPlaying = false;
  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
  const finalScore = displayScore();
  const isWin = finalScore >= targetScore;
  play(isWin ? 'win' : 'lose');
  const summary = isWin
    ? '🎉 ' + t('tg.win').replace('{s}', String(finalScore))
    : t('tg.lose').replace('{s}', String(finalScore)).replace('{n}', String(targetScore));
  message.textContent = summary;
  shell.finishPlay(finalScore, isWin, '', Date.now() - runStart);
}

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

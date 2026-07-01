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

const winRate = host.winRate;
const targetScore = winRate >= 70 ? 4 : winRate <= 30 ? 7 : 5;

let score = 0;
let timeLeft = 10;
let isPlaying = false;
let timerInterval: ReturnType<typeof setInterval> | undefined;
let runStart = 0;

const area = $('#tg-area');
const scoreEl = $('#tg-score');
const timeEl = $('#tg-time');
const message = $('#tg-message');
const hint = $('#tg-hint');

function play(type: 'tap' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'tap': case 'click': sfx.click(); break;
    case 'win': sfx.coin(); break;
    case 'lose': sfx.crash(); break;
  }
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
      area.style.background = 'rgba(255, 68, 68, 0.25)';
      setTimeout(() => { area.style.background = ''; }, 120);
    }
    scoreEl.textContent = String(score);
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
  isPlaying = false;
  score = 0;
  timeLeft = 10;
  scoreEl.textContent = '0';
  timeEl.textContent = '10';
  timeEl.style.color = '';
  message.textContent = '';
  hint.style.display = '';
  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
}

const shell = wireFreeCasualShell(host, startGame);

async function startGame(): Promise<void> {
  resetPlayfield();
  play('click');
  isPlaying = true;
  runStart = Date.now();
  message.textContent = '🔥 ' + t('tg.go');
  hint.style.display = 'none';

  spawnTarget('regular');
  timerInterval = setInterval(() => {
    timeLeft--;
    timeEl.textContent = String(timeLeft);
    if (timeLeft <= 3) timeEl.style.color = '#ff4444';
    if (timeLeft <= 0) {
      if (timerInterval) clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

function endGame(): void {
  isPlaying = false;
  timeEl.style.color = '';
  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
  const isWin = score >= targetScore;
  play(isWin ? 'win' : 'lose');
  const summary = isWin
    ? '🎉 ' + t('tg.win').replace('{s}', String(score))
    : t('tg.lose').replace('{s}', String(score)).replace('{n}', String(targetScore));
  message.textContent = summary;
  shell.finishPlay(score, isWin, summary, Date.now() - runStart);
}

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

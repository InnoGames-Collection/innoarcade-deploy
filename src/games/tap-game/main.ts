// Tap Game — a reflex game ported from the awetar build.
// The run score is the natural leaderboard metric, so it is what the host
// records / submits. winRate tunes the target needed to count as a "win".

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { profile } from '../../engine/profile';

const host = createHost('tap-game');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function play(type: 'tap' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'tap': case 'click': sfx.click(); break;
    case 'win': sfx.coin(); break;
    case 'lose': sfx.crash(); break;
  }
}

const winRate = host.winRate;
const targetScore = winRate >= 70 ? 4 : winRate <= 30 ? 7 : 5;

let score = 0;
let timeLeft = 10;
let isPlaying = false;
let timerInterval: ReturnType<typeof setInterval> | undefined;

const area = $('#tg-area');
const scoreEl = $('#tg-score');
const timeEl = $('#tg-time');
const message = $('#tg-message');
const startBtn = $('#tg-start-btn') as HTMLButtonElement;
const hint = $('#tg-hint');

function setHUD(): void {
  $('#tg-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('arc.free');
  $('#tg-hud-win').textContent = `+${host.winPoints} ${t('arc.pts')}`;
  if (!isPlaying) message.textContent = t('tg.goal').replace('{n}', String(targetScore));
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

async function startGame(): Promise<void> {
  if (isPlaying) return;
  // Host gate — free games pass instantly; tournament games would charge here.
  const begin = await host.begin();
  if (!begin.ok) {
    message.textContent = begin.reason === 'auth' ? t('arc.signIn') : t('arc.needCoins');
    return;
  }
  play('click');
  isPlaying = true;
  score = 0;
  timeLeft = 10;
  scoreEl.textContent = '0';
  timeEl.textContent = '10';
  message.textContent = '🔥 ' + t('tg.go');
  startBtn.disabled = true;
  startBtn.textContent = t('arc.playing');
  hint.style.display = 'none';

  document.querySelectorAll('.tg-target-btn').forEach((el) => el.remove());
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
  message.textContent = isWin
    ? '🎉 ' + t('tg.win').replace('{s}', String(score))
    : t('tg.lose').replace('{s}', String(score)).replace('{n}', String(targetScore));
  startBtn.disabled = false;
  startBtn.textContent = t('arc.playAgain');
  hint.style.display = '';
  host.finish(score, isWin);
}

startBtn.addEventListener('click', () => void startGame());

// --- Language switch --------------------------------------------------------
const langEn = $('#langEn');
const langAm = $('#langAm');
function syncLangButtons(): void {
  const lang = getLang();
  langEn.classList.toggle('active', lang === 'en');
  langAm.classList.toggle('active', lang === 'am');
  setHUD();
}
function pick(lang: Lang): void {
  setLang(lang);
  applyTranslations();
  if (!isPlaying) startBtn.textContent = score > 0 ? t('arc.playAgain') : t('arc.start');
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
setHUD();
void profile.coins;

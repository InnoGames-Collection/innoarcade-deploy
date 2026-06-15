// Memory Match — a skill game ported from the awetar build.
//
// The original used page-global hooks (window.currentGameWin, currentCoinsCost,
// currentPointsWin, playSound). Those are replaced by the shared GameHost: it
// owns the economy/best-score wiring, so the same logic drops straight onto the
// InnoArcade platform and, by flipping the catalog `mode`, could become a
// tournament with no change here.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { profile } from '../../engine/profile';

const host = createHost('memory-match');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

// Map the awetar sound names onto the engine's synthesised SFX.
function play(type: 'flip' | 'match' | 'nomatch' | 'win' | 'lose' | 'click'): void {
  switch (type) {
    case 'flip': case 'click': sfx.click(); break;
    case 'match': case 'win': sfx.coin(); break;
    case 'nomatch': sfx.slide(); break;
    case 'lose': sfx.crash(); break;
  }
}

const winRate = host.winRate;
const maxMoves = winRate >= 70 ? 18 : winRate <= 30 ? 10 : 14;
const emojis = ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑'];

let cards: string[] = [];
let flipped: HTMLElement[] = [];
let moves = 0;
let pairs = 0;
let canFlip = true;
let peekUsed = false;
let isPeeking = false;
let roundOver = false;

const grid = $('#mm-grid');
const movesEl = $('#mm-moves');
const pairsEl = $('#mm-pairs');
const message = $('#mm-message');
const restartBtn = $('#mm-restart-btn');
const peekBtn = $('#mm-peek-btn') as HTMLButtonElement;

function setHUD(): void {
  $('#mm-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('mm.free');
  $('#mm-hud-win').textContent = `+${host.winPoints} ${t('mm.pts')}`;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initGame(): void {
  cards = shuffle([...emojis, ...emojis]);
  flipped = [];
  moves = 0;
  pairs = 0;
  canFlip = true;
  roundOver = false;
  movesEl.textContent = '0/' + maxMoves;
  pairsEl.textContent = '0/6';
  message.textContent = t('mm.findPairs').replace('{n}', String(maxMoves));
  message.style.color = '';
  grid.innerHTML = '';

  peekUsed = false;
  isPeeking = false;
  peekBtn.disabled = false;
  peekBtn.textContent = 'PEEK (1)';

  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'mm-card';
    card.dataset.i = String(i);
    card.dataset.e = emoji;
    card.textContent = '❓';
    card.addEventListener('click', () => flipCard(card));
    grid.appendChild(card);
  });
}

function endRound(isWin: boolean): void {
  if (roundOver) return;
  roundOver = true;
  void host.finish(isWin ? host.winPoints : 0, isWin);
  // Best (lowest moves is "better" here, but the platform best tracks score) and
  // the in-game coin balance both update through the host; reflect the latter.
  $('#mm-hud-win').textContent = `+${host.winPoints} ${t('mm.pts')}`;
}

function flipCard(card: HTMLElement): void {
  if (!canFlip || isPeeking || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  play('flip');
  card.classList.add('flipped');
  card.textContent = card.dataset.e!;
  flipped.push(card);
  if (flipped.length === 2) {
    moves++;
    movesEl.textContent = moves + '/' + maxMoves;
    canFlip = false;
    checkMatch();
  }
}

function checkMatch(): void {
  const [c1, c2] = flipped;
  if (c1.dataset.e === c2.dataset.e) {
    c1.classList.add('matched');
    c2.classList.add('matched');
    pairs++;
    pairsEl.textContent = `${pairs}/6`;
    flipped = [];
    canFlip = true;
    play('match');
    if (pairs === 6) {
      const stars = moves <= 9 ? 3 : moves <= 13 ? 2 : 1;
      message.textContent = `🎉 ${t('mm.perfect')} ${'⭐'.repeat(stars)} (${moves})`;
      message.style.color = '#ffd700';
      play('win');
      endRound(true);
    } else if (moves >= maxMoves) {
      message.textContent = t('mm.outOfMoves').replace('{n}', String(maxMoves));
      message.style.color = '#ff4444';
      canFlip = false;
      play('lose');
      endRound(false);
    }
  } else {
    play('nomatch');
    setTimeout(() => {
      c1.classList.remove('flipped');
      c2.classList.remove('flipped');
      c1.textContent = '❓';
      c2.textContent = '❓';
      flipped = [];
      if (moves >= maxMoves && pairs < 6) {
        message.textContent = t('mm.outOfMoves').replace('{n}', String(maxMoves));
        message.style.color = '#ff4444';
        canFlip = false;
        play('lose');
        endRound(false);
      } else {
        canFlip = true;
      }
    }, 900);
  }
}

function triggerPeek(): void {
  if (peekUsed || isPeeking) return;
  peekUsed = true;
  isPeeking = true;
  peekBtn.disabled = true;
  peekBtn.textContent = 'PEEK (0)';
  play('click');
  play('flip');
  const allCards = Array.from(document.querySelectorAll<HTMLElement>('.mm-card'));
  allCards.forEach((card) => {
    if (!card.classList.contains('matched') && !card.classList.contains('flipped')) {
      card.textContent = card.dataset.e!;
      card.classList.add('flipped');
    }
  });
  setTimeout(() => {
    allCards.forEach((card) => {
      if (!card.classList.contains('matched') && !flipped.includes(card)) {
        card.textContent = '❓';
        card.classList.remove('flipped');
      }
    });
    isPeeking = false;
  }, 1200);
}

peekBtn.addEventListener('click', triggerPeek);
restartBtn.addEventListener('click', () => {
  play('click');
  initGame();
});

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
  syncLangButtons();
  if (!roundOver && pairs === 0 && moves === 0) {
    message.textContent = t('mm.findPairs').replace('{n}', String(maxMoves));
  }
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
setHUD();
initGame();

// touch the profile import so the welcome balance is initialised on first load
void profile.coins;

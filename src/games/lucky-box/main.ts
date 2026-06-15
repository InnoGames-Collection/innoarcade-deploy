// Lucky Boxes — a chance game ported from the awetar build (tournament mode).
// Pick a box; a win opens a double-or-nothing chest stage (take the win, or
// gamble for double / lose it). Outcomes use a CSPRNG; the entry fee is charged
// once per tournament window and points accumulate to the leaderboard.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';

const host = createHost('lucky-box');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const inner = (el: Element): HTMLElement => el.querySelector('.lb-box-inner') as HTMLElement;

function chance(ratePct: number): boolean {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] / 0x100000000) * 100 < ratePct;
}
function coinFlip(): boolean {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] < 128;
}
function pickIndex(arr: number[]): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return arr[buf[0] % arr.length];
}

const boxes = Array.from(document.querySelectorAll<HTMLElement>('.lb-box'));
const message = $('#lb-message');
const resetBtn = $('#lb-reset-btn');
const gambleContainer = $('#lb-gamble-container');
const cashoutBtn = $('#lb-cashout-btn');
const gambleChests = Array.from(document.querySelectorAll<HTMLElement>('.lb-gamble-chest'));

let prizes = ['🎉', '😔', '😔'];
let gamePlayed = false;
let isGambleStage = false;
let gambleResolved = false;
let sessionPoints = 0;

function setHUD(): void {
  $('#lb-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('arc.free');
  $('#lb-hud-win').textContent = `+${host.winPoints} ${t('arc.pts')}`;
}

function renderTournament(): void {
  const strip = $('#lb-tourney');
  if (!host.isTournament || !host.tournament) { strip.style.display = 'none'; return; }
  const title = getLang() === 'am' ? host.tournament.titleAm : host.tournament.titleEn;
  $('#lb-t-name').textContent = `${title} · ${t('arc.endsIn')} ${host.countdownText()}`;
  const standing = host.standing();
  $('#lb-rank').textContent = standing ? `#${standing.rank}` : '#—';
}

function submit(points: number, isWin: boolean): void {
  if (isWin) sessionPoints += points;
  void host.finish(sessionPoints, isWin).then((res) => {
      if (host.isTournament && res.rank) $('#lb-rank').textContent = `#${res.rank}`;
    });
}

function initGame(): void {
  prizes = ['🎉', '😔', '😔'];
  gamePlayed = false;
  message.textContent = t('lb.pick');
  message.style.color = '';
  boxes.forEach((box) => {
    box.classList.remove('opened');
    inner(box).textContent = '📦';
  });
  gambleContainer.style.display = 'none';
  gambleResolved = false;
  isGambleStage = false;
  gambleChests.forEach((c) => {
    c.classList.remove('opened');
    inner(c).textContent = '🔮';
  });
  resetBtn.style.display = 'inline-block';
}

async function openBox(box: HTMLElement, index: number): Promise<void> {
  if (gamePlayed) return;
  // Charge into the tournament on the first pick of a round.
  const begin = await host.begin();
  if (!begin.ok) {
    message.textContent = begin.reason === 'auth' ? t('arc.signIn') : t('arc.needCoins');
    return;
  }
  gamePlayed = true;
  setHUD();

  const isWin = chance(host.winRate);
  prizes = ['😔', '😔', '😔'];
  if (isWin) {
    prizes[index] = '🎉';
  } else {
    prizes[pickIndex([0, 1, 2].filter((i) => i !== index))] = '🎉';
  }

  box.classList.add('opened');
  inner(box).textContent = prizes[index];
  sfx.click();

  setTimeout(() => {
    boxes.forEach((b, i) => {
      if (!b.classList.contains('opened')) {
        b.classList.add('opened');
        inner(b).textContent = prizes[i];
      }
    });
  }, 600);

  setTimeout(() => {
    if (isWin) {
      sfx.coin();
      isGambleStage = true;
      resetBtn.style.display = 'none';
      message.textContent = t('lb.found');
      message.style.color = '#ffd700';
      gambleContainer.style.display = 'flex';
    } else {
      message.textContent = t('lb.wrong');
      message.style.color = '#c77dff';
      sfx.crash();
      submit(0, false);
    }
  }, 750);
}

function pickGamble(chest: HTMLElement, gidx: number): void {
  if (!isGambleStage || gambleResolved) return;
  gambleResolved = true;
  const gamblePrizes = coinFlip() ? ['💎', '💥'] : ['💥', '💎'];
  chest.classList.add('opened');
  inner(chest).textContent = gamblePrizes[gidx];
  const doubleWin = gamblePrizes[gidx] === '💎';
  sfx[doubleWin ? 'coin' : 'crash']();

  setTimeout(() => {
    gambleChests.forEach((c, idx) => {
      if (!c.classList.contains('opened')) {
        c.classList.add('opened');
        inner(c).textContent = gamblePrizes[idx];
      }
    });
  }, 400);

  setTimeout(() => {
    gambleContainer.style.display = 'none';
    resetBtn.style.display = 'inline-block';
    if (doubleWin) {
      message.textContent = t('lb.double').replace('{p}', String(host.winPoints * 2));
      message.style.color = '#ffd700';
      submit(host.winPoints * 2, true);
    } else {
      message.textContent = t('lb.boom');
      message.style.color = '#ff6b6b';
      submit(0, false);
    }
  }, 1400);
}

cashoutBtn.addEventListener('click', () => {
  if (!isGambleStage || gambleResolved) return;
  gambleResolved = true;
  sfx.click();
  gambleContainer.style.display = 'none';
  resetBtn.style.display = 'inline-block';
  message.textContent = t('lb.cashedOut').replace('{p}', String(host.winPoints));
  message.style.color = '#ffd700';
  submit(host.winPoints, true);
});

boxes.forEach((box) => {
  box.addEventListener('click', () => void openBox(box, Number(box.dataset.index)));
});
gambleChests.forEach((chest) => {
  chest.addEventListener('click', () => pickGamble(chest, Number(chest.dataset.gidx)));
});
resetBtn.addEventListener('click', () => { sfx.click(); initGame(); });

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
  if (!gamePlayed) message.textContent = t('lb.pick');
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
syncLangButtons();
setHUD();
initGame();

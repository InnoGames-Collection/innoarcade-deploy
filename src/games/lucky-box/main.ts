// Lucky Boxes — pick-a-box + gamble with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

const host = createHost('lucky-box');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const inner = (el: Element): HTMLElement => el.querySelector('.lb-box-inner') as HTMLElement;

const GIFT_ICON = `<svg class="lb-gift-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 7H2v5h20V7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C10.5 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13.5 2 12 7 12 7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
const gambleContainer = $('#lb-gamble-container');
const cashoutBtn = $('#lb-cashout-btn');
const gambleChests = Array.from(document.querySelectorAll<HTMLElement>('.lb-gamble-chest'));

let prizes = ['🎉', '😔', '😔'];
let gamePlayed = false;
let isGambleStage = false;
let gambleResolved = false;
let runStart = 0;

const shell = wireFreeCasualShell(host, initGame, { headerSlots: [], chanceOver: true });

function finishRound(points: number, isWin: boolean): void {
  shell.finishPlay(points, isWin, '', Date.now() - runStart);
}

function setGiftIcon(box: HTMLElement): void {
  inner(box).innerHTML = GIFT_ICON;
}

function initGame(): void {
  prizes = ['🎉', '😔', '😔'];
  gamePlayed = false;
  message.textContent = '';
  message.className = 'lb-message';
  boxes.forEach((box) => {
    box.classList.remove('opened');
    setGiftIcon(box);
  });
  gambleContainer.style.display = 'none';
  gambleResolved = false;
  isGambleStage = false;
  gambleChests.forEach((c) => {
    c.classList.remove('opened');
    inner(c).innerHTML = GIFT_ICON;
  });
}

function openBox(box: HTMLElement, index: number): void {
  if (gamePlayed) return;
  runStart = Date.now();
  gamePlayed = true;

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
      message.textContent = t('lb.win');
      message.className = 'lb-message lb-message--win';
      gambleContainer.style.display = 'flex';
    } else {
      message.textContent = t('lb.lose');
      message.className = 'lb-message lb-message--lose';
      sfx.crash();
      finishRound(0, false);
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
    if (doubleWin) {
      message.textContent = t('lb.double');
      message.className = 'lb-message lb-message--win';
      finishRound(host.winPoints * 2, true);
    } else {
      message.textContent = t('lb.lose');
      message.className = 'lb-message lb-message--lose';
      finishRound(0, false);
    }
  }, 1400);
}

cashoutBtn.addEventListener('click', () => {
  if (!isGambleStage || gambleResolved) return;
  gambleResolved = true;
  sfx.click();
  gambleContainer.style.display = 'none';
  message.textContent = t('lb.win');
  message.className = 'lb-message lb-message--win';
  finishRound(host.winPoints, true);
});

boxes.forEach((box) => {
  box.addEventListener('click', () => openBox(box, Number(box.dataset.index)));
});
gambleChests.forEach((chest) => {
  chest.addEventListener('click', () => pickGamble(chest, Number(chest.dataset.gidx)));
});

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

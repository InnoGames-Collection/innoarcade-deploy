// Lucky Slot — 3-reel slot with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

const host = createHost('luckyslot');
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
const rand = () => randInt(1_000_000) / 1_000_000;

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

const reelStrips = [$('#slot-reel1'), $('#slot-reel2'), $('#slot-reel3')];
const spinBtn = $('#slot-spinBtn') as HTMLButtonElement;
const messageDisplay = $('#slot-message-display');
const machineElement = $('#slot-machine-body');

let isSpinning = false;
let runStart = 0;
let slotTickInterval: ReturnType<typeof setInterval> | undefined;

function initIdleReels(): void {
  reelStrips.forEach((strip) => {
    const row = Array.from({ length: 10 }, () => SYMBOLS[randInt(SYMBOLS.length)]);
    const doubled = row.concat(row);
    strip.innerHTML = doubled.map((s) => `<div class="slot-symbol">${s}</div>`).join('');
    strip.style.top = '0px';
    strip.style.transition = '';
    strip.style.transform = '';
    strip.classList.remove('slot-blur');
  });
  machineElement.classList.add('slot-idle');
}

function resetSlot(): void {
  clearInterval(slotTickInterval);
  isSpinning = false;
  spinBtn.disabled = false;
  machineElement.classList.remove('slot-win-glow');
  messageDisplay.textContent = '';
  initIdleReels();
}

const shell = wireFreeCasualShell(host, beginSpin, { headerSlots: [] });

async function beginSpin(): Promise<void> {
  resetSlot();
  runStart = Date.now();
}

async function runSpinLogic(): Promise<void> {
  if (isSpinning) return;
  isSpinning = true;
  spinBtn.disabled = true;
  machineElement.classList.remove('slot-win-glow', 'slot-idle');
  messageDisplay.textContent = '';
  sfx.click();

  clearInterval(slotTickInterval);
  slotTickInterval = setInterval(() => sfx.click(), 110);

  const isWin = chance(host.winRate);
  const results: string[] = [];
  if (isWin) {
    if (rand() < 0.2) {
      const tripleSym = SYMBOLS[randInt(SYMBOLS.length)];
      results.push(tripleSym, tripleSym, tripleSym);
    } else {
      const sym1 = SYMBOLS[randInt(SYMBOLS.length)];
      let sym2 = SYMBOLS[randInt(SYMBOLS.length)];
      while (sym1 === sym2) sym2 = SYMBOLS[randInt(SYMBOLS.length)];
      const patterns = [
        [sym1, sym1, sym2],
        [sym2, sym1, sym1],
        [sym1, sym2, sym1],
      ];
      results.push(...patterns[randInt(patterns.length)]);
    }
  } else {
    const tempSymbols = [...SYMBOLS];
    for (let i = 0; i < 3; i++) results.push(tempSymbols.splice(randInt(tempSymbols.length), 1)[0]);
  }

  const firstSym = document.querySelector('.slot-symbol');
  const rh = (firstSym ? parseInt(getComputedStyle(firstSym).height) : 150) || 150;
  reelStrips.forEach((strip, index) => {
    const targetSymbol = results[index];
    const stripSymbols = [SYMBOLS[randInt(SYMBOLS.length)]];
    const fakeCount = 18 + index * 9;
    for (let i = 0; i < fakeCount; i++) stripSymbols.push(SYMBOLS[randInt(SYMBOLS.length)]);
    stripSymbols.push(targetSymbol);
    strip.innerHTML = stripSymbols.map((s) => `<div class="slot-symbol">${s}</div>`).join('');
    const totalH = (stripSymbols.length - 1) * rh;
    strip.style.transition = 'none';
    strip.style.transform = '';
    strip.style.top = `-${totalH}px`;
    strip.classList.add('slot-blur');
    setTimeout(() => {
      strip.style.transition = `top ${1.7 + index * 0.55}s cubic-bezier(0.22,1,0.36,1)`;
      strip.style.top = '0px';
    }, 60);
    setTimeout(() => {
      strip.classList.remove('slot-blur');
      strip.innerHTML = `<div class="slot-symbol">${targetSymbol}</div>`;
      if (index === 2) {
        clearInterval(slotTickInterval);
        evaluateWin(results);
      }
    }, 1700 + index * 550);
  });
}

function evaluateWin(results: string[]): void {
  isSpinning = false;
  spinBtn.disabled = false;
  const [r1, r2, r3] = results;
  let isWin = false;
  let summary = '';
  if (r1 === r2 && r2 === r3) {
    isWin = true;
    summary = t('sl.jackpot').replace('{p}', String(host.winPoints));
    machineElement.classList.add('slot-win-glow');
    sfx.coin();
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    isWin = true;
    summary = t('sl.twoMatch').replace('{p}', String(host.winPoints));
    sfx.coin();
  } else {
    summary = t('sl.tryAgain');
    sfx.crash();
  }
  messageDisplay.textContent = summary;
  shell.finishPlay(isWin ? host.winPoints : 0, isWin, '', Date.now() - runStart);
}

spinBtn.addEventListener('click', () => void runSpinLogic());

document.documentElement.lang = getLang();
applyTranslations();
initIdleReels();

// Lucky Slot — a 3-reel slot ported from the awetar build (tournament mode).
// The outcome is decided by a CSPRNG at the configured win rate, and the reels
// are filled to land on a matching/non-matching result accordingly. Entry fee
// is charged once per window; wins accumulate to the leaderboard.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';

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
let slotTickInterval: ReturnType<typeof setInterval> | undefined;
let sessionPoints = 0;

function setHUD(): void {
  $('#slot-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('arc.free');
  $('#slot-hud-win').textContent = `+${host.winPoints} ${t('arc.pts')}`;
}

function renderTournament(): void {
  const strip = $('#slot-tourney');
  if (!host.isTournament || !host.tournament) { strip.style.display = 'none'; return; }
  const title = getLang() === 'am' ? host.tournament.titleAm : host.tournament.titleEn;
  $('#slot-t-name').textContent = `${title} · ${t('arc.endsIn')} ${host.countdownText()}`;
  const standing = host.standing();
  $('#slot-rank').textContent = standing ? `#${standing.rank}` : '#—';
}

function initReels(): void {
  reelStrips.forEach((strip, i) => {
    strip.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'slot-symbol';
    el.textContent = SYMBOLS[i % SYMBOLS.length];
    strip.appendChild(el);
    strip.style.top = '0px';
  });
}

async function runSpinLogic(): Promise<void> {
  if (isSpinning) return;
  const begin = await host.begin();
  if (!begin.ok) {
    messageDisplay.textContent = begin.reason === 'auth' ? t('arc.signIn') : t('arc.needCoins');
    return;
  }
  setHUD();
  isSpinning = true;
  spinBtn.disabled = true;
  machineElement.classList.remove('slot-win-glow');
  messageDisplay.textContent = t('sl.spinning');
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
    const stripSymbols = [strip.children[0] ? strip.children[0].textContent! : SYMBOLS[0]];
    const fakeCount = 18 + index * 9;
    for (let i = 0; i < fakeCount; i++) stripSymbols.push(SYMBOLS[randInt(SYMBOLS.length)]);
    stripSymbols.push(targetSymbol);
    strip.innerHTML = stripSymbols.map((s) => `<div class="slot-symbol">${s}</div>`).join('');
    const totalH = (stripSymbols.length - 1) * rh;
    strip.style.transition = 'none';
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
  if (r1 === r2 && r2 === r3) {
    isWin = true;
    messageDisplay.textContent = t('sl.jackpot').replace('{p}', String(host.winPoints));
    machineElement.classList.add('slot-win-glow');
    sfx.coin();
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    isWin = true;
    messageDisplay.textContent = t('sl.twoMatch').replace('{p}', String(host.winPoints));
    sfx.coin();
  } else {
    messageDisplay.textContent = t('sl.tryAgain');
    sfx.crash();
  }
  if (isWin) sessionPoints += host.winPoints;
  void host.finish(sessionPoints, isWin).then((res) => {
      if (host.isTournament && res.rank) $('#slot-rank').textContent = `#${res.rank}`;
    });
}

spinBtn.addEventListener('click', () => void runSpinLogic());

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
  if (!isSpinning) messageDisplay.textContent = t('sl.tapSpin');
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
messageDisplay.textContent = t('sl.tapSpin');
syncLangButtons();
setHUD();
initReels();

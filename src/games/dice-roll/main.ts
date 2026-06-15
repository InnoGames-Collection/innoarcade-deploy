// Dice Roll — a chance game ported from the awetar build (tournament mode).
//
// Two integrity changes vs the original:
//   1. The outcome is decided LOCALLY with a CSPRNG (crypto.getRandomValues) at
//      the configured win rate — the old build trusted a server `is_win` flag
//      that the client could forge. There is no such hook here.
//   2. Economy runs through the host: the tournament entry fee is debited once
//      per window on the first roll; each win adds points to a running session
//      total that is submitted to the leaderboard.
//
// Flip the catalog mode to 'free' and the entry fee / leaderboard simply fall
// away (host.isTournament === false) with no change to this file.

import '../../styles/base.css';
import './style.css';
import { applyTranslations, getLang, setLang, t, type Lang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';

const host = createHost('dice-roll');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

// --- CSPRNG helpers ---------------------------------------------------------
function chance(ratePct: number): boolean {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] / 0x100000000) * 100 < ratePct;
}
function dieFace(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 6) + 1;
}

const rotationMapping: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  6: { x: 0, y: 180 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  2: { x: -90, y: 0 },
  5: { x: 90, y: 0 },
};

const cube1 = $('#dr-cube1');
const cube2 = $('#dr-cube2');
const message = $('#dr-message');
const rollBtn = $('#dr-roll-btn') as HTMLButtonElement;

let isRolling = false;
let sessionPoints = 0;

function play(type: 'click' | 'tick' | 'stop'): void {
  switch (type) {
    case 'click': sfx.click(); break;
    case 'tick': sfx.click(); break;
    case 'stop': sfx.coin(); break;
  }
}

function setHUD(): void {
  $('#dr-hud-cost').textContent = host.costCoins > 0 ? `${host.costCoins} 🪙` : t('arc.free');
  $('#dr-hud-win').textContent = `+${host.winPoints} ${t('arc.pts')}`;
}

function renderTournament(): void {
  const strip = $('#dr-tourney');
  if (!host.isTournament || !host.tournament) {
    strip.style.display = 'none';
    return;
  }
  const title = getLang() === 'am' ? host.tournament.titleAm : host.tournament.titleEn;
  $('#dr-t-name').textContent = `${title} · ${t('arc.endsIn')} ${host.countdownText()}`;
  const standing = host.standing();
  $('#dr-rank').textContent = standing ? `#${standing.rank}` : '#—';
}

function rollDice(): void {
  if (isRolling) return;
  void beginRoll();
}

async function beginRoll(): Promise<void> {
  // Charge into the tournament (once per window). Free mode passes instantly.
  const begin = await host.begin();
  if (!begin.ok) {
    message.textContent = begin.reason === 'auth' ? t('arc.signIn') : t('arc.needCoins');
    return;
  }
  setHUD(); // entry may have changed the displayed balance-derived state

  isRolling = true;
  rollBtn.disabled = true;
  play('click');
  message.textContent = '🎲 ' + t('dr.rolling');
  message.style.color = '';

  let tick = 0;
  const ticks = 12;
  const iv = setInterval(() => {
    tick++;
    play('tick');
    const r = () => Math.random() * 600 + 300;
    cube1.style.transform = `rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(10deg)`;
    cube2.style.transform = `rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(-10deg)`;
    if (tick >= ticks) {
      clearInterval(iv);
      finishRoll();
    }
  }, 80);
}

function finishRoll(): void {
  const isWin = chance(host.winRate);
  let v1 = dieFace();
  let v2: number;
  if (isWin) {
    v2 = v1; // doubles
  } else {
    v2 = dieFace();
    if (v1 === v2) v2 = (v2 % 6) + 1; // guarantee a non-match on a loss
  }

  const rot1 = rotationMapping[v1];
  const rot2 = rotationMapping[v2];
  const spin = 1080;
  cube1.style.transform = `rotateX(${rot1.x + spin}deg) rotateY(${rot1.y + spin}deg) rotateZ(0deg)`;
  cube2.style.transform = `rotateX(${rot2.x + spin}deg) rotateY(${rot2.y + spin}deg) rotateZ(0deg)`;

  setTimeout(() => play('stop'), 700);
  setTimeout(() => {
    isRolling = false;
    rollBtn.disabled = false;
    if (isWin) {
      sessionPoints += host.winPoints;
      message.textContent = '🎉 ' + t('dr.win').replace('{p}', String(host.winPoints));
      message.style.color = '#ffd700';
    } else {
      message.textContent = t('dr.lose').replace('{a}', String(v1)).replace('{b}', String(v2));
      message.style.color = '';
    }
    void host.finish(sessionPoints, isWin).then((res) => {
      if (host.isTournament && res.rank) $('#dr-rank').textContent = `#${res.rank}`;
    });
  }, 1100);
}

rollBtn.addEventListener('click', rollDice);

// Idle dice pose before the first roll.
const s1 = dieFace();
const s2 = dieFace();
cube1.style.transform = `rotateX(${rotationMapping[s1].x}deg) rotateY(${rotationMapping[s1].y}deg)`;
cube2.style.transform = `rotateX(${rotationMapping[s2].x}deg) rotateY(${rotationMapping[s2].y}deg)`;

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
  if (!isRolling && sessionPoints === 0) message.textContent = t('dr.tapRoll');
  syncLangButtons();
}
langEn.addEventListener('click', () => pick('en'));
langAm.addEventListener('click', () => pick('am'));

document.documentElement.lang = getLang();
applyTranslations();
message.textContent = t('dr.tapRoll');
syncLangButtons();

// Dice Roll — chance doubles game with hub casual shell.

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang, t } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';

const host = createHost('dice-roll');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

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
let runStart = 0;

function play(type: 'click' | 'tick' | 'stop'): void {
  switch (type) {
    case 'click': sfx.click(); break;
    case 'tick': sfx.click(); break;
    case 'stop': sfx.coin(); break;
  }
}

function resetDice(): void {
  isRolling = false;
  rollBtn.disabled = false;
  message.textContent = t('dr.tapRoll');
  message.style.color = '';
}

const shell = wireFreeCasualShell(host, beginRoll);

async function beginRoll(): Promise<void> {
  resetDice();
  runStart = Date.now();
  message.textContent = t('dr.tapRoll');
  rollBtn.disabled = false;
}

async function rollDice(): Promise<void> {
  if (isRolling) return;
  isRolling = true;
  rollBtn.disabled = true;
  play('click');
  message.textContent = '🎲 ' + t('dr.rolling');
  message.style.color = '';

  let tick = 0;
  const ticks = 12;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      tick++;
      play('tick');
      const r = () => Math.random() * 600 + 300;
      cube1.style.transform = `rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(10deg)`;
      cube2.style.transform = `rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(-10deg)`;
      if (tick >= ticks) {
        clearInterval(iv);
        resolve();
      }
    }, 80);
  });

  const isWin = chance(host.winRate);
  let v1 = dieFace();
  let v2: number;
  if (isWin) {
    v2 = v1;
  } else {
    v2 = dieFace();
    if (v1 === v2) v2 = (v2 % 6) + 1;
  }

  const rot1 = rotationMapping[v1];
  const rot2 = rotationMapping[v2];
  const spin = 1080;
  cube1.style.transform = `rotateX(${rot1.x + spin}deg) rotateY(${rot1.y + spin}deg) rotateZ(0deg)`;
  cube2.style.transform = `rotateX(${rot2.x + spin}deg) rotateY(${rot2.y + spin}deg) rotateZ(0deg)`;

  setTimeout(() => play('stop'), 700);
  await new Promise<void>((resolve) => setTimeout(resolve, 1100));

  const summary = isWin
    ? '🎉 ' + t('dr.win').replace('{p}', String(host.winPoints))
    : t('dr.lose').replace('{a}', String(v1)).replace('{b}', String(v2));
  message.textContent = summary;
  message.style.color = isWin ? '#ffd700' : '';
  isRolling = false;
  rollBtn.disabled = true;
  shell.finishPlay(isWin ? 1 : 0, isWin, summary, Date.now() - runStart);
}

rollBtn.addEventListener('click', () => void rollDice());

const s1 = dieFace();
const s2 = dieFace();
cube1.style.transform = `rotateX(${rotationMapping[s1].x}deg) rotateY(${rotationMapping[s1].y}deg)`;
cube2.style.transform = `rotateX(${rotationMapping[s2].x}deg) rotateY(${rotationMapping[s2].y}deg)`;

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { wireFreeCasualShell } from '../../platform/freeGameShell';
import { finalizeArcadeScore, scaleArcadeScore } from '../../platform/arcadeScore';

const host = createHost('reflex-tap');
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const ROUND_MS = 60_000;
const area = $('#rt-area');
const hint = $('#rt-hint');

let score = 0;
let hits = 0;
let misses = 0;
let runStart = 0;
let endAt = 0;
let timerId = 0;
let spawnId = 0;
let active: HTMLButtonElement | null = null;
let playing = false;

function updateHud(): void {
  const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  shell.setHeader({ score: String(scaleArcadeScore(score)), time: `${left}s` });
}

function clearTarget(): void {
  if (active) { active.remove(); active = null; }
}

function spawnTarget(): void {
  if (!playing) return;
  clearTarget();
  hint.style.display = 'none';
  const rect = area.getBoundingClientRect();
  const size = 44 + Math.random() * 28;
  const margin = size / 2 + 8;
  const x = margin + Math.random() * (rect.width - size - margin * 2);
  const y = margin + Math.random() * (rect.height - size - margin * 2);
  const life = Math.max(500, 1400 - score * 8);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rt-target';
  btn.style.width = btn.style.height = `${size}px`;
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!playing || active !== btn) return;
    hits++;
    score += 10 + Math.floor(size / 10);
    sfx.coin();
    clearTarget();
    updateHud();
    scheduleSpawn();
  });
  area.appendChild(btn);
  active = btn;
  window.setTimeout(() => {
    if (active !== btn || !playing) return;
    misses++;
    score = Math.max(0, score - 5);
    btn.classList.add('miss');
    sfx.slide();
    window.setTimeout(() => { if (active === btn) clearTarget(); scheduleSpawn(); }, 120);
    updateHud();
  }, life);
}

function scheduleSpawn(): void {
  window.clearTimeout(spawnId);
  if (!playing) return;
  const delay = Math.max(180, 520 - score * 2);
  spawnId = window.setTimeout(spawnTarget, delay);
}

function endRound(): void {
  if (!playing) return;
  playing = false;
  window.clearTimeout(spawnId);
  window.clearInterval(timerId);
  clearTarget();
  const accuracy = hits + misses > 0 ? hits / (hits + misses) : 0;
  score += Math.floor(accuracy * 80);
  const finalScore = finalizeArcadeScore(score, Date.now() - runStart, { budgetSec: 70 });
  shell.finishPlay(finalScore, finalScore >= host.winScore, '', Date.now() - runStart);
}

function resetGame(): void {
  playing = false;
  score = 0; hits = 0; misses = 0;
  window.clearTimeout(spawnId);
  window.clearInterval(timerId);
  clearTarget();
  hint.style.display = '';
}

const shell = wireFreeCasualShell(host, beginPlay, {
  headerSlots: [
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
    { id: 'time', labelKey: 'mm.time', icon: 'time' },
  ],
  onAbandon: resetGame,
});

async function beginPlay(): Promise<void> {
  resetGame();
  playing = true;
  runStart = Date.now();
  endAt = runStart + ROUND_MS;
  updateHud();
  timerId = window.setInterval(updateHud, 250);
  window.setTimeout(endRound, ROUND_MS);
  scheduleSpawn();
}

document.documentElement.lang = getLang();
applyTranslations();
shell.refreshMenu();

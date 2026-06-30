// Pop Blast — a match-3 a built-in GoPlay game (free mode).
// The board/match logic is faithful to the original; the external mixkit audio
// is replaced with the engine's synthesised SFX, and the run score is recorded
// through the host (win threshold mirrors the original: score > 20).

import '../../styles/base.css';
import '../../styles/game-shell.css';
import './style.css';
import { applyTranslations, getLang } from '../../i18n';
import { sfx } from '../../engine/audio';
import { createHost } from '../../platform/gameHost';
import { ensureToast, paintInlineReward, renderFreeHudHtml, startFreeRound } from '../../platform/freeGameShell';

const host = createHost('popblast');

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const freeHud = $('#freeHud');
const runReward = $('#runReward');
const toast = ensureToast('popblast-toast');

const board = $('#board');
const scoreDisplay = $('#score');
const movesDisplay = $('#moves');
const combo = $('#combo');

const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const START_MOVES = 20;

let squares: HTMLElement[] = [];
let score = 0;
let moves = START_MOVES;
let startX = 0;
let startY = 0;
let draggedId = 0;
let gameEnded = false;

function mountFreeHud(): void {
  freeHud.innerHTML = renderFreeHudHtml(host);
}

function play(type: 'flip' | 'match' | 'pop' | 'nomatch' | 'click'): void {
  switch (type) {
    case 'flip': case 'click': sfx.click(); break;
    case 'match': sfx.coin(); break;
    case 'pop': sfx.click(); break;
    case 'nomatch': sfx.slide(); break;
  }
}

async function createBoard(): Promise<void> {
  if (!(await startFreeRound(host, toast))) return;
  runReward.innerHTML = '';
  board.innerHTML = '';
  squares = [];
  score = 0;
  moves = START_MOVES;
  gameEnded = false;
  scoreDisplay.textContent = String(score);
  movesDisplay.textContent = String(moves);

  for (let i = 0; i < 64; i++) {
    const tile = document.createElement('div');
    tile.setAttribute('id', String(i));
    const color = colors[Math.floor(Math.random() * colors.length)];
    tile.classList.add('tile', color);
    board.appendChild(tile);
    squares.push(tile);
    tile.addEventListener('touchstart', touchStart);
    tile.addEventListener('touchend', touchEnd);
    tile.addEventListener('pointerdown', pointerStart);
    tile.addEventListener('pointerup', pointerEnd);
  }

  setTimeout(() => {
    checkRow();
    checkColumn();
    moveDown();
    scoreDisplay.textContent = String(score);
  }, 100);
}

function touchStart(this: HTMLElement, e: TouchEvent): void {
  if (gameEnded) return;
  play('click');
  draggedId = parseInt(this.id);
  startX = e.changedTouches[0].clientX;
  startY = e.changedTouches[0].clientY;
}
function touchEnd(e: TouchEvent): void {
  if (gameEnded) return;
  resolveSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}
function pointerStart(this: HTMLElement, e: PointerEvent): void {
  if (gameEnded) return;
  draggedId = parseInt(this.id);
  startX = e.clientX;
  startY = e.clientY;
}
function pointerEnd(e: PointerEvent): void {
  if (gameEnded) return;
  resolveSwipe(e.clientX, e.clientY);
}

function resolveSwipe(endX: number, endY: number): void {
  const diffX = endX - startX;
  const diffY = endY - startY;
  let targetId = draggedId;
  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 20) targetId = draggedId + 1;
    else if (diffX < -20) targetId = draggedId - 1;
  } else {
    if (diffY > 20) targetId = draggedId + 8;
    else if (diffY < -20) targetId = draggedId - 8;
  }
  swapTiles(draggedId, targetId);
}

function swapTiles(from: number, to: number): void {
  if (gameEnded) return;
  if (to < 0 || to >= 64) return;
  const validMoves = [from - 1, from + 1, from - 8, from + 8];
  if (!validMoves.includes(to)) return;

  const color1 = squares[from].classList[1];
  const color2 = squares[to].classList[1];
  squares[from].classList.replace(color1, color2);
  squares[to].classList.replace(color2, color1);
  play('flip');

  moves--;
  movesDisplay.textContent = String(moves);

  setTimeout(() => {
    const hadMatch = checkRow() || checkColumn();
    if (hadMatch) {
      play('match');
      moveDown();
    } else {
      squares[from].classList.replace(color2, color1);
      squares[to].classList.replace(color1, color2);
      play('nomatch');
      moves++;
      movesDisplay.textContent = String(moves);
    }
    if (moves <= 0 && !gameEnded) void endGame();
  }, 150);
}

function showCombo(): void {
  combo.classList.add('show');
  setTimeout(() => combo.classList.remove('show'), 800);
}

function createParticles(element: HTMLElement, color: string): void {
  play('pop');
  for (let i = 0; i < 10; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.background = color;
    const rect = element.getBoundingClientRect();
    particle.style.left = rect.left + rect.width / 2 + 'px';
    particle.style.top = rect.top + rect.height / 2 + 'px';
    particle.style.setProperty('--x', Math.random() * 200 - 100 + 'px');
    particle.style.setProperty('--y', Math.random() * 200 - 100 + 'px');
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

function clearTile(tile: HTMLElement): void {
  const bg = window.getComputedStyle(tile).background;
  tile.classList.add('break');
  createParticles(tile, bg);
  setTimeout(() => (tile.className = 'tile empty'), 300);
}

function checkRow(): boolean {
  let matched = false;
  const notValid = [6, 7, 14, 15, 22, 23, 30, 31, 38, 39, 46, 47, 54, 55];
  for (let i = 0; i < 61; i++) {
    if (notValid.includes(i)) continue;
    const color = squares[i].classList[1];
    const row = [i, i + 1, i + 2];
    if (row.every((index) => squares[index].classList[1] === color && !squares[index].classList.contains('empty'))) {
      matched = true;
      score += 3;
      scoreDisplay.textContent = String(score);
      showCombo();
      row.forEach((index) => clearTile(squares[index]));
    }
  }
  return matched;
}

function checkColumn(): boolean {
  let matched = false;
  for (let i = 0; i < 47; i++) {
    const color = squares[i].classList[1];
    const column = [i, i + 8, i + 16];
    if (column.every((index) => squares[index].classList[1] === color && !squares[index].classList.contains('empty'))) {
      matched = true;
      score += 3;
      scoreDisplay.textContent = String(score);
      showCombo();
      column.forEach((index) => clearTile(squares[index]));
    }
  }
  return matched;
}

function moveDown(): void {
  for (let i = 55; i >= 0; i--) {
    if (squares[i + 8].classList.contains('empty')) {
      const color = squares[i].classList[1];
      squares[i + 8].className = 'tile ' + color;
      squares[i].className = 'tile empty';
    }
  }
  for (let i = 0; i < 8; i++) {
    if (squares[i].classList.contains('empty')) {
      const random = colors[Math.floor(Math.random() * colors.length)];
      squares[i].className = 'tile ' + random;
    }
  }
  setTimeout(() => {
    if (checkRow() || checkColumn()) moveDown();
  }, 120);
}

async function endGame(): Promise<void> {
  if (gameEnded) return;
  gameEnded = true;
  const isWin = score > 20;
  setTimeout(() => void paintInlineReward(host, runReward, score, isWin), 300);
}

$('#popblast-restart').addEventListener('click', () => void createBoard());

document.documentElement.lang = getLang();
applyTranslations();
mountFreeHud();
void createBoard();

// Tile Connect — link matching pairs with at most two turns. Native GoPlay brain game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import './polish.css';
import { el, finishLQRound, mulberry32, mountLQ, setLQHeader, toast } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { tileConnectCanConnect } from '../_lq/solvable';
import { buildSolvableTileBoard } from '../_lq/levelGen';
import { sfx } from '../../engine/audio';
import { tcSfx } from './sounds';
import {
  animateCountUp,
  animateHudValue,
  boardClusterLayout,
  clampBoardScale,
  centerOf,
  drawConnectionLine,
  findConnectionPath,
  formatTime,
  labelForMatch,
  launchConfetti,
  pulseBoard,
  shakeWrap,
  spawnMatchBurst,
  spawnScorePopup,
} from './fx';

const ROWS = 6;
const COLS = 8;
const ICONS = ['🍎', '🍊', '🍋', '🍇', '🍓', '🌸', '⭐', '💎', '🎵', '🦋', '🌙', '🔔'];
const ICON_COLORS = ['#6cc52f', '#3d8ef0', '#f39c12', '#9b59b6', '#e74c3c', '#1abc9c'];
const LEVELS = 5;
const host = createHost('tile-connect');

let boardResizeHandler: (() => void) | null = null;

function remaining(board: (string | null)[][]): number {
  let n = 0;
  for (const row of board) for (const v of row) if (v) n++;
  return n;
}

function iconColor(icon: string): string {
  const idx = ICONS.indexOf(icon);
  return ICON_COLORS[(idx >= 0 ? idx : 0) % ICON_COLORS.length];
}

function iconClass(icon: string): string {
  const idx = ICONS.indexOf(icon);
  return ` tc-tile--c${(idx >= 0 ? idx : 0) % 6}`;
}

function hudEl(id: string): HTMLElement | null {
  return document.getElementById(`fpStat-${id}`);
}

function render(mount: HTMLElement): void {
  let levelIdx = 0;
  let totalScore = 0;
  const sessionStart = Date.now();
  let combo = 0;
  let bestCombo = 0;
  let lastMatchAt = 0;
  let totalAttempts = 0;
  let successfulMatches = 0;
  let timerId = 0;

  function paintRunStatsOnOver(score: number, isWin: boolean): void {
    const timeEl = document.getElementById('tcOverTime');
    const comboEl = document.getElementById('tcOverCombo');
    const accEl = document.getElementById('tcOverAccuracy');
    const resultEl = document.getElementById('tcOverResult');
    if (timeEl) timeEl.textContent = formatTime(Date.now() - sessionStart);
    if (comboEl) comboEl.textContent = `×${bestCombo}`;
    const acc = totalAttempts > 0 ? Math.round((successfulMatches / totalAttempts) * 100) : 100;
    if (accEl) accEl.textContent = `${acc}%`;
    if (resultEl) resultEl.textContent = isWin ? 'Victory' : 'Good try';
    const finalEl = document.getElementById('finalScore');
    if (finalEl) animateCountUp(finalEl, score);
    const overPanel = document.querySelector('#overOverlay .game-panel');
    if (isWin && overPanel) launchConfetti(overPanel as HTMLElement);
    if (isWin) tcSfx.victory();
    else tcSfx.gameOver();
  }

  function updateTimer(): void {
    const elapsed = formatTime(Date.now() - sessionStart);
    setLQHeader({ time: elapsed });
    animateHudValue(hudEl('time'), elapsed);
  }

  function loadLevel(): void {
    if (boardResizeHandler) {
      window.removeEventListener('resize', boardResizeHandler);
      boardResizeHandler = null;
    }
    mount.innerHTML = '';
    const rnd = mulberry32((Math.random() * 1e9) | 0);
    const pairs = 8 + levelIdx * 2;
    const initialTiles = pairs * 2;
    const board: (string | null)[][] = buildSolvableTileBoard(ROWS, COLS, ICONS, pairs, rnd);
    let sel: [number, number] | null = null;
    let matching: [number, number, number, number] | null = null;
    let animating = false;
    let moves = 0;
    const levelStart = Date.now();

    const wrap = el('div', { class: 'tc-wrap' });
    const fxLayer = el('div', { class: 'tc-fx-layer' });
    const boardViewport = el('div', { class: 'tc-board-viewport' });
    const boardWrap = el('div', { class: 'tc-board-wrap' });
    const lineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lineSvg.setAttribute('class', 'tc-line-layer');
    lineSvg.innerHTML = `
      <defs>
        <linearGradient id="tc-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6cc52f"/>
          <stop offset="50%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#3d8ef0"/>
        </linearGradient>
      </defs>`;
    const grid = el('div', {
      class: 'tc-board pboard',
      style: `grid-template-columns:repeat(${COLS},1fr)`,
    });
    boardWrap.appendChild(lineSvg);
    boardWrap.appendChild(grid);
    boardViewport.appendChild(boardWrap);

    wrap.appendChild(boardViewport);
    wrap.appendChild(fxLayer);
    mount.appendChild(wrap);

    setLQHeader({
      round: `${levelIdx + 1}/${LEVELS}`,
      score: String(totalScore),
      moves: '0',
      time: formatTime(Date.now() - sessionStart),
    });

    function applyBoardScale(): void {
      const layout = boardClusterLayout(board, ROWS, COLS, remaining(board), initialTiles);
      grid.style.gap = layout.gap;
      grid.style.padding = layout.pad;
      boardWrap.style.setProperty('--tc-board-scale', '1');
      const clamped = clampBoardScale(boardViewport, grid, layout.scale);
      boardWrap.style.setProperty('--tc-board-scale', clamped.toFixed(3));
    }

    function updateBoardLayout(): void {
      applyBoardScale();
      requestAnimationFrame(applyBoardScale);
    }

    const onResize = (): void => { applyBoardScale(); };
    boardResizeHandler = onResize;
    window.addEventListener('resize', onResize);

    function paint(): void {
      grid.innerHTML = '';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board[r][c];
          const isSel = sel && sel[0] === r && sel[1] === c;
          const isMatch = matching
            && ((matching[0] === r && matching[1] === c) || (matching[2] === r && matching[3] === c));
          const tile = el('div', {
            class: 'tc-tile'
              + (!v ? ' tc-empty' : iconClass(v))
              + (isSel ? ' tc-tile--sel' : '')
              + (isMatch ? ' tc-tile--match' : ''),
            onclick: () => onTap(r, c),
          });
          if (v) tile.appendChild(el('span', { class: 'tc-tile-emoji', text: v }));
          grid.appendChild(tile);
        }
      }
      updateBoardLayout();
      setLQHeader({ moves: String(moves) });
      animateHudValue(hudEl('moves'), String(moves));
    }

    function matchFeedback(r1: number, c1: number, r2: number, c2: number, icon: string): void {
      const t1 = grid.children[r1 * COLS + c1] as HTMLElement | undefined;
      const t2 = grid.children[r2 * COLS + c2] as HTMLElement | undefined;
      const c1pos = t1 ? centerOf(t1, wrap) : { x: wrap.clientWidth / 2, y: wrap.clientHeight / 2 };
      const c2pos = t2 ? centerOf(t2, wrap) : c1pos;
      const mx = (c1pos.x + c2pos.x) / 2;
      const my = (c1pos.y + c2pos.y) / 2;
      const elapsed = lastMatchAt ? Date.now() - lastMatchAt : 9999;
      const label = labelForMatch(combo, elapsed);
      spawnScorePopup(fxLayer, mx, my, label);
      spawnMatchBurst(fxLayer, c1pos.x, c1pos.y, c2pos.x, c2pos.y, iconColor(icon));
      pulseBoard(grid);
    }

    function onTap(r: number, c: number): void {
      if (animating || !board[r][c]) return;
      if (!sel) {
        sel = [r, c];
        totalAttempts++;
        tcSfx.select();
        paint();
        return;
      }
      const [r1, c1] = sel;
      if (r1 === r && c1 === c) { sel = null; paint(); return; }
      totalAttempts++;
      if (board[r1][c1] !== board[r][c] || !tileConnectCanConnect(board, r1, c1, r, c)) {
        tcSfx.invalid();
        shakeWrap(wrap);
        toast('No valid path');
        sel = [r, c];
        paint();
        return;
      }

      const icon = board[r1][c1]!;
      const path = findConnectionPath(board, r1, c1, r, c);
      animating = true;
      matching = [r1, c1, r, c];
      sel = null;

      if (path) drawConnectionLine(lineSvg, grid, COLS, boardWrap, path);

      const now = Date.now();
      if (lastMatchAt && now - lastMatchAt < 5000) combo++;
      else combo = 1;
      bestCombo = Math.max(bestCombo, combo);
      lastMatchAt = now;
      successfulMatches++;

      if (combo >= 2) tcSfx.combo(combo);
      else tcSfx.match();

      paint();
      matchFeedback(r1, c1, r, c, icon);

      window.setTimeout(() => {
        board[r1][c1] = null;
        board[r][c] = null;
        moves++;
        matching = null;
        animating = false;
        lineSvg.innerHTML = lineSvg.querySelector('defs')?.outerHTML ?? '';
        paint();
        if (remaining(board) === 0) finishLevel();
      }, 520);
    }

    function finishLevel(): void {
      tcSfx.levelClear();
      const elapsedMs = Date.now() - levelStart;
      const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 300, base: 80 })
        + Math.max(0, pairs * 2 - moves) * 8;
      totalScore += levelScore;
      levelIdx++;
      setLQHeader({
        round: `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`,
        score: String(totalScore),
      });
      animateHudValue(hudEl('score'), String(totalScore));
      animateHudValue(hudEl('round'), `${Math.min(levelIdx + 1, LEVELS)}/${LEVELS}`);
      grid.classList.add('pboard-clear-flash');
      window.setTimeout(() => grid.classList.remove('pboard-clear-flash'), 450);

      if (levelIdx >= LEVELS) {
        const isWin = totalScore >= host.winScore;
        paintRunStatsOnOver(totalScore, isWin);
        finishLQRound(totalScore, isWin, `${LEVELS}/${LEVELS} boards`, Date.now() - sessionStart);
      } else {
        window.setTimeout(loadLevel, 600);
      }
    }

    paint();
  }

  clearInterval(timerId);
  timerId = window.setInterval(updateTimer, 1000);
  loadLevel();
}

function initBgParticles(): void {
  const layer = document.querySelector('.tc-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'tc-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 40}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${6 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

function wireMenu(): void {
  const startBtn = document.getElementById('startBtn');
  document.querySelectorAll('.tc-mode-card:not(.tc-mode-card--locked)').forEach((card) => {
    card.addEventListener('click', () => {
      tcSfx.menu();
      startBtn?.click();
    });
  });
  document.getElementById('tcHomeBtn')?.addEventListener('click', () => {
    tcSfx.click();
    if (history.length > 1) history.back();
    else location.href = '../../';
  });
  document.getElementById('tcLeaderBtn')?.addEventListener('click', () => {
    tcSfx.click();
    location.href = '../../#leaderboard';
  });
}

function wireHudRow(): void {
  const hudRow = document.getElementById('tcHudRow');
  const stats = document.getElementById('fpStats');
  const btn = document.getElementById('tcSettingsBtn');
  if (!hudRow || !stats || !btn) return;
  hudRow.insertBefore(stats, btn);
}

function wireSettings(): void {
  const btn = document.getElementById('tcSettingsBtn');
  if (!btn) return;
  const sync = (): void => {
    btn.textContent = sfx.muted ? '🔇' : '🔊';
    btn.classList.toggle('tc-settings-btn--muted', sfx.muted);
  };
  sync();
  btn.addEventListener('click', () => {
    sfx.toggleMute();
    sync();
    if (!sfx.muted) tcSfx.click();
  });
}

mountLQ('tile-connect', render, {
  pauseable: true,
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'moves' },
    { id: 'time', labelKey: 'tg.time', icon: 'timer' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});

initBgParticles();
wireMenu();
wireHudRow();
wireSettings();

/** Shared tube-sort game loop — water-sort & ball-sort. */

import { el, finishLQRound, mulberry32, sound, setLQHeader, toast, emitLQLevelComplete } from '../../_lq/lq';
import { puzzleCompletionScore } from '../../_lq/scoring';
import { createHost } from '../../../platform/gameHost';
import { emitGameEvent } from '../../../platform/gameEvents';
import { showFirstRunHint } from '../firstRun';
import { gemClassesByIndex, gemIdFromIndex } from '../premiumGems';
import {
  animatePour,
  animateScorePop,
  animateUndoRipple,
  applyHeldPieces,
  playPourSound,
  pulseTubeSelect,
  shakeTube,
  spawnTubeSparkles,
  spawnVictoryBurst,
  type PourTheme,
  LIQUID_POUR_THEME,
  SPHERE_POUR_THEME,
} from '../liquidPour';
import { sfx } from '../../../engine/audio';
import {
  canPour,
  cloneTubes,
  findHintMove,
  isLayerRevealed,
  isPourSourceLocked,
  isSolved,
  isTubeComplete,
  pour,
  pourAmount,
  pourSingleLayer,
  topRunLength,
  tubeCapacity,
  tubeHiddenBottom,
  type LevelModifiers,
  type PourStyle,
  type Tubes,
} from './gameRules';
import {
  generateLevel,
  generateLevelWithSpec,
  LEVEL_COUNT,
  type ModifierKind,
} from './levelGen';
import {
  endlessLevelSpec,
  recordGemCollect,
  roundLabel,
  sessionSeed,
  type SessionMode,
} from './meta';
import { WaterBottleManager } from './waterFluid';
import { renderModeMenu } from './modeMenu';
import { t } from '../../../i18n';
import {
  bumpStat as bumpBallStat,
  showLevelCompleteCelebration as showBallLevelComplete,
} from '../../ball-sort/levelComplete';
import { ballSortSound } from '../../ball-sort/audio';
import {
  bumpStat as bumpWaterStat,
  mountBoardBubbles as mountWaterBubbles,
  showLevelCompleteCelebration as showWaterLevelComplete,
} from '../../water-sort/levelComplete';
import { waterSortSound } from '../../water-sort/audio';

export interface TubeSortTheme {
  gameId: string;
  classPrefix: 'ws' | 'bs';
  gemVariant: 'liquid' | 'sphere';
  pourTheme: PourTheme;
  pourStyle: PourStyle;
  firstRunKey: string;
  ariaLabel: string;
  hintText: string;
  emptyToast: string;
  invalidToast: string;
  scoreBase: number;
}

export const WATER_SORT_THEME: TubeSortTheme = {
  gameId: 'water-sort',
  classPrefix: 'ws',
  gemVariant: 'liquid',
  pourTheme: LIQUID_POUR_THEME,
  pourStyle: 'run',
  firstRunKey: 'water-sort',
  ariaLabel: 'Water tubes',
  hintText: 'Tap a tube, then tap another to pour.',
  emptyToast: 'Pick a tube with liquid',
  invalidToast: 'Can only pour onto matching color or empty tube',
  scoreBase: 80,
};

export const BALL_SORT_THEME: TubeSortTheme = {
  gameId: 'ball-sort',
  classPrefix: 'bs',
  gemVariant: 'sphere',
  pourTheme: SPHERE_POUR_THEME,
  pourStyle: 'single',
  firstRunKey: 'ball-sort',
  ariaLabel: 'Ball tubes',
  hintText: 'Move one ball at a time onto matching color or empty tube.',
  emptyToast: 'Pick a tube with balls',
  invalidToast: 'Only onto matching color or empty tube',
  scoreBase: 85,
};

function modifierLabel(kinds: ModifierKind[]): string | null {
  if (!kinds.length) return null;
  const keys: Record<ModifierKind, 'ws.mod.hidden' | 'ws.mod.locked' | 'ws.mod.narrow' | 'ws.mod.singleBuffer'> = {
    hidden: 'ws.mod.hidden',
    locked: 'ws.mod.locked',
    narrow: 'ws.mod.narrow',
    singleBuffer: 'ws.mod.singleBuffer',
  };
  return kinds.map((k) => t(keys[k])).join(' · ');
}

function modeBadgeLabel(mode: SessionMode): string | null {
  if (mode === 'daily') return t('ts.mode.daily');
  if (mode === 'endless') return t('ts.mode.endless');
  return null;
}

function starRating(moves: number, par: number): number {
  if (moves <= par) return 3;
  if (moves <= par + 4) return 2;
  if (moves <= par + 8) return 1;
  return 0;
}

function renderStars(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(3 - count);
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Columns per row so tubes always fit inside the playfield on mobile. */
function tubeGridCols(count: number): number {
  if (count <= 4) return count;
  if (count <= 6) return 3;
  if (count <= 8) return 4;
  return 4;
}

function applyTubeGridLayout(row: HTMLElement, tubeCount: number): void {
  const cols = tubeGridCols(tubeCount);
  const rows = Math.ceil(tubeCount / cols);
  row.style.setProperty('--tube-cols', String(cols));
  row.style.setProperty('--tube-rows', String(rows));
  row.dataset.cols = String(cols);
  row.dataset.rows = String(rows);
}

function cx(theme: TubeSortTheme, base: string): string {
  return `${theme.classPrefix}-${base}`;
}

export function runTubeSortGame(mount: HTMLElement, theme: TubeSortTheme): void {
  const host = createHost(theme.gameId);
  const isBall = theme.gameId === 'ball-sort';
  const isWater = theme.gameId === 'water-sort';

  function playSound(name: 'click' | 'good' | 'bad' | 'win'): void {
    if (isBall) ballSortSound(name);
    else if (isWater) waterSortSound(name);
    else sound(name);
  }

  function showMenu(): void {
    mount.innerHTML = '';
    renderModeMenu(mount, theme.gameId, theme.gemVariant, (mode) => {
      startSession(mode, sessionSeed(mode, theme.gameId));
    });
  }

  function startSession(mode: SessionMode, seed: number): void {
    document.body.classList.remove('ws-at-mode-menu');
    const rnd = mulberry32(seed);
    let levelIdx = 0;
    let totalScore = 0;
    const sessionStart = Date.now();
    let levelCleanup: (() => void) | null = null;

    emitGameEvent({ type: 'runStart', gameId: theme.gameId });

    function loadLevel(): void {
      if (levelCleanup) levelCleanup();
      mount.innerHTML = '';

      const generated = mode === 'endless' && levelIdx >= LEVEL_COUNT
        ? generateLevelWithSpec(endlessLevelSpec(levelIdx, theme.pourStyle), rnd, theme.pourStyle, levelIdx)
        : generateLevel(levelIdx, rnd, theme.pourStyle);
      let tubes = cloneTubes(generated.tubes);
      const initialTubes = cloneTubes(generated.tubes);
      const mods: LevelModifiers = generated.mods;
      const initialMods: LevelModifiers = {
        emptyTubes: mods.emptyTubes,
        tubeMods: mods.tubeMods.map((m) => ({ ...m })),
      };
      const { parMoves } = generated.spec;
      const modLabel = modifierLabel(generated.spec.modifiers);
      const modeLabel = modeBadgeLabel(mode);

      const undoStack: Tubes[] = [];
      let moves = 0;
      let selected: number | null = null;
      let locked = false;
      let paused = false;
      let hintsLeft = 1;
      let hintFlash: { from: number; to: number } | null = null;
      const levelStart = Date.now();
      let timerSec = 0;
      let timerHandle: ReturnType<typeof setInterval> | null = null;
      const completedTubes = new Set<number>();

      const p = theme.classPrefix;
      const hint = isWater
        ? null
        : el('p', { class: cx(theme, 'hint'), text: theme.hintText });
      const modeBadge = modeLabel
        ? el('p', { class: `ts-mode-badge ts-mode-badge--${mode}`, text: modeLabel })
        : null;
      const modBadge = modLabel ? el('p', { class: cx(theme, 'mod-badge'), text: modLabel }) : null;
      const toolbar = el('div', { class: cx(theme, 'toolbar') });
      const hintBtn = el('button', {
        type: 'button',
        class: `btn ${cx(theme, 'hint-btn')}`,
        text: `💡 ${t('ws.hint.btn')}`,
        onclick: () => useHint(),
      });
      const undoBtn = el('button', {
        type: 'button',
        class: `btn ${cx(theme, 'undo')}`,
        text: '↩ Undo',
        onclick: () => void undo(),
      });
      toolbar.appendChild(hintBtn);
      toolbar.appendChild(undoBtn);

      let restartBtn: HTMLButtonElement | null = null;
      let pauseBtn: HTMLButtonElement | null = null;
      let muteBtn: HTMLButtonElement | null = null;
      let pauseOverlay: HTMLElement | null = null;

      if (isWater) {
        restartBtn = el('button', {
          type: 'button',
          class: `btn ${cx(theme, 'restart')}`,
          text: `↺ ${t('ws.restart')}`,
          onclick: () => void restartLevel(),
        }) as HTMLButtonElement;
        pauseBtn = el('button', {
          type: 'button',
          class: `btn ${cx(theme, 'pause')}`,
          text: `⏸ ${t('td.pause')}`,
          onclick: () => togglePause(),
        }) as HTMLButtonElement;
        muteBtn = el('button', {
          type: 'button',
          class: `btn ${cx(theme, 'mute')}`,
          text: sfx.muted ? '🔇' : '🔊',
          'aria-label': t('set.sound'),
          onclick: () => {
            const muted = sfx.toggleMute();
            muteBtn!.textContent = muted ? '🔇' : '🔊';
          },
        }) as HTMLButtonElement;
        toolbar.appendChild(restartBtn);
        toolbar.appendChild(pauseBtn);
        toolbar.appendChild(muteBtn);

        pauseOverlay = el('div', { class: `${p}-pause-overlay hidden` },
          el('div', { class: `${p}-pause-panel` },
            el('h2', { text: t('td.paused') }),
            el('button', {
              type: 'button',
              class: 'btn primary',
              text: t('td.resume'),
              onclick: () => togglePause(),
            }),
            el('button', {
              type: 'button',
              class: 'btn',
              text: t('ws.restart'),
              onclick: () => { togglePause(false); void restartLevel(); },
            }),
          ),
        );
      }

      const board = el('div', { class: cx(theme, 'board') });
      const row = el('div', {
        class: cx(theme, 'tubes'),
        role: 'group',
        'aria-label': theme.ariaLabel,
      });
      if (hint) board.appendChild(hint);
      if (modeBadge) board.appendChild(modeBadge);
      if (modBadge) board.appendChild(modBadge);
      board.appendChild(toolbar);
      board.appendChild(row);
      mount.appendChild(board);
      if (pauseOverlay) board.appendChild(pauseOverlay);
      const removeBubbles = isWater ? mountWaterBubbles(board) : null;

      if (levelIdx === 0 && !isWater) showFirstRunHint(theme.firstRunKey, toast);

      setLQHeader({
        round: roundLabel(levelIdx, mode),
        score: String(totalScore),
        moves: '0',
        ...(isWater ? { time: '0:00' } : {}),
      });

      function startTimer(): void {
        if (!isWater || timerHandle) return;
        timerHandle = setInterval(() => {
          if (paused || locked) return;
          timerSec++;
          setLQHeader({ time: formatTimer(timerSec) });
        }, 1000);
      }

      function stopTimer(): void {
        if (timerHandle) {
          clearInterval(timerHandle);
          timerHandle = null;
        }
      }

      function togglePause(force?: boolean): void {
        if (!isWater || locked) return;
        paused = force ?? !paused;
        pauseOverlay?.classList.toggle('hidden', !paused);
        pauseBtn!.textContent = paused ? `▶ ${t('td.resume')}` : `⏸ ${t('td.pause')}`;
        board.classList.toggle(`${p}-board--paused`, paused);
      }

      function restartLevel(): void {
        if (locked) return;
        tubes = cloneTubes(initialTubes);
        mods.emptyTubes = initialMods.emptyTubes;
        mods.tubeMods = initialMods.tubeMods.map((m) => ({ ...m }));
        undoStack.length = 0;
        moves = 0;
        selected = null;
        hintsLeft = 1;
        hintFlash = null;
        completedTubes.clear();
        timerSec = 0;
        setLQHeader({ moves: '0', time: '0:00' });
        playSound('click');
        paint();
      }

      const stackClass = theme.gemVariant === 'liquid' ? 'ws-liquid-stack' : 'bs-ball-stack';
      const pieceClass = theme.gemVariant === 'liquid' ? 'ws-seg' : 'bs-ball';
      const mysteryClass = theme.gemVariant === 'liquid' ? 'ws-seg--mystery' : 'bs-ball--mystery';
      const emptyPieceClass = theme.gemVariant === 'liquid' ? 'ws-seg--empty' : '';
      const fluidManager = isWater ? new WaterBottleManager() : null;
      let fluidAnimRaf = 0;

      function renderFluids(): void {
        if (!fluidManager) return;
        fluidManager.renderAll(tubes, (idx) => {
          const cap = tubeCapacity(mods, idx);
          return {
            capacity: cap,
            hiddenBottom: tubeHiddenBottom(mods, idx),
            selected: selected === idx,
            completed: isTubeComplete(tubes[idx], cap),
            highlightTop: selected === idx && tubes[idx].length > 0
              ? (theme.pourStyle === 'single' ? 1 : topRunLength(tubes[idx]))
              : undefined,
            tubeSeed: idx + 1,
          };
        });
      }

      function startFluidAnim(): void {
        if (!fluidManager) return;
        const tick = (now: number) => {
          if (!fluidManager) return;
          fluidManager.setAnimPhase(now * 0.0012);
          if (!locked && !paused) renderFluids();
          fluidAnimRaf = requestAnimationFrame(tick);
        };
        fluidAnimRaf = requestAnimationFrame(tick);
      }

      function stopFluidAnim(): void {
        if (fluidAnimRaf) cancelAnimationFrame(fluidAnimRaf);
        fluidAnimRaf = 0;
      }

      function buildPiece(colorId: number, layerIdx: number, tubeIdx: number, tube: number[]): HTMLElement {
        const hidden = tubeHiddenBottom(mods, tubeIdx);
        if (!isLayerRevealed(tube, layerIdx, hidden)) {
          return el('div', {
            class: `${pieceClass} ${mysteryClass}`,
            'data-color': String(colorId),
            'aria-hidden': 'true',
          });
        }
        return el('div', {
          class: `${pieceClass} ${gemClassesByIndex(colorId - 1, theme.gemVariant)}`,
          'data-color': String(colorId),
          'data-gem': `pgem--${gemIdFromIndex(colorId - 1)}`,
        });
      }

      function paint(): void {
        row.innerHTML = '';
        if (fluidManager) fluidManager.clear();
        if (theme.gemVariant === 'liquid') applyTubeGridLayout(row, tubes.length);
        tubes.forEach((tube, idx) => {
          const cap = tubeCapacity(mods, idx);
          const tubeMod = mods.tubeMods[idx];
          const isNarrow = cap < 4;
          const isLocked = tubeMod?.locked && isPourSourceLocked(mods, idx, tubes);
          const previewAmt = selected != null && selected !== idx && canPour(
            tubes[selected], tube, selected, idx, tubes, mods,
          )
            ? pourAmount(tubes[selected], tube, idx, mods, theme.pourStyle)
            : 0;

          const tubeEl = el('div', {
            class: `${p}-tube`
              + (selected === idx ? ` ${p}-tube--sel` : '')
              + (previewAmt > 0 ? ` ${p}-tube--target` : '')
              + (isLocked ? ` ${p}-tube--locked` : '')
              + (isNarrow ? ` ${p}-tube--narrow` : '')
              + (hintFlash && (hintFlash.from === idx || hintFlash.to === idx) ? ` ${p}-tube--hint` : '')
              + (isTubeComplete(tube, cap) ? ` ${p}-tube--done` : ''),
            role: 'button',
            style: isNarrow ? `--tube-cap: ${cap}` : '',
            onclick: () => void onTap(idx),
          });

          if (isLocked) {
            tubeEl.appendChild(el('span', { class: `${p}-lock`, text: '🔒', 'aria-hidden': 'true' }));
          }

          if (fluidManager) {
            fluidManager.setMeta(idx, cap, tubeHiddenBottom(mods, idx));
            fluidManager.attach(idx, tubeEl);
          } else {
            const stack = el('div', { class: stackClass });
            if (tube.length === 0 && theme.gemVariant === 'liquid') {
              stack.appendChild(el('div', { class: `${pieceClass} ${emptyPieceClass}`, style: 'visibility:hidden' }));
            } else {
              tube.forEach((colorId, layerIdx) => {
                stack.appendChild(buildPiece(colorId, layerIdx, idx, tube));
              });
            }
            tubeEl.appendChild(stack);
          }

          if (previewAmt > 0) {
            tubeEl.appendChild(el('span', { class: `${p}-pour-preview`, text: `+${previewAmt}` }));
          }

          row.appendChild(tubeEl);
        });

        if (fluidManager) {
          requestAnimationFrame(() => renderFluids());
        } else if (selected != null && tubes[selected].length > 0) {
          const held = theme.pourStyle === 'single' ? 1 : topRunLength(tubes[selected]);
          applyHeldPieces(row, selected, held, theme.pourTheme);
        }
        setLQHeader({ moves: String(moves) });
        if (isBall) bumpBallStat('fpStat-moves');
        else if (isWater) bumpWaterStat('fpStat-moves');
        undoBtn.toggleAttribute('disabled', undoStack.length === 0);
        hintBtn.toggleAttribute('disabled', hintsLeft <= 0 || locked);
      }

      function useHint(): void {
        if (locked || hintsLeft <= 0) return;
        const move = findHintMove(tubes, mods, theme.pourStyle);
        if (!move) {
          toast(t('ws.hint.none'));
          return;
        }
        hintsLeft--;
        hintFlash = move;
        playSound('click');
        paint();
        window.setTimeout(() => {
          hintFlash = null;
          paint();
        }, 2200);
      }

      function pushUndo(): void {
        undoStack.push(cloneTubes(tubes));
        if (undoStack.length > 40) undoStack.shift();
      }

      async function undo(): Promise<void> {
        if (locked || !undoStack.length) return;
        tubes = undoStack.pop()!;
        moves = Math.max(0, moves - 1);
        selected = null;
        playSound('click');
        if (isWater && fluidManager) {
          paint();
          await animateUndoRipple(board, fluidManager, tubes.length);
          renderFluids();
        } else {
          paint();
        }
      }

      function checkTubeComplete(idx: number): void {
        const cap = tubeCapacity(mods, idx);
        const tube = tubes[idx];
        if (!isTubeComplete(tube, cap) || completedTubes.has(idx)) return;
        completedTubes.add(idx);
        recordGemCollect(theme.gameId, tube[0]);
        const tubeEl = row.children[idx] as HTMLElement | undefined;
        if (tubeEl) {
          tubeEl.classList.add(`${p}-tube--done`);
          spawnTubeSparkles(tubeEl);
          playPourSound('complete');
        }
      }

      async function onTap(idx: number): Promise<void> {
        if (locked || paused) return;
        if (selected == null) {
          if (tubes[idx].length === 0) {
            toast(theme.emptyToast);
            return;
          }
          if (isPourSourceLocked(mods, idx, tubes)) {
            playSound('bad');
            toast('Complete a tube to unlock this one');
            return;
          }
          selected = idx;
          playSound('click');
          paint();
          if (isWater || isBall) {
            const tubeEl = row.children[idx] as HTMLElement | undefined;
            if (tubeEl) pulseTubeSelect(tubeEl, p);
          }
          return;
        }
        if (selected === idx) {
          selected = null;
          paint();
          return;
        }
        if (!canPour(tubes[selected], tubes[idx], selected, idx, tubes, mods)) {
          playSound('bad');
          if (isWater || isBall) {
            const srcEl = row.children[selected] as HTMLElement | undefined;
            if (srcEl) shakeTube(srcEl, p);
            paint();
            window.setTimeout(() => {
              selected = null;
              paint();
            }, 560);
          } else {
            toast(theme.invalidToast);
            selected = null;
            paint();
          }
          return;
        }

        const fromIdx = selected;
        const toIdx = idx;
        const colorId = tubes[fromIdx][tubes[fromIdx].length - 1];
        const amount = pourAmount(tubes[fromIdx], tubes[toIdx], toIdx, mods, theme.pourStyle);

        locked = true;
        pushUndo();

        const applySegment = (): void => {
          pourSingleLayer(tubes[fromIdx], tubes[toIdx], fromIdx, toIdx, tubes, mods);
        };

        if (theme.gemVariant === 'liquid' && fluidManager) {
          await animatePour({
            board,
            row,
            fromIdx,
            toIdx,
            colorId,
            amount,
            theme: theme.pourTheme,
            onSegment: applySegment,
            fluidManager,
            tubes,
            fromCap: tubeCapacity(mods, fromIdx),
            toCap: tubeCapacity(mods, toIdx),
            fromHidden: tubeHiddenBottom(mods, fromIdx),
            toHidden: tubeHiddenBottom(mods, toIdx),
          });
        } else {
          await animatePour({
            board,
            row,
            fromIdx,
            toIdx,
            colorId,
            amount,
            theme: theme.pourTheme,
          });
          pour(tubes[fromIdx], tubes[toIdx], fromIdx, toIdx, tubes, mods, theme.pourStyle);
        }
        moves++;
        selected = null;
        paint();
        checkTubeComplete(toIdx);
        checkTubeComplete(fromIdx);

        playSound('good');
        locked = false;

        if (isSolved(tubes, mods)) finishLevel();
      }

      function finishLevel(): void {
        locked = true;
        stopTimer();
        board.classList.add(`${p}-win-flash`);
        if (isWater || isBall) spawnVictoryBurst(board);
        playSound('win');
        const elapsedMs = Date.now() - levelStart;
        const stars = starRating(moves, parMoves);
        const moveBonus = Math.max(0, parMoves - moves) * 12;
        const starBonus = stars * 25;
        const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 360, base: theme.scoreBase })
          + moveBonus + starBonus;
        totalScore += levelScore;
        if (isBall) {
          showBallLevelComplete(board, { stars, levelScore, starBonus });
        } else if (isWater) {
          showWaterLevelComplete(board, { stars, levelScore, starBonus });
        } else if (stars > 0) {
          toast(`${renderStars(stars)} · +${starBonus} star bonus`, 1400);
        }
        levelIdx++;
        emitLQLevelComplete(levelIdx, totalScore);
        setLQHeader({
          round: roundLabel(levelIdx, mode),
          score: String(totalScore),
        });
        if (isWater || isBall) animateScorePop();
        if (isBall) bumpBallStat('fpStat-score');
        else if (isWater) bumpWaterStat('fpStat-score');

        const sessionDone = mode !== 'endless' && levelIdx >= LEVEL_COUNT;
        if (sessionDone) {
          finishLQRound(
            totalScore,
            totalScore >= host.winScore,
            `${LEVEL_COUNT}/${LEVEL_COUNT} levels · ${moves} moves last`,
            Date.now() - sessionStart,
          );
        } else {
          setTimeout(loadLevel, 900);
        }
      }

      paint();
      if (isWater) {
        startTimer();
        startFluidAnim();
      }
      levelCleanup = () => {
        stopTimer();
        stopFluidAnim();
        removeBubbles?.();
      };
    }

    loadLevel();
  }

  showMenu();
}

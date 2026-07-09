/** Shared tube-sort game loop — water-sort & ball-sort. */

import { el, finishLQRound, mulberry32, sound, setLQHeader, toast, emitLQLevelComplete } from '../../_lq/lq';
import { puzzleCompletionScore } from '../../_lq/scoring';
import { createHost } from '../../../platform/gameHost';
import { emitGameEvent } from '../../../platform/gameEvents';
import { showFirstRunHint } from '../firstRun';
import { gemClassesByIndex, gemIdFromIndex } from '../premiumGems';
import {
  animatePour,
  applyHeldPieces,
  playPourSound,
  spawnTubeSparkles,
  type PourTheme,
  LIQUID_POUR_THEME,
  SPHERE_POUR_THEME,
} from '../liquidPour';
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
  topRunLength,
  tubeCapacity,
  tubeHiddenBottom,
  type LevelModifiers,
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
import { renderModeMenu } from './modeMenu';
import { t } from '../../../i18n';

export interface TubeSortTheme {
  gameId: string;
  classPrefix: 'ws' | 'bs';
  gemVariant: 'liquid' | 'sphere';
  pourTheme: PourTheme;
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
  firstRunKey: 'ball-sort',
  ariaLabel: 'Ball tubes',
  hintText: 'Move balls between tubes — same color only.',
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

function cx(theme: TubeSortTheme, base: string): string {
  return `${theme.classPrefix}-${base}`;
}

export function runTubeSortGame(mount: HTMLElement, theme: TubeSortTheme): void {
  const host = createHost(theme.gameId);

  function showMenu(): void {
    mount.innerHTML = '';
    renderModeMenu(mount, theme.gameId, theme.gemVariant, (mode) => {
      startSession(mode, sessionSeed(mode, theme.gameId));
    });
  }

  function startSession(mode: SessionMode, seed: number): void {
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
        ? generateLevelWithSpec(endlessLevelSpec(levelIdx), rnd)
        : generateLevel(levelIdx, rnd);
      let tubes = cloneTubes(generated.tubes);
      const mods: LevelModifiers = generated.mods;
      const { parMoves } = generated.spec;
      const modLabel = modifierLabel(generated.spec.modifiers);
      const modeLabel = modeBadgeLabel(mode);

      const undoStack: Tubes[] = [];
      let moves = 0;
      let selected: number | null = null;
      let locked = false;
      let hintsLeft = 1;
      let hintFlash: { from: number; to: number } | null = null;
      const levelStart = Date.now();
      const completedTubes = new Set<number>();

      const p = theme.classPrefix;
      const hint = el('p', { class: cx(theme, 'hint'), text: theme.hintText });
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
      const board = el('div', { class: cx(theme, 'board') });
      const row = el('div', {
        class: cx(theme, 'tubes'),
        role: 'group',
        'aria-label': theme.ariaLabel,
      });
      board.appendChild(hint);
      if (modeBadge) board.appendChild(modeBadge);
      if (modBadge) board.appendChild(modBadge);
      board.appendChild(toolbar);
      board.appendChild(row);
      mount.appendChild(board);

      if (levelIdx === 0) showFirstRunHint(theme.firstRunKey, toast);

      setLQHeader({
        round: roundLabel(levelIdx, mode),
        score: String(totalScore),
        moves: '0',
      });

      const stackClass = theme.gemVariant === 'liquid' ? 'ws-liquid-stack' : 'bs-ball-stack';
      const pieceClass = theme.gemVariant === 'liquid' ? 'ws-seg' : 'bs-ball';
      const mysteryClass = theme.gemVariant === 'liquid' ? 'ws-seg--mystery' : 'bs-ball--mystery';
      const emptyPieceClass = theme.gemVariant === 'liquid' ? 'ws-seg--empty' : '';

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
        tubes.forEach((tube, idx) => {
          const cap = tubeCapacity(mods, idx);
          const tubeMod = mods.tubeMods[idx];
          const isNarrow = cap < 4;
          const isLocked = tubeMod?.locked && isPourSourceLocked(mods, idx, tubes);
          const previewAmt = selected != null && selected !== idx && canPour(
            tubes[selected], tube, selected, idx, tubes, mods,
          )
            ? pourAmount(tubes[selected], tube, idx, mods)
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

          const stack = el('div', { class: stackClass });
          if (tube.length === 0 && theme.gemVariant === 'liquid') {
            stack.appendChild(el('div', { class: `${pieceClass} ${emptyPieceClass}`, style: 'visibility:hidden' }));
          } else {
            tube.forEach((colorId, layerIdx) => {
              stack.appendChild(buildPiece(colorId, layerIdx, idx, tube));
            });
          }
          tubeEl.appendChild(stack);

          if (previewAmt > 0) {
            tubeEl.appendChild(el('span', { class: `${p}-pour-preview`, text: `+${previewAmt}` }));
          }

          row.appendChild(tubeEl);
        });
        if (selected != null && tubes[selected].length > 0) {
          applyHeldPieces(row, selected, topRunLength(tubes[selected]), theme.pourTheme);
        }
        setLQHeader({ moves: String(moves) });
        undoBtn.toggleAttribute('disabled', undoStack.length === 0);
        hintBtn.toggleAttribute('disabled', hintsLeft <= 0 || locked);
      }

      function useHint(): void {
        if (locked || hintsLeft <= 0) return;
        const move = findHintMove(tubes, mods);
        if (!move) {
          toast(t('ws.hint.none'));
          return;
        }
        hintsLeft--;
        hintFlash = move;
        sound('click');
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

      function undo(): void {
        if (locked || !undoStack.length) return;
        tubes = undoStack.pop()!;
        moves = Math.max(0, moves - 1);
        selected = null;
        sound('click');
        paint();
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
        if (locked) return;
        if (selected == null) {
          if (tubes[idx].length === 0) {
            toast(theme.emptyToast);
            return;
          }
          if (isPourSourceLocked(mods, idx, tubes)) {
            sound('bad');
            toast('Complete a tube to unlock this one');
            return;
          }
          selected = idx;
          sound('click');
          paint();
          return;
        }
        if (selected === idx) {
          selected = null;
          paint();
          return;
        }
        if (!canPour(tubes[selected], tubes[idx], selected, idx, tubes, mods)) {
          sound('bad');
          toast(theme.invalidToast);
          selected = null;
          paint();
          return;
        }

        const fromIdx = selected;
        const toIdx = idx;
        const colorId = tubes[fromIdx][tubes[fromIdx].length - 1];
        const amount = pourAmount(tubes[fromIdx], tubes[toIdx], toIdx, mods);

        locked = true;
        pushUndo();

        await animatePour({
          board,
          row,
          fromIdx,
          toIdx,
          colorId,
          amount,
          theme: theme.pourTheme,
        });

        pour(tubes[fromIdx], tubes[toIdx], fromIdx, toIdx, tubes, mods);
        moves++;
        selected = null;
        paint();
        checkTubeComplete(toIdx);
        checkTubeComplete(fromIdx);

        sound('good');
        locked = false;

        if (isSolved(tubes, mods)) finishLevel();
      }

      function finishLevel(): void {
        locked = true;
        board.classList.add(`${p}-win-flash`);
        sound('win');
        const elapsedMs = Date.now() - levelStart;
        const stars = starRating(moves, parMoves);
        const moveBonus = Math.max(0, parMoves - moves) * 12;
        const starBonus = stars * 25;
        const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 360, base: theme.scoreBase })
          + moveBonus + starBonus;
        totalScore += levelScore;
        if (stars > 0) toast(`${renderStars(stars)} · +${starBonus} star bonus`, 1400);
        levelIdx++;
        emitLQLevelComplete(levelIdx, totalScore);
        setLQHeader({
          round: roundLabel(levelIdx, mode),
          score: String(totalScore),
        });

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
      levelCleanup = () => { /* no listeners */ };
    }

    loadLevel();
  }

  showMenu();
}

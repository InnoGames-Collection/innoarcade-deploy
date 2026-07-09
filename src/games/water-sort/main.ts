// Water Sort — pour colored liquids into tubes until each holds one color. Native GoPlay game.
import '../../styles/base.css';
import '../../styles/game-shell.css';
import '../_casual/style.css';
import '../_lq/lq.css';
import './style.css';
import { el, finishLQRound, mulberry32, sound, mountLQ, setLQHeader, toast, emitLQLevelComplete } from '../_lq/lq';
import { puzzleCompletionScore } from '../_lq/scoring';
import { createHost } from '../../platform/gameHost';
import { showFirstRunHint } from '../_shared/firstRun';
import { gemClassesByIndex, gemIdFromIndex } from '../_shared/premiumGems';
import { animatePour, playPourSound, spawnTubeSparkles } from '../_shared/liquidPour';
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
  tubeCapacity,
  tubeHiddenBottom,
  type LevelModifiers,
  type Tubes,
} from '../_shared/tubeSort/gameRules';
import { generateLevel, LEVEL_COUNT, type ModifierKind } from '../_shared/tubeSort/levelGen';
import { t } from '../../i18n';

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

const host = createHost('water-sort');

function starRating(moves: number, par: number): number {
  if (moves <= par) return 3;
  if (moves <= par + 4) return 2;
  if (moves <= par + 8) return 1;
  return 0;
}

function renderStars(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(3 - count);
}

function render(mount: HTMLElement): void {
  function startSession(seed: number): void {
    const rnd = mulberry32(seed);
    let levelIdx = 0;
    let totalScore = 0;
    const sessionStart = Date.now();
    let levelCleanup: (() => void) | null = null;

    function loadLevel(): void {
      if (levelCleanup) levelCleanup();
      mount.innerHTML = '';

      const generated = generateLevel(levelIdx, rnd);
      let tubes = cloneTubes(generated.tubes);
      const mods: LevelModifiers = generated.mods;
      const { parMoves } = generated.spec;
      const modLabel = modifierLabel(generated.spec.modifiers);

      const undoStack: Tubes[] = [];
      let moves = 0;
      let selected: number | null = null;
      let locked = false;
      let hintsLeft = 1;
      let hintFlash: { from: number; to: number } | null = null;
      const levelStart = Date.now();
      const completedTubes = new Set<number>();

      const hint = el('p', { class: 'ws-hint', text: 'Tap a tube, then tap another to pour.' });
      const modBadge = modLabel
        ? el('p', { class: 'ws-mod-badge', text: modLabel })
        : null;
      const toolbar = el('div', { class: 'ws-toolbar' });
      const undoBtn = el('button', {
        type: 'button',
        class: 'btn ws-undo',
        text: '↩ Undo',
        onclick: () => void undo(),
      });
      const hintBtn = el('button', {
        type: 'button',
        class: 'btn ws-hint-btn',
        text: `💡 ${t('ws.hint.btn')}`,
        onclick: () => useHint(),
      });
      toolbar.appendChild(hintBtn);
      toolbar.appendChild(undoBtn);
      const board = el('div', { class: 'ws-board' });
      const row = el('div', { class: 'ws-tubes', role: 'group', 'aria-label': 'Water tubes' });
      board.appendChild(hint);
      if (modBadge) board.appendChild(modBadge);
      board.appendChild(toolbar);
      board.appendChild(row);
      mount.appendChild(board);

      if (levelIdx === 0) showFirstRunHint('water-sort', toast);

      setLQHeader({
        round: `${levelIdx + 1}/${LEVEL_COUNT}`,
        score: String(totalScore),
        moves: '0',
      });

      function buildSegment(colorId: number, layerIdx: number, tubeIdx: number, tube: number[]): HTMLElement {
        const hidden = tubeHiddenBottom(mods, tubeIdx);
        const revealed = isLayerRevealed(tube, layerIdx, hidden);
        if (!revealed) {
          return el('div', {
            class: 'ws-seg ws-seg--mystery',
            'data-color': String(colorId),
            'aria-hidden': 'true',
          });
        }
        return el('div', {
          class: `ws-seg ${gemClassesByIndex(colorId - 1, 'liquid')}`,
          'data-color': String(colorId),
          'data-gem': `pgem--${gemIdFromIndex(colorId - 1)}`,
        });
      }

      function paint(): void {
        row.innerHTML = '';
        tubes.forEach((tube, idx) => {
          const cap = tubeCapacity(mods, idx);
          const sourceLocked = isPourSourceLocked(mods, idx, tubes);
          const tubeMod = mods.tubeMods[idx];
          const isNarrow = cap < 4;
          const isLocked = tubeMod?.locked && sourceLocked;
          const previewAmt = selected != null && selected !== idx && canPour(
            tubes[selected], tube, selected, idx, tubes, mods,
          )
            ? pourAmount(tubes[selected], tube, idx, mods)
            : 0;

          const tubeEl = el('div', {
            class: 'ws-tube'
              + (selected === idx ? ' ws-tube--sel' : '')
              + (previewAmt > 0 ? ' ws-tube--target' : '')
              + (isLocked ? ' ws-tube--locked' : '')
              + (isNarrow ? ' ws-tube--narrow' : '')
              + (hintFlash && (hintFlash.from === idx || hintFlash.to === idx) ? ' ws-tube--hint' : '')
              + (isTubeComplete(tube, cap) ? ' ws-tube--done' : ''),
            role: 'button',
            'aria-label': `Tube ${idx + 1}`,
            style: isNarrow ? `--tube-cap: ${cap}` : '',
            onclick: () => void onTap(idx),
          });

          if (isLocked) {
            tubeEl.appendChild(el('span', { class: 'ws-lock', text: '🔒', 'aria-hidden': 'true' }));
          }

          const stack = el('div', { class: 'ws-liquid-stack' });
          if (tube.length === 0) {
            stack.appendChild(el('div', { class: 'ws-seg ws-seg--empty', style: 'visibility:hidden' }));
          } else {
            tube.forEach((colorId, layerIdx) => {
              stack.appendChild(buildSegment(colorId, layerIdx, idx, tube));
            });
          }
          tubeEl.appendChild(stack);

          if (previewAmt > 0) {
            tubeEl.appendChild(el('span', {
              class: 'ws-pour-preview',
              text: `+${previewAmt}`,
            }));
          }

          row.appendChild(tubeEl);
        });
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
        if (!isTubeComplete(tubes[idx], cap) || completedTubes.has(idx)) return;
        completedTubes.add(idx);
        const tubeEl = row.children[idx] as HTMLElement | undefined;
        if (tubeEl) {
          tubeEl.classList.add('ws-tube--done');
          spawnTubeSparkles(tubeEl);
          playPourSound('complete');
        }
      }

      async function onTap(idx: number): Promise<void> {
        if (locked) return;
        if (selected == null) {
          if (tubes[idx].length === 0) {
            toast('Pick a tube with liquid');
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
          toast('Can only pour onto matching color or empty tube');
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
          onTick: () => {
            pour(tubes[fromIdx], tubes[toIdx], fromIdx, toIdx, tubes, mods);
            moves++;
            selected = null;
            paint();
            checkTubeComplete(toIdx);
            checkTubeComplete(fromIdx);
          },
        });

        sound('good');
        locked = false;

        if (isSolved(tubes, mods)) finishLevel();
      }

      function finishLevel(): void {
        locked = true;
        board.classList.add('ws-win-flash');
        sound('win');
        const elapsedMs = Date.now() - levelStart;
        const stars = starRating(moves, parMoves);
        const moveBonus = Math.max(0, parMoves - moves) * 12;
        const starBonus = stars * 25;
        const levelScore = puzzleCompletionScore(elapsedMs, 0, { budgetSec: 360, base: 80 })
          + moveBonus + starBonus;
        totalScore += levelScore;
        if (stars > 0) {
          toast(`${renderStars(stars)} · +${starBonus} star bonus`, 1400);
        }
        levelIdx++;
        emitLQLevelComplete(levelIdx, totalScore);
        setLQHeader({
          round: `${Math.min(levelIdx + 1, LEVEL_COUNT)}/${LEVEL_COUNT}`,
          score: String(totalScore),
        });
        if (levelIdx >= LEVEL_COUNT) {
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
      levelCleanup = () => { /* no listeners to detach */ };
    }

    loadLevel();
  }

  startSession(Math.floor(Math.random() * 1e9));
}

mountLQ('water-sort', render, {
  headerSlots: [
    { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
    { id: 'moves', labelKey: 'ws.moves', icon: 'question' },
    { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  ],
});

// Shared stats header for free-game play frames (quiz / casual / brain games).

import { t } from '../i18n';

export type FreeHeaderIcon = 'question' | 'time' | 'timer' | 'score' | 'round' | 'correct' | 'moves';

export interface FreePlayHeaderSlot {
  id: string;
  labelKey?: string;
  label?: string;
  icon?: FreeHeaderIcon;
  /** Score-style highlight (blue accent). */
  score?: boolean;
}

const ICONS: Record<FreeHeaderIcon, string> = {
  question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M12 5V3M5 3l2 2M19 3l-2 2"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  score: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L12 14.8 7.2 16.8l.9-5.3L4.2 7.7l5.4-.8L12 2z"/></svg>',
  round: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  correct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  moves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 16h16"/></svg>',
};

function slotLabel(slot: FreePlayHeaderSlot): string {
  if (slot.labelKey) return t(slot.labelKey as Parameters<typeof t>[0]);
  if (slot.label) return slot.label;
  return '';
}

export function renderFreePlayHeaderHtml(slots: FreePlayHeaderSlot[]): string {
  const cells = slots.map((slot) => {
    const icon = slot.icon ? ICONS[slot.icon] : '';
    const label = slotLabel(slot);
    const scoreCls = slot.score ? ' fp-stat-score' : '';
    const iconHtml = icon
      ? `<span class="fp-stat-icon" aria-hidden="true">${icon}</span>`
      : '';
    return `
      <div class="fp-stat${scoreCls}">
        ${iconHtml}
        <span class="fp-stat-label"${slot.labelKey ? ` data-i18n="${slot.labelKey}"` : ''}>${label}</span>
        <span class="fp-stat-value" id="fpStat-${slot.id}">—</span>
      </div>`;
  }).join('');
  return `<div class="fp-stats" id="fpStats">${cells}</div>`;
}

/** Insert shared header + optional pause row into a play frame if missing. */
export function ensureFreePlayChrome(
  playFrame: HTMLElement,
  slots: FreePlayHeaderSlot[],
  opts?: { pauseable?: boolean },
): Record<string, HTMLElement> {
  let stats = playFrame.querySelector('#fpStats') as HTMLElement | null;
  if (!stats) {
    const wrap = document.createElement('div');
    wrap.innerHTML = renderFreePlayHeaderHtml(slots);
    stats = wrap.firstElementChild as HTMLElement;
    const closeBtn = playFrame.querySelector('#closeBtn');
    if (closeBtn) {
      closeBtn.insertAdjacentElement('afterend', stats);
    } else {
      playFrame.prepend(stats);
    }
  }

  if (opts?.pauseable && !playFrame.querySelector('#fpPauseBtn')) {
    const hud = document.createElement('div');
    hud.className = 'fp-hud';
    hud.innerHTML = `<button type="button" id="fpPauseBtn" class="fp-pause-btn" data-i18n="td.pause">Pause</button>`;
    playFrame.appendChild(hud);
  }

  const out: Record<string, HTMLElement> = {};
  for (const slot of slots) {
    const el = playFrame.querySelector(`#fpStat-${slot.id}`) as HTMLElement | null;
    if (el) out[slot.id] = el;
  }
  return out;
}

export function setFreePlayHeaderValues(
  values: Record<string, string>,
  root: ParentNode = document,
): void {
  for (const [id, text] of Object.entries(values)) {
    const el = root.querySelector(`#fpStat-${id}`);
    if (el) el.textContent = text;
  }
}

/** No stats row — luck/chance games and compact brain puzzles. */
export const NO_HEADER: FreePlayHeaderSlot[] = [];

/** Timed reflex games: countdown + score. */
export const CASUAL_HEADER_SLOTS: FreePlayHeaderSlot[] = [
  { id: 'time', labelKey: 'tg.time', icon: 'timer' },
  { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
];

/** Puzzle rounds + score (sequence, multi-round brain games). */
export const PUZZLE_ROUND_HEADER: FreePlayHeaderSlot[] = [
  { id: 'round', labelKey: 'shell.puzzle', icon: 'round' },
  { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
];

/** Sudoku / cross-sum style: time, score, moves. */
export const PUZZLE_STATS_HEADER: FreePlayHeaderSlot[] = [
  { id: 'time', labelKey: 'tg.time', icon: 'timer' },
  { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  { id: 'moves', labelKey: 'shell.moves', icon: 'moves' },
];

/** Canvas puzzle: score + best (no session timer). */
export const SCORE_BEST_HEADER: FreePlayHeaderSlot[] = [
  { id: 'score', labelKey: 'td.score', icon: 'score', score: true },
  { id: 'best', labelKey: 'td.best', icon: 'score' },
];

// Hub browse state — sessionStorage persistence for tab, category, search,
// scroll, and shelf position when leaving for a game and returning.

import type { GameCategory } from '../platform/catalog';

const STORAGE_KEY = 'inno.hub.browse';

const HSCROLL_SHELF_IDS = ['trendingShelf', 'recentShelf'] as const;

export interface HubBrowseSnapshot {
  categoryFilter: GameCategory | 'all';
  gameQuery: string;
  scrollY: number;
  focusedGameId?: string;
  hScrollPositions?: Record<string, number>;
}

export function loadBrowseState(): HubBrowseSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubBrowseSnapshot;
    if (typeof parsed.categoryFilter !== 'string') return null;
    if (typeof parsed.gameQuery !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBrowseState(snapshot: HubBrowseSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function collectHScrollPositions(): Record<string, number> {
  const positions: Record<string, number> = {};
  for (const id of HSCROLL_SHELF_IDS) {
    const track = document.getElementById(id)?.querySelector<HTMLElement>('.hscroll-track');
    if (track) positions[id] = track.scrollLeft;
  }
  return positions;
}

export function restoreHScrollPositions(positions?: Record<string, number>): void {
  if (!positions) return;
  for (const [id, left] of Object.entries(positions)) {
    const track = document.getElementById(id)?.querySelector<HTMLElement>('.hscroll-track');
    if (track) track.scrollLeft = left;
  }
}

export function findGameCard(gameId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-game-id="${CSS.escape(gameId)}"]`);
}

export function restoreFocusedCard(gameId: string): boolean {
  const el = findGameCard(gameId);
  if (!el) return false;

  const track = el.closest<HTMLElement>('.hscroll-track');
  const item = el.closest<HTMLElement>('.hscroll-item');
  if (track && item) {
    const left = item.offsetLeft - (track.clientWidth - item.clientWidth) / 2;
    track.scrollLeft = Math.max(0, left);
  }

  el.classList.add('is-focused');
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  window.setTimeout(() => el.classList.remove('is-focused'), 1200);
  return true;
}

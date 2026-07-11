// Hexa Block — drag-and-drop UX layer (placement rules unchanged).

import { gemClasses } from '../_shared/premiumGems';
import { el } from '../_lq/lq';

const ROWS = 7;
const SNAP_RADIUS = 1.4;

export interface DragPiece {
  cells: [number, number][];
  color: string;
  used: boolean;
}

export interface DragContext {
  gridEl: HTMLElement;
  wrap: HTMLElement;
  rowWidth: (r: number) => number;
  canPlace: (cells: [number, number][], br: number, bc: number) => boolean;
  onPlace: (br: number, bc: number) => void;
  onInvalid: () => void;
  onPickup: () => void;
  getSelected: () => number | null;
  setSelected: (idx: number | null) => void;
  getPiece: (idx: number) => DragPiece;
  paint: () => void;
}

function getCellEl(gridEl: HTMLElement, r: number, c: number): HTMLElement | null {
  const row = gridEl.children[r] as HTMLElement | undefined;
  if (!row) return null;
  return (row.children[c] as HTMLElement) ?? null;
}

function getCellCenter(gridEl: HTMLElement, r: number, c: number): { x: number; y: number } | null {
  const cell = getCellEl(gridEl, r, c);
  if (!cell) return null;
  const rect = cell.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function avgCellSize(gridEl: HTMLElement): number {
  const cell = getCellEl(gridEl, 0, 0);
  if (!cell) return 36;
  const rect = cell.getBoundingClientRect();
  return (rect.width + rect.height) / 2;
}

function findSnapAnchor(
  gridEl: HTMLElement,
  rowWidth: (r: number) => number,
  clientX: number,
  clientY: number,
  cells: [number, number][],
  canPlace: (cells: [number, number][], br: number, bc: number) => boolean,
): { r: number; c: number } | null {
  const maxDist = avgCellSize(gridEl) * SNAP_RADIUS;
  let best: { r: number; c: number; dist: number } | null = null;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < rowWidth(r); c++) {
      if (!canPlace(cells, r, c)) continue;
      const center = getCellCenter(gridEl, r, c);
      if (!center) continue;
      const dist = Math.hypot(clientX - center.x, clientY - center.y);
      if (dist > maxDist) continue;
      if (!best || dist < best.dist) best = { r, c, dist };
    }
  }

  return best ? { r: best.r, c: best.c } : null;
}

function buildGhost(piece: DragPiece): HTMLElement {
  let maxR = 0;
  let maxC = 0;
  for (const [dr, dc] of piece.cells) {
    maxR = Math.max(maxR, dr);
    maxC = Math.max(maxC, dc);
  }
  const ghost = el('div', { class: 'hb-drag-ghost' });
  for (let r = 0; r <= maxR; r++) {
    const mini = el('div', { class: 'hb-row hb-row--mini hb-row--ghost' });
    for (let c = 0; c <= maxC; c++) {
      const filled = piece.cells.some(([dr, dc]) => dr === r && dc === c);
      mini.appendChild(el('div', {
        class: filled
          ? `hb-cell filled ${gemClasses(piece.color, 'hex')}`
          : 'hb-cell hb-cell--ghost',
      }));
    }
    ghost.appendChild(mini);
  }
  return ghost;
}

function setSnapHighlight(gridEl: HTMLElement, keys: Set<string>): void {
  gridEl.querySelectorAll('.hb-cell--snap').forEach((n) => n.classList.remove('hb-cell--snap'));
  for (const key of keys) {
    const [r, c] = key.split(',').map(Number);
    getCellEl(gridEl, r, c)?.classList.add('hb-cell--snap');
  }
}

export function wireDrag(ctx: DragContext): void {
  let dragging = false;
  let pieceIdx: number | null = null;
  let ghost: HTMLElement | null = null;
  let snapHighlight = new Set<string>();
  let rafId = 0;
  let pendingX = 0;
  let pendingY = 0;

  const clearSnapHighlight = (): void => {
    snapHighlight = new Set();
    setSnapHighlight(ctx.gridEl, snapHighlight);
  };

  const updateSnapPreview = (clientX: number, clientY: number): void => {
    if (pieceIdx == null) return;
    const piece = ctx.getPiece(pieceIdx);
    const anchor = findSnapAnchor(
      ctx.gridEl, ctx.rowWidth, clientX, clientY, piece.cells, ctx.canPlace,
    );
    const next = new Set<string>();
    if (anchor) {
      for (const [dr, dc] of piece.cells) next.add(`${anchor.r + dr},${anchor.c + dc}`);
    }
    if (next.size === snapHighlight.size && [...next].every((k) => snapHighlight.has(k))) return;
    snapHighlight = next;
    setSnapHighlight(ctx.gridEl, snapHighlight);
  };

  const moveGhost = (clientX: number, clientY: number): void => {
    if (!ghost) return;
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;
    updateSnapPreview(clientX, clientY);
  };

  const scheduleMove = (clientX: number, clientY: number): void => {
    pendingX = clientX;
    pendingY = clientY;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      moveGhost(pendingX, pendingY);
      rafId = 0;
    });
  };

  const endDrag = (clientX: number, clientY: number): void => {
    if (pieceIdx == null) return;
    const idx = pieceIdx;
    const piece = ctx.getPiece(idx);
    const anchor = findSnapAnchor(
      ctx.gridEl, ctx.rowWidth, clientX, clientY, piece.cells, ctx.canPlace,
    );

    ghost?.classList.add('hb-drag-ghost--drop');
    window.setTimeout(() => {
      ghost?.remove();
      ghost = null;
    }, anchor ? 80 : 220);

    dragging = false;
    clearSnapHighlight();
    document.body.classList.remove('hb-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    if (anchor) {
      ctx.setSelected(idx);
      ctx.onPlace(anchor.r, anchor.c);
    } else {
      ctx.onInvalid();
      const trayPiece = ctx.wrap.querySelector(`[data-piece-idx="${idx}"]`) as HTMLElement | null;
      trayPiece?.classList.remove('hb-piece--dragging');
      trayPiece?.classList.add('hb-piece--return');
      window.setTimeout(() => trayPiece?.classList.remove('hb-piece--return'), 380);
      ctx.paint();
    }
    pieceIdx = null;
  };

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    scheduleMove(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    endDrag(e.clientX, e.clientY);
  };

  ctx.wrap.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest('.hb-piece') as HTMLElement | null;
    if (!target || target.classList.contains('hb-piece--used')) return;
    const raw = target.dataset.pieceIdx;
    const idx = raw != null ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(idx)) return;

    pieceIdx = idx;
    ctx.setSelected(idx);
    ctx.onPickup();
    target.classList.add('hb-piece--dragging');
    dragging = true;
    document.body.classList.add('hb-dragging');

    const piece = ctx.getPiece(idx);
    ghost = buildGhost(piece);
    document.body.appendChild(ghost);
    scheduleMove(e.clientX, e.clientY);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    e.preventDefault();
  });
}

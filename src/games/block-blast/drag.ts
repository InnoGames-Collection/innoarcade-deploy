// Block Blast — drag-and-drop UX layer (placement rules unchanged).

import { gemClasses } from '../_shared/premiumGems';
import { el } from '../_lq/lq';

const SIZE = 8;
const SNAP_RADIUS = 1.35;

export interface DragPiece {
  cells: [number, number][];
  color: string;
  used: boolean;
}

export interface DragContext {
  gridEl: HTMLElement;
  wrap: HTMLElement;
  canPlace: (cells: [number, number][], br: number, bc: number) => boolean;
  onPlace: (br: number, bc: number) => void;
  onInvalid: () => void;
  onPickup: () => void;
  getSelected: () => number | null;
  setSelected: (idx: number | null) => void;
  getPiece: (idx: number) => DragPiece;
  paint: () => void;
}

function cellMetrics(gridEl: HTMLElement): { left: number; top: number; step: number; size: number } {
  const rect = gridEl.getBoundingClientRect();
  const style = getComputedStyle(gridEl);
  const padX = parseFloat(style.paddingLeft) || 0;
  const padY = parseFloat(style.paddingTop) || 0;
  const gap = parseFloat(style.gap) || 3;
  const innerW = rect.width - padX * 2;
  const step = (innerW - gap * (SIZE - 1)) / SIZE;
  return { left: rect.left + padX, top: rect.top + padY, step: step + gap, size: step };
}

function pointerToAnchor(
  gridEl: HTMLElement,
  clientX: number,
  clientY: number,
): { r: number; c: number } {
  const { left, top, step } = cellMetrics(gridEl);
  const c = Math.round((clientX - left - step * 0.5) / step);
  const r = Math.round((clientY - top - step * 0.5) / step);
  return { r, c };
}

function findSnapAnchor(
  gridEl: HTMLElement,
  clientX: number,
  clientY: number,
  cells: [number, number][],
  canPlace: (cells: [number, number][], br: number, bc: number) => boolean,
): { r: number; c: number } | null {
  const { left, top, step, size } = cellMetrics(gridEl);
  const px = clientX - left;
  const py = clientY - top;
  const maxDist = size * SNAP_RADIUS;

  let best: { r: number; c: number; dist: number } | null = null;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!canPlace(cells, r, c)) continue;
      const cx = c * step + size * 0.5;
      const cy = r * step + size * 0.5;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > maxDist) continue;
      if (!best || dist < best.dist) best = { r, c, dist };
    }
  }

  if (best) return { r: best.r, c: best.c };

  const anchor = pointerToAnchor(gridEl, clientX, clientY);
  if (canPlace(cells, anchor.r, anchor.c)) return anchor;

  const offsets: [number, number][] = [
    [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
  ];
  for (const [dr, dc] of offsets) {
    const r = anchor.r + dr;
    const c = anchor.c + dc;
    if (canPlace(cells, r, c)) return { r, c };
  }
  return null;
}

function buildGhost(piece: DragPiece): HTMLElement {
  const maxR = Math.max(...piece.cells.map((x) => x[0]));
  const maxC = Math.max(...piece.cells.map((x) => x[1]));
  const ghost = el('div', {
    class: 'bb-drag-ghost',
    style: `grid-template-rows:repeat(${maxR + 1},var(--bb-cell-size,32px));grid-template-columns:repeat(${maxC + 1},var(--bb-cell-size,32px))`,
  });
  for (const [r, c] of piece.cells) {
    ghost.appendChild(el('div', {
      class: `bb-pcell ${gemClasses(piece.color, 'block')}`,
      style: `grid-row:${r + 1};grid-column:${c + 1}`,
    }));
  }
  return ghost;
}

export function wireDrag(ctx: DragContext): void {
  let dragging = false;
  let pieceIdx: number | null = null;
  let ghost: HTMLElement | null = null;
  let snapHighlight: Set<string> = new Set();

  const clearSnapHighlight = (): void => {
    snapHighlight = new Set();
    ctx.gridEl.querySelectorAll('.bb-cell--snap').forEach((n) => n.classList.remove('bb-cell--snap'));
  };

  const updateSnapPreview = (clientX: number, clientY: number): void => {
    if (pieceIdx == null) return;
    const piece = ctx.getPiece(pieceIdx);
    const anchor = findSnapAnchor(ctx.gridEl, clientX, clientY, piece.cells, ctx.canPlace);
    const next = new Set<string>();
    if (anchor) {
      for (const [dr, dc] of piece.cells) next.add(`${anchor.r + dr},${anchor.c + dc}`);
    }
    if (next.size === snapHighlight.size && [...next].every((k) => snapHighlight.has(k))) return;
    clearSnapHighlight();
    snapHighlight = next;
    if (!anchor) return;
    const cells = ctx.gridEl.children;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (next.has(`${r},${c}`)) {
          (cells[r * SIZE + c] as HTMLElement).classList.add('bb-cell--snap');
        }
      }
    }
  };

  const moveGhost = (clientX: number, clientY: number): void => {
    if (!ghost) return;
    ghost.style.left = `${clientX}px`;
    ghost.style.top = `${clientY}px`;
    updateSnapPreview(clientX, clientY);
  };

  const endDrag = (clientX: number, clientY: number): void => {
    if (pieceIdx == null) return;
    const piece = ctx.getPiece(pieceIdx);
    const anchor = findSnapAnchor(ctx.gridEl, clientX, clientY, piece.cells, ctx.canPlace);
    ghost?.remove();
    ghost = null;
    dragging = false;
    clearSnapHighlight();
    document.body.classList.remove('bb-dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);

    if (anchor) {
      ctx.setSelected(pieceIdx);
      ctx.onPlace(anchor.r, anchor.c);
    } else {
      ctx.onInvalid();
      ctx.paint();
    }
    pieceIdx = null;
  };

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    moveGhost(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    endDrag(e.clientX, e.clientY);
  };

  ctx.wrap.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest('.bb-piece') as HTMLElement | null;
    if (!target || target.classList.contains('bb-piece--used')) return;
    const raw = target.dataset.pieceIdx;
    const idx = raw != null ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(idx)) return;

    pieceIdx = idx;
    ctx.setSelected(idx);
    ctx.onPickup();
    dragging = true;
    document.body.classList.add('bb-dragging');

    const piece = ctx.getPiece(idx);
    ghost = buildGhost(piece);
    document.body.appendChild(ghost);
    moveGhost(e.clientX, e.clientY);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    e.preventDefault();
  });
}

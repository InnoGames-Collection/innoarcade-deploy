// Tile Connect — DOM visual effects (connection line, particles, score popups).

export type PathPoint = { r: number; c: number };

/** Visual-only path reconstruction — does not affect gameplay validation. */
export function findConnectionPath(
  board: (string | null)[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  maxTurns = 2,
): PathPoint[] | null {
  if (board[r1][c1] !== board[r2][c2] || !board[r1][c1]) return null;
  const H = board.length;
  const W = board[0].length;
  const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  type Node = { r: number; c: number; dir: number; turns: number };
  type Parent = { node: Node; prev: Parent | null };

  const seen = new Set<string>();
  const parentMap = new Map<string, Parent>();
  const q: Node[] = [{ r: r1, c: c1, dir: -1, turns: 0 }];
  const startKey = `${r1},${c1},-1,0`;
  seen.add(startKey);
  parentMap.set(startKey, { node: q[0], prev: null });

  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === r2 && cur.c === c2 && (cur.r !== r1 || cur.c !== c1)) {
      const path: PathPoint[] = [];
      let p: Parent | null | undefined = parentMap.get(`${cur.r},${cur.c},${cur.dir},${cur.turns}`);
      while (p) {
        path.unshift({ r: p.node.r, c: p.node.c });
        p = p.prev;
      }
      return simplifyPath(path);
    }
    for (let d = 0; d < 4; d++) {
      const turns = cur.dir === -1 ? 0 : (d === cur.dir ? cur.turns : cur.turns + 1);
      if (turns > maxTurns) continue;
      let nr = cur.r + dirs[d][0];
      let nc = cur.c + dirs[d][1];
      while (nr >= -1 && nc >= -1 && nr <= H && nc <= W) {
        const inside = nr >= 0 && nc >= 0 && nr < H && nc < W;
        const empty = !inside || !board[nr][nc];
        const isEnd = nr === r2 && nc === c2;
        if (!empty && !isEnd) break;
        const key = `${nr},${nc},${d},${turns}`;
        if (!seen.has(key)) {
          seen.add(key);
          const node: Node = { r: nr, c: nc, dir: d, turns };
          parentMap.set(key, { node, prev: parentMap.get(`${cur.r},${cur.c},${cur.dir},${cur.turns}`) ?? null });
          q.push(node);
        }
        if (isEnd) {
          const path: PathPoint[] = [];
          let p: Parent | null | undefined = parentMap.get(key);
          while (p) {
            path.unshift({ r: p.node.r, c: p.node.c });
            p = p.prev;
          }
          return simplifyPath(path);
        }
        if (!empty) break;
        nr += dirs[d][0];
        nc += dirs[d][1];
      }
    }
  }
  return null;
}

function simplifyPath(path: PathPoint[]): PathPoint[] {
  if (path.length <= 2) return path;
  const out: PathPoint[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const dr1 = b.r - a.r;
    const dc1 = b.c - a.c;
    const dr2 = c.r - b.r;
    const dc2 = c.c - b.c;
    if (dr1 === dr2 && dc1 === dc2) continue;
    out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}

export function cellCenter(
  grid: HTMLElement,
  r: number,
  c: number,
  cols: number,
  area: HTMLElement,
): { x: number; y: number } | null {
  const tile = grid.children[r * cols + c] as HTMLElement | undefined;
  if (!tile) return null;
  const a = area.getBoundingClientRect();
  const b = tile.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
}

export function drawConnectionLine(
  svg: SVGSVGElement,
  grid: HTMLElement,
  cols: number,
  area: HTMLElement,
  path: PathPoint[],
): void {
  const pts: string[] = [];
  for (const { r, c } of path) {
    const center = cellCenter(grid, r, c, cols, area);
    if (center) pts.push(`${center.x},${center.y}`);
  }
  if (pts.length < 2) return;
  svg.innerHTML = `
    <polyline class="tc-line-glow" points="${pts.join(' ')}" />
    <polyline class="tc-line-core" points="${pts.join(' ')}" />
  `;
}

export function spawnScorePopup(
  area: HTMLElement,
  x: number,
  y: number,
  label: string,
  points?: number,
): void {
  const node = document.createElement('div');
  node.className = 'tc-score-popup';
  const pts = points != null && points > 0
    ? `<span class="tc-score-popup__pts">+${points}</span>`
    : '';
  node.innerHTML = `${pts}<span class="tc-score-popup__lbl">${label}</span>`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  area.appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}

export function labelForMatch(combo: number, elapsedSinceLast: number): string {
  if (combo >= 5) return `Combo ×${combo}`;
  if (combo >= 3) return 'Tile Master';
  if (combo >= 2) return `Combo ×${combo}`;
  if (elapsedSinceLast < 2000) return 'Quick Thinker';
  if (elapsedSinceLast < 4000) return 'Great Match';
  return 'Perfect';
}

export function spawnMatchBurst(
  area: HTMLElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
): void {
  spawnParticles(area, x1, y1, color, 6);
  spawnParticles(area, x2, y2, color, 6);
  spawnSparkles(area, x1, y1);
  spawnSparkles(area, x2, y2);
}

export function boardScaleForRemaining(remaining: number, initial: number): number {
  const ratio = initial > 0 ? remaining / initial : 1;
  const base = 1.08;
  const boost = (1 - ratio) * 0.1;
  return Math.min(base + boost, 1.2);
}

export interface BoardClusterLayout {
  scale: number;
  originX: string;
  originY: string;
  gap: string;
  pad: string;
}

/** Visual-only layout — tightens gaps as tiles are cleared. */
export function boardClusterLayout(
  _board: (string | null)[][],
  _rows: number,
  _cols: number,
  remaining: number,
  initial: number,
): BoardClusterLayout {
  const fillRatio = initial > 0 ? remaining / initial : 1;
  const gap = fillRatio < 0.35 ? '3px' : fillRatio < 0.65 ? '4px' : '5px';
  const pad = fillRatio < 0.35 ? '7px' : fillRatio < 0.65 ? '9px' : '10px';
  const scale = boardScaleForRemaining(remaining, initial);

  return {
    scale,
    originX: '50%',
    originY: '50%',
    gap,
    pad,
  };
}

/** Clamp visual scale so the full board stays inside the play viewport. */
export function clampBoardScale(
  viewport: HTMLElement,
  grid: HTMLElement,
  desired: number,
): number {
  const margin = 8;
  const availW = Math.max(viewport.clientWidth - margin, 1);
  const availH = Math.max(viewport.clientHeight - margin, 1);
  const naturalW = grid.offsetWidth;
  const naturalH = grid.offsetHeight;
  if (naturalW < 1 || naturalH < 1) return Math.min(desired, 1.1);

  const maxFit = Math.min(availW / naturalW, availH / naturalH) * 0.97;
  return Math.min(desired, maxFit, 1.22);
}

export function spawnParticles(
  area: HTMLElement,
  x: number,
  y: number,
  color: string,
  count = 10,
): void {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'tc-particle';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 20 + Math.random() * 28;
    p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    p.style.setProperty('--particle-color', color);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.animationDelay = `${Math.random() * 0.05}s`;
    area.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

export function spawnSparkles(area: HTMLElement, x: number, y: number): void {
  const colors = ['#6cc52f', '#3d8ef0', '#ffd700', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    s.className = 'tc-sparkle';
    s.textContent = '✦';
    s.style.color = colors[i % colors.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 24;
    s.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    area.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  }
}

export function centerOf(el: HTMLElement, area: HTMLElement): { x: number; y: number } {
  const a = area.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
}

export function animateHudValue(el: HTMLElement | null, value: string): void {
  if (!el) return;
  el.classList.remove('tc-stat-bump');
  void el.offsetWidth;
  el.textContent = value;
  el.classList.add('tc-stat-bump');
}

export function animateCountUp(el: HTMLElement, target: number, duration = 900): void {
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function launchConfetti(container: HTMLElement): void {
  const colors = ['#4f9e16', '#6cc52f', '#1f74e0', '#3d8ef0', '#ffd700', '#ffffff'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'tc-confetti';
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    c.style.animationDuration = `${1.1 + Math.random() * 0.7}s`;
    container.appendChild(c);
    c.addEventListener('animationend', () => c.remove());
  }
}

export function pulseBoard(gridEl: HTMLElement): void {
  gridEl.classList.remove('tc-board-pulse');
  void gridEl.offsetWidth;
  gridEl.classList.add('tc-board-pulse');
}

export function shakeWrap(wrap: HTMLElement): void {
  wrap.classList.remove('tc-shake');
  void wrap.offsetWidth;
  wrap.classList.add('tc-shake');
}

export function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

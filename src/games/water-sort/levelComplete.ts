/** Water Sort — premium level-complete celebration overlay (visual only). */

export interface LevelCompleteOpts {
  stars: number;
  levelScore: number;
  starBonus: number;
  coins?: number;
}

function renderStars(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(3 - count);
}

function animateCount(el: HTMLElement, target: number, durationMs: number, prefix = '+'): void {
  const start = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = `${prefix}${Math.round(target * eased)}`;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = `${prefix}${target}`;
  };
  requestAnimationFrame(tick);
}

export function showLevelCompleteCelebration(
  board: HTMLElement,
  opts: LevelCompleteOpts,
  durationMs = 900,
): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {};
  }

  const overlay = document.createElement('div');
  overlay.className = 'ws-level-complete';

  const card = document.createElement('div');
  card.className = 'ws-level-complete__card';

  const title = document.createElement('h3');
  title.className = 'ws-level-complete__title';
  title.textContent = 'Level Complete!';

  const stars = document.createElement('div');
  stars.className = 'ws-level-complete__stars';
  stars.textContent = renderStars(opts.stars);

  const score = document.createElement('div');
  score.className = 'ws-level-complete__score';
  score.textContent = '+0';

  card.appendChild(title);
  card.appendChild(stars);
  card.appendChild(score);

  if (opts.starBonus > 0) {
    const coins = document.createElement('div');
    coins.className = 'ws-level-complete__coins';
    coins.innerHTML = '<span>✦</span><span class="ws-lc-coins-val">+0</span> bonus';
    card.appendChild(coins);
    const coinVal = coins.querySelector('.ws-lc-coins-val') as HTMLElement;
    requestAnimationFrame(() => animateCount(coinVal, opts.starBonus, 600));
  }

  overlay.appendChild(card);
  board.appendChild(overlay);

  requestAnimationFrame(() => animateCount(score, opts.levelScore, 650));

  const timer = window.setTimeout(() => overlay.remove(), durationMs);
  return () => {
    window.clearTimeout(timer);
    overlay.remove();
  };
}

export function mountBoardBubbles(board: HTMLElement): () => void {
  const layer = document.createElement('div');
  layer.className = 'ws-bubbles';
  layer.setAttribute('aria-hidden', 'true');

  const sizes = [12, 16, 20, 10, 14, 18, 24, 11];
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('span');
    b.className = 'ws-bubble';
    const size = sizes[i % sizes.length];
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${6 + (i * 11) % 88}%`;
    b.style.bottom = `${-4 - (i % 4) * 6}%`;
    b.style.setProperty('--dur', `${9 + i * 1.6}s`);
    b.style.setProperty('--delay', `${i * 1.2}s`);
    layer.appendChild(b);
  }

  board.prepend(layer);
  return () => layer.remove();
}

export function bumpStat(id: 'fpStat-moves' | 'fpStat-score' | 'fpStat-round' | 'fpStat-time'): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('ws-stat-bump');
  void el.offsetWidth;
  el.classList.add('ws-stat-bump');
  window.setTimeout(() => el.classList.remove('ws-stat-bump'), 500);
}

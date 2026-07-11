/** Slide Puzzle visual helpers — presentation only, no gameplay logic. */

const FEEDBACK_MSGS = [
  'Perfect Move',
  'Excellent',
  'Fast Solver',
  'Puzzle Master',
  'Brilliant',
  'Smooth!',
];

export function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function efficiencyRating(moves: number, par: number, elapsedMs: number): string {
  const moveRatio = moves / Math.max(1, par);
  const timeSec = elapsedMs / 1000;
  if (moveRatio <= 1.0 && timeSec < 45) return 'Puzzle Master';
  if (moveRatio <= 1.1 && timeSec < 75) return 'Brilliant';
  if (moveRatio <= 1.25 && timeSec < 120) return 'Fast Solver';
  if (moveRatio <= 1.5) return 'Excellent';
  if (moveRatio <= 2) return 'Good';
  return 'Completed';
}

export function comboFeedback(combo: number): string {
  if (combo >= 5) return 'Puzzle Master!';
  if (combo >= 4) return 'Brilliant!';
  if (combo >= 3) return 'Excellent!';
  if (combo >= 2) return 'Perfect Move!';
  return FEEDBACK_MSGS[Math.floor(Math.random() * FEEDBACK_MSGS.length)];
}

export function bumpStat(id: string): void {
  const el = document.getElementById(`fpStat-${id}`);
  if (!el) return;
  el.classList.remove('sp-stat-bump');
  void el.offsetWidth;
  el.classList.add('sp-stat-bump');
}

export function animateCountUp(el: HTMLElement, target: number, duration = 1200): void {
  const start = performance.now();
  const from = 0;
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(step);
}

export function showFeedback(mount: HTMLElement, text: string): void {
  const pop = mount.querySelector('.sp-score-pop') as HTMLElement | null;
  if (!pop) return;
  const node = document.createElement('div');
  node.className = 'sp-feedback';
  node.textContent = text;
  pop.appendChild(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

export function initBgParticles(): void {
  const layer = document.querySelector('body[data-game="slide-puzzle"] .sp-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'sp-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 40}%`;
    p.style.animationDelay = `${Math.random() * 9}s`;
    p.style.animationDuration = `${7 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

export function wireHudRow(): void {
  const hudRow = document.getElementById('spHudRow');
  const stats = document.getElementById('fpStats');
  const btn = document.getElementById('spSettingsHudBtn');
  if (!hudRow || !stats || !btn) return;
  hudRow.insertBefore(stats, btn);
}

export function ensureScorePop(mount: HTMLElement): HTMLElement {
  let pop = mount.querySelector('.sp-score-pop') as HTMLElement | null;
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'sp-score-pop';
    pop.setAttribute('aria-live', 'polite');
    mount.insertBefore(pop, mount.firstChild);
  }
  return pop;
}

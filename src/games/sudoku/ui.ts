/** Sudoku visual helpers — presentation only, no gameplay logic. */

const FEEDBACK_MSGS = [
  'Correct!',
  'Perfect!',
  'Fast Move!',
  'Excellent!',
  'Sudoku Master!',
  'Brilliant!',
];

export function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function tierLabel(tier: number): string {
  if (tier <= 0) return 'Easy';
  if (tier === 1) return 'Medium';
  return 'Hard';
}

export function randomFeedback(): string {
  return FEEDBACK_MSGS[Math.floor(Math.random() * FEEDBACK_MSGS.length)];
}

export function bumpStat(id: string): void {
  const el = document.getElementById(`fpStat-${id}`);
  if (!el) return;
  el.classList.remove('sdk-stat-bump');
  void el.offsetWidth;
  el.classList.add('sdk-stat-bump');
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
  const pop = mount.querySelector('.sdk-score-pop') as HTMLElement | null;
  if (!pop) return;
  const node = document.createElement('div');
  node.className = 'sdk-feedback';
  node.textContent = text;
  pop.appendChild(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
}

export function spawnSparkles(anchor: HTMLElement, count = 10): void {
  const rect = anchor.getBoundingClientRect();
  const parent = anchor.closest('.sdk-board-frame') as HTMLElement | null;
  if (!parent) return;
  const pr = parent.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = `sdk-sparkle ${i % 2 ? 'sdk-sparkle--gold' : 'sdk-sparkle--teal'}`;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 20 + Math.random() * 28;
    s.style.left = `${rect.left - pr.left + rect.width / 2}px`;
    s.style.top = `${rect.top - pr.top + rect.height / 2}px`;
    s.style.setProperty('--sx', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--sy', `${Math.sin(angle) * dist - 20}px`);
    parent.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
}

export function initBgParticles(): void {
  const layer = document.querySelector('body[data-game="sudoku"] .sdk-bg-layer');
  if (!layer) return;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('div');
    p.className = 'sdk-bg-particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.bottom = `${Math.random() * 35}%`;
    p.style.animationDelay = `${Math.random() * 9}s`;
    p.style.animationDuration = `${7 + Math.random() * 6}s`;
    layer.appendChild(p);
  }
}

export function ensurePlayToolbar(): void {
  const frame = document.getElementById('fcPlayFrame');
  if (!frame || frame.querySelector('#sdkSettingsPlayBtn')) return;
  const bar = document.createElement('div');
  bar.className = 'sdk-toolbar';
  bar.innerHTML = `
    <button type="button" id="sdkSettingsPlayBtn" class="sdk-icon-btn" aria-label="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      Settings
    </button>`;
  const mount = frame.querySelector('#lq-mount');
  if (mount) frame.insertBefore(bar, mount);
  else frame.appendChild(bar);
}

// Hexa Block — DOM visual effects (particles, popups, board pulse).

export function spawnScorePopup(
  area: HTMLElement,
  x: number,
  y: number,
  label: string,
  points?: number,
): void {
  const node = document.createElement('div');
  node.className = 'hb-score-popup';
  const pts = points != null && points > 0
    ? `<span class="hb-score-popup__pts">+${points}</span>`
    : '';
  node.innerHTML = `${pts}<span class="hb-score-popup__lbl">${label}</span>`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  area.appendChild(node);
  node.addEventListener('animationend', () => node.remove());
}

export function labelForPlacement(lines: number, combo: number): string {
  if (lines >= 3) return 'Brilliant';
  if (lines >= 2) return 'Hex Master';
  if (combo >= 5) return `Combo ×${combo}`;
  if (combo >= 2) return `Combo ×${combo}`;
  if (lines === 1) return 'Excellent';
  return 'Perfect Placement';
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
    p.className = 'hb-particle';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 24 + Math.random() * 32;
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
    s.className = 'hb-sparkle';
    s.textContent = '✦';
    s.style.color = colors[i % colors.length];
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 28;
    s.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    s.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    area.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  }
}

export function spawnStreak(area: HTMLElement, x: number, y: number): void {
  const s = document.createElement('div');
  s.className = 'hb-streak';
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  area.appendChild(s);
  s.addEventListener('animationend', () => s.remove());
}

export function pulseBoard(gridEl: HTMLElement): void {
  gridEl.classList.remove('hb-board-pulse');
  void gridEl.offsetWidth;
  gridEl.classList.add('hb-board-pulse');
}

export function shakeWrap(wrap: HTMLElement): void {
  wrap.classList.remove('hb-shake');
  void wrap.offsetWidth;
  wrap.classList.add('hb-shake');
}

export function centerOf(el: HTMLElement, area: HTMLElement): { x: number; y: number } {
  const a = area.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  return {
    x: b.left - a.left + b.width / 2,
    y: b.top - a.top + b.height / 2,
  };
}

export function animateHudValue(el: HTMLElement | null, value: string): void {
  if (!el) return;
  el.classList.remove('hb-stat-bump');
  void el.offsetWidth;
  el.textContent = value;
  el.classList.add('hb-stat-bump');
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
    c.className = 'hb-confetti';
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    c.style.animationDuration = `${1.1 + Math.random() * 0.7}s`;
    container.appendChild(c);
    c.addEventListener('animationend', () => c.remove());
  }
}

export function markPlacedCells(gridEl: HTMLElement, keys: string[]): void {
  for (const key of keys) {
    const [r, c] = key.split(',').map(Number);
    const row = gridEl.children[r] as HTMLElement | undefined;
    const cell = row?.children[c] as HTMLElement | undefined;
    if (cell) {
      cell.classList.add('hb-cell--placed');
      window.setTimeout(() => cell.classList.remove('hb-cell--placed'), 420);
    }
  }
}

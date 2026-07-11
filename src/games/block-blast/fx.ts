// Block Blast — DOM visual effects (particles, popups, board pulse).

export function spawnScorePopup(
  area: HTMLElement,
  x: number,
  y: number,
  label: string,
  points?: number,
): void {
  const el = document.createElement('div');
  el.className = 'bb-score-popup';
  const pts = points != null && points > 0
    ? `<span class="bb-score-popup__pts">+${points}</span>`
    : '';
  el.innerHTML = `${pts}<span class="bb-score-popup__lbl">${label}</span>`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  area.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function labelForPlacement(lines: number, combo: number): string {
  if (lines >= 2) return lines >= 3 ? 'Brilliant!' : 'Amazing!';
  if (combo >= 5) return `Combo ×${combo}`;
  if (combo >= 2) return `Combo ×${combo}`;
  if (lines === 1) return 'Line Clear!';
  return 'Perfect';
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
    p.className = 'bb-particle';
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
    s.className = 'bb-sparkle';
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
  s.className = 'bb-streak';
  s.style.left = `${x}px`;
  s.style.top = `${y}px`;
  area.appendChild(s);
  s.addEventListener('animationend', () => s.remove());
}

export function pulseBoard(gridEl: HTMLElement): void {
  gridEl.classList.remove('bb-board-pulse');
  void gridEl.offsetWidth;
  gridEl.classList.add('bb-board-pulse');
}

export function shakeWrap(wrap: HTMLElement): void {
  wrap.classList.remove('bb-shake');
  void wrap.offsetWidth;
  wrap.classList.add('bb-shake');
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
  el.classList.remove('bb-stat-bump');
  void el.offsetWidth;
  el.textContent = value;
  el.classList.add('bb-stat-bump');
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
    c.className = 'bb-confetti';
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
    const idx = r * 8 + c;
    const cell = gridEl.children[idx] as HTMLElement | undefined;
    if (cell) {
      cell.classList.add('bb-cell--placed');
      window.setTimeout(() => cell.classList.remove('bb-cell--placed'), 420);
    }
  }
}

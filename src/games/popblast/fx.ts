// DOM-based visual effects for Candy Blast — presentation only.

const CELEBRATION_TEXTS = [
  '', '', 'Sweet', 'Tasty', 'Fantastic', 'Excellent', 'Amazing', 'Delicious',
  'Outstanding', 'Mega Combo', 'Blast Master', 'Candy King',
] as const;

let fxRoot: HTMLElement | null = null;
let shakeTarget: HTMLElement | null = null;
let shakeTimer = 0;

export function initFx(stage: HTMLElement, shakeEl?: HTMLElement): void {
  fxRoot = stage.querySelector('#pbFxLayer') as HTMLElement | null;
  if (!fxRoot) {
    fxRoot = document.createElement('div');
    fxRoot.id = 'pbFxLayer';
    fxRoot.className = 'pb-fx-layer';
    fxRoot.setAttribute('aria-hidden', 'true');
    stage.appendChild(fxRoot);
  }
  shakeTarget = shakeEl ?? stage;
}

export function celebrationText(combo: number, matchSize: number): string {
  if (combo >= 10) return 'Candy King';
  if (combo >= 8) return 'Blast Master';
  if (combo >= 6) return 'Mega Combo';
  if (combo >= 5) return CELEBRATION_TEXTS[Math.min(combo + 2, 11)] ?? 'Outstanding';
  if (matchSize >= 5) return 'Fantastic';
  if (matchSize >= 4) return 'Excellent';
  if (combo >= 3) return 'Sweet';
  if (combo >= 2) return 'Tasty';
  return '';
}

export function scoreLabel(points: number): string {
  const scaled = Math.round(points * 10);
  if (scaled >= 150) return '+150';
  if (scaled >= 100) return '+100';
  if (scaled >= 75) return '+75';
  if (scaled >= 50) return '+50';
  if (scaled >= 30) return '+30';
  if (scaled >= 20) return '+20';
  return '+10';
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function spawnScorePopup(x: number, y: number, text: string, big = false): void {
  if (!fxRoot || !text) return;
  const el = document.createElement('div');
  el.className = `pb-score-pop${big ? ' pb-score-pop--big' : ''}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('pb-score-pop--active'));
  window.setTimeout(() => el.remove(), 900);
}

export function spawnParticles(x: number, y: number, color: string, count = 8): void {
  if (!fxRoot) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'pb-particle';
    const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const dist = rand(28, 56);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--pb-px', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--pb-py', `${Math.sin(angle) * dist}px`);
    p.style.background = color;
    fxRoot.appendChild(p);
    requestAnimationFrame(() => p.classList.add('pb-particle--active'));
    window.setTimeout(() => p.remove(), 650);
  }
}

export function spawnSparkles(x: number, y: number, count = 5): void {
  if (!fxRoot) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'pb-sparkle';
    s.textContent = '✦';
    s.style.left = `${x + rand(-30, 30)}px`;
    s.style.top = `${y + rand(-30, 30)}px`;
    s.style.animationDelay = `${rand(0, 0.15)}s`;
    fxRoot.appendChild(s);
    window.setTimeout(() => s.remove(), 800);
  }
}

export function showCelebration(text: string, tier: 'low' | 'mid' | 'high' = 'mid'): void {
  if (!fxRoot || !text) return;
  const el = document.createElement('div');
  el.className = `pb-celebration pb-celebration--${tier}`;
  el.textContent = text;
  fxRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('pb-celebration--active'));
  if (tier !== 'low') burstConfetti(tier === 'high' ? 40 : 22);
  if (tier === 'high') lightBurst();
  window.setTimeout(() => el.remove(), 1200);
}

export function lightBurst(): void {
  if (!fxRoot) return;
  const el = document.createElement('div');
  el.className = 'pb-light-burst';
  fxRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('pb-light-burst--active'));
  window.setTimeout(() => el.remove(), 600);
}

export function burstConfetti(count = 30): void {
  if (!fxRoot) return;
  const colors = ['#e85b9c', '#1f74e0', '#4f9e16', '#ffd700', '#ff7b9c', '#6ec8ff', '#ffe566'];
  const stageRect = fxRoot.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'pb-confetti';
    c.style.left = `${stageRect.width * rand(0.2, 0.8)}px`;
    c.style.top = `${rand(-20, 40)}px`;
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.setProperty('--pb-cx', `${rand(-80, 80)}px`);
    c.style.setProperty('--pb-cy', `${rand(60, 180)}px`);
    c.style.setProperty('--pb-rot', `${rand(180, 720)}deg`);
    c.style.animationDelay = `${rand(0, 0.3)}s`;
    fxRoot.appendChild(c);
    window.setTimeout(() => c.remove(), 2200);
  }
}

export function screenShake(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!shakeTarget) return;
  shakeTarget.classList.remove('pb-shake-light', 'pb-shake-medium', 'pb-shake-heavy');
  void shakeTarget.offsetWidth;
  shakeTarget.classList.add(`pb-shake-${intensity}`);
  clearTimeout(shakeTimer);
  shakeTimer = window.setTimeout(() => {
    shakeTarget?.classList.remove('pb-shake-light', 'pb-shake-medium', 'pb-shake-heavy');
  }, 350);
}

export function cameraPulse(): void {
  const stage = document.getElementById('stage');
  if (!stage) return;
  stage.classList.add('pb-camera-pulse');
  window.setTimeout(() => stage.classList.remove('pb-camera-pulse'), 400);
}

export function tileCenter(tile: HTMLElement): { x: number; y: number } {
  const rect = tile.getBoundingClientRect();
  const rootRect = fxRoot?.getBoundingClientRect() ?? rect;
  return {
    x: rect.left + rect.width / 2 - rootRect.left,
    y: rect.top + rect.height / 2 - rootRect.top,
  };
}

export const CANDY_COLORS: Record<string, string> = {
  red: '#ff7b9c',
  blue: '#6ec8ff',
  green: '#6ddf8a',
  yellow: '#ffe566',
  purple: '#d4a0ff',
  orange: '#ffb86a',
};

export function celebrationTier(combo: number, matchSize: number): 'low' | 'mid' | 'high' {
  if (combo >= 6 || matchSize >= 5) return 'high';
  if (combo >= 3 || matchSize >= 4) return 'mid';
  return 'low';
}

export function animateCounter(
  el: HTMLElement,
  from: number,
  to: number,
  duration = 400,
): void {
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - (1 - t) ** 3;
    const val = Math.round(from + (to - from) * eased);
    el.textContent = val.toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function fireworks(): void {
  if (!fxRoot) return;
  const stageRect = fxRoot.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    window.setTimeout(() => {
      const x = stageRect.width * rand(0.15, 0.85);
      const y = stageRect.height * rand(0.1, 0.45);
      const colors = ['#ffd700', '#e85b9c', '#1f74e0', '#4f9e16', '#ff7b9c'];
      for (let j = 0; j < 12; j++) {
        const p = document.createElement('div');
        p.className = 'pb-firework';
        const angle = (Math.PI * 2 * j) / 12;
        const dist = rand(40, 70);
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.setProperty('--pb-fx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--pb-fy', `${Math.sin(angle) * dist}px`);
        p.style.background = colors[j % colors.length];
        fxRoot!.appendChild(p);
        requestAnimationFrame(() => p.classList.add('pb-firework--active'));
        window.setTimeout(() => p.remove(), 900);
      }
    }, i * 280);
  }
}

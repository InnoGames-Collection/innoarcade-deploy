// Unified keyboard + swipe input. Pointer events cover mouse and touch;
// swipes shorter than the threshold count as taps.

export type Action = 'left' | 'right' | 'up' | 'down' | 'tap' | 'pause';

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ' ': 'tap',
  Enter: 'tap',
  Escape: 'pause',
  p: 'pause',
  P: 'pause',
};

const SWIPE_THRESHOLD = 24;
const TAP_MAX_MS = 400;

export class Input {
  private listeners: Array<(a: Action) => void> = [];
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private tracking = false;

  constructor(target: HTMLElement = document.body) {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const action = KEY_MAP[e.key];
      if (!action) return;
      e.preventDefault();
      this.emit(action);
    });

    target.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      this.tracking = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startT = performance.now();
    });

    target.addEventListener('pointerup', (e) => {
      if (!this.tracking) return;
      this.tracking = false;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
        if (performance.now() - this.startT < TAP_MAX_MS) this.emit('tap');
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) this.emit(dx > 0 ? 'right' : 'left');
      else this.emit(dy > 0 ? 'down' : 'up');
    });
  }

  onAction(fn: (a: Action) => void): void {
    this.listeners.push(fn);
  }

  private emit(a: Action): void {
    for (const fn of this.listeners) fn(a);
  }
}

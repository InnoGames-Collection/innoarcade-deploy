// Lightweight analytics hooks — dispatch CustomEvents for hub / future telemetry.
// Listeners: `document.addEventListener('goplay-game', (e) => { ... e.detail })`

export type GameEventDetail =
  | { type: 'runStart'; gameId: string }
  | { type: 'levelComplete'; gameId: string; level: number; score?: number }
  | { type: 'gameOver'; gameId: string; score: number; isWin: boolean };

const EVENT_NAME = 'goplay-game';

export function emitGameEvent(detail: GameEventDetail): void {
  try {
    document.dispatchEvent(new CustomEvent<GameEventDetail>(EVENT_NAME, { detail }));
  } catch { /* non-browser env */ }
}

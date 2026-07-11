/** Hub play-frame visibility for canvas arcade games (merge-2048 pattern). */

import { finalizeArcadeScore, scaleArcadeScore } from '../../platform/arcadeScore';
import { emitGameEvent } from '../../platform/gameEvents';

const DEFAULT_IN_ROUND = [
  'playing', 'paused', 'ready', 'firing', 'levelClear', 'over', 'gameOver',
];

export function bindHubCanvasChrome(opts: {
  playWrapper: HTMLElement;
  backdrop?: HTMLElement | null;
  shell: { showForState: (state: string) => void; toast?: (msg: string) => void };
  inRoundStates?: string[];
  gameId?: string;
}): (state: string) => void {
  const inRound = new Set(opts.inRoundStates ?? DEFAULT_IN_ROUND);
  return (state: string) => {
    opts.shell.showForState(state);
    const active = inRound.has(state);
    opts.playWrapper.classList.toggle('hidden', !active);
    opts.backdrop?.classList.toggle('hidden', active);
  };
}

/** Track run start from first in-round state (menu resets). */
export function trackArcadeRunStart(gameId?: string): {
  getRunStart: () => number;
  onStateChange: (state: string) => void;
} {
  let runStart = 0;
  let emittedStart = false;
  return {
    getRunStart: () => runStart,
    onStateChange: (state: string) => {
      if (state === 'menu') {
        runStart = 0;
        emittedStart = false;
      } else if (!runStart) {
        runStart = Date.now();
        if (gameId && !emittedStart) {
          emittedStart = true;
          emitGameEvent({ type: 'runStart', gameId });
        }
      }
    },
  };
}

export { scaleArcadeScore };

/** Submit scaled arcade score with optional time bonus. */
export function submitArcadeScore(
  rawScore: number,
  runStart: number,
  shell: { handleGameOver: (score: number, isRecord: boolean) => void },
  opts?: { budgetSec?: number; mult?: number; gameId?: string; isWin?: boolean; winScore?: number },
): void {
  const final = finalizeArcadeScore(rawScore, Date.now() - runStart, opts);
  if (opts?.gameId) {
    emitGameEvent({
      type: 'gameOver',
      gameId: opts.gameId,
      score: final,
      isWin: opts.winScore != null ? final >= opts.winScore : (opts.isWin ?? false),
    });
  }
  void shell.handleGameOver(final, false);
}

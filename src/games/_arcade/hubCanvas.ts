/** Hub play-frame visibility for canvas arcade games (merge-2048 pattern). */

import { finalizeArcadeScore, scaleArcadeScore } from '../../platform/arcadeScore';

const DEFAULT_IN_ROUND = [
  'playing', 'paused', 'ready', 'firing', 'levelClear', 'over', 'gameOver',
];

export function bindHubCanvasChrome(opts: {
  playWrapper: HTMLElement;
  backdrop?: HTMLElement | null;
  shell: { showForState: (state: string) => void };
  inRoundStates?: string[];
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
export function trackArcadeRunStart(): {
  getRunStart: () => number;
  onStateChange: (state: string) => void;
} {
  let runStart = 0;
  return {
    getRunStart: () => runStart,
    onStateChange: (state: string) => {
      if (state === 'menu') runStart = 0;
      else if (!runStart) runStart = Date.now();
    },
  };
}

export { scaleArcadeScore };

/** Submit scaled arcade score with optional time bonus. */
export function submitArcadeScore(
  rawScore: number,
  runStart: number,
  shell: { handleGameOver: (score: number, isRecord: boolean) => void },
  opts?: { budgetSec?: number; mult?: number },
): void {
  const final = finalizeArcadeScore(rawScore, Date.now() - runStart, opts);
  void shell.handleGameOver(final, false);
}

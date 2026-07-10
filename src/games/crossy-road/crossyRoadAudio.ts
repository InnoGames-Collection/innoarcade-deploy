// Crossy Road — synthesized audio cues and ambient music bed.

import { sfx } from '../../engine/audio';

const BASE_PATTERN = [262, 330, 392, 440, 392, 330, 294, 0];
const MUSIC_BPM = 108;

export const crossyRoadAudio = {
  startSession(): void {
    sfx.startMusic(BASE_PATTERN, MUSIC_BPM);
  },

  stopSession(): void {
    sfx.stopMusic();
  },

  hop(): void {
    sfx.jump();
  },

  splash(): void {
    sfx.slide();
  },

  dust(): void {
    sfx.click();
  },

  coin(): void {
    sfx.coin();
  },

  gameOver(): void {
    sfx.crash();
    sfx.stopMusic();
  },

  newBest(): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => sfx.coin(), i * 90);
    }
  },
};

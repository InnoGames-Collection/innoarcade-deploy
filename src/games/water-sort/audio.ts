/** Water Sort — premium WebAudio synth (same timing as shared sounds). */

import { sfx } from '../../engine/audio';

type Note = [freq: number, at: number, dur: number, type?: OscillatorType, vol?: number];

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (sfx.muted) return null;
  try {
    const Ctor = window.AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

function playNotes(notes: Note[]): void {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [freq, at, dur, type = 'sine', vol = 0.1] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(5000, freq * 3.5);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(vol, now + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.02);
  }
}

export type WaterSortSound = 'click' | 'good' | 'bad' | 'win' | 'pourStart' | 'pourLand' | 'pourComplete';

const SOUNDS: Record<WaterSortSound, Note[]> = {
  click: [[920, 0, 0.04, 'sine', 0.07], [1380, 0.01, 0.03, 'sine', 0.04]],
  good: [[580, 0, 0.08, 'sine', 0.09], [780, 0.08, 0.1, 'sine', 0.08]],
  bad: [[220, 0, 0.16, 'triangle', 0.08]],
  win: [
    [523, 0, 0.1, 'sine', 0.1],
    [659, 0.1, 0.1, 'sine', 0.1],
    [784, 0.2, 0.1, 'sine', 0.09],
    [1047, 0.3, 0.18, 'sine', 0.11],
  ],
  pourStart: [[340, 0, 0.06, 'sine', 0.07], [480, 0.03, 0.09, 'sine', 0.06], [620, 0.06, 0.07, 'triangle', 0.05]],
  pourLand: [[260, 0, 0.05, 'sine', 0.07], [340, 0.04, 0.08, 'sine', 0.06], [420, 0.08, 0.1, 'triangle', 0.05]],
  pourComplete: [[620, 0, 0.08, 'sine', 0.08], [820, 0.08, 0.12, 'sine', 0.08], [1040, 0.16, 0.14, 'sine', 0.07]],
};

export function waterSortSound(name: WaterSortSound): void {
  playNotes(SOUNDS[name]);
}

export function isWaterSortPage(): boolean {
  return document.body.dataset.game === 'water-sort';
}

export function waterSortPourSound(kind: 'start' | 'land' | 'complete'): void {
  const map: Record<typeof kind, WaterSortSound> = {
    start: 'pourStart',
    land: 'pourLand',
    complete: 'pourComplete',
  };
  waterSortSound(map[kind]);
}

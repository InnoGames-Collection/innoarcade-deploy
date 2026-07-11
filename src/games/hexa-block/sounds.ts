// Hexa Block — premium synthesized SFX (scoped to this game only).

import { sfx } from '../../engine/audio';
import { settings } from '../../engine/settings';

class HexaBlockSounds {
  private ctx: AudioContext | null = null;

  private ensureCtx(): AudioContext | null {
    if (sfx.muted) return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private vol(v: number): number {
    return v * settings.data.master * settings.data.sfx;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    freqEnd = freq,
    attack = 0.006,
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(vol), 0.0001);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private chord(notes: [number, number, OscillatorType, number][], stagger = 0.03): void {
    notes.forEach(([f, d, type, v], i) => {
      setTimeout(() => this.tone(f, d, type, v, f * 1.03), i * stagger * 1000);
    });
  }

  pickup(): void {
    this.tone(540, 0.055, 'sine', 0.1, 820);
  }

  place(): void {
    this.chord([
      [460, 0.07, 'sine', 0.09],
      [690, 0.09, 'sine', 0.07],
    ]);
  }

  invalid(): void {
    this.tone(210, 0.15, 'triangle', 0.1, 150);
  }

  lineClear(lines: number): void {
    const base = lines > 1 ? 0.04 : 0.03;
    this.chord([
      [523, 0.1, 'sine', 0.1],
      [659, 0.1, 'sine', 0.09],
      [784, 0.14, 'sine', 0.08],
      [1047, 0.22, 'triangle', 0.07],
    ], base);
  }

  combo(level: number): void {
    const lift = Math.min(level, 5) * 40;
    this.chord([
      [660 + lift, 0.08, 'sine', 0.09],
      [880 + lift, 0.1, 'sine', 0.08],
      [1175 + lift, 0.16, 'triangle', 0.07],
    ]);
  }

  click(): void {
    this.tone(700, 0.035, 'sine', 0.08, 940);
  }

  menu(): void {
    this.tone(400, 0.06, 'sine', 0.07, 530);
  }

  gameOver(): void {
    this.tone(392, 0.2, 'sine', 0.1, 262);
    setTimeout(() => this.tone(330, 0.35, 'sine', 0.08, 196), 140);
  }

  victory(): void {
    this.chord([
      [523, 0.12, 'sine', 0.1],
      [659, 0.12, 'sine', 0.1],
      [784, 0.15, 'sine', 0.1],
      [1047, 0.35, 'triangle', 0.09],
    ], 0.05);
  }
}

export const hbSfx = new HexaBlockSounds();

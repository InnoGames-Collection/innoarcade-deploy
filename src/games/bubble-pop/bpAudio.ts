// Bubble Pop — premium synthesized arcade SFX (presentation only).

import { settings } from '../../engine/settings';

const MUTE_KEY = 'innoarcade.muted';

class BubblePopAudio {
  private ctx: AudioContext | null = null;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private vol(v: number): number {
    return v * settings.data.master * settings.data.sfx;
  }

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    freqEnd = freq, attack = 0.006,
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(vol), 0.0001);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 2400): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.7;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(vol), 0.0001);
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  click(): void {
    this.tone(720, 0.05, 'sine', 0.1, 960, 0.003);
  }

  launch(): void {
    this.tone(160, 0.16, 'sine', 0.18, 480, 0.004);
    this.tone(380, 0.1, 'triangle', 0.1, 720, 0.003);
    this.noise(0.05, 0.06, 3500);
  }

  wallBounce(): void {
    this.tone(520, 0.06, 'sine', 0.08, 680, 0.003);
  }

  impact(): void {
    this.tone(340, 0.08, 'triangle', 0.12, 220, 0.004);
    this.noise(0.04, 0.07, 2800);
  }

  pop(groupSize = 3): void {
    const base = 600 + groupSize * 30;
    this.tone(base, 0.12, 'sine', 0.16, base * 1.8, 0.004);
    this.tone(base * 1.5, 0.08, 'triangle', 0.1, base * 2.2, 0.003);
    this.noise(0.07, 0.09, 3200);
  }

  combo(level: number): void {
    const base = 520 + level * 90;
    this.tone(base, 0.14, 'sine', 0.2, base * 1.7, 0.005);
    this.tone(base * 1.3, 0.1, 'triangle', 0.12, base * 2, 0.004);
    if (level >= 4) this.noise(0.08, 0.1, 4000);
  }

  drop(): void {
    this.tone(280, 0.1, 'sine', 0.08, 180, 0.005);
  }

  swap(): void {
    this.tone(880, 0.06, 'sine', 0.07, 1100, 0.003);
  }

  gameOver(): void {
    this.tone(440, 0.2, 'sine', 0.14, 220, 0.01);
    this.tone(330, 0.3, 'triangle', 0.1, 165, 0.02);
    this.noise(0.15, 0.08, 1200);
  }

  coin(): void {
    this.tone(880, 0.09, 'sine', 0.12, 1480, 0.004);
    this.tone(1320, 0.07, 'triangle', 0.08, 1760, 0.003);
  }
}

export const bpSfx = new BubblePopAudio();

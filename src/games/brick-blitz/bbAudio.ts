// Brick Blitz — premium synthesized arcade SFX (presentation only).

import { settings } from '../../engine/settings';

const MUTE_KEY = 'innoarcade.muted';

class BrickBlitzAudio {
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
    freqEnd = freq, attack = 0.008,
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

  private noise(dur: number, vol: number, filterFreq = 2000): void {
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
    filter.Q.value = 0.8;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(vol), 0.0001);
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  paddleHit(): void {
    this.tone(320, 0.12, 'sine', 0.18, 520, 0.004);
    this.tone(640, 0.06, 'triangle', 0.06, 800, 0.002);
  }

  wallBounce(): void {
    this.tone(480, 0.05, 'sine', 0.07, 620);
  }

  brickBreak(combo = 1): void {
    this.tone(520 + combo * 40, 0.1, 'triangle', 0.16, 880 + combo * 30, 0.003);
    this.noise(0.06, 0.08, 3000 + combo * 200);
  }

  comboHit(level: number): void {
    const base = 660 + level * 80;
    this.tone(base, 0.14, 'sine', 0.2, base * 1.6, 0.005);
    this.tone(base * 1.5, 0.1, 'triangle', 0.1, base * 2, 0.003);
  }

  powerUp(): void {
    this.tone(440, 0.08, 'sine', 0.14, 880, 0.005);
    this.tone(660, 0.12, 'triangle', 0.12, 1320, 0.008);
    this.tone(880, 0.16, 'sine', 0.1, 1760, 0.01);
  }

  launch(): void {
    this.tone(200, 0.15, 'sine', 0.16, 480, 0.006);
  }

  levelClear(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14, f * 1.02, 0.005), i * 90);
    });
  }

  gameOver(): void {
    this.tone(392, 0.3, 'sine', 0.2, 196, 0.01);
    setTimeout(() => this.tone(294, 0.4, 'triangle', 0.16, 147, 0.01), 200);
    this.noise(0.25, 0.12, 800);
  }

  lifeLost(): void {
    this.tone(220, 0.2, 'sawtooth', 0.12, 110, 0.008);
  }

  pause(): void {
    this.tone(400, 0.06, 'sine', 0.08, 300);
  }

  click(): void {
    this.tone(720, 0.04, 'triangle', 0.07, 960);
  }
}

export const bbSfx = new BrickBlitzAudio();

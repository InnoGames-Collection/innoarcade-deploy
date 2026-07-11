// Ball Shooter — premium synthesized arcade SFX (presentation only).

import { settings } from '../../engine/settings';

const MUTE_KEY = 'innoarcade.muted';

class OrbitBlastAudio {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer = 0;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.muted) this.stopMusic();
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

  launch(): void {
    this.tone(180, 0.14, 'sine', 0.16, 520, 0.005);
    this.tone(440, 0.08, 'triangle', 0.08, 880, 0.003);
    this.noise(0.04, 0.05, 4000);
  }

  blockHit(): void {
    this.tone(640, 0.07, 'triangle', 0.1, 920, 0.003);
  }

  blockDestroy(): void {
    this.tone(480, 0.12, 'triangle', 0.18, 1100, 0.004);
    this.noise(0.08, 0.1, 3200);
    this.tone(720, 0.06, 'sine', 0.08, 1440, 0.002);
  }

  comboHit(level: number): void {
    const base = 580 + level * 70;
    this.tone(base, 0.14, 'sine', 0.18, base * 1.5, 0.005);
    this.tone(base * 1.25, 0.1, 'triangle', 0.1, base * 1.8, 0.003);
  }

  perfectShot(): void {
    [880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.1, 'sine', 0.12, f * 1.05, 0.004), i * 55);
    });
  }

  pickup(): void {
    this.tone(660, 0.1, 'sine', 0.14, 1320, 0.005);
    this.tone(990, 0.12, 'triangle', 0.1, 1580, 0.006);
  }

  gameOver(): void {
    this.tone(392, 0.32, 'sine', 0.18, 196, 0.01);
    setTimeout(() => this.tone(294, 0.38, 'triangle', 0.14, 147, 0.01), 180);
    this.noise(0.22, 0.1, 700);
  }

  pause(): void {
    this.tone(400, 0.06, 'sine', 0.08, 300);
  }

  click(): void {
    this.tone(720, 0.04, 'triangle', 0.07, 960);
  }

  startMusic(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.stopMusic();
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = settings.data.master * settings.data.music * 0.18;
    this.musicGain.connect(ctx.destination);
    const pattern = [0, 392, 0, 494, 0, 587, 494, 0, 330, 0, 392, 0];
    const bpm = 92;
    const beat = 60 / bpm;
    let i = 0;
    const step = (): void => {
      if (!this.musicGain) return;
      const freq = pattern[i % pattern.length];
      i++;
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t0 = ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(1, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 0.85);
        osc.connect(g).connect(this.musicGain);
        osc.start(t0);
        osc.stop(t0 + beat);
      }
      this.musicTimer = window.setTimeout(step, beat * 1000);
    };
    step();
  }

  stopMusic(): void {
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = 0; }
    if (this.musicGain) { this.musicGain.disconnect(); this.musicGain = null; }
  }
}

export const obSfx = new OrbitBlastAudio();

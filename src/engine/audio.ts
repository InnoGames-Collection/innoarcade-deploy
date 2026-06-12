// Synthesized sound effects via Web Audio — no asset files needed.
// The AudioContext is created lazily on the first play call (after a user
// gesture) to satisfy autoplay policies. SFX volume is scaled by the global
// master × sfx settings sliders; music plays through a separate gain bus.

import { settings } from './settings';

const MUTE_KEY = 'innoarcade.muted';

class Sfx {
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

  private sfxVol(vol: number): number {
    return vol * settings.data.master * settings.data.sfx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, freqEnd = freq): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    const peak = Math.max(this.sfxVol(vol), 0.0001);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  coin(): void {
    this.tone(880, 0.09, 'square', 0.12, 1480);
  }

  jump(): void {
    this.tone(280, 0.18, 'sine', 0.2, 620);
  }

  slide(): void {
    this.tone(420, 0.16, 'sine', 0.15, 160);
  }

  click(): void {
    this.tone(600, 0.05, 'square', 0.08);
  }

  crash(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const dur = 0.35;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = this.sfxVol(0.5);
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  // A lightweight generative music bed: loops a note pattern on a soft
  // triangle voice through a dedicated music gain bus. Call stopMusic() to end.
  startMusic(pattern: number[], bpm = 100): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this.stopMusic();
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = settings.data.master * settings.data.music * 0.25;
    this.musicGain.connect(ctx.destination);
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
        g.gain.linearRampToValueAtTime(1, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 0.9);
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

  // Re-apply the music volume after a settings change.
  syncMusicVolume(): void {
    if (this.musicGain) {
      this.musicGain.gain.value = settings.data.master * settings.data.music * 0.25;
    }
  }
}

export const sfx = new Sfx();

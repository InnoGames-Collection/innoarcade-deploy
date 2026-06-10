// Synthesized sound effects via Web Audio — no asset files needed.
// The AudioContext is created lazily on the first play call (after a user
// gesture) to satisfy autoplay policies.

const MUTE_KEY = 'innoarcade.muted';

class Sfx {
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

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, freqEnd = freq): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
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
    gain.gain.value = 0.25;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
}

export const sfx = new Sfx();

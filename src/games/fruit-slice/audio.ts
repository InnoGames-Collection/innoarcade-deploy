// Premium Fruit Slice SFX — synthesized arcade-quality sounds (presentation only).

import { settings } from '../../engine/settings';

const MUTE_KEY = 'innoarcade.muted';

class FruitSliceAudio {
  private ctx: AudioContext | null = null;
  muted = localStorage.getItem(MUTE_KEY) === '1';

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private vol(v: number): number {
    return v * settings.data.master * settings.data.sfx;
  }

  /** Sharp blade slice through fruit. */
  slice(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.35), 0.0001);

    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    noise.buffer = buf;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 3200;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(peak * 0.7, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    noise.connect(nf).connect(ng).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.06);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t0);
    osc.frequency.exponentialRampToValueAtTime(400, t0 + 0.04);
    og.gain.setValueAtTime(peak * 0.25, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    osc.connect(og).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.05);
  }

  /** Wet juice splash on impact. */
  splash(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.22), 0.0001);

    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.5;
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t0);
    lp.frequency.exponentialRampToValueAtTime(600, t0 + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    noise.connect(lp).connect(g).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.12);
  }

  /** Combo milestone reward chime. */
  comboReward(tier: number): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const freqs = [523, 659, 784, 1047, 1319];
    const f = freqs[Math.min(tier, freqs.length - 1)];
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.18 + tier * 0.03), 0.0001);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.18);

    if (tier >= 2) {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = f * 1.5;
      g2.gain.setValueAtTime(peak * 0.4, t0 + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      o2.connect(g2).connect(ctx.destination);
      o2.start(t0 + 0.04);
      o2.stop(t0 + 0.22);
    }
  }

  /** Perfect / high combo slice accent. */
  perfectSlice(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.28), 0.0001);

    [880, 1108, 1318].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = t0 + i * 0.03;
      g.gain.setValueAtTime(peak * (1 - i * 0.2), start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  /** Bomb impact — deep thud + crackle. */
  bombHit(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.45), 0.0001);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.25);
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);

    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(peak * 0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    noise.connect(ng).connect(ctx.destination);
    noise.start(t0);
    noise.stop(t0 + 0.2);
  }

  /** Game over sting. */
  gameOver(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const peak = Math.max(this.vol(0.3), 0.0001);

    [440, 349, 262].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const start = t0 + i * 0.12;
      g.gain.setValueAtTime(peak, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  syncMute(muted: boolean): void {
    this.muted = muted;
  }
}

export const fruitSfx = new FruitSliceAudio();

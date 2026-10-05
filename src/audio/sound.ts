// Synthetische Klänge über WebAudio: Motor, Reifenquietschen, Effekte. Keine Audiodateien nötig.

class SoundSystem {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  volume = 0.7;
  private engine: { o1: OscillatorNode; o2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private squeal: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastEng = -1;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC() as AudioContext;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, when = 0, slideTo?: number) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq = 1200, q = 0.8, when = 0) {
    if (!this.ensure() || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  click() {
    this.tone(1400, 0.05, 'triangle', 0.08);
  }
  confirm() {
    this.tone(660, 0.08, 'triangle', 0.12);
    this.tone(990, 0.12, 'triangle', 0.12, 0.07);
  }
  error() {
    this.tone(220, 0.18, 'square', 0.08);
  }
  countdown() {
    this.tone(440, 0.22, 'square', 0.12);
  }
  go() {
    this.tone(880, 0.5, 'square', 0.14);
  }
  collision(power = 10) {
    this.noise(0.25, Math.min(0.6, 0.12 + power * 0.02), 500, 0.6);
    this.tone(90, 0.2, 'sawtooth', Math.min(0.3, power * 0.015), 0, 50);
  }
  pitStop() {
    for (let i = 0; i < 4; i++) this.noise(0.12, 0.25, 2600, 4, i * 0.18);
  }
  flag() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, i * 0.12));
  }
  coin() {
    this.tone(1320, 0.07, 'triangle', 0.07);
    this.tone(1760, 0.1, 'triangle', 0.07, 0.06);
  }
  build() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.13, i * 0.07));
    this.noise(0.18, 0.18, 900, 1.2, 0);
  }
  achievement() {
    [784, 988, 1175].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, i * 0.09));
  }

  startEngine() {
    if (!this.ensure() || !this.ctx || !this.master || this.engine) return;
    const ctx = this.ctx;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain).connect(this.master);
    o1.start();
    o2.start();
    this.engine = { o1, o2, filter, gain };
    if (this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 6;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.squeal = { src, filter: f, gain: g };
    }
  }

  updateEngine(rpm01: number, throttle: number, slide: number, on: boolean) {
    if (!this.engine || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Parameter nur ca. 20-mal pro Sekunde setzen: jeder Aufruf legt Ereignisse im Audio-Thread an
    if (t - this.lastEng < 0.045 && on) return;
    this.lastEng = t;
    const f = 55 + rpm01 * 210;
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.03);
    this.engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.engine.filter.frequency.setTargetAtTime(500 + throttle * 1600 + rpm01 * 800, t, 0.05);
    this.engine.gain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.06 : 0, t, 0.08);
    if (this.squeal) this.squeal.gain.gain.setTargetAtTime(on ? Math.min(0.12, slide * 0.18) : 0, t, 0.05);
  }

  stopEngine() {
    if (this.engine) {
      try {
        this.engine.o1.stop();
        this.engine.o2.stop();
      } catch {}
      this.engine = null;
    }
    if (this.squeal) {
      try {
        this.squeal.src.stop();
      } catch {}
      this.squeal = null;
    }
  }
}

export const sound = new SoundSystem();

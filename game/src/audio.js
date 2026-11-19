// Synthesized sound: every effect is an oscillator or a noise burst made in code,
// so the game ships no audio files and makes no network request.
// Audio starts lazily on the first user gesture; every call is safe before that.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    ensure() {
      if (this.ctx || typeof window === 'undefined') return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null;
      }
    },
    resume() {
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },
    tone(freq, duration, type, volume, slideTo) {
      if (!this.ctx || this.muted) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume || 0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (err) { /* sound is decoration; never break the game */ }
    },
    noise(duration, volume, lowpass) {
      if (!this.ctx || this.muted) return;
      try {
        const len = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass || 1200;
        const gain = this.ctx.createGain();
        gain.gain.value = volume || 0.25;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start();
      } catch (err) { /* sound is decoration */ }
    },
    shot() { this.noise(0.12, 0.3, 2500); this.tone(180, 0.08, 'square', 0.12, 60); },
    punch() { this.noise(0.08, 0.2, 900); },
    /** A two-tone car horn for the player's car (H). */
    horn() { this.tone(370, 0.16, 'square', 0.12); this.tone(466, 0.16, 'square', 0.1); },
    /** Tyre scrub for a handbrake slide. */
    skid() { this.noise(0.18, 0.16, 500); },
    pickup() { this.tone(660, 0.09, 'sine', 0.18); this.tone(990, 0.12, 'sine', 0.15); },
    cash() { this.tone(880, 0.1, 'sine', 0.16); this.tone(1174, 0.14, 'sine', 0.16); this.tone(1568, 0.18, 'sine', 0.14); },
    siren() { this.tone(700, 0.4, 'sine', 0.07, 950); },
    crash() { this.noise(0.25, 0.35, 700); },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.16, 'triangle', 0.18), i * 110));
    },
    fail() { this.tone(220, 0.35, 'sawtooth', 0.14, 110); },
    /** Engine hum that follows the player's speed; call every frame. */
    engine(speedRatio, on) {
      if (!this.ctx || this.muted) return;
      try {
        if (!on) {
          if (this.engineOsc) { this.engineGain.gain.value = 0; }
          return;
        }
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineOsc.type = 'sawtooth';
          this.engineGain = this.ctx.createGain();
          this.engineGain.gain.value = 0;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          this.engineOsc.connect(filter);
          filter.connect(this.engineGain);
          this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        this.engineOsc.frequency.setValueAtTime(50 + speedRatio * 130, this.ctx.currentTime);
        this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, this.ctx.currentTime, 0.1);
      } catch (err) { /* sound is decoration */ }
    },
  };
  return audio;
}

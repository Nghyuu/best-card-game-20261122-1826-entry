// Crown of Embers — procedural sound. Every effect is synthesized with
// WebAudio at play time; the game ships no audio files and makes no
// network request. Audio starts only after the player's first gesture.

let ctx = null;
let muted = false;

export function ensureAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.08, when = 0, low = 400) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = low;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.08); },
  select() { tone(520, 0.08, 'triangle', 0.09); tone(780, 0.08, 'triangle', 0.06, 0.05); },
  playCard() { noise(0.12, 0.1, 0, 900); tone(330, 0.14, 'triangle', 0.1, 0, 520); },
  hit() { noise(0.18, 0.16, 0, 500); tone(140, 0.2, 'sawtooth', 0.12, 0, 70); },
  heal() { tone(523, 0.16, 'sine', 0.09); tone(659, 0.16, 'sine', 0.09, 0.1); tone(784, 0.24, 'sine', 0.09, 0.2); },
  turn() { tone(392, 0.1, 'triangle', 0.08); tone(494, 0.12, 'triangle', 0.08, 0.08); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.11, i * 0.13));
    tone(1319, 0.5, 'sine', 0.08, 0.55);
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'sine', 0.1, i * 0.16));
  },
};

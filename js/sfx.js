// Sound effects from assets/sfx/<name>.mp3, with tiny synthesized tones when a file is missing.
import { ASSET } from './assets.js';

const TONES = {
  error: [[392, 0.09], [262, 0.16]],
  ding: [[784, 0.09], [1175, 0.22]],
  notify: [[659, 0.08], [988, 0.14]],
  startup: [[523, 0.18], [784, 0.18], [659, 0.18], [1047, 0.45]],
  shutdown: [[1047, 0.18], [784, 0.18], [659, 0.18], [523, 0.45]],
  correct: [[880, 0.05]],
};

const missing = new Set();
let ctx = null;

/** Call from a user gesture so browsers allow audio. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function tone(name, volume = 0.12) {
  const seq = TONES[name];
  if (!ctx || !seq) return;
  let t = ctx.currentTime;
  for (const [freq, dur] of seq) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

export function play(name, volume = 0.7) {
  if (missing.has(name)) return tone(name);
  const audio = new Audio(ASSET.sfx(name));
  audio.volume = volume;
  audio.addEventListener('error', () => { missing.add(name); tone(name); }, { once: true });
  audio.play().catch(() => { /* autoplay blocked or file missing (handled by the error event) */ });
}

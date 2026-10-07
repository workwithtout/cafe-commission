// Short UI sound effects synthesized with WebAudio (no audio files needed).
// The AudioContext is only created after a user gesture.

let ctx = null;
const state = { enabled: true, pitch: 1 };

export function configureSfx({ enabled, pitch }) {
  if (enabled !== undefined) state.enabled = enabled;
  if (pitch !== undefined) state.pitch = pitch || 1;
}

export function sfxPreference() {
  try {
    return localStorage.getItem('cafe_sfx') !== 'off';
  } catch {
    return true;
  }
}
export function setSfxPreference(on) {
  try {
    localStorage.setItem('cafe_sfx', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function tone(freq, start, dur, type = 'sine', gain = 0.05) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq * state.pitch;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

const SOUNDS = {
  tap:   () => tone(880, 0, 0.09, 'sine'),
  nav:   () => { tone(660, 0, 0.07, 'triangle'); tone(990, 0.06, 0.09, 'triangle'); },
  open:  () => { tone(523, 0, 0.08); tone(784, 0.07, 0.08); tone(1046, 0.14, 0.12); },
  close: () => { tone(784, 0, 0.07); tone(523, 0.07, 0.1); },
  copy:  () => { tone(1046, 0, 0.06, 'square', 0.025); tone(1318, 0.07, 0.1, 'square', 0.025); },
  gallery: () => { tone(740, 0, 0.06); tone(932, 0.06, 0.06); tone(1108, 0.12, 0.1); },
  success: () => { tone(659, 0, 0.08); tone(880, 0.08, 0.08); tone(1318, 0.16, 0.16); },
  error: () => { tone(330, 0, 0.12, 'sawtooth', 0.025); tone(247, 0.1, 0.16, 'sawtooth', 0.025); },
};

export function play(name = 'tap') {
  if (!state.enabled || !sfxPreference()) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    (SOUNDS[name] || SOUNDS.tap)();
  } catch {
    /* sound must never break the UI */
  }
}

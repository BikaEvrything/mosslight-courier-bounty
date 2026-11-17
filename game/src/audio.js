// Mosslight Courier — synthesized WebAudio cues.
//
// Every sound is generated at runtime with oscillators and a noise buffer:
// no audio files, no network. Audio is created lazily on the first user
// gesture, and the mute toggle simply silences the master gain.

let ac = null;
let master = null;
let muted = false;

/** Creates the audio context on the first user gesture. Returns success. */
export function ensureAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.4;
    master.connect(ac.destination);
    startDrone();
  }
  if (ac.state === 'suspended') ac.resume();
  return true;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.4;
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

function tone({ freq = 440, end = null, dur = 0.2, type = 'sine', gain = 0.14, delay = 0 }) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (end !== null) o.frequency.exponentialRampToValueAtTime(Math.max(30, end), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.2, gain = 0.08, freq = 800, delay = 0 }) {
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = freq;
  filt.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
}

/** A quiet grove drone under everything, started once with the context. */
function startDrone() {
  const g = ac.createGain();
  g.gain.value = 0.035;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 240;
  const o1 = ac.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ac.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = 82.6;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.08;
  const lg = ac.createGain();
  lg.gain.value = 0.016;
  lfo.connect(lg);
  lg.connect(g.gain);
  o1.connect(filt);
  o2.connect(filt);
  filt.connect(g);
  g.connect(master);
  o1.start();
  o2.start();
  lfo.start();
}

const SFX = {
  ui: () => tone({ freq: 520, dur: 0.08, type: 'triangle', gain: 0.08 }),
  start: () => {
    tone({ freq: 392, dur: 0.12, type: 'triangle', gain: 0.12 });
    tone({ freq: 523, dur: 0.16, type: 'triangle', gain: 0.12, delay: 0.1 });
  },
  pause: () => tone({ freq: 300, end: 240, dur: 0.15, type: 'triangle', gain: 0.08 }),
  resume: () => tone({ freq: 300, end: 420, dur: 0.15, type: 'triangle', gain: 0.08 }),
  collect: (combo = 1) => {
    const f = 620 * Math.pow(1.0595, Math.min((combo || 1) - 1, 12));
    tone({ freq: f, end: f * 1.25, dur: 0.16, gain: 0.14 });
    tone({ freq: f * 2, dur: 0.08, gain: 0.05, delay: 0.02 });
  },
  near: () => tone({ freq: 980, dur: 0.06, type: 'triangle', gain: 0.06 }),
  dash: () => {
    tone({ freq: 520, end: 140, dur: 0.22, type: 'sawtooth', gain: 0.07 });
    noise({ dur: 0.18, gain: 0.05, freq: 1200 });
  },
  hit: () => {
    tone({ freq: 160, end: 60, dur: 0.32, type: 'square', gain: 0.12 });
    noise({ dur: 0.25, gain: 0.09, freq: 300 });
  },
  heal: () => {
    tone({ freq: 523, dur: 0.12, gain: 0.1 });
    tone({ freq: 784, dur: 0.18, gain: 0.1, delay: 0.1 });
  },
  bloomFull: () => {
    tone({ freq: 523, dur: 0.14, gain: 0.09 });
    tone({ freq: 659, dur: 0.14, gain: 0.09, delay: 0.08 });
    tone({ freq: 784, dur: 0.14, gain: 0.09, delay: 0.16 });
  },
  bloom: () => tone({ freq: 880, dur: 0.1, gain: 0.05 }),
  win: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, dur: 0.28, type: 'triangle', gain: 0.12, delay: i * 0.12 }));
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, end: f * 0.94, dur: 0.3, gain: 0.1, delay: i * 0.16 }));
  },
  stage: () => tone({ freq: 220, end: 260, dur: 0.2, type: 'triangle', gain: 0.06 }),
  comboEnd: () => tone({ freq: 360, end: 300, dur: 0.1, gain: 0.04 }),
  // The ember flare: a bright crack, then a rising wash.
  flare: () => {
    tone({ freq: 900, end: 120, dur: 0.45, type: 'sawtooth', gain: 0.08 });
    noise({ dur: 0.4, gain: 0.1, freq: 700 });
    tone({ freq: 220, end: 660, dur: 0.4, type: 'triangle', gain: 0.08, delay: 0.06 });
  },
  emberFull: () => {
    tone({ freq: 660, dur: 0.1, gain: 0.06 });
    tone({ freq: 990, dur: 0.14, gain: 0.06, delay: 0.07 });
  },
  unlock: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.1, delay: i * 0.09 }));
  },
  mapMove: () => tone({ freq: 440, dur: 0.05, type: 'triangle', gain: 0.05 }),
  locked: () => tone({ freq: 140, dur: 0.12, type: 'square', gain: 0.06 }),
  route: () => tone({ freq: 340, end: 260, dur: 0.12, type: 'triangle', gain: 0.07 }),
  // Regional mechanics: one small, distinct cue pair per grove — a warning
  // rising note, then a short textural burst. All flow through the same mute
  // gate as every other cue (sfx() returns early while muted).
  gustWarn: () => tone({ freq: 190, end: 300, dur: 0.5, type: 'triangle', gain: 0.06 }),
  gust: () => noise({ dur: 1.1, gain: 0.05, freq: 520 }),
  gustEnd: () => tone({ freq: 300, end: 190, dur: 0.2, gain: 0.04 }),
  tideWarn: () => tone({ freq: 120, end: 210, dur: 0.6, type: 'sine', gain: 0.07 }),
  tide: () => {
    noise({ dur: 0.9, gain: 0.06, freq: 280 });
    tone({ freq: 96, end: 72, dur: 0.8, gain: 0.05 });
  },
  tideEnd: () => tone({ freq: 210, end: 140, dur: 0.25, gain: 0.04 }),
  snareWarn: () => tone({ freq: 720, end: 470, dur: 0.55, type: 'triangle', gain: 0.05 }),
  snare: () => {
    tone({ freq: 150, end: 60, dur: 0.3, type: 'square', gain: 0.09 });
    noise({ dur: 0.25, gain: 0.07, freq: 900 });
  },
};

/** Plays one named cue; silent until the audio context exists. */
export function sfx(name, arg) {
  if (!ac || muted) return;
  const fn = SFX[name];
  if (fn) fn(arg);
}

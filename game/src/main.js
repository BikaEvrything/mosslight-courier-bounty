// Mosslight Courier — browser bootstrap and game loop.
//
// Owns the canvas, the fixed-timestep loop, screen transitions, audio and
// particle wiring, and the truthful screenshot fixture modes (?shot=start,
// play, win, lose) which render the game's own renderer at arranged states.
// Fixtures are review aids only — they are not proof of human gameplay.

import * as C from './config.js';
import { PHASE, createWorld, startRun, stepWorld, togglePause } from './world.js';
import { createInput, inputAxis, inputDash, takePressed, resetInput } from './input.js';
import { createEffects, updateEffects, eventBurst, pushTrail } from './effects.js';
import { setupTransform, render, getButtons } from './renderer.js';
import { ensureAudio, sfx, setMuted } from './audio.js';

const STEP = 1 / 60;
const BEST_KEY = 'mosslight-courier-best';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const shotMode = new URLSearchParams(window.location.search).get('shot');

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {}
}

let world = createWorld(1337);
const effects = createEffects();
const input = createInput();
const view = {
  t: 0,
  touch: window.matchMedia('(pointer: coarse)').matches,
  muted: false,
  best: loadBest(),
  reducedMotion,
  effects,
};

// ------------------------------------------------------------- canvas fit

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------- flow

function newSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

function beginRun(seed) {
  world = createWorld(seed);
  startRun(world);
  dispatch(world.events);
}

function confirmAction() {
  if (world.phase === PHASE.MENU || world.phase === PHASE.WON || world.phase === PHASE.LOST) {
    beginRun(newSeed());
  } else if (world.phase === PHASE.PAUSED) {
    togglePause(world);
  }
}

function onRunEnd() {
  if (world.score > view.best) {
    view.best = world.score;
    saveBest(world.score);
  }
}

/** Sends simulation events to sound and particles. */
function dispatch(events) {
  for (const ev of events) {
    if (ev.type === 'collect') sfx('collect', ev.combo);
    else sfx(ev.type);
    eventBurst(effects, ev, reducedMotion);
    if ((ev.type === 'win' || ev.type === 'lose') && world.score > 0) onRunEnd();
  }
}

// ------------------------------------------------------------- raw input

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * C.LOGICAL_W,
    y: ((e.clientY - r.top) / r.height) * C.LOGICAL_H,
  };
}

function hitButton(x, y) {
  for (const b of getButtons(world.phase, view)) {
    if (b.shape === 'circle') {
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 8) return b.id;
    } else if (x >= b.x - 8 && x <= b.x + b.w + 8 && y >= b.y - 8 && y <= b.y + b.h + 8) {
      return b.id;
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  view.touch = view.touch || e.pointerType === 'touch';
  const pt = toLogical(e);
  const id = hitButton(pt.x, pt.y);
  if (id === 'start' || id === 'restart' || id === 'resume') {
    sfx('ui');
    if (id === 'start' || id === 'restart') beginRun(newSeed());
    else togglePause(world);
    return;
  }
  if (id === 'pause') {
    sfx('pause');
    togglePause(world);
    return;
  }
  if (id === 'mute') {
    view.muted = !view.muted;
    ensureAudio();
    setMuted(view.muted);
    return;
  }
  if (id === 'dash' && world.phase === PHASE.RUNNING) {
    input.button.dash = true;
    return;
  }
  // Otherwise begin drag steering from this point.
  input.pointer.dragging = true;
  input.pointer.startX = pt.x;
  input.pointer.startY = pt.y;
  input.pointer.x = pt.x;
  input.pointer.y = pt.y;
});

canvas.addEventListener('pointermove', (e) => {
  if (!input.pointer.dragging) return;
  const pt = toLogical(e);
  input.pointer.x = pt.x;
  input.pointer.y = pt.y;
});

const endPointer = () => {
  input.pointer.dragging = false;
  input.button.dash = false;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('blur', () => {
  resetInput(input);
  if (world.phase === PHASE.RUNNING) togglePause(world);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resetInput(input);
    if (world.phase === PHASE.RUNNING) togglePause(world);
  }
});

// ------------------------------------------------------------- main loop

function handleEdges() {
  if (takePressed(input, 'confirm')) {
    ensureAudio();
    sfx('ui');
    confirmAction();
  }
  if (takePressed(input, 'pause')) {
    ensureAudio();
    if (world.phase === PHASE.RUNNING || world.phase === PHASE.PAUSED) {
      sfx(world.phase === PHASE.RUNNING ? 'pause' : 'resume');
      togglePause(world);
    }
  }
  if (takePressed(input, 'mute')) {
    view.muted = ensureAudio() ? !view.muted : view.muted;
    setMuted(view.muted);
  }
  if (takePressed(input, 'restart')) {
    if (world.phase === PHASE.WON || world.phase === PHASE.LOST) beginRun(newSeed());
  }
}

let acc = 0;
let last = performance.now();

function frame(now) {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  view.t += dt;
  handleEdges();

  if (world.phase === PHASE.RUNNING) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      acc -= STEP;
      steps++;
      const axis = inputAxis(input);
      const events = stepWorld(world, { axisX: axis.x, axisY: axis.y, dash: inputDash(input) }, STEP);
      dispatch(events);
      if (!reducedMotion && steps % 2 === 0) pushTrail(effects, world.player.x, world.player.y);
      if (world.phase !== PHASE.RUNNING) {
        acc = 0;
        break;
      }
    }
  } else {
    acc = 0;
  }

  updateEffects(effects, dt);
  setupTransform(ctx, canvas);
  render(ctx, world, view);
}

// ------------------------------------------------------------- fixtures
// ?shot=start | play | win | lose — truthful renders of the real renderer at
// arranged game states. They are review fixtures, never proof of play.

function nearestSeed(w) {
  let best = null;
  let bd = Infinity;
  for (const s of w.seeds) {
    if (s.taken) continue;
    const d = Math.hypot(s.x - w.player.x, s.y - w.player.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Parks a bramble at a spot regardless of its movement kind (fixture/test aid). */
function pinBramble(b, x, y) {
  if (b.kind === 'drifter') b.speed = 0;
  else if (b.kind === 'lunger') {
    b.state = 'idle';
    b.timer = 99;
  } else {
    b.orbit = 0;
    b.cx = x;
    b.cy = y;
  }
  b.x = x;
  b.y = y;
  return b;
}

function setupShot(mode) {
  world = createWorld(1337);
  if (mode === 'play') {
    startRun(world);
    dispatch(world.events);
    for (let i = 0; i < 210; i++) {
      const target = nearestSeed(world);
      const ax = target ? Math.max(-1, Math.min(1, (target.x - world.player.x) / 120)) : 0;
      const ay = target ? Math.max(-1, Math.min(1, (target.y - world.player.y) / 120)) : 0;
      const events = stepWorld(world, { axisX: ax, axisY: ay, dash: i === 70 }, STEP);
      dispatch(events);
      if (!reducedMotion) pushTrail(effects, world.player.x, world.player.y);
      // Fixture guard: keep the mid-run shot playable rather than near-death.
      if (world.hearts < 2) world.hearts = 2;
      if (world.phase !== PHASE.RUNNING) break;
    }
  } else if (mode === 'win') {
    startRun(world);
    dispatch(world.events);
    let guard = 0;
    while (world.collected < C.TOTAL_SEEDS && guard++ < 200) {
      const s = world.seeds.find((seed) => !seed.taken);
      world.player.x = s.x;
      world.player.y = s.y;
      world.player.invuln = 999;
      dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false }, STEP));
    }
  } else if (mode === 'lose') {
    startRun(world);
    dispatch(world.events);
    world.hearts = 1;
    const b = pinBramble(world.brambles[0], world.brambles[0].x, world.brambles[0].y);
    world.player.x = b.x;
    world.player.y = b.y;
    world.player.invuln = 0;
    dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false }, STEP));
  }
  // One completed render, then flag readiness for the capture tool.
  setupTransform(ctx, canvas);
  render(ctx, world, view);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

if (shotMode) {
  setupShot(shotMode);
} else {
  window.requestAnimationFrame(frame);
}

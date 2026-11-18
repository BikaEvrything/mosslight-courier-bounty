// Mosslight Courier — browser bootstrap and game loop.
//
// Owns the canvas, the fixed-timestep loop, the campaign flow (route map →
// region run → result → route), the persistent campaign save, audio and
// particle wiring, and the truthful screenshot fixture modes (?shot=map, play,
// win, lose) which render the game's own renderer at arranged states.
// Fixtures are review aids only — they are not proof of human gameplay.

import * as C from './config.js';
import { PHASE, createWorld, startRun, stepWorld, togglePause, runSummary } from './world.js';
import { REGION_COUNT, clampRegionIndex } from './regions.js';
import {
  createCampaign,
  recordResult,
  serialize,
  deserialize,
  isUnlocked,
  firstIncomplete,
} from './campaign.js';
import { createInput, inputAxis, inputDash, takePressed, resetInput } from './input.js';
import { createEffects, updateEffects, eventBurst, pushTrail } from './effects.js';
import { setupTransform, renderWorld, renderUI, getButtons } from './renderer.js';
import { ensureAudio, sfx, setMuted } from './audio.js';

const STEP = 1 / 60;
const CAMP_KEY = 'mosslight-courier-campaign-v2';
/** World pass downscale: the scenery is drawn chunky, then blitted back. */
const PIXEL_SCALE = 3;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const shotMode = new URLSearchParams(window.location.search).get('shot');

// Low-resolution world buffer for the pixel-inspired pass.
const pix = document.createElement('canvas');
pix.width = Math.ceil(C.LOGICAL_W / PIXEL_SCALE);
pix.height = Math.ceil(C.LOGICAL_H / PIXEL_SCALE);
const pixCtx = pix.getContext('2d');

// ------------------------------------------------------------ campaign save

function loadCampaign() {
  try {
    return deserialize(window.localStorage.getItem(CAMP_KEY)) ?? createCampaign();
  } catch {
    return createCampaign();
  }
}

function saveCampaign() {
  try {
    window.localStorage.setItem(CAMP_KEY, serialize(view.camp));
  } catch {}
}

let world = createWorld(1337, 0);
const effects = createEffects();
const input = createInput();
const camp = loadCampaign();
const view = {
  t: 0,
  touch: window.matchMedia('(pointer: coarse)').matches,
  muted: false,
  reducedMotion,
  effects,
  camp,
  mapSel: firstIncomplete(camp),
  nextAvailable: false,
  lastResult: null,
};
world.phase = PHASE.MAP;

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

function beginRun(regionIdx) {
  const idx = clampRegionIndex(regionIdx);
  view.mapSel = idx;
  view.nextAvailable = false;
  view.lastResult = null;
  world = createWorld(newSeed(), idx);
  startRun(world);
  dispatch(world.events);
}

/** Leaves whatever is on screen for the route map. */
function gotoMap() {
  world = createWorld(newSeed(), view.mapSel);
  world.phase = PHASE.MAP;
  sfx('route');
}

function onRunEnd() {
  const sum = runSummary(world);
  const res = recordResult(view.camp, world.regionIdx, sum);
  view.lastResult = res;
  view.nextAvailable = sum.won && world.regionIdx < REGION_COUNT - 1;
  saveCampaign();
  if (res.openedNext) sfx('unlock');
}

/** Sends simulation events to sound and particles. */
function dispatch(events) {
  for (const ev of events) {
    if (ev.type === 'collect') sfx('collect', ev.combo);
    else sfx(ev.type);
    eventBurst(effects, ev, reducedMotion);
    if (ev.type === 'win' || ev.type === 'lose') onRunEnd();
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

function tapRegion(idx) {
  if (isUnlocked(view.camp, idx)) {
    if (idx === view.mapSel) {
      sfx('ui');
      beginRun(idx);
    } else {
      view.mapSel = idx;
      sfx('mapMove');
    }
  } else {
    sfx('locked');
  }
}

canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  view.touch = view.touch || e.pointerType === 'touch';
  const pt = toLogical(e);
  const id = hitButton(pt.x, pt.y);
  if (id && id.startsWith('region')) {
    tapRegion(Number(id.slice(6)));
    return;
  }
  if (id === 'primary') {
    sfx('ui');
    if (world.phase === PHASE.WON && view.nextAvailable) beginRun(world.regionIdx + 1);
    else if (world.phase === PHASE.WON) gotoMap();
    else beginRun(world.regionIdx);
    return;
  }
  if (id === 'route') {
    sfx('ui');
    gotoMap();
    return;
  }
  if (id === 'resume') {
    sfx('ui');
    togglePause(world);
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
  if (id === 'flare' && world.phase === PHASE.RUNNING) {
    input.button.flare = true; // consumed as a one-shot edge by the loop
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

function stepMapSelection(dir) {
  const open = [];
  for (let i = 0; i < REGION_COUNT; i++) if (isUnlocked(view.camp, i)) open.push(i);
  if (open.length < 2) return;
  const at = Math.max(0, open.indexOf(view.mapSel));
  view.mapSel = open[(at + dir + open.length) % open.length];
  sfx('mapMove');
}

function handleEdges() {
  if (takePressed(input, 'confirm')) {
    ensureAudio();
    sfx('ui');
    if (world.phase === PHASE.MAP || world.phase === PHASE.MENU) beginRun(view.mapSel);
    else if (world.phase === PHASE.WON) {
      if (view.nextAvailable) beginRun(world.regionIdx + 1);
      else gotoMap();
    } else if (world.phase === PHASE.LOST) beginRun(world.regionIdx);
    else if (world.phase === PHASE.PAUSED) togglePause(world);
  }
  if (takePressed(input, 'pause')) {
    ensureAudio();
    if (world.phase === PHASE.RUNNING || world.phase === PHASE.PAUSED) {
      sfx(world.phase === PHASE.RUNNING ? 'pause' : 'resume');
      togglePause(world);
    } else if (world.phase === PHASE.WON || world.phase === PHASE.LOST) {
      gotoMap();
    }
  }
  if (takePressed(input, 'back')) {
    if (world.phase === PHASE.PAUSED || world.phase === PHASE.WON || world.phase === PHASE.LOST) {
      sfx('ui');
      gotoMap();
    }
  }
  if (takePressed(input, 'mute')) {
    view.muted = ensureAudio() ? !view.muted : view.muted;
    setMuted(view.muted);
  }
  if (takePressed(input, 'restart')) {
    if (world.phase === PHASE.WON || world.phase === PHASE.LOST) beginRun(world.regionIdx);
  }
  // mapLeft/mapRight are consumed every frame, in every phase: movement
  // presses made outside the route screen must never queue up a stale
  // selection change for later.
  const wantMapLeft = takePressed(input, 'mapLeft');
  const wantMapRight = takePressed(input, 'mapRight');
  if (world.phase === PHASE.MAP || world.phase === PHASE.MENU) {
    if (wantMapLeft) stepMapSelection(-1);
    if (wantMapRight) stepMapSelection(1);
  }
}

let acc = 0;
let last = performance.now();

/** One composed frame: chunky world pass, then the crisp UI pass. */
function renderFrame() {
  pixCtx.setTransform(pix.width / C.LOGICAL_W, 0, 0, pix.height / C.LOGICAL_H, 0, 0);
  renderWorld(pixCtx, world, view);
  setupTransform(ctx, canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pix, 0, 0, C.LOGICAL_W, C.LOGICAL_H);
  ctx.imageSmoothingEnabled = true;
  renderUI(ctx, world, view);
}

function frame(now) {
  window.requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  view.t += dt;
  handleEdges();

  // The flare is a one-shot edge: it lands on the first step of the frame.
  let flareEdge = takePressed(input, 'flare');
  if (input.button.flare) {
    flareEdge = true;
    input.button.flare = false;
  }

  if (world.phase === PHASE.RUNNING) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      acc -= STEP;
      const axis = inputAxis(input);
      const events = stepWorld(
        world,
        { axisX: axis.x, axisY: axis.y, dash: inputDash(input), flare: flareEdge && steps === 0 },
        STEP,
      );
      steps++;
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
  renderFrame();
}

// ------------------------------------------------------------- fixtures
// ?shot=map | play | win | lose — truthful renders of the real renderer at
// arranged game states. They are review fixtures, never proof of play.

// A read-only probe for the browser smoke test: the live phase, selection and
// run counters. It observes only — it changes nothing and drives nothing.
window.__probe = () => ({
  phase: world.phase,
  sel: view.mapSel,
  region: world.regionIdx,
  timeLeft: world.timeLeft,
  collected: world.collected,
  waylights: world.stats.waylights,
  relayDone: world.stats.relayDone,
});

function arrangedCampaign() {
  // A mid-route campaign so the map shows progression, locks and bests.
  const c = createCampaign();
  recordResult(c, 0, { won: true, score: 3520 });
  recordResult(c, 1, { won: true, score: 2210 });
  return c;
}

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

/** Parks every bramble in a field corner (fixture aid for arranged passes). */
function parkAllBrambles(w) {
  const corners = [
    { x: C.FIELD.x0 + 60, y: C.FIELD.y0 + 60 },
    { x: C.FIELD.x1 - 60, y: C.FIELD.y0 + 60 },
    { x: C.FIELD.x0 + 60, y: C.FIELD.y1 - 60 },
    { x: C.FIELD.x1 - 60, y: C.FIELD.y1 - 60 },
  ];
  let i = 0;
  for (const b of w.brambles) {
    pinBramble(b, corners[i % 4].x, corners[i % 4].y);
    i++;
  }
}

function setupShot(mode) {
  if (mode === 'start') mode = 'map';
  view.camp = arrangedCampaign();
  view.mapSel = 2;
  view.nextAvailable = false;
  view.lastResult = null;
  if (mode === 'map') {
    world = createWorld(1337, view.mapSel);
    world.phase = PHASE.MAP;
  } else if (mode === 'play') {
    // Tideglum Depths mid-sweep, arranged for a readable mechanic frame: the
    // real simulation is stepped with the courier parked and shielded until
    // the glum tide's wall is sweeping, then the wall is placed mid-sweep
    // (leading edge at the field's center) and the lantern is staged just
    // ahead of it. Review fixture only — never evidence of play.
    world = createWorld(1337, 2);
    startRun(world);
    dispatch(world.events);
    // Wait out the tide's seeded first delay (~10 s) without playing: parked
    // and shielded, so no hearts can be lost and no seeds are collected.
    let guard = 0;
    while (
      world.phase === PHASE.RUNNING &&
      !(world.biome && world.biome.phase === 'active') &&
      guard++ < 900
    ) {
      world.player.invuln = 999;
      dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false, flare: false }, STEP));
      if (!reducedMotion) pushTrail(effects, world.player.x, world.player.y);
    }
    if (world.biome && world.biome.phase === 'active') {
      const b = world.biome;
      // Arranged: the wall mid-sweep. The short steering pass below moves it
      // another 80 px, so the leading edge is arranged 80 px upwind of the
      // field's center and lands exactly there in the frozen frame.
      b.wallX = (C.FIELD.x0 + C.FIELD.x1) / 2 + b.side * 80;
      // Roamers pinned on the wall's trailing side, clear of the sweep.
      const trailX = b.side > 0 ? C.FIELD.x1 - 90 : C.FIELD.x0 + 90;
      world.brambles.forEach((h, i) => pinBramble(h, trailX, C.FIELD.y0 + 110 + (i % 3) * 220));
      // The lantern staged 320 px ahead of the leading edge, inside the field.
      world.player.x = Math.max(
        C.FIELD.x0 + 40,
        Math.min(C.FIELD.x1 - 40, b.wallX + -b.side * 320),
      );
      world.player.y = (C.FIELD.y0 + C.FIELD.y1) / 2;
      // A short real steering pass so the frame shows play (trail, HUD count):
      // the wall closes 80 px and the courier moves at most ~117 px against a
      // 320 px staging gap, so no contact happens in this window.
      for (let i = 0; i < 20; i++) {
        world.player.invuln = 999;
        const target = nearestSeed(world);
        const ax = target ? Math.max(-1, Math.min(1, (target.x - world.player.x) / 120)) : 0;
        const ay = target ? Math.max(-1, Math.min(1, (target.y - world.player.y) / 120)) : 0;
        dispatch(stepWorld(world, { axisX: ax, axisY: ay, dash: false, flare: false }, STEP));
        if (!reducedMotion) pushTrail(effects, world.player.x, world.player.y);
      }
      // Fixture guard: keep the mid-run shot playable rather than near-death.
      if (world.hearts < 2) world.hearts = 2;
      world.player.invuln = 0; // the frozen frame must not blink the lantern
      // Arranged: the relay live — one beacon already lit, and the nearest
      // unlit one staged just ahead of the lantern mid-channel, so the
      // frozen frame shows the charge arc filling while the tide closes.
      // Review fixture only — never evidence of play.
      const unlit = world.waylights.filter((b) => !b.lit);
      if (unlit.length >= 2) {
        const near = [...unlit].sort(
          (a, b) =>
            Math.hypot(a.x - world.player.x, a.y - world.player.y) -
            Math.hypot(b.x - world.player.x, b.y - world.player.y),
        )[0];
        const far = unlit.filter((b) => b !== near)[0];
        far.lit = true;
        world.stats.waylights = 1;
        near.x = Math.max(C.FIELD.x0 + 90, Math.min(C.FIELD.x1 - 90, world.player.x + 60));
        near.y = Math.max(C.FIELD.y0 + 60, Math.min(C.FIELD.y1 - 60, world.player.y));
        world.player.x = Math.max(C.FIELD.x0 + 40, near.x - 46); // inside the ring
        world.player.y = near.y;
        near.channel = C.WAYLIGHT.channel * 0.6;
      }
    }
    // Arranged: a partially charged ember so the meter reads in the shot.
    world.ember = 66;
  } else if (mode === 'win') {
    world = createWorld(1337, 1);
    startRun(world);
    dispatch(world.events);
    // Hazards pinned to the corners so the arranged passes stay clean.
    parkAllBrambles(world);
    // The relay is completed by the simulation itself: the shielded courier
    // stands inside each beacon's ring for the full channel. Real steps,
    // arranged staging — a review fixture, never proof of human play.
    for (const bl of world.waylights) {
      world.player.x = bl.x;
      world.player.y = bl.y;
      world.player.invuln = 999;
      let relayGuard = 0;
      while (!bl.lit && world.phase === PHASE.RUNNING && relayGuard++ < 120) {
        dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false, flare: false }, STEP));
      }
    }
    let guard = 0;
    while (world.collected < world.region.seeds && guard++ < 200) {
      const s = world.seeds.find((seed) => !seed.taken);
      world.player.x = s.x;
      world.player.y = s.y;
      world.player.invuln = 999;
      dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false, flare: false }, STEP));
    }
  } else if (mode === 'lose') {
    world = createWorld(1337, 3); // Umbral Crown
    startRun(world);
    dispatch(world.events);
    world.hearts = 1;
    const b = pinBramble(world.brambles[0], world.brambles[0].x, world.brambles[0].y);
    world.player.x = b.x;
    world.player.y = b.y;
    world.player.invuln = 0;
    dispatch(stepWorld(world, { axisX: 0, axisY: 0, dash: false, flare: false }, STEP));
  }
  // One completed render, then flag readiness for the capture tool.
  renderFrame();
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

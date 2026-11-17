// Deterministic tests for the three regional field mechanics added in the V3
// draft: Ambershard's shard gust, Tideglum's glum tide and Umbral Crown's
// snares, against the mechanic-free Mosslight Hollow baseline. These import
// the same pure modules the browser runs: no DOM, no window, no browser.
// Run with:  node --test tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../game/src/config.js';
import {
  createWorld,
  startRun,
  stepWorld,
  runSummary,
  togglePause,
  PHASE,
} from '../game/src/world.js';

const STEP = 1 / 60;
const IDLE = { axisX: 0, axisY: 0, dash: false, flare: false };
const CX = (C.FIELD.x0 + C.FIELD.x1) / 2;
const CY = (C.FIELD.y0 + C.FIELD.y1) / 2;

const BIOME_EVENTS = new Set([
  'gustWarn',
  'gust',
  'gustEnd',
  'tideWarn',
  'tide',
  'tideEnd',
  'snareWarn',
  'snare',
]);

/** Parks a bramble at a spot regardless of its movement kind (test aid). */
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

/** Removes every seed so mechanic tests never trip a collect or a win. */
function clearSeeds(w) {
  for (const s of w.seeds) s.taken = true;
}

const CORNERS = [
  { x: C.FIELD.x0 + 60, y: C.FIELD.y0 + 60 },
  { x: C.FIELD.x1 - 60, y: C.FIELD.y0 + 60 },
  { x: C.FIELD.x0 + 60, y: C.FIELD.y1 - 60 },
  { x: C.FIELD.x1 - 60, y: C.FIELD.y1 - 60 },
];

/** Parks every bramble in the corner farthest from the given point. */
function parkAway(w, x, y) {
  for (const b of w.brambles) {
    let best = CORNERS[0];
    let bd = -1;
    for (const c of CORNERS) {
      const d = Math.min(Math.hypot(c.x - x, c.y - y), Math.hypot(c.x - b.x, c.y - b.y));
      if (d > bd) {
        bd = d;
        best = c;
      }
    }
    pinBramble(b, best.x, best.y);
  }
}

/** Keeps roaming hazards from closing on a stationary test courier. */
function pinNearby(w, x, y) {
  for (const b of w.brambles) {
    if (Math.hypot(b.x - x, b.y - y) < 320) pinBramble(b, b.x, b.y);
  }
}

/** Steps a shielded run until `pred` fires on an event; null on timeout. */
function runUntil(w, pred, maxSteps = 1600) {
  for (let i = 0; i < maxSteps; i++) {
    w.player.invuln = 999; // shield the courier from brambles in these tests
    const events = stepWorld(w, IDLE, STEP);
    const hit = events.find(pred);
    if (hit) return hit;
    if (w.phase !== PHASE.RUNNING) return null;
  }
  return null;
}

// -------------------------------------------------------- region isolation

test('the hollow runs no mechanic; each later grove runs only its own', () => {
  const hollow = createWorld(301, 0);
  startRun(hollow);
  clearSeeds(hollow);
  for (let i = 0; i < 1500; i++) {
    hollow.player.invuln = 999;
    const events = stepWorld(hollow, IDLE, STEP);
    assert.deepEqual(
      events.filter((e) => BIOME_EVENTS.has(e.type)),
      [],
      'the baseline grove never emits a mechanic event',
    );
    assert.equal(hollow.phase, PHASE.RUNNING);
  }
  assert.equal(hollow.biome, null, 'the hollow keeps no mechanic state');

  const expected = {
    1: ['gust', 'gustEnd', 'gustWarn'],
    2: ['tide', 'tideEnd', 'tideWarn'],
    3: ['snare', 'snareWarn'],
  };
  for (const [idx, kinds] of Object.entries(expected)) {
    const w = createWorld(302, Number(idx));
    startRun(w);
    clearSeeds(w);
    const seen = new Set();
    for (let i = 0; i < 1500 && seen.size < kinds.length; i++) {
      w.player.invuln = 999;
      for (const e of stepWorld(w, IDLE, STEP)) {
        if (BIOME_EVENTS.has(e.type)) seen.add(e.type);
      }
    }
    assert.deepEqual(
      [...seen].sort(),
      [...kinds].sort(),
      `region ${idx} runs only its own mechanic`,
    );
  }
});

// ------------------------------------------------------------------- gust

test('the shard gust warns, then shoves the lantern downwind with no input', () => {
  const w = createWorld(202, 1);
  startRun(w);
  clearSeeds(w);
  const warn = runUntil(w, (e) => e.type === 'gustWarn');
  assert.ok(warn, 'the gust announces its direction');
  assert.equal(w.biome.phase, 'warn');
  const dir = warn.dir;
  const xBefore = w.player.x;
  for (let i = 0; i < 60; i++) {
    w.player.invuln = 999;
    const events = stepWorld(w, IDLE, STEP);
    assert.ok(!events.some((e) => e.type === 'gust'), 'no shove during the warning');
  }
  assert.equal(w.biome.phase, 'warn', 'the warning lasts its full tell');
  assert.equal(w.player.x, xBefore, 'the lantern does not move during the warning');

  const g = runUntil(w, (e) => e.type === 'gust');
  assert.ok(g, 'the gust lands after its warning');
  let ended = false;
  for (let i = 0; i < 130 && !ended; i++) {
    w.player.invuln = 999;
    const events = stepWorld(w, IDLE, STEP);
    assert.ok(!events.some((e) => e.type === 'hit'), 'the wind itself never stings');
    if (events.some((e) => e.type === 'gustEnd')) ended = true;
  }
  assert.ok(ended, 'the gust ends its shove');
  const drift = w.player.x - xBefore;
  assert.ok(Math.abs(drift) > 300, 'the gust shoves the lantern downwind');
  assert.equal(Math.sign(drift), dir, 'the shove follows the warned direction');
  assert.equal(w.stats.biome, 1, 'a weathered gust is counted');
});

// ------------------------------------------------------------------- tide

test('the glum tide catches a stationary courier once, with fair knockback', () => {
  const w = createWorld(201, 2);
  startRun(w);
  clearSeeds(w);
  const warn = runUntil(w, (e) => e.type === 'tideWarn');
  assert.ok(warn, 'the tide announces its origin side');
  assert.equal(w.biome.phase, 'warn');
  const side = warn.side;
  parkAway(w, CX, CY);
  w.player.x = CX;
  w.player.y = CY;
  const hearts0 = w.hearts;
  let hits = 0;
  let sawKnockback = false;
  let ended = false;
  for (let i = 0; i < 1300 && !ended; i++) {
    // Seek the first contact with no shield; after it lands, the shared
    // invulnerability window must cap the whole sweep to that single heart.
    if (hits === 0) w.player.invuln = 0;
    const events = stepWorld(w, IDLE, STEP);
    pinNearby(w, w.player.x, w.player.y);
    for (const e of events) {
      if (e.type === 'hit') {
        hits++;
        if (hits === 1) {
          assert.equal(w.hearts, hearts0 - 1, 'the wall costs exactly one heart');
          assert.equal(w.stats.hitsTaken, 1);
          assert.ok(w.player.invuln > 0, 'the shared invulnerability window opens');
          assert.equal(
            Math.sign(w.player.vx),
            -side,
            'the knockback pushes downwind with the tide',
          );
          assert.equal(w.player.vy, 0, 'the knockback is purely along the sweep');
          sawKnockback = true;
        } else {
          assert.fail('the tide caught the courier twice in one sweep');
        }
      }
      if (e.type === 'tideEnd') ended = true;
    }
  }
  assert.ok(sawKnockback, 'the wall caught the stationary courier');
  assert.ok(ended, 'the tide finishes its sweep');
  assert.equal(w.hearts, hearts0 - 1, 'no damage beyond the one window');
  assert.equal(w.stats.biome, 0, 'a tide that caught the courier is not counted');
});

test('dashing through the glum tide crosses cleanly', () => {
  const w = createWorld(201, 2); // same seed: same schedule, same origin side
  startRun(w);
  clearSeeds(w);
  const warn = runUntil(w, (e) => e.type === 'tideWarn');
  const side = warn.side;
  parkAway(w, CX, CY);
  w.player.x = CX;
  w.player.y = CY;
  const hearts0 = w.hearts;
  let dashed = false;
  let dashStep = -9999;
  let ended = false;
  for (let i = 0; i < 1400 && !ended; i++) {
    // No shield, except within the dash's own brief invulnerability window.
    if (i - dashStep > 40) w.player.invuln = 0;
    const closing =
      !dashed && w.biome.phase === 'active' && Math.abs(w.player.x - w.biome.wallX) < 150;
    if (closing) {
      dashed = true;
      dashStep = i;
    }
    const events = stepWorld(
      w,
      { axisX: closing ? side : 0, axisY: 0, dash: closing, flare: false },
      STEP,
    );
    pinNearby(w, w.player.x, w.player.y);
    assert.ok(!events.some((e) => e.type === 'hit'), 'a well-timed dash takes no tide damage');
    if (events.some((e) => e.type === 'tideEnd')) ended = true;
  }
  assert.ok(ended, 'the tide finishes its sweep');
  assert.ok(dashed, 'the test dashed through the wall');
  assert.equal(w.stats.biome, 1, 'a clean crossing is counted');
  assert.equal(w.hearts, hearts0, 'the courier never lost a heart');
  assert.equal(w.stats.hitsTaken, 0);
});

// ------------------------------------------------------------------ snare

test('the umbra snare only catches a courier still inside its warned ring', () => {
  // (a) Escaped: outside the ring when it closes.
  const w = createWorld(203, 3);
  startRun(w);
  clearSeeds(w);
  const warn = runUntil(w, (e) => e.type === 'snareWarn');
  assert.ok(warn, 'the snare telegraphs its ring');
  assert.equal(w.biome.phase, 'warn');
  const { x, y, r } = warn;
  let corner = CORNERS[0];
  let bd = -1;
  for (const c of CORNERS) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > bd) {
      bd = d;
      corner = c;
    }
  }
  assert.ok(bd > r + 60, 'test setup: an escape spot exists outside the ring');
  w.player.x = corner.x;
  w.player.y = corner.y;
  const hearts0 = w.hearts;
  const erupt = runUntil(w, (e) => e.type === 'snare');
  assert.ok(erupt, 'the snare erupts after its warning');
  assert.equal(erupt.hit, false, 'standing clear means no damage');
  assert.equal(w.hearts, hearts0);
  assert.equal(w.stats.biome, 1, 'a clean escape is counted');

  // (b) Caught: the same seed lays the same ring; stand dead center, unshielded.
  const w2 = createWorld(203, 3);
  startRun(w2);
  clearSeeds(w2);
  const warn2 = runUntil(w2, (e) => e.type === 'snareWarn');
  assert.equal(warn2.x, x, 'the same seed lays the same ring');
  assert.equal(warn2.y, y);
  parkAway(w2, x, y);
  w2.player.x = x;
  w2.player.y = y;
  const hearts2 = w2.hearts;
  let erupt2 = false;
  let steps = 0;
  for (let i = 0; i < 300 && !erupt2; i++) {
    w2.player.invuln = 0;
    steps++;
    const events = stepWorld(w2, IDLE, STEP);
    pinNearby(w2, x, y);
    if (events.some((e) => e.type === 'snare')) erupt2 = true;
  }
  assert.ok(erupt2, 'the ring erupts around the courier standing inside it');
  assert.ok(steps > 30, 'the ring warns before it erupts');
  assert.equal(w2.hearts, hearts2 - 1, 'standing inside costs one heart');
  assert.equal(w2.stats.hitsTaken, 1);
  assert.equal(w2.stats.biome, 0, 'a caught courier is not counted as evaded');
  assert.ok(w2.player.invuln > 0, 'the shared invulnerability window opens');
  for (let i = 0; i < 40; i++) {
    w2.player.invuln = 0;
    const events = stepWorld(w2, IDLE, STEP);
    assert.ok(!events.some((e) => e.type === 'hit'), 'one snare never bites twice');
  }
  assert.equal(w2.hearts, hearts2 - 1, 'the caught courier keeps exactly one loss');

  // (c) Shielded: inside the ring but invulnerable — counterplay still counts.
  const w3 = createWorld(203, 3);
  startRun(w3);
  clearSeeds(w3);
  runUntil(w3, (e) => e.type === 'snareWarn');
  w3.player.x = x;
  w3.player.y = y;
  const erupt3 = runUntil(w3, (e) => e.type === 'snare');
  assert.ok(erupt3, 'the ring erupts');
  assert.equal(erupt3.hit, false, 'invulnerability refuses the eruption');
  assert.equal(w3.hearts, C.MAX_HEARTS);
  assert.equal(w3.stats.biome, 1, 'a shielded escape is counted');
});

// ------------------------------------------------------------ determinism

test('the same seed schedules the same mechanics; a different seed differs', () => {
  const collect = (seed) => {
    const w = createWorld(seed, 3);
    startRun(w);
    clearSeeds(w);
    const out = [];
    for (let i = 0; i < 1000; i++) {
      w.player.invuln = 999;
      for (const e of stepWorld(w, IDLE, STEP)) {
        if (BIOME_EVENTS.has(e.type)) {
          out.push([e.type, e.x ?? null, e.y ?? null, e.dir ?? e.side ?? null]);
        }
      }
    }
    return out;
  };
  const a = collect(77);
  assert.ok(a.length > 0, 'the schedule produces mechanic events');
  assert.deepEqual(collect(77), a, 'same seed, same schedule');
  assert.notDeepEqual(collect(78), a, 'a different seed schedules differently');
});

// ------------------------------------------------------------------- pause

test('a paused world freezes its mechanic', () => {
  const w = createWorld(401, 1);
  startRun(w);
  clearSeeds(w);
  const warn = runUntil(w, (e) => e.type === 'gustWarn');
  assert.ok(warn, 'the gust warns first');
  assert.equal(w.biome.phase, 'warn');
  togglePause(w);
  assert.equal(w.phase, PHASE.PAUSED);
  const timer = w.biome.timer;
  const timeLeft = w.timeLeft;
  for (let i = 0; i < 120; i++) {
    const events = stepWorld(w, { axisX: 1, axisY: 1, dash: true }, STEP);
    assert.deepEqual(events, [], 'a paused world emits nothing');
  }
  assert.equal(w.biome.phase, 'warn', 'the mechanic waits out the pause');
  assert.equal(w.biome.timer, timer, 'the mechanic timer is frozen');
  assert.equal(w.timeLeft, timeLeft);
  togglePause(w);
  assert.equal(w.phase, PHASE.RUNNING);
});

// ----------------------------------------------------------------- summary

test('the result summary names the grove’s mechanic stat', () => {
  const w = createWorld(501, 1);
  startRun(w);
  clearSeeds(w);
  const end = runUntil(w, (e) => e.type === 'gustEnd');
  assert.ok(end, 'a gust completes');
  const sum = runSummary(w);
  assert.equal(sum.biomeLabel, 'Gusts weathered');
  assert.equal(sum.biome, 1);
  const hollow = createWorld(502, 0);
  startRun(hollow);
  assert.equal(runSummary(hollow).biomeLabel, null, 'the baseline grove has no mechanic stat');
  assert.equal(runSummary(hollow).biome, 0);
});

// -------------------------------------------------------- lethal step guard

test('a lethal mechanic hit ends the step at once — it cannot collect a seed', () => {
  const w = createWorld(606, 3); // Umbral Crown: the snare can end a run
  startRun(w);
  w.bloomTimer = 1e9; // fixture: no moonbloom may heal the courier mid-test
  const warn = runUntil(w, (e) => e.type === 'snareWarn');
  assert.ok(warn, 'the snare telegraphs its ring');
  // One live seed, all others out of play — so only that seed could ever be
  // collected. It parks far from the ring through the whole warning, so the
  // ordinary (still nonlethal) warning steps cannot collect it either.
  const staged = w.seeds.find((s) => !s.taken);
  assert.ok(staged, 'test setup: a seed exists to stage');
  for (const s of w.seeds) s.taken = s !== staged;
  let corner = CORNERS[0];
  let bd = -1;
  for (const c of CORNERS) {
    const d = Math.hypot(c.x - warn.x, c.y - warn.y);
    if (d > bd) {
      bd = d;
      corner = c;
    }
  }
  assert.ok(bd > C.SEED.pickup + 40, 'test setup: the seed parks beyond pickup reach');
  staged.x = corner.x;
  staged.y = corner.y;
  // One heart left: the eruption will be lethal. The courier stands dead
  // center, unshielded, with zero velocity, so they never leave the ring.
  w.hearts = 1;
  parkAway(w, warn.x, warn.y);
  w.player.x = warn.x;
  w.player.y = warn.y;
  w.player.vx = 0;
  w.player.vy = 0;
  const score0 = w.score;
  let erupt = null;
  for (let i = 0; i < 300 && !erupt; i++) {
    w.player.invuln = 0;
    // Only in the final warning step — the one that will erupt — move the
    // seed under the stationary courier. A collect in that same step would
    // prove the lethal guard missing; earlier steps must never see it there.
    if (w.biome.phase === 'warn' && w.biome.timer <= STEP) {
      staged.x = w.player.x;
      staged.y = w.player.y;
    }
    const events = stepWorld(w, IDLE, STEP);
    pinNearby(w, warn.x, warn.y);
    erupt = events.find((e) => e.type === 'snare') || null;
  }
  assert.ok(erupt, 'the ring erupts around the courier');
  assert.equal(erupt.hit, true, 'the courier standing inside is caught');
  assert.equal(w.phase, PHASE.LOST, 'the lethal hit ends the run');
  assert.equal(w.hearts, 0);
  assert.equal(w.stats.hitsTaken, 1);
  // The seed sitting under the courier is NOT collected: the step stopped
  // immediately after the lethal loss, before collectSeeds could run.
  assert.equal(staged.taken, false, 'the staged seed stays uncollected');
  assert.equal(w.collected, 0);
  assert.equal(w.score, score0, 'no collect points are scored after the loss');
  assert.equal(w.stats.seedsCollected, 0);
  // The finished world is frozen: further steps do nothing at all.
  const timeLeft = w.timeLeft;
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(stepWorld(w, IDLE, STEP), []);
  }
  assert.equal(w.timeLeft, timeLeft);
  assert.equal(staged.taken, false, 'the seed stays uncollected after the run has ended');
});

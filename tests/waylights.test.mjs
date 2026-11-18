// Deterministic tests for the V4 draft's Waylight Relay: the three seeded
// beacons every grove carries, rekindled by standing inside their ring.
// These import the same pure modules the browser runs: no DOM, no window.
// Run with:  node --test tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../game/src/config.js';
import {
  createWorld,
  startRun,
  stepWorld,
  togglePause,
  runSummary,
  PHASE,
} from '../game/src/world.js';

const STEP = 1 / 60;
const IDLE = { axisX: 0, axisY: 0, dash: false, flare: false };

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

const CORNERS = [
  { x: C.FIELD.x0 + 60, y: C.FIELD.y0 + 60 },
  { x: C.FIELD.x1 - 60, y: C.FIELD.y0 + 60 },
  { x: C.FIELD.x0 + 60, y: C.FIELD.y1 - 60 },
  { x: C.FIELD.x1 - 60, y: C.FIELD.y1 - 60 },
];

/** Parks every bramble in the corner farthest from the given point. */
function parkFar(w, x, y) {
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

/** Removes every seed so relay tests never trip a collect or a win. */
function clearSeeds(w) {
  for (const s of w.seeds) s.taken = true;
}

/** Parks the courier dead inside a beacon's activation ring. */
function standIn(w, beacon) {
  w.player.x = beacon.x;
  w.player.y = beacon.y;
}

// ------------------------------------------------------------- layout

test('every grove carries three fairly spaced beacons, seeded and deterministic', () => {
  for (let idx = 0; idx < 4; idx++) {
    const w = createWorld(900 + idx, idx);
    startRun(w);
    assert.equal(w.waylights.length, C.WAYLIGHT.count, `${w.region.name} lays its relay`);
    const p = w.player;
    for (const b of w.waylights) {
      assert.ok(
        Math.hypot(b.x - p.x, b.y - p.y) >= C.WAYLIGHT.minPlayerDist - 1,
        'a beacon never spawns on the courier start',
      );
      for (const o of w.waylights) {
        if (o === b) continue;
        assert.ok(
          Math.hypot(b.x - o.x, b.y - o.y) >= C.WAYLIGHT.minSpacing - 1,
          'beacons keep their spacing',
        );
      }
    }
    for (const s of w.seeds) {
      for (const b of w.waylights) {
        assert.ok(
          Math.hypot(s.x - b.x, s.y - b.y) >= C.SEED.minSpacing - 1,
          'no moonseed spawns inside a beacon ring',
        );
      }
    }
    for (const h of w.brambles) {
      for (const b of w.waylights) {
        assert.ok(
          Math.hypot(h.x - b.x, h.y - b.y) >= 180 - 1,
          'no hazard spawns on top of a beacon',
        );
      }
    }
  }

  // The same seed lays the same relay; a different seed lays a different one.
  const a = createWorld(901, 2);
  startRun(a);
  const b = createWorld(901, 2);
  startRun(b);
  assert.deepEqual(
    a.waylights.map((w) => [w.x, w.y]),
    b.waylights.map((w) => [w.x, w.y]),
    'same seed, same beacons',
  );
  const c = createWorld(902, 2);
  startRun(c);
  assert.notDeepEqual(
    a.waylights.map((w) => [w.x, w.y]),
    c.waylights.map((w) => [w.x, w.y]),
    'a different seed lays a different relay',
  );
});

// ---------------------------------------------------------- activation

test('standing in a beacon rekindles it: points, ember, time — exactly once', () => {
  const w = createWorld(1001, 0);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  standIn(w, b);
  w.timeLeft = 40; // below the cap, so the time reward is visible in full
  const hearts0 = w.hearts;
  const score0 = w.score;
  const ember0 = w.ember;
  let lit = null;
  for (let i = 0; i < 60 && !lit; i++) {
    w.player.invuln = 999;
    const events = stepWorld(w, IDLE, STEP);
    lit = events.find((e) => e.type === 'waylight') || null;
  }
  assert.ok(lit, 'the beacon lights after the full channel');
  assert.equal(lit.points, C.WAYLIGHT.scorePerBeacon);
  assert.equal(w.score, score0 + C.WAYLIGHT.scorePerBeacon);
  assert.equal(w.stats.waylights, 1);
  assert.equal(w.ember, ember0 + C.WAYLIGHT.emberPerBeacon, 'the beacon feeds the ember');
  assert.ok(
    Math.abs(w.timeLeft - (40 - 0.9 + C.WAYLIGHT.timePerBeacon)) < 1e-6,
    'the channel costs time, the reward returns it',
  );
  assert.equal(w.hearts, hearts0, 'the beacon itself is harmless');

  // Holding still afterwards cannot pay again: one-shot per run.
  const scoreAfter = w.score;
  const emberAfter = w.ember;
  let extra = 0;
  for (let i = 0; i < 120; i++) {
    w.player.invuln = 999;
    const events = stepWorld(w, IDLE, STEP);
    extra += events.filter((e) => e.type === 'waylight' || e.type === 'waylightRelay').length;
  }
  assert.equal(extra, 0, 'a lit beacon pays nothing more');
  assert.equal(w.score, scoreAfter);
  assert.equal(w.ember, emberAfter);
  assert.equal(w.stats.waylights, 1);
});

test('leaving the ring cancels the commit; the beacon can still be lit later', () => {
  const w = createWorld(1002, 0);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  standIn(w, b);
  const score0 = w.score;
  for (let i = 0; i < 30; i++) {
    w.player.invuln = 999;
    stepWorld(w, IDLE, STEP);
  }
  assert.ok(b.channel > 0, 'the commit builds inside the ring');
  assert.equal(w.stats.waylights, 0, 'half a channel is not a lit beacon');

  // Step out: the charge resets, and the cancel is announced.
  w.player.x = b.x + C.WAYLIGHT.ring + 30;
  const events = stepWorld(w, IDLE, STEP);
  assert.ok(events.some((e) => e.type === 'waylightBreak'), 'the cancel is announced');
  assert.equal(b.channel, 0, 'the charge resets outside the ring');
  assert.equal(w.score, score0, 'a broken commit pays nothing');

  // Back inside, a full dwell still lights it.
  standIn(w, b);
  let lit = false;
  for (let i = 0; i < 60 && !lit; i++) {
    w.player.invuln = 999;
    const evs = stepWorld(w, IDLE, STEP);
    lit = evs.some((e) => e.type === 'waylight');
  }
  assert.ok(lit, 'a recommitted courier lights the beacon');
  assert.equal(w.stats.waylights, 1);
});

test('a hit cancels the commit — counterplay while channeling is real', () => {
  const w = createWorld(1003, 0);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  standIn(w, b);
  // Build most of the channel first.
  for (let i = 0; i < 30; i++) {
    w.player.invuln = 999;
    stepWorld(w, IDLE, STEP);
  }
  assert.ok(b.channel > 0, 'test setup: a commit is being held');
  // A hazard lands on the courier: the shared hit rule stings and the
  // commit is cancelled in the same step.
  const hitBramble = pinBramble(w.brambles[0], w.player.x, w.player.y);
  w.player.invuln = 0;
  const hearts0 = w.hearts;
  const events = stepWorld(w, IDLE, STEP);
  assert.ok(events.some((e) => e.type === 'hit'), 'the hazard stings');
  assert.equal(w.hearts, hearts0 - 1, 'the hit costs its heart');
  assert.equal(b.channel, 0, 'the hit cancels the commit');
  assert.equal(w.stats.waylights, 0, 'no beacon lights through the sting');
  assert.ok(!events.some((e) => e.type === 'waylight'), 'the lit event never fires that step');

  // The commit restarts from zero afterwards — no banked progress survived.
  pinBramble(hitBramble, C.FIELD.x0 + 60, C.FIELD.y0 + 60);
  for (let i = 0; i < 10; i++) {
    w.player.invuln = 999;
    stepWorld(w, IDLE, STEP);
  }
  assert.ok(
    b.channel > 0 && b.channel < C.WAYLIGHT.channel,
    'a fresh commit builds again from nothing',
  );
  assert.equal(w.stats.waylights, 0);
});

// -------------------------------------------------------- relay bonus

test('lighting all three pays the relay bonus once, and never wins the run', () => {
  const w = createWorld(1004, 1); // Ambershard Wastes
  startRun(w);
  clearSeeds(w);
  w.timeLeft = 50; // below the cap, so the relay's time reward shows
  const score0 = w.score;
  let relayEvents = 0;
  for (const b of w.waylights) {
    parkFar(w, b.x, b.y);
    standIn(w, b);
    let lit = false;
    for (let i = 0; i < 70 && !lit; i++) {
      w.player.invuln = 999;
      const events = stepWorld(w, IDLE, STEP);
      if (events.some((e) => e.type === 'waylight')) lit = true;
      relayEvents += events.filter((e) => e.type === 'waylightRelay').length;
    }
    assert.ok(lit, 'each beacon lights in turn');
  }
  assert.equal(w.stats.waylights, 3);
  assert.equal(w.stats.relayDone, true);
  assert.equal(relayEvents, 1, 'the relay bonus is announced exactly once');
  assert.equal(
    w.score,
    score0 + 3 * C.WAYLIGHT.scorePerBeacon + C.WAYLIGHT.relayBonus,
    'the relay pays its full bounded sum',
  );
  assert.equal(w.phase, PHASE.RUNNING, 'the relay alone never wins the run');
  assert.equal(w.collected, 0, 'the seed objective stays untouched');
  assert.ok(w.timeLeft > 50, 'the relay returns more time than standing still cost');
  const sum = runSummary(w);
  assert.equal(sum.waylights, 3);
  assert.equal(sum.relayDone, true);
});

// ---------------------------------------------------------------- caps

test('the rewards respect their caps: no overcharge, no timer overrun', () => {
  const w = createWorld(1005, 0);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  standIn(w, b);
  w.ember = C.EMBER.max - C.WAYLIGHT.emberPerBeacon + 5; // one beacon tops it out
  w.timeLeft = w.region.time; // already at the timer cap
  let sawFull = false;
  let lit = false;
  for (let i = 0; i < 60 && !lit; i++) {
    w.player.invuln = 999;
    const events = stepWorld(w, IDLE, STEP);
    if (events.some((e) => e.type === 'emberFull')) sawFull = true;
    if (events.some((e) => e.type === 'waylight')) lit = true;
  }
  assert.ok(lit, 'the beacon lights');
  assert.equal(w.ember, C.EMBER.max, 'the ember tops out at its cap');
  assert.ok(sawFull, 'the full-ember cue still fires once');
  assert.equal(w.timeLeft, w.region.time, 'the time reward never pushes past the cap');
});

// --------------------------------------------------------------- pause

test('a paused world freezes the relay channel', () => {
  const w = createWorld(1006, 0);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  standIn(w, b);
  for (let i = 0; i < 20; i++) {
    w.player.invuln = 999;
    stepWorld(w, IDLE, STEP);
  }
  togglePause(w);
  assert.equal(w.phase, PHASE.PAUSED);
  const channel = b.channel;
  const timeLeft = w.timeLeft;
  for (let i = 0; i < 120; i++) {
    const events = stepWorld(w, { axisX: 1, axisY: 1, dash: true }, STEP);
    assert.deepEqual(events, [], 'a paused world emits nothing');
  }
  assert.equal(b.channel, channel, 'the channel timer is frozen');
  assert.equal(w.timeLeft, timeLeft);
  togglePause(w);
  assert.equal(w.phase, PHASE.RUNNING);
});

// ------------------------------------------------------------- summary

test('the summary reports the relay in every grove, hollow included', () => {
  for (let idx = 0; idx < 4; idx++) {
    const w = createWorld(1007 + idx, idx);
    startRun(w);
    const sum = runSummary(w);
    assert.equal(w.waylights.length, C.WAYLIGHT.count, `${w.region.name} runs the relay`);
    assert.equal(sum.waylights, 0);
    assert.equal(sum.relayDone, false);
  }
});

// -------------------------------------------------------- pass-through

test('passing through a beacon ring without dwelling lights nothing', () => {
  const w = createWorld(1008, 2);
  startRun(w);
  clearSeeds(w);
  const b = w.waylights[0];
  parkFar(w, b.x, b.y);
  // Cross the whole ring at a stride: at top speed the courier is inside
  // for far less than the channel, so a mere pass never rekindles.
  const span = 300;
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    w.player.invuln = 999;
    w.player.x = b.x - span / 2 + (span / steps) * i;
    w.player.y = b.y;
    const events = stepWorld(w, IDLE, STEP);
    assert.ok(!events.some((e) => e.type === 'waylight'), 'a pass is not a commit');
  }
  assert.equal(w.stats.waylights, 0, 'no beacon lit through the pass');
});

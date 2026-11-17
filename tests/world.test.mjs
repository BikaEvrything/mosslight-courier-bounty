// Deterministic tests for the Mosslight Courier world simulation.
// These import the same pure modules the browser runs: no DOM, no window.
// Run with:  node --test tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../game/src/rng.js';
import * as C from '../game/src/config.js';
import {
  createWorld,
  startRun,
  stepWorld,
  togglePause,
  comboPoints,
  gradeFor,
  PHASE,
} from '../game/src/world.js';

const STEP = 1 / 60;
const IDLE = { axisX: 0, axisY: 0, dash: false };

function seededRun(seed) {
  const w = createWorld(seed);
  startRun(w);
  return w;
}

/** Parks a bramble at a spot regardless of its movement kind. */
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

/** Parks every bramble but `keep` in the corner farthest from the test point. */
function parkAway(w, keep, x, y) {
  let i = 0;
  for (const b of w.brambles) {
    if (b === keep) continue;
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
    i++;
  }
}

test('seeded rng is deterministic and seed-sensitive', () => {
  const a = createRng(7);
  const b = createRng(7);
  const c = createRng(8);
  for (let i = 0; i < 1000; i++) {
    const va = a.next();
    assert.equal(va, b.next(), 'same seed gives the same sequence');
    if (i === 0) assert.notEqual(va, c.next(), 'a different seed starts differently');
  }
  assert.equal(createRng(1).range(5, 9), createRng(1).range(5, 9));
  assert.equal(createRng(2).int(3, 3), 3);
});

test('same seed lays out identical seeds and brambles', () => {
  const a = seededRun(42);
  const b = seededRun(42);
  assert.deepEqual(
    a.seeds.map((s) => [s.x, s.y]),
    b.seeds.map((s) => [s.x, s.y]),
  );
  assert.deepEqual(
    a.brambles.map((s) => [s.x, s.y, s.kind]),
    b.brambles.map((s) => [s.x, s.y, s.kind]),
  );
  const other = seededRun(43);
  assert.notDeepEqual(
    a.seeds.map((s) => [s.x, s.y]),
    other.seeds.map((s) => [s.x, s.y]),
  );
});

test('seed spawns respect fair spacing rules', () => {
  const w = seededRun(99);
  const p = w.player;
  for (const s of w.seeds) {
    assert.ok(Math.hypot(s.x - p.x, s.y - p.y) >= C.SEED.minPlayerDist - 1, 'seed not on top of spawn');
    for (const o of w.seeds) {
      if (o === s) continue;
      assert.ok(Math.hypot(s.x - o.x, s.y - o.y) >= C.SEED.minSpacing - 1, 'seeds keep their spacing');
    }
  }
  for (const b of w.brambles) {
    assert.ok(Math.hypot(b.x - p.x, b.y - p.y) >= C.BRAMBLE.minSpawnDist - 1, 'bramble spawns away from the courier');
  }
});

test('collecting a seed raises collected, combo and score', () => {
  const w = seededRun(5);
  const s = w.seeds[0];
  parkAway(w, null, s.x, s.y);
  w.player.x = s.x;
  w.player.y = s.y;
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.collected, 1);
  assert.equal(w.combo, 1);
  assert.equal(w.score, comboPoints(1));
  assert.ok(events.some((e) => e.type === 'collect'));
});

test('fast collection builds a combo streak worth more points', () => {
  const w = seededRun(6);
  const first = w.seeds[0];
  parkAway(w, null, first.x, first.y);
  w.player.x = first.x;
  w.player.y = first.y;
  stepWorld(w, IDLE, STEP);
  const second = w.seeds.find((s) => !s.taken);
  parkAway(w, null, second.x, second.y);
  w.player.x = second.x;
  w.player.y = second.y;
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.combo, 2);
  assert.equal(w.score, comboPoints(1) + comboPoints(2));
  assert.ok(events.some((e) => e.type === 'collect' && e.points === comboPoints(2)));
});

test('combo breaks after the streak window passes', () => {
  const w = seededRun(7);
  const s = w.seeds[0];
  parkAway(w, null, s.x, s.y);
  w.player.x = s.x;
  w.player.y = s.y;
  stepWorld(w, IDLE, STEP);
  const steps = Math.ceil(C.COMBO.window / STEP) + 5;
  for (let i = 0; i < steps; i++) {
    stepWorld(w, IDLE, STEP);
    for (const b of w.brambles) pinBramble(b, b.x, b.y); // park hazards for this test
    if (w.phase !== PHASE.RUNNING) break;
  }
  assert.equal(w.combo, 0);
});

test('the run is lost when the timer runs out', () => {
  const w = seededRun(8);
  const steps = Math.ceil((C.RUN_SECONDS + 0.5) / STEP);
  for (let i = 0; i < steps; i++) {
    stepWorld(w, IDLE, STEP);
    for (const b of w.brambles) pinBramble(b, b.x, b.y); // park hazards for this test
    if (w.phase !== PHASE.RUNNING) break;
  }
  assert.equal(w.phase, PHASE.LOST);
  assert.equal(w.loseReason, 'time');
  assert.equal(w.timeLeft, 0);
});

test('a paused world does not progress', () => {
  const w = seededRun(9);
  togglePause(w);
  assert.equal(w.phase, PHASE.PAUSED);
  const before = { t: w.timeLeft, x: w.player.x, y: w.player.y, score: w.score };
  for (let i = 0; i < 120; i++) {
    const events = stepWorld(w, { axisX: 1, axisY: 1, dash: true }, STEP);
    assert.deepEqual(events, [], 'a paused world emits nothing');
  }
  assert.equal(w.timeLeft, before.t);
  assert.equal(w.player.x, before.x);
  assert.equal(w.player.y, before.y);
  assert.equal(w.score, before.score);
  togglePause(w);
  assert.equal(w.phase, PHASE.RUNNING);
});

test('dash has a cooldown and boosts speed', () => {
  const w = seededRun(10);
  const p = w.player;
  const events = stepWorld(w, { axisX: 1, axisY: 0, dash: true }, STEP);
  assert.ok(events.some((e) => e.type === 'dash'));
  assert.equal(w.stats.dashesUsed, 1);
  assert.ok(p.dashTime > 0, 'dash burst active');
  assert.ok(p.dashCooldown > 0, 'cooldown started');
  assert.ok(p.invuln > 0, 'brief dash invulnerability');
  assert.ok(Math.abs(p.vx) > C.PLAYER.maxSpeed, 'dash is faster than running');

  // Holding dash does not restart it while cooling down.
  let dashes = 1;
  for (let i = 0; i < 60; i++) {
    const evts = stepWorld(w, { axisX: 1, axisY: 0, dash: true }, STEP);
    dashes += evts.filter((e) => e.type === 'dash').length;
  }
  assert.equal(dashes, 1, 'no re-dash during the cooldown');

  // Cooldown drains over time.
  assert.ok(p.dashCooldown < C.PLAYER.dashCooldown - 0.5);
  const remaining = Math.ceil(p.dashCooldown / STEP) + 10;
  for (let i = 0; i < remaining; i++) stepWorld(w, IDLE, STEP);
  assert.equal(p.dashCooldown, 0);
  const evts = stepWorld(w, { axisX: 0, axisY: 0, dash: true }, STEP);
  assert.ok(evts.some((e) => e.type === 'dash'), 'dash returns after the cooldown');
});

test('a bramble hit costs a heart and grants brief invulnerability', () => {
  const w = seededRun(11);
  const b = pinBramble(w.brambles[0], w.brambles[0].x, w.brambles[0].y);
  w.player.x = b.x + 1;
  w.player.y = b.y;
  w.player.invuln = 0;
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.hearts, C.MAX_HEARTS - 1);
  assert.equal(w.stats.hitsTaken, 1);
  assert.ok(events.some((e) => e.type === 'hit'));
  assert.ok(w.player.invuln > 0, 'invulnerability window opens');
  // Second contact inside the window is ignored.
  w.player.vx = 0;
  w.player.vy = 0;
  stepWorld(w, IDLE, STEP);
  assert.equal(w.hearts, C.MAX_HEARTS - 1, 'no double damage while invulnerable');
});

test('losing every heart loses the run', () => {
  const w = seededRun(12);
  const b = pinBramble(w.brambles[0], w.brambles[0].x, w.brambles[0].y);
  w.hearts = 1;
  w.player.x = b.x;
  w.player.y = b.y;
  w.player.invuln = 0;
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.hearts, 0);
  assert.equal(w.phase, PHASE.LOST);
  assert.equal(w.loseReason, 'hearts');
  assert.ok(events.some((e) => e.type === 'lose' && e.reason === 'hearts'));
});

test('a near miss awards once per hazard, then never again', () => {
  const w = seededRun(13);
  const raw = w.brambles[0];
  const hitR = raw.r + C.PLAYER.r - C.BRAMBLE.contact;
  const b = pinBramble(raw, raw.x, raw.y);
  const px = b.x + hitR + C.NEAR_MISS.reach / 2;
  parkAway(w, b, px, b.y);
  w.player.x = px;
  w.player.y = b.y;
  w.player.invuln = 0;
  const first = stepWorld(w, IDLE, STEP);
  assert.ok(first.some((e) => e.type === 'near'), 'near miss fires');
  assert.equal(w.stats.nearMisses, 1);
  assert.equal(w.score, C.SCORE.nearMiss);
  const scoreAfter = w.score;
  stepWorld(w, IDLE, STEP);
  stepWorld(w, IDLE, STEP);
  assert.equal(w.stats.nearMisses, 1, 'near miss is deduplicated per hazard');
  assert.equal(w.score, scoreAfter);
});

test('a moonbloom heals a missing heart', () => {
  const w = seededRun(14);
  startRun(w);
  w.hearts = 2;
  w.bloom = { x: w.player.x, y: w.player.y, life: 5, spin: 0 };
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.hearts, C.MAX_HEARTS, 'heart restored');
  assert.ok(events.some((e) => e.type === 'heal'));
});

test('a moonbloom at full health awards bonus points', () => {
  const w = seededRun(15);
  w.bloom = { x: w.player.x, y: w.player.y, life: 5, spin: 0 };
  const before = w.score;
  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.hearts, C.MAX_HEARTS);
  assert.equal(w.score, before + C.SCORE.bloomFullHealth);
  assert.ok(events.some((e) => e.type === 'bloomFull'));
});

test('collecting every moonseed wins with a time bonus', () => {
  const w = seededRun(16);
  startRun(w);
  let guard = 0;
  while (w.collected < C.TOTAL_SEEDS && guard++ < 200) {
    const s = w.seeds.find((seed) => !seed.taken);
    w.player.x = s.x;
    w.player.y = s.y;
    w.player.invuln = 999;
    stepWorld(w, IDLE, STEP);
  }
  assert.equal(w.phase, PHASE.WON);
  assert.equal(w.collected, C.TOTAL_SEEDS);
  assert.ok(w.score > 0);
  assert.ok(w.stats.timeBonus > 0, 'time left is converted to bonus points');
  assert.ok(w.timeLeft > C.RUN_SECONDS - 200 * STEP, 'the win took only a few steps');
});

test('grades follow score thresholds', () => {
  assert.equal(gradeFor(0), 'D');
  assert.equal(gradeFor(1200), 'C');
  assert.equal(gradeFor(1900), 'B');
  assert.equal(gradeFor(2600), 'A');
  assert.equal(gradeFor(3400), 'S');
  assert.equal(gradeFor(9999), 'S');
});

test('combo points climb to their cap', () => {
  assert.equal(comboPoints(1), 100);
  assert.equal(comboPoints(2), 150);
  assert.equal(comboPoints(3), 200);
  assert.equal(comboPoints(7), 400);
  assert.equal(comboPoints(50), 400);
});

test('menu and finished worlds stay still while stepped', () => {
  const menu = createWorld(17);
  for (let i = 0; i < 60; i++) assert.deepEqual(stepWorld(menu, { axisX: 1, axisY: 1, dash: true }, STEP), []);
  assert.equal(menu.phase, PHASE.MENU);
  assert.equal(menu.timeLeft, C.RUN_SECONDS);
  const won = seededRun(18);
  won.phase = PHASE.WON;
  const before = won.score;
  for (let i = 0; i < 30; i++) stepWorld(won, IDLE, STEP);
  assert.equal(won.score, before, 'a won run keeps its score');
});

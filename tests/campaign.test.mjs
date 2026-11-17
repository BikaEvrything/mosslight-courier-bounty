// Deterministic tests for the Mosslight Courier campaign, ember flare and
// per-region seed targets. These import the same pure modules the browser
// runs: no DOM, no window, no fake APIs, no browser needed.
// Run with:  node --test tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../game/src/rng.js';
import * as C from '../game/src/config.js';
import { REGIONS, REGION_COUNT } from '../game/src/regions.js';
import { pickWeighted, createWorld, startRun, stepWorld, PHASE } from '../game/src/world.js';
import {
  createCampaign,
  recordResult,
  serialize,
  deserialize,
  isUnlocked,
  totalCleared,
  firstIncomplete,
  gradeRank,
  SAVE_VERSION,
} from '../game/src/campaign.js';

const STEP = 1 / 60;
const IDLE = { axisX: 0, axisY: 0, dash: false, flare: false };

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

/** Removes every seed so hazard-only tests never trip a collect. */
function clearSeeds(w) {
  for (const s of w.seeds) s.taken = true;
}

// ------------------------------------------------------------ unlock chain

test('a fresh campaign has only the first region unlocked', () => {
  const camp = createCampaign();
  assert.equal(camp.version, SAVE_VERSION);
  assert.equal(camp.regions.length, REGION_COUNT);
  assert.ok(isUnlocked(camp, 0), 'the hollow is open from the start');
  for (let i = 1; i < REGION_COUNT; i++) {
    assert.ok(!isUnlocked(camp, i), `region ${i} starts locked`);
  }
  assert.equal(totalCleared(camp), 0);
  assert.equal(firstIncomplete(camp), 0);
});

test('clearing regions in order unlocks the next one, one at a time', () => {
  const camp = createCampaign();
  for (let i = 0; i < REGION_COUNT - 1; i++) {
    const res = recordResult(camp, i, { won: true, score: 1500 + i });
    assert.equal(res.openedNext, true, `clearing region ${i} opens region ${i + 1}`);
    assert.ok(isUnlocked(camp, i + 1), `region ${i + 1} is now playable`);
    assert.ok(!isUnlocked(camp, i + 2), 'but the one after stays locked');
    assert.equal(firstIncomplete(camp), i + 1);
  }
  recordResult(camp, REGION_COUNT - 1, { won: true, score: 3000 });
  assert.equal(totalCleared(camp), REGION_COUNT);
  // A finished route replays its last grove.
  assert.equal(firstIncomplete(camp), REGION_COUNT - 1);
});

test('losing a run never unlocks anything', () => {
  const camp = createCampaign();
  const res = recordResult(camp, 0, { won: false, score: 800 });
  assert.equal(res.openedNext, false);
  assert.ok(!isUnlocked(camp, 1));
  assert.equal(totalCleared(camp), 0);
});

test('results for locked regions are ignored outright', () => {
  const camp = createCampaign();
  const res = recordResult(camp, 2, { won: true, score: 2000 });
  assert.equal(res.newBest, false, 'an ignored result claims no new best');
  assert.equal(res.openedNext, false, 'an ignored result opens nothing');
  assert.ok(!camp.regions[2].cleared, 'a locked region cannot be cleared out of order');
  assert.equal(camp.regions[2].bestScore, 0, 'no score is recorded for a locked region');
  assert.equal(camp.regions[2].bestGrade, null, 'no grade is recorded for a locked region');
  assert.equal(camp.runs, 0, 'an ignored run is not counted');
  assert.ok(!isUnlocked(camp, 1), 'an uncleared predecessor keeps earlier groves locked');
  assert.ok(!isUnlocked(camp, 2), 'a locked region stays locked');
  assert.ok(!isUnlocked(camp, 3), 'nothing later opens either');
  assert.equal(totalCleared(camp), 0);
  assert.equal(firstIncomplete(camp), 0, 'the route still starts at the first grove');
});

test('isUnlocked requires every predecessor to be cleared', () => {
  const camp = createCampaign();
  recordResult(camp, 0, { won: true, score: 1000 });
  // Hand-craft the non-prefix state the strict chain must reject.
  camp.regions[2].cleared = true;
  assert.ok(isUnlocked(camp, 1), 'region 1 follows a cleared region 0');
  assert.ok(!isUnlocked(camp, 2), 'region 1 still blocks region 2 despite its own clear');
  assert.ok(!isUnlocked(camp, 3), 'a cleared region 2 does not open region 3 through the gap');
  camp.regions[1].cleared = true;
  assert.ok(isUnlocked(camp, 2));
  assert.ok(isUnlocked(camp, 3), 'every predecessor cleared means region 3 opens');
  assert.ok(!isUnlocked(camp, 4), 'region 4 still waits for region 3');
});

// ------------------------------------------------- records, bests, grades

test('best score and best grade never regress', () => {
  const camp = createCampaign();
  recordResult(camp, 0, { won: false, score: 2000 }); // grade B
  assert.equal(camp.regions[0].bestScore, 2000);
  assert.equal(camp.regions[0].bestGrade, 'B');

  const worse = recordResult(camp, 0, { won: false, score: 900 }); // grade D
  assert.equal(worse.newBest, false);
  assert.equal(camp.regions[0].bestScore, 2000, 'a lower score is not kept');
  assert.equal(camp.regions[0].bestGrade, 'B', 'a lower grade is not kept');

  const better = recordResult(camp, 0, { won: false, score: 3500 }); // grade S
  assert.equal(better.newBest, true);
  assert.equal(camp.regions[0].bestScore, 3500);
  assert.equal(camp.regions[0].bestGrade, 'S', 'a better grade replaces the old one');
});

test('grade ranks order from S down and every run counts', () => {
  assert.equal(gradeRank('S'), 0);
  assert.ok(gradeRank('A') < gradeRank('B'));
  assert.ok(gradeRank('B') < gradeRank('C'));
  assert.ok(gradeRank('C') < gradeRank('D'));
  assert.ok(gradeRank('Z') >= gradeRank('D'), 'unknown letters rank last');
  const camp = createCampaign();
  recordResult(camp, 0, { won: true, score: 100 });
  recordResult(camp, 0, { won: true, score: 200 });
  assert.equal(camp.runs, 2, 'recordResult counts every finished run');
});

// ------------------------------------------------------- save round-trip

test('the save round-trips exactly through serialize/deserialize', () => {
  const camp = createCampaign();
  recordResult(camp, 0, { won: true, score: 3120 });
  recordResult(camp, 1, { won: false, score: 1450 });
  recordResult(camp, 1, { won: true, score: 2680 });
  camp.runs = 3;
  const back = deserialize(serialize(camp));
  assert.deepEqual(back, camp, 'the save string restores the same campaign');
  assert.equal(back.runs, 3);
});

test('malformed, mistyped or tampered saves are rejected with null', () => {
  const good = createCampaign();
  recordResult(good, 0, { won: true, score: 2600 });
  const goodText = serialize(good);

  const tampered = (mutate) => {
    const raw = JSON.parse(goodText);
    mutate(raw);
    return JSON.stringify(raw);
  };

  const rejected = {
    'not JSON at all': '{oops',
    'empty string': '',
    'JSON null': 'null',
    'a bare number': '7',
    'a top-level array': '[]',
    'missing version': '{"regions":[]}',
    'wrong version': tampered((r) => {
      r.version = SAVE_VERSION - 1;
    }),
    'regions not an array': '{"version":2,"regions":{}}',
    'too few regions': '{"version":2,"regions":[]}',
    'too many regions': tampered((r) => {
      r.regions.push({ cleared: false, bestScore: 0, bestGrade: null });
    }),
    'region entry is an array': tampered((r) => {
      r.regions[0] = [true, 10, 'S'];
    }),
    'cleared is not a boolean': tampered((r) => {
      r.regions[1].cleared = 'yes';
    }),
    'bestScore is not a number': tampered((r) => {
      r.regions[1].bestScore = 'lots';
    }),
    'bestScore is negative': tampered((r) => {
      r.regions[1].bestScore = -5;
    }),
    'bestScore is not finite': tampered((r) => {
      r.regions[1].bestScore = Number.POSITIVE_INFINITY;
    }),
    'bestGrade is an unknown letter': tampered((r) => {
      r.regions[1].bestGrade = 'X';
    }),
    'bestGrade is a number': tampered((r) => {
      r.regions[1].bestGrade = 3;
    }),
    'a non-prefix clear state (0 and 2 cleared, 1 not)': tampered((r) => {
      r.regions[2].cleared = true;
    }),
  };

  for (const [name, text] of Object.entries(rejected)) {
    assert.equal(deserialize(text), null, `${name} must be rejected`);
  }
  assert.notEqual(deserialize(goodText), null, 'the honest save still reads back');
});

test('saves with a non-prefix clear state are rejected with null', () => {
  const build = (cleared) => {
    const camp = createCampaign();
    camp.regions.forEach((r, i) => {
      r.cleared = cleared[i];
    });
    return serialize(camp);
  };
  // Regions 0 and 2 cleared while region 1 is not — a gap in the chain.
  assert.equal(deserialize(build([true, false, true, false])), null, 'a mid-chain gap is rejected');
  assert.equal(deserialize(build([false, false, true, false])), null, 'a cleared region 0 successor is rejected');
  assert.equal(deserialize(build([false, true, true, true])), null, 'clears without the first region are rejected');
  // Valid prefixes still load.
  assert.notEqual(deserialize(build([true, true, false, false])), null, 'a prefix of clears reads back');
  assert.notEqual(deserialize(build([true, true, true, true])), null, 'a fully cleared save reads back');
});

// ------------------------------------------- firstIncomplete / totalCleared

test('firstIncomplete and totalCleared track the route honestly', () => {
  const camp = createCampaign();
  assert.equal(firstIncomplete(camp), 0);
  recordResult(camp, 0, { won: true, score: 1000 });
  assert.equal(firstIncomplete(camp), 1);
  assert.equal(totalCleared(camp), 1);
  recordResult(camp, 1, { won: true, score: 1000 });
  assert.equal(firstIncomplete(camp), 2);
  assert.equal(totalCleared(camp), 2);
  recordResult(camp, 1, { won: false, score: 500 });
  assert.equal(firstIncomplete(camp), 2, 'a loss does not move the frontier');
  assert.equal(totalCleared(camp), 2);
});

// ------------------------------------------------ deterministic weighting

test('pickWeighted is deterministic for a given rng state', () => {
  const a = createRng(11);
  const b = createRng(11);
  const table = { drifter: 3, lunger: 1, orbiter: 1 };
  const seqA = [];
  const seqB = [];
  for (let i = 0; i < 200; i++) {
    seqA.push(pickWeighted(a, table));
    seqB.push(pickWeighted(b, table));
  }
  assert.deepEqual(seqA, seqB, 'same seed, same picks');
  assert.ok(seqA.includes('drifter'), 'weighted tables produce their kinds');
  const other = [];
  const c = createRng(12);
  for (let i = 0; i < 200; i++) other.push(pickWeighted(c, table));
  assert.notDeepEqual(seqA, other, 'a different seed picks differently');
});

test('pickWeighted never picks a zero-weight kind and handles an empty table', () => {
  const rng = createRng(5);
  for (let i = 0; i < 100; i++) assert.equal(pickWeighted(rng, { a: 0, b: 2 }), 'b');
  assert.equal(pickWeighted(createRng(6), { a: 0, b: 0 }), null);
});

// --------------------------------------------- per-region seed targets

test('regions 2 and 3 need every one of their seeds — 12 is not enough', () => {
  const targets = [13, 14];
  for (const idx of [2, 3]) {
    const region = REGIONS[idx];
    assert.equal(region.seeds, targets[idx - 2], `${region.name} requires ${targets[idx - 2]} seeds`);

    const w = createWorld(4242, idx);
    startRun(w);
    assert.equal(w.seeds.length, region.seeds, 'the run lays out exactly the region’s seeds');

    for (let i = 1; i <= region.seeds; i++) {
      const s = w.seeds.find((seed) => !seed.taken);
      w.player.x = s.x;
      w.player.y = s.y;
      w.player.invuln = 999; // walk the route without hazard interference
      const events = stepWorld(w, IDLE, STEP);
      assert.equal(w.collected, i);
      if (i < region.seeds) {
        assert.equal(w.phase, PHASE.RUNNING, `${i}/${region.seeds} is not a win`);
        assert.ok(!events.some((e) => e.type === 'win'));
        if (i === C.TOTAL_SEEDS) {
          // The old shared TOTAL_SEEDS threshold would have ended the run here.
          assert.ok(w.collected < region.seeds, 'region still short of its own target');
        }
      } else {
        assert.equal(w.phase, PHASE.WON, `the ${region.seeds}th seed wins the region`);
        assert.ok(events.some((e) => e.type === 'win'));
        assert.ok(w.stats.timeBonus > 0, 'a won region pays its time bonus');
      }
    }
  }
});

// ------------------------------------------------------------ ember + flare

/** The graze band sits between contact and contact + reach. */
function grazeDist(b) {
  return b.r + C.PLAYER.r - C.BRAMBLE.contact + C.NEAR_MISS.reach / 2;
}

test('grazes charge the ember to its cap and fire emberFull exactly once', () => {
  const w = createWorld(31, 0); // hollow: 3 starting brambles
  startRun(w);
  clearSeeds(w);
  w.brambles.forEach((b, i) => {
    const a = (i / w.brambles.length) * Math.PI * 2;
    const d = grazeDist(b);
    pinBramble(b, w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d);
  });

  const events = stepWorld(w, IDLE, STEP);
  assert.equal(w.stats.nearMisses, w.brambles.length, 'every pinned hazard grazed once');
  assert.equal(w.ember, C.EMBER.max, 'three close grazes fill the ember');
  assert.equal(events.filter((e) => e.type === 'emberFull').length, 1, 'one full-charge event');

  // Another graze cannot overcharge, and cannot re-fire the full event.
  w.brambles[0].nearMissed = false;
  w.brambles.forEach((b, i) => {
    const a = (i / w.brambles.length) * Math.PI * 2 + 0.4;
    pinBramble(b, w.player.x + Math.cos(a) * grazeDist(b), w.player.y + Math.sin(a) * grazeDist(b));
  });
  const again = stepWorld(w, IDLE, STEP);
  assert.equal(w.ember, C.EMBER.max, 'the ember stays capped');
  assert.equal(again.filter((e) => e.type === 'emberFull').length, 0, 'no second full event');
});

test('the flare does nothing until the ember is full', () => {
  const w = createWorld(32, 0);
  startRun(w);
  clearSeeds(w);
  // Parked outside the graze band, so this step does not also graze.
  const b = pinBramble(w.brambles[0], w.player.x + 150, w.player.y);
  w.ember = C.EMBER.grazeGain; // charged, not full
  const events = stepWorld(w, { ...IDLE, flare: true }, STEP);
  assert.ok(!events.some((e) => e.type === 'flare'), 'no flare event');
  assert.equal(w.ember, C.EMBER.grazeGain, 'the ember is not spent');
  assert.equal(b.stun, 0, 'no hazard is stilled');
  assert.equal(w.flareTimer, 0);
  assert.equal(w.stats.flares, 0);
});

test('a full ember flares: stuns, points, invulnerability, and is spent', () => {
  const w = createWorld(33, 0);
  startRun(w);
  clearSeeds(w);
  w.ember = C.EMBER.max;
  // Two brambles inside the flare radius (but outside the graze band), the
  // rest parked far away in the corners.
  const [inner0, inner1] = w.brambles;
  pinBramble(inner0, w.player.x + 120, w.player.y);
  pinBramble(inner1, w.player.x, w.player.y + 180);
  const far = w.brambles.slice(2);
  far.forEach((b, i) => pinBramble(b, i % 2 ? C.FIELD.x0 + 60 : C.FIELD.x1 - 60, i < 2 ? C.FIELD.y0 + 60 : C.FIELD.y1 - 60));
  const inside = w.brambles.filter(
    (b) => Math.hypot(b.x - w.player.x, b.y - w.player.y) <= C.EMBER.flareRadius + b.r,
  );
  assert.equal(inside.length, 2, 'test arrangement: two brambles in range');

  const scoreBefore = w.score;
  const events = stepWorld(w, { ...IDLE, flare: true }, STEP);
  const flare = events.find((e) => e.type === 'flare');
  assert.ok(flare, 'the flare fires');
  assert.equal(flare.stilled, 2);
  assert.equal(flare.points, 2 * C.EMBER.stunPoints);
  assert.equal(w.score, scoreBefore + 2 * C.EMBER.stunPoints, 'stilled brambles pay points');
  assert.equal(w.ember, 0, 'the ember is spent');
  assert.equal(w.flareTimer, C.EMBER.flareActive, 'the flare ring shows');
  // tryFlare grants flareInvuln, then the same fixed step decrements it by
  // STEP — so one stepWorld later it is still active but slightly less.
  assert.ok(w.player.invuln > 0, 'the flare invulnerability is still active');
  assert.ok(
    w.player.invuln >= C.EMBER.flareInvuln - STEP - 1e-9,
    'the flare grants its invulnerability, less the elapsed step',
  );
  assert.equal(w.stats.flares, 1);
  assert.equal(w.stats.stilled, 2);
  for (const b of inside) {
    assert.ok(b.stun >= C.EMBER.stunTime - STEP - 1e-9, 'in-range brambles are still stilled for the remaining duration');
  }
  for (const b of far) assert.equal(b.stun, 0, 'distant brambles are untouched');

  // Immediately pressing flare again does nothing: no ember and it is active.
  const second = stepWorld(w, { ...IDLE, flare: true }, STEP);
  assert.ok(!second.some((e) => e.type === 'flare'), 'one shot per charge');
  assert.equal(w.stats.flares, 1);
});

test('stunned hazards are inert: they freeze, never sting and pay no near miss', () => {
  const w = createWorld(34, 0);
  startRun(w);
  clearSeeds(w);
  // Park the bystanders far away; only the stunned bramble matters here.
  w.brambles.slice(1).forEach((b, i) =>
    pinBramble(b, i % 2 ? C.FIELD.x0 + 60 : C.FIELD.x1 - 60, C.FIELD.y1 - 60),
  );
  const b = pinBramble(w.brambles[0], w.player.x + 150, w.player.y);
  b.stun = C.EMBER.stunTime;
  w.player.invuln = 0;
  const scoreBefore = w.score;
  const heartsBefore = w.hearts;
  const pos = { x: b.x, y: b.y };
  for (let i = 0; i < 90; i++) {
    const events = stepWorld(w, IDLE, STEP);
    assert.ok(!events.some((e) => e.type === 'hit'), 'a stunned bramble never stings');
    if (w.phase !== PHASE.RUNNING) break;
  }
  assert.equal(w.hearts, heartsBefore);
  assert.equal(b.x, pos.x, 'a stunned bramble does not move');
  assert.equal(b.y, pos.y);
  assert.equal(w.stats.nearMisses, 0, 'no near-miss credit from a frozen hazard');
  assert.equal(w.score, scoreBefore);

  // Even sitting directly on top of it, the courier takes nothing.
  w.player.x = b.x;
  w.player.y = b.y;
  const events = stepWorld(w, IDLE, STEP);
  assert.ok(!events.some((e) => e.type === 'hit'), 'contact with a stunned bramble is harmless');
  assert.equal(w.hearts, heartsBefore);
});

// Mosslight Courier — world simulation.
//
// A pure, deterministic module: no document, no window, no timers. It is
// imported by the browser (game) and by Node (tests) alike. Every step takes
// a plain input object { axisX, axisY, dash } and a fixed timestep, and the
// same seed and inputs always produce the same run.

import { createRng } from './rng.js';
import * as C from './config.js';

export const PHASE = {
  MENU: 'menu',
  RUNNING: 'running',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost',
};

const PI2 = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function freshStats() {
  return {
    seedsCollected: 0,
    maxCombo: 0,
    nearMisses: 0,
    hitsTaken: 0,
    dashesUsed: 0,
    blooms: 0,
    timeBonus: 0,
  };
}

/** A fresh world in the MENU phase. Spawns happen in startRun. */
export function createWorld(seed = 1) {
  return {
    seed: seed >>> 0,
    rng: createRng(seed >>> 0),
    phase: PHASE.MENU,
    elapsed: 0,
    timeLeft: C.RUN_SECONDS,
    hearts: C.MAX_HEARTS,
    collected: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    stage: 0,
    loseReason: null,
    bloom: null,
    bloomTimer: C.BLOOM.intervalMin,
    player: {
      x: (C.FIELD.x0 + C.FIELD.x1) / 2,
      y: (C.FIELD.y0 + C.FIELD.y1) / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      dashTime: 0,
      dashCooldown: 0,
      dashDirX: 0,
      dashDirY: -1,
      invuln: 0,
    },
    seeds: [],
    brambles: [],
    stats: freshStats(),
    events: [],
  };
}

/** Points a collect at streak `combo` (1-based) is worth. */
export function comboPoints(combo) {
  return Math.min(C.SCORE.seedBase + C.SCORE.seedStep * Math.max(0, combo - 1), C.SCORE.seedCap);
}

/** Letter grade for a finished run's score. */
export function gradeFor(score) {
  for (const g of C.GRADES) if (score >= g.min) return g.letter;
  return 'D';
}

/** Plain stats object for the results screen. */
export function runSummary(world) {
  return {
    won: world.phase === PHASE.WON,
    loseReason: world.loseReason,
    score: world.score,
    collected: world.collected,
    total: C.TOTAL_SEEDS,
    maxCombo: world.stats.maxCombo,
    nearMisses: world.stats.nearMisses,
    hitsTaken: world.stats.hitsTaken,
    dashesUsed: world.stats.dashesUsed,
    blooms: world.stats.blooms,
    timeBonus: world.stats.timeBonus,
    timeLeft: Math.max(0, world.timeLeft),
    hearts: world.hearts,
  };
}

// ---------------------------------------------------------------- spawning

/**
 * A fair seeded position: far enough from the courier and from every other
 * listed spot. Tries up to 60 rolls, then keeps the roomiest candidate.
 */
function fairPosition(world, opts) {
  let best = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = world.rng.range(C.FIELD.x0 + 44, C.FIELD.x1 - 44);
    const y = world.rng.range(C.FIELD.y0 + 44, C.FIELD.y1 - 44);
    const dPlayer = Math.hypot(x - world.player.x, y - world.player.y);
    let dOther = Infinity;
    let blocked = dPlayer < opts.minPlayer;
    for (const o of opts.others) {
      if (o.taken) continue;
      const d = Math.hypot(x - o.x, y - o.y);
      if (d < opts.minOther) blocked = true;
      if (d < dOther) dOther = d;
    }
    if (!blocked) return { x, y };
    const roominess = Math.min(dPlayer, dOther);
    if (roominess > bestScore) {
      bestScore = roominess;
      best = { x, y };
    }
  }
  return best ?? { x: (C.FIELD.x0 + C.FIELD.x1) / 2, y: (C.FIELD.y0 + C.FIELD.y1) / 2 };
}

function spawnBramble(world) {
  const kind = world.rng.pick(C.BRAMBLE.kinds);
  const pos = fairPosition(world, {
    minPlayer: C.BRAMBLE.minSpawnDist,
    others: world.brambles,
    minOther: 180,
  });
  const b = {
    kind,
    r: C.BRAMBLE.radius[kind],
    x: pos.x,
    y: pos.y,
    nearMissed: false,
    spin: world.rng.range(0, PI2),
  };
  if (kind === 'drifter') {
    b.heading = world.rng.range(0, PI2);
    b.speed = world.rng.range(46, 74);
  } else if (kind === 'lunger') {
    b.state = 'idle';
    b.timer = world.rng.range(0.5, 1.6);
    b.lockX = 0;
    b.lockY = 0;
  } else {
    b.cx = pos.x;
    b.cy = pos.y;
    b.orbit = world.rng.range(64, 116);
    b.angVel = (world.rng.chance(0.5) ? 1 : -1) * world.rng.range(0.9, 1.5);
    b.angle = world.rng.range(0, PI2);
  }
  world.brambles.push(b);
  return b;
}

/** Begins a run: resets the field and lays out seeds and hazards fairly. */
export function startRun(world) {
  world.phase = PHASE.RUNNING;
  world.elapsed = 0;
  world.timeLeft = C.RUN_SECONDS;
  world.hearts = C.MAX_HEARTS;
  world.collected = 0;
  world.score = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.stage = 0;
  world.loseReason = null;
  world.stats = freshStats();
  world.events = [];
  world.player.x = (C.FIELD.x0 + C.FIELD.x1) / 2;
  world.player.y = (C.FIELD.y0 + C.FIELD.y1) / 2;
  world.player.vx = 0;
  world.player.vy = 0;
  world.player.angle = -Math.PI / 2;
  world.player.dashTime = 0;
  world.player.dashCooldown = 0;
  world.player.invuln = 0;
  world.seeds = [];
  world.brambles = [];
  world.bloom = null;
  for (let i = 0; i < C.TOTAL_SEEDS; i++) {
    const pos = fairPosition(world, {
      minPlayer: C.SEED.minPlayerDist,
      others: world.seeds,
      minOther: C.SEED.minSpacing,
    });
    world.seeds.push({ x: pos.x, y: pos.y, taken: false, twinkle: world.rng.range(0, PI2) });
  }
  for (let i = 0; i < C.BRAMBLE.initial; i++) spawnBramble(world);
  world.bloomTimer = world.rng.range(C.BLOOM.intervalMin, C.BLOOM.intervalMax);
  world.events.push({ type: 'start' });
}

// ---------------------------------------------------------------- stepping

export function stepWorld(world, input, dt) {
  const events = (world.events = []);
  if (world.phase !== PHASE.RUNNING) return events;
  const step = Math.min(dt, 1 / 20); // clamp long frames for stability
  world.elapsed += step;
  world.timeLeft -= step;

  // Gentle escalation: every stage adds one hazard and speeds them up.
  const targetStage = Math.min(C.BRAMBLE.max - C.BRAMBLE.initial, Math.floor(world.elapsed / C.BRAMBLE.stageEvery));
  while (world.stage < targetStage) {
    world.stage++;
    spawnBramble(world);
    events.push({ type: 'stage', stage: world.stage });
  }

  updatePlayer(world, input, step, events);
  updateBrambles(world, step, events);
  if (world.phase !== PHASE.RUNNING) return events; // a lost run stops changing
  updateBloom(world, step, events);

  if (world.combo > 0) {
    world.comboTimer -= step;
    if (world.comboTimer <= 0) {
      world.combo = 0;
      world.comboTimer = 0;
      events.push({ type: 'comboEnd' });
    }
  }

  collectSeeds(world, events);

  if (world.phase === PHASE.RUNNING && world.timeLeft <= 0) {
    world.timeLeft = 0;
    world.phase = PHASE.LOST;
    world.loseReason = 'time';
    events.push({ type: 'lose', reason: 'time', x: world.player.x, y: world.player.y });
  }
  return events;
}

function updatePlayer(world, input, dt, events) {
  const p = world.player;
  let ax = clamp(Number(input.axisX) || 0, -1, 1);
  let ay = clamp(Number(input.axisY) || 0, -1, 1);
  const len = Math.hypot(ax, ay);
  if (len > 1) {
    ax /= len;
    ay /= len;
  }

  // Dash: a short burst with brief invulnerability, on a visible cooldown.
  if (input.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
    if (len > 0.05) {
      p.dashDirX = ax / len;
      p.dashDirY = ay / len;
    } else {
      p.dashDirX = Math.cos(p.angle);
      p.dashDirY = Math.sin(p.angle);
    }
    p.dashTime = C.PLAYER.dashTime;
    p.dashCooldown = C.PLAYER.dashCooldown;
    p.invuln = Math.max(p.invuln, C.PLAYER.dashInvuln);
    world.stats.dashesUsed++;
    events.push({ type: 'dash', x: p.x, y: p.y, dirX: p.dashDirX, dirY: p.dashDirY });
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashDirX * C.PLAYER.dashSpeed;
    p.vy = p.dashDirY * C.PLAYER.dashSpeed;
  } else {
    const k = Math.min(1, dt * C.PLAYER.steer);
    p.vx += (ax * C.PLAYER.maxSpeed - p.vx) * k;
    p.vy += (ay * C.PLAYER.maxSpeed - p.vy) * k;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x < C.FIELD.x0) {
    p.x = C.FIELD.x0;
    p.vx = 0;
  } else if (p.x > C.FIELD.x1) {
    p.x = C.FIELD.x1;
    p.vx = 0;
  }
  if (p.y < C.FIELD.y0) {
    p.y = C.FIELD.y0;
    p.vy = 0;
  } else if (p.y > C.FIELD.y1) {
    p.y = C.FIELD.y1;
    p.vy = 0;
  }

  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 20) p.angle = Math.atan2(p.vy, p.vx);
}

function updateBrambles(world, dt, events) {
  const p = world.player;
  const m = 1 + world.stage * C.BRAMBLE.speedRamp;
  for (const b of world.brambles) {
    b.spin += dt;
    if (b.kind === 'drifter') {
      b.heading += world.rng.range(-0.9, 0.9) * dt;
      b.x += Math.cos(b.heading) * b.speed * m * dt;
      b.y += Math.sin(b.heading) * b.speed * m * dt;
      if (b.x < C.FIELD.x0) {
        b.x = C.FIELD.x0;
        b.heading = Math.PI - b.heading;
      } else if (b.x > C.FIELD.x1) {
        b.x = C.FIELD.x1;
        b.heading = Math.PI - b.heading;
      }
      if (b.y < C.FIELD.y0) {
        b.y = C.FIELD.y0;
        b.heading = -b.heading;
      } else if (b.y > C.FIELD.y1) {
        b.y = C.FIELD.y1;
        b.heading = -b.heading;
      }
    } else if (b.kind === 'lunger') {
      b.timer -= dt;
      if (b.state === 'idle') {
        if (b.timer <= 0) {
          b.state = 'telegraph';
          b.timer = 0.7;
        }
      } else if (b.state === 'telegraph') {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const l = Math.hypot(dx, dy) || 1;
        b.lockX = dx / l;
        b.lockY = dy / l;
        if (b.timer <= 0) {
          b.state = 'lunge';
          b.timer = 0.35;
        }
      } else {
        b.x += b.lockX * 470 * m * dt;
        b.y += b.lockY * 470 * m * dt;
        b.x = clamp(b.x, C.FIELD.x0, C.FIELD.x1);
        b.y = clamp(b.y, C.FIELD.y0, C.FIELD.y1);
        if (b.timer <= 0) {
          b.state = 'idle';
          b.timer = world.rng.range(1.2, 2.1);
        }
      }
    } else {
      b.angle += b.angVel * m * dt;
      b.x = clamp(b.cx + Math.cos(b.angle) * b.orbit, C.FIELD.x0, C.FIELD.x1);
      b.y = clamp(b.cy + Math.sin(b.angle) * b.orbit, C.FIELD.y0, C.FIELD.y1);
    }

    // Contact and near-miss checks, shared by every kind.
    const hitR = b.r + C.PLAYER.r - C.BRAMBLE.contact;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < hitR) {
      if (p.invuln <= 0) {
        world.hearts--;
        world.stats.hitsTaken++;
        world.combo = 0;
        world.comboTimer = 0;
        p.invuln = C.PLAYER.hitInvuln;
        const nx = (p.x - b.x) / (d || 1);
        const ny = (p.y - b.y) / (d || 1);
        p.vx = nx * 260;
        p.vy = ny * 260;
        events.push({ type: 'hit', x: p.x, y: p.y, hearts: world.hearts });
        if (world.hearts <= 0) {
          world.hearts = 0;
          world.phase = PHASE.LOST;
          world.loseReason = 'hearts';
          events.push({ type: 'lose', reason: 'hearts', x: p.x, y: p.y });
          return;
        }
      }
    } else if (!b.nearMissed && d < hitR + C.NEAR_MISS.reach) {
      // A close pass is worth +35 once per hazard per run.
      b.nearMissed = true;
      world.score += C.SCORE.nearMiss;
      world.stats.nearMisses++;
      events.push({ type: 'near', x: (b.x + p.x) / 2, y: (b.y + p.y) / 2, points: C.SCORE.nearMiss });
    }
  }
}

function updateBloom(world, dt, events) {
  const p = world.player;
  if (world.bloom) {
    const bloom = world.bloom;
    bloom.life -= dt;
    bloom.spin += dt * 2;
    if (bloom.life <= 0) {
      world.bloom = null;
      events.push({ type: 'bloomFade' });
    } else if (Math.hypot(bloom.x - p.x, bloom.y - p.y) <= C.BLOOM.pickup) {
      world.stats.blooms++;
      if (world.hearts < C.MAX_HEARTS) {
        world.hearts++;
        events.push({ type: 'heal', x: bloom.x, y: bloom.y, hearts: world.hearts });
      } else {
        world.score += C.SCORE.bloomFullHealth;
        events.push({ type: 'bloomFull', x: bloom.x, y: bloom.y, points: C.SCORE.bloomFullHealth });
      }
      world.bloom = null;
    }
  } else {
    world.bloomTimer -= dt;
    if (world.bloomTimer <= 0) {
      const pos = fairPosition(world, {
        minPlayer: C.BLOOM.minPlayerDist,
        others: world.seeds,
        minOther: 90,
      });
      world.bloom = { x: pos.x, y: pos.y, life: C.BLOOM.life, spin: 0 };
      world.bloomTimer = world.rng.range(C.BLOOM.intervalMin, C.BLOOM.intervalMax);
      events.push({ type: 'bloom', x: pos.x, y: pos.y });
    }
  }
}

function collectSeeds(world, events) {
  const p = world.player;
  for (const s of world.seeds) {
    if (s.taken) continue;
    if (Math.hypot(s.x - p.x, s.y - p.y) <= C.SEED.pickup) {
      s.taken = true;
      world.collected++;
      world.combo++;
      world.comboTimer = C.COMBO.window;
      world.stats.seedsCollected++;
      world.stats.maxCombo = Math.max(world.stats.maxCombo, world.combo);
      const pts = comboPoints(world.combo);
      world.score += pts;
      events.push({ type: 'collect', x: s.x, y: s.y, combo: world.combo, points: pts });
      if (world.collected >= C.TOTAL_SEEDS) {
        world.stats.timeBonus = Math.round(Math.max(0, world.timeLeft) * C.SCORE.timeBonusPerSecond);
        world.score += world.stats.timeBonus;
        world.phase = PHASE.WON;
        events.push({ type: 'win', x: p.x, y: p.y, timeBonus: world.stats.timeBonus });
        return;
      }
    }
  }
}

// ---------------------------------------------------------------- pause

/** Freezes a running world or thaws a paused one; a finished run is untouched. */
export function togglePause(world) {
  if (world.phase === PHASE.RUNNING) {
    world.phase = PHASE.PAUSED;
    world.events.push({ type: 'pause' });
  } else if (world.phase === PHASE.PAUSED) {
    world.phase = PHASE.RUNNING;
    world.events.push({ type: 'resume' });
  }
  return world.phase;
}

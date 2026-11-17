// Mosslight Courier — the three regional field mechanics (V3 draft).
//
// Each later grove runs one telegraphed field hazard on its own seeded clock:
//   Ambershard Wastes — the shard gust shoves the lantern downwind;
//   Tideglum Depths   — the glum tide sweeps a glowing wall across the grove;
//   Umbral Crown      — umbra snares erupt inside a warned violet ring.
// Mosslight Hollow stays the mechanic-free baseline players learn on.
//
// Pure simulation: every timing and placement roll comes from the world's own
// seeded RNG, so a given seed always produces the same schedule. Damage always
// flows through the shared one-heart rule the brambles use. No DOM access.

import * as C from './config.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A fresh biome state for a run, or null for the mechanic-free hollow. */
export function initBiome(world) {
  const m = world.region.mechanic;
  if (!m) return null;
  return {
    id: m.id,
    mechanic: m, // shared, read-only tuning from the region kit
    phase: 'idle', // idle → warn → active (gust/tide) or flash (snare) → idle
    timer: m.firstDelay,
    dir: 0, // gust push direction (+1 east, -1 west)
    side: 0, // tide origin side (+1 from the east, -1 from the west)
    wallX: 0, // the tide wall's leading edge
    x: 0,
    y: 0,
    r: 0, // a snare's ring
    hit: false, // the current cycle caught the courier
  };
}

/**
 * Advances one regional mechanic by one fixed step.
 *
 * `hurt(world, srcX, srcY, events)` is the world's shared damage rule: it
 * costs exactly one heart, breaks the combo, knocks back and opens the same
 * invulnerability window a bramble hit would — and it refuses to act while
 * the courier is invulnerable, so dashing through a tide or a snare is real
 * counterplay. It returns true when damage landed.
 *
 * Every cycle telegraphs first (warn), then acts, so nothing ever costs a
 * heart without a visible, timed tell.
 */
export function updateBiome(world, dt, events, hurt) {
  const b = world.biome;
  if (!b) return;
  const m = b.mechanic;
  const p = world.player;
  b.timer -= dt;

  if (b.phase === 'idle') {
    if (b.timer > 0) return;
    b.timer = 0;
    if (m.id === 'gust') {
      b.phase = 'warn';
      b.timer = m.warn;
      b.dir = world.rng.chance(0.5) ? 1 : -1;
      events.push({ type: 'gustWarn', dir: b.dir });
    } else if (m.id === 'tide') {
      b.phase = 'warn';
      b.timer = m.warn;
      b.side = world.rng.chance(0.5) ? 1 : -1;
      events.push({ type: 'tideWarn', side: b.side });
    } else {
      // A snare rings out near the courier — close enough to matter, never
      // exactly on top of them, and always escapable inside the warning.
      b.phase = 'warn';
      b.timer = m.warn;
      const a = world.rng.range(0, Math.PI * 2);
      const d = world.rng.range(40, m.maxOffset);
      b.x = clamp(p.x + Math.cos(a) * d, C.FIELD.x0 + 30, C.FIELD.x1 - 30);
      b.y = clamp(p.y + Math.sin(a) * d, C.FIELD.y0 + 30, C.FIELD.y1 - 30);
      b.r = m.radius;
      b.hit = false;
      events.push({ type: 'snareWarn', x: b.x, y: b.y, r: b.r });
    }
    return;
  }

  if (b.phase === 'warn') {
    if (b.timer > 0) return;
    b.timer = 0;
    if (m.id === 'gust') {
      b.phase = 'active';
      b.timer = m.active;
      b.hit = false;
      events.push({ type: 'gust', dir: b.dir, x: p.x, y: p.y });
    } else if (m.id === 'tide') {
      b.phase = 'active';
      b.hit = false;
      b.wallX = b.side > 0 ? C.FIELD.x1 + 40 : C.FIELD.x0 - 40;
      events.push({ type: 'tide', side: b.side, x: p.x, y: p.y });
    } else {
      b.phase = 'flash';
      b.timer = m.flash;
      // The ring only catches a courier still inside it when it closes — the
      // shown ring is the truth, minus the shared contact forgiveness. Being
      // invulnerable (a dash) also refuses the hurt below, so counterplay
      // stays real either way.
      const inside = Math.hypot(p.x - b.x, p.y - b.y) <= b.r - C.BRAMBLE.contact;
      const damaged = inside && hurt(world, b.x, b.y, events);
      b.hit = damaged;
      if (!damaged) world.stats.biome++;
      events.push({ type: 'snare', x: b.x, y: b.y, r: b.r, hit: damaged });
    }
    return;
  }

  if (b.phase === 'active') {
    if (m.id === 'gust') {
      // The wind shoves the lantern downwind for the whole active phase.
      p.x = clamp(p.x + b.dir * m.push * dt, C.FIELD.x0, C.FIELD.x1);
      if (b.timer > 0) return;
      b.phase = 'idle';
      b.timer = world.rng.range(m.idleMin, m.idleMax);
      world.stats.biome++;
      events.push({ type: 'gustEnd' });
    } else {
      // The tide wall sweeps across the grove; its band hurts on contact.
      // The damage source sits just upwind of the courier (on the wall's
      // origin side), so the knockback pushes downwind with the tide instead
      // of collapsing to zero at the courier's own position.
      const inBand =
        b.side > 0
          ? p.x >= b.wallX && p.x <= b.wallX + m.thickness
          : p.x <= b.wallX && p.x >= b.wallX - m.thickness;
      if (inBand && hurt(world, p.x + b.side * 40, p.y, events)) b.hit = true;
      b.wallX += -b.side * m.speed * dt;
      const beyond =
        b.side > 0
          ? b.wallX < C.FIELD.x0 - 40 - m.thickness
          : b.wallX > C.FIELD.x1 + 40 + m.thickness;
      if (beyond) {
        b.phase = 'idle';
        b.timer = world.rng.range(m.idleMin, m.idleMax);
        if (!b.hit) world.stats.biome++;
        events.push({ type: 'tideEnd' });
      }
    }
    return;
  }

  // flash: the snare's brief eruption visual, then back to its seeded idle.
  if (b.timer > 0) return;
  b.phase = 'idle';
  b.timer = world.rng.range(m.idleMin, m.idleMax);
}

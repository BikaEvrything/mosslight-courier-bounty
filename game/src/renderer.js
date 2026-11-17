// Mosslight Courier — canvas renderer.
//
// Split into two passes so screenshots read at thumbnail size:
//   renderWorld — scenery and entities, drawn chunky (the caller renders this
//                 into a low-resolution buffer that is blitted back with
//                 image smoothing off, giving a crisp pixel-inspired look);
//   renderUI    — HUD, route map, results and pause screens at full logical
//                 resolution, so every word stays crisp and readable.
//
// Every visual is drawn here with vector paths: no images, no fonts fetched,
// no external assets. The logical canvas is 1280x720.

import * as C from './config.js';
import { createRng } from './rng.js';
import { PHASE, gradeFor, runSummary } from './world.js';
import { REGIONS } from './regions.js';
import { totalCleared } from './campaign.js';

// ---------------------------------------------------------- static scenery
// Fixed-seed tables so the scenery is identical on every machine and in
// every screenshot fixture, independent of the run's own seed.

const sceneryRng = createRng(0x5c0d17);

const STARS = Array.from({ length: 90 }, () => ({
  x: sceneryRng.range(0, C.LOGICAL_W),
  y: sceneryRng.range(0, 430),
  r: sceneryRng.range(0.6, 1.8),
  tw: sceneryRng.range(0, Math.PI * 2),
}));

const FIREFLIES = Array.from({ length: 26 }, () => ({
  x: sceneryRng.range(50, 1230),
  y: sceneryRng.range(160, 650),
  ph: sceneryRng.range(0, Math.PI * 2),
  sp: sceneryRng.range(0.4, 1.1),
  r: sceneryRng.range(1.2, 2.6),
}));

const TUFTS = Array.from({ length: 64 }, () => ({
  x: sceneryRng.range(0, C.LOGICAL_W),
  y: sceneryRng.range(596, 716),
  s: sceneryRng.range(6, 16),
  lean: sceneryRng.range(-0.5, 0.5),
}));

const GLOW_PATCHES = Array.from({ length: 10 }, () => ({
  x: sceneryRng.range(90, 1190),
  y: sceneryRng.range(560, 706),
  r: sceneryRng.range(34, 84),
  flip: sceneryRng.chance(0.6),
}));

const TRUNKS = [
  { x: 34, w: 46, lean: 0.03, canopy: 250 },
  { x: 168, w: 30, lean: -0.02, canopy: 180 },
  { x: 1108, w: 34, lean: 0.02, canopy: 190 },
  { x: 1236, w: 48, lean: -0.03, canopy: 260 },
];

const SHARDS = [
  { x: 40, w: 76, h: 340, lean: 30 },
  { x: 210, w: 44, h: 200, lean: -20 },
  { x: 1064, w: 60, h: 300, lean: -30 },
  { x: 1176, w: 84, h: 410, lean: 36 },
  { x: 610, w: 38, h: 170, lean: 14 },
];

const THORNS = [
  { x: 30, w: 64, h: 390, j: 30 },
  { x: 150, w: 42, h: 240, j: 22 },
  { x: 1096, w: 56, h: 330, j: 26 },
  { x: 1196, w: 74, h: 430, j: 34 },
  { x: 894, w: 36, h: 180, j: 18 },
];

const KELPS = Array.from({ length: 10 }, () => ({
  x: sceneryRng.range(40, 1240),
  h: sceneryRng.range(170, 350),
  ph: sceneryRng.range(0, Math.PI * 2),
  sp: sceneryRng.range(0.5, 1.0),
  amp: sceneryRng.range(10, 26),
  w: sceneryRng.range(5, 9),
  far: sceneryRng.chance(0.5),
}));

const CRATERS = [
  { dx: -18, dy: -12, r: 12 },
  { dx: 14, dy: 6, r: 9 },
  { dx: -4, dy: 22, r: 7 },
];

function rrect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** A hex color like '#rrggbb' at an alpha, for region-accent telegraphs. */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Sets the logical 1280x720 transform for the frame. */
export function setupTransform(ctx, canvas) {
  ctx.setTransform(canvas.width / C.LOGICAL_W, 0, 0, canvas.height / C.LOGICAL_H, 0, 0);
}

/** The active region's palette kit (falls back to the hollow). */
function pal(world) {
  return (REGIONS[world.regionIdx] ?? REGIONS[0]).colors;
}

function regionOf(world) {
  return REGIONS[world.regionIdx] ?? REGIONS[0];
}

// ---------------------------------------------------------------- world pass

function drawSky(ctx, world, t, view) {
  const p = pal(world);
  const g = ctx.createLinearGradient(0, 0, 0, C.LOGICAL_H);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);

  for (const s of STARS) {
    const a = view.reducedMotion ? 0.55 : 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.star;
    circle(ctx, s.x, s.y, s.r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The region's moon or sun with a wide halo and a few soft craters.
  const halo = ctx.createRadialGradient(p.moonX, p.moonY, p.moonR * 0.4, p.moonX, p.moonY, p.moonR * 3.1);
  halo.addColorStop(0, p.moonHalo);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  circle(ctx, p.moonX, p.moonY, p.moonR * 3.1);
  ctx.fill();
  ctx.fillStyle = p.moon;
  circle(ctx, p.moonX, p.moonY, p.moonR);
  ctx.fill();
  ctx.fillStyle = p.moonCrater;
  for (const c of CRATERS) {
    circle(ctx, p.moonX + c.dx, p.moonY + c.dy, c.r);
    ctx.fill();
  }

  // Light rays fanning down through the canopy, where the region has them.
  if (p.ray) {
    ctx.fillStyle = p.ray;
    for (let i = 0; i < 4; i++) {
      const x0 = p.moonX - 152 + i * 64;
      ctx.beginPath();
      ctx.moveTo(p.moonX - 30 + i * 22, p.moonY + 20);
      ctx.lineTo(x0 - 60, C.LOGICAL_H);
      ctx.lineTo(x0 + 70, C.LOGICAL_H);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawProps(ctx, world, t, view, layer) {
  const p = pal(world);
  const kind = regionOf(world).props;
  const sway = view.reducedMotion ? 0 : Math.sin(t * 0.7) * 2;

  if (layer === 'back') {
    if (kind === 'trees') {
      for (const tr of TRUNKS) {
        ctx.fillStyle = p.propFar;
        ctx.beginPath();
        ctx.moveTo(tr.x, C.LOGICAL_H);
        ctx.quadraticCurveTo(tr.x + tr.lean * 300, 420, tr.x + tr.lean * 560, 40);
        ctx.lineTo(tr.x + tr.w + tr.lean * 560, 40);
        ctx.quadraticCurveTo(tr.x + tr.w + tr.lean * 300, 420, tr.x + tr.w, C.LOGICAL_H);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.propNear;
        circle(ctx, tr.x + tr.w / 2 + tr.lean * 520, 70, tr.canopy);
        ctx.fill();
      }
      // Canopy scallop shading the top corners.
      ctx.fillStyle = p.propNear;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(C.LOGICAL_W, 0);
      ctx.lineTo(C.LOGICAL_W, 30);
      ctx.quadraticCurveTo(960, 74, 640, 40);
      ctx.quadraticCurveTo(320, 6, 0, 52);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'shards') {
      for (const s of SHARDS) {
        ctx.fillStyle = p.propNear;
        ctx.beginPath();
        ctx.moveTo(s.x, C.LOGICAL_H);
        ctx.lineTo(s.x + s.w * 0.5 + s.lean, C.LOGICAL_H - s.h);
        ctx.lineTo(s.x + s.w, C.LOGICAL_H);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.propFar;
        ctx.beginPath();
        ctx.moveTo(s.x + s.w * 0.5 + s.lean, C.LOGICAL_H - s.h);
        ctx.lineTo(s.x + s.w * 0.62 + s.lean * 0.4, C.LOGICAL_H - s.h * 0.45);
        ctx.lineTo(s.x + s.w * 0.42, C.LOGICAL_H - s.h * 0.45);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'thorns') {
      for (const s of THORNS) {
        ctx.fillStyle = p.propNear;
        ctx.beginPath();
        ctx.moveTo(s.x, C.LOGICAL_H);
        ctx.lineTo(s.x + s.w * 0.2, C.LOGICAL_H - s.h * 0.35);
        ctx.lineTo(s.x + s.w * 0.45 - s.j, C.LOGICAL_H - s.h * 0.5);
        ctx.lineTo(s.x + s.w * 0.55, C.LOGICAL_H - s.h * 0.8);
        ctx.lineTo(s.x + s.w * 0.5, C.LOGICAL_H - s.h);
        ctx.lineTo(s.x + s.w * 0.75, C.LOGICAL_H - s.h * 0.55);
        ctx.lineTo(s.x + s.w * 0.9, C.LOGICAL_H - s.h * 0.3);
        ctx.lineTo(s.x + s.w, C.LOGICAL_H);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = p.propFar;
        circle(ctx, s.x + s.w * 0.5, C.LOGICAL_H - s.h * 0.92, s.w * 0.35);
        ctx.fill();
      }
    }
    return;
  }

  // Front layer: the drowned grove's kelp sways over the ground.
  if (kind === 'kelp') {
    ctx.lineCap = 'round';
    for (const k of KELPS) {
      const swayX = view.reducedMotion ? 0 : Math.sin(t * k.sp + k.ph) * k.amp;
      ctx.strokeStyle = k.far ? p.propFar : p.propNear;
      ctx.lineWidth = k.w;
      ctx.beginPath();
      ctx.moveTo(k.x, C.LOGICAL_H + 8);
      ctx.quadraticCurveTo(k.x + swayX * 0.4, C.LOGICAL_H - k.h * 0.5, k.x + swayX, C.LOGICAL_H - k.h);
      ctx.stroke();
    }
  }
}

function drawGround(ctx, world, t, view) {
  const p = pal(world);
  const g = ctx.createLinearGradient(0, 590, 0, C.LOGICAL_H);
  g.addColorStop(0, p.groundTop);
  g.addColorStop(1, p.groundBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 590, C.LOGICAL_W, C.LOGICAL_H - 590);

  for (const patch of GLOW_PATCHES) {
    const grad = ctx.createRadialGradient(patch.x, patch.y, 2, patch.x, patch.y, patch.r);
    grad.addColorStop(0, patch.flip ? p.glowB : p.glowA);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    circle(ctx, patch.x, patch.y, patch.r);
    ctx.fill();
  }

  ctx.strokeStyle = p.tuft;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const sway = view.reducedMotion ? 0 : Math.sin(t * 0.7) * 2;
  for (const tf of TUFTS) {
    ctx.beginPath();
    ctx.moveTo(tf.x, tf.y);
    ctx.quadraticCurveTo(tf.x + tf.lean * 6 + sway, tf.y - tf.s * 0.7, tf.x + tf.lean * 12 + sway, tf.y - tf.s);
    ctx.stroke();
  }
}

function drawFireflies(ctx, world, t, view) {
  const p = pal(world);
  for (const f of FIREFLIES) {
    const dx = view.reducedMotion ? 0 : Math.sin(t * f.sp + f.ph) * 14;
    const dy = view.reducedMotion ? 0 : Math.cos(t * f.sp * 0.8 + f.ph) * 9;
    const a = view.reducedMotion ? 0.5 : 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + f.ph * 3));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.seed;
    circle(ctx, f.x + dx, f.y + dy, f.r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- entities

function drawSeeds(ctx, world, t) {
  const p = pal(world);
  for (const s of world.seeds) {
    if (s.taken) continue;
    const pulse = 1 + 0.08 * Math.sin(t * 3 + s.twinkle);
    const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26);
    glow.addColorStop(0, p.seedGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    circle(ctx, s.x, s.y, 26);
    ctx.fill();
    // A dark rim just outside the body keeps every seed readable against the
    // lifted ground and its own glow.
    ctx.strokeStyle = 'rgba(5,9,18,0.8)';
    ctx.lineWidth = 2.5;
    circle(ctx, s.x, s.y, C.SEED.r * pulse + 2);
    ctx.stroke();
    ctx.fillStyle = p.seed;
    ctx.beginPath();
    ctx.arc(s.x, s.y, C.SEED.r * pulse, -0.4 * Math.PI, 0.75 * Math.PI);
    ctx.arc(s.x + 6 * pulse, s.y - 3 * pulse, C.SEED.r * 0.78 * pulse, 0.75 * Math.PI, -0.4 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.COLORS.moon;
    circle(ctx, s.x - 2, s.y - 4, 2.4);
    ctx.fill();
  }
}

function drawBloom(ctx, world, t) {
  const b = world.bloom;
  if (!b) return;
  const fade = b.life < 1.4 ? Math.max(0.25, b.life / 1.4) : 1;
  ctx.globalAlpha = fade;
  const glow = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 34);
  glow.addColorStop(0, 'rgba(255,233,176,0.55)');
  glow.addColorStop(1, 'rgba(255,233,176,0)');
  ctx.fillStyle = glow;
  circle(ctx, b.x, b.y, 34);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  ctx.fillStyle = C.COLORS.goldBright;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, -9, 4.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = C.COLORS.gold;
  circle(ctx, b.x, b.y, 4.5);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBramble(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);

  if (b.stun > 0) {
    // A stilled bramble: dimmed body under a pale, brittle shell.
    ctx.globalAlpha = 0.55;
  }

  if (b.kind === 'lunger') {
    if (b.state === 'telegraph') {
      const k = 1 - Math.max(0, b.timer) / 0.7;
      ctx.strokeStyle = `rgba(255,79,160,${0.25 + 0.5 * k})`;
      ctx.lineWidth = 2;
      circle(ctx, 0, 0, b.r + 10 + 16 * (1 - k));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,79,160,0.35)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(b.lockX * 260, b.lockY * 260);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (b.state === 'lunge') {
      ctx.rotate(Math.atan2(b.lockY, b.lockX));
      ctx.scale(1.35, 0.8);
      ctx.rotate(-Math.atan2(b.lockY, b.lockX));
    }
  }

  const rot = b.kind === 'lunger' ? t * 0.4 : b.spin * 0.9;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, b.r * 2.4);
  glow.addColorStop(0, 'rgba(255,79,160,0.35)');
  glow.addColorStop(1, 'rgba(255,79,160,0)');
  ctx.fillStyle = glow;
  circle(ctx, 0, 0, b.r * 2.4);
  ctx.fill();

  ctx.rotate(rot);
  ctx.fillStyle = C.COLORS.magenta;
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(b.r * 0.35, -b.r * 0.32);
    ctx.lineTo(b.r * 1.45, 0);
    ctx.lineTo(b.r * 0.35, b.r * 0.32);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = C.COLORS.magentaDeep;
  circle(ctx, 0, 0, b.r * 0.78);
  ctx.fill();
  ctx.fillStyle = C.COLORS.magenta;
  circle(ctx, 0, 0, b.r * 0.42);
  ctx.fill();

  if (b.stun > 0) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#cfeaff';
    ctx.lineWidth = 2.5;
    circle(ctx, 0, 0, b.r * 1.25);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * b.r * 1.25, Math.sin(a) * b.r * 1.25);
      ctx.lineTo(Math.cos(a) * b.r * 1.55, Math.sin(a) * b.r * 1.55);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawLantern(ctx, world, t, view) {
  const p = world.player;
  const emberFrac = world.ember / C.EMBER.max;
  const blink = p.invuln > 0 && p.dashTime <= 0 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 14)) : 1;

  ctx.save();
  ctx.globalAlpha = blink;

  // Warm glow around the lantern; a charged ember burns wider and brighter.
  const glowR = 58 + 14 * emberFrac;
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, glowR);
  glow.addColorStop(0, `rgba(255,207,107,${0.5 + 0.3 * emberFrac})`);
  glow.addColorStop(0.55, `rgba(255,207,107,${0.14 + 0.1 * emberFrac})`);
  glow.addColorStop(1, 'rgba(255,207,107,0)');
  ctx.fillStyle = glow;
  circle(ctx, p.x, p.y, glowR);
  ctx.fill();

  // Dash streaks.
  if (p.dashTime > 0) {
    ctx.strokeStyle = 'rgba(255,233,176,0.7)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 1; i <= 3; i++) {
      const bx = p.x - p.dashDirX * i * 16;
      const by = p.y - p.dashDirY * i * 16;
      ctx.globalAlpha = blink * (0.5 - i * 0.13);
      ctx.beginPath();
      ctx.moveTo(bx - p.dashDirY * 5, by + p.dashDirX * 5);
      ctx.lineTo(bx + p.dashDirY * 5, by - p.dashDirX * 5);
      ctx.stroke();
    }
    ctx.globalAlpha = blink;
  }

  // The lantern: warm orb inside a little cage with a handle. A dark rim
  // under the cage separates the silhouette from bright ground below it.
  ctx.strokeStyle = 'rgba(8,6,3,0.5)';
  ctx.lineWidth = 3.5;
  circle(ctx, p.x, p.y, 14.5);
  ctx.stroke();
  ctx.fillStyle = C.COLORS.goldDeep;
  ctx.strokeStyle = C.COLORS.gold;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 16, 6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke(); // handle
  ctx.fillStyle = C.COLORS.goldDeep;
  rrect(ctx, p.x - 8, p.y - 15, 16, 5, 2);
  ctx.fill(); // cap
  rrect(ctx, p.x - 8, p.y + 10, 16, 5, 2);
  ctx.fill(); // base
  ctx.fillStyle = '#fff4d6';
  circle(ctx, p.x, p.y, 10.5);
  ctx.fill();
  ctx.fillStyle = C.COLORS.gold;
  circle(ctx, p.x, p.y, 7);
  ctx.fill();
  ctx.strokeStyle = C.COLORS.goldDeep;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 10);
  ctx.lineTo(p.x, p.y + 10);
  ctx.moveTo(p.x - 6, p.y - 10);
  ctx.lineTo(p.x - 6, p.y + 10);
  ctx.moveTo(p.x + 6, p.y - 10);
  ctx.lineTo(p.x + 6, p.y + 10);
  ctx.stroke();

  // Dash cooldown ring around the lantern.
  if (p.dashCooldown > 0) {
    const frac = 1 - p.dashCooldown / C.PLAYER.dashCooldown;
    ctx.strokeStyle = C.COLORS.tealDim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
  }
  ctx.restore();
}

/** The expanding shockwave ring of a spent flare. */
function drawFlareRing(ctx, world, view) {
  if (world.flareTimer <= 0) return;
  const frac = 1 - world.flareTimer / C.EMBER.flareActive;
  ctx.save();
  if (view.reducedMotion) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff4d6';
    ctx.lineWidth = 4;
    circle(ctx, world.player.x, world.player.y, C.EMBER.flareRadius * 0.85);
    ctx.stroke();
  } else {
    const r = 30 + frac * (C.EMBER.flareRadius - 30);
    ctx.globalAlpha = 0.85 * (1 - frac * 0.6);
    ctx.strokeStyle = '#fff4d6';
    ctx.lineWidth = 5 - frac * 3;
    circle(ctx, world.player.x, world.player.y, r);
    ctx.stroke();
    ctx.globalAlpha = 0.4 * (1 - frac * 0.6);
    ctx.strokeStyle = C.COLORS.gold;
    ctx.lineWidth = 9 - frac * 5;
    circle(ctx, world.player.x, world.player.y, Math.max(10, r - 14));
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft chevron pointing at the nearest uncollected moonseed when it is far. */
function drawSeedPointer(ctx, world) {
  if (world.phase !== PHASE.RUNNING) return;
  let best = null;
  let bd = Infinity;
  for (const s of world.seeds) {
    if (s.taken) continue;
    const d = Math.hypot(s.x - world.player.x, s.y - world.player.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  if (!best || bd <= 340) return;
  const dx = (best.x - world.player.x) / bd;
  const dy = (best.y - world.player.y) / bd;
  const tipX = world.player.x + dx * 54;
  const tipY = world.player.y + dy * 54;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.translate(tipX, tipY);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.fillStyle = pal(world).seed;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -6.5);
  ctx.lineTo(-6, 6.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------- biome telegraphs

/** One filled chevron pointing along `dir` (+1 right, -1 left). */
function drawChevron(ctx, x, y, dir, size, alpha, color) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + dir * size, y);
  ctx.lineTo(x - dir * size * 0.5, y - size * 0.9);
  ctx.lineTo(x - dir * size * 0.5, y + size * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Ambershard: marching chevrons while warning, streaming streaks while blowing. */
function drawGust(ctx, b, t, p) {
  const { x0, y0, x1, y1 } = C.FIELD;
  const midY = (y0 + y1) / 2;
  if (b.phase === 'warn') {
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.4 + i / 3) % 1;
      const x = (x0 + x1) / 2 + b.dir * (k * 240 - 120);
      drawChevron(ctx, x, midY, b.dir, 15, 0.25 + 0.5 * Math.sin(k * Math.PI), p.accent);
    }
  } else if (b.phase === 'active') {
    ctx.save();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const w = x1 - x0;
    for (let i = 0; i < 9; i++) {
      const raw = (t * 300 + i * 167) % w;
      const x = b.dir > 0 ? x0 + raw : x1 - raw;
      const y = y0 + 50 + ((i * 97) % (y1 - y0 - 100));
      ctx.globalAlpha = 0.14 + 0.16 * Math.sin(t * 9 + i * 2.1) ** 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - b.dir * 42, y);
      ctx.stroke();
    }
    // The downwind edge glows: where the wind is pushing you.
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.accent;
    ctx.fillRect(b.dir > 0 ? x1 - 10 : x0, y0, 10, y1 - y0);
    ctx.restore();
  }
}

/** Tideglum: a glowing origin edge while warning, a sweeping wall while active. */
function drawTide(ctx, b, t, p) {
  const { x0, y0, x1, y1 } = C.FIELD;
  const m = b.mechanic;
  const travel = -b.side; // the direction the wall moves
  const midY = (y0 + y1) / 2;
  if (b.phase === 'warn') {
    ctx.save();
    // The origin edge glows, brightest at the field's border, fading inward.
    const g = ctx.createLinearGradient(
      b.side > 0 ? x1 : x0,
      0,
      b.side > 0 ? x1 - 14 : x0 + 14,
      0,
    );
    g.addColorStop(0, p.seedGlow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.side > 0 ? x1 - 14 : x0, y0, 14, y1 - y0);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.4 + i / 3) % 1;
      const x = (x0 + x1) / 2 + travel * (k * 240 - 120);
      drawChevron(ctx, x, midY, travel, 15, 0.25 + 0.5 * Math.sin(k * Math.PI), p.accent);
    }
  } else if (b.phase === 'active') {
    ctx.save();
    const th = m.thickness;
    const bx = b.side > 0 ? b.wallX : b.wallX - th; // band start x
    const ba = Math.max(x0, bx);
    const bb = Math.min(x1, bx + th);
    if (bb > ba) {
      // Band: bright at the leading edge, fading into its trailing tail.
      const g = ctx.createLinearGradient(bx, 0, bx + th, 0);
      g.addColorStop(0, hexA(p.accent, b.side > 0 ? 0.6 : 0.15));
      g.addColorStop(1, hexA(p.accent, b.side > 0 ? 0.15 : 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(ba, y0, bb - ba, y1 - y0);
    }
    // Trailing wash behind the band, on the origin side.
    const tail = 120;
    const tx = b.side > 0 ? bx + th : bx - tail;
    const tg = ctx.createLinearGradient(tx, 0, tx + tail, 0);
    tg.addColorStop(0, hexA(p.accent, b.side > 0 ? 0.18 : 0));
    tg.addColorStop(1, hexA(p.accent, b.side > 0 ? 0 : 0.18));
    const ta = Math.max(x0, tx);
    const tb = Math.min(x1, tx + tail);
    if (tb > ta) {
      ctx.fillStyle = tg;
      ctx.fillRect(ta, y0, tb - ta, y1 - y0);
    }
    // The bright leading edge itself.
    if (b.wallX >= x0 - 2 && b.wallX <= x1 + 2) {
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.wallX, y0);
      ctx.lineTo(b.wallX, y1);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Umbral Crown: a violet ring with a countdown, then a brief eruption. */
function drawSnare(ctx, b, t, p) {
  const m = b.mechanic;
  if (b.phase === 'warn') {
    const k = 1 - Math.max(0, b.timer) / m.warn; // 0 → 1 across the warning
    ctx.save();
    ctx.fillStyle = hexA(p.accent, 0.1 + 0.16 * k);
    circle(ctx, b.x, b.y, b.r);
    ctx.fill();
    ctx.strokeStyle = '#e6d5ff';
    ctx.globalAlpha = 0.55 + 0.4 * k;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    circle(ctx, b.x, b.y, b.r);
    ctx.stroke();
    ctx.setLineDash([]);
    // A shrinking inner ring counts the time left to step out.
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    circle(ctx, b.x, b.y, Math.max(2, b.r * (1 - k)));
    ctx.stroke();
    ctx.restore();
  } else if (b.phase === 'flash') {
    const k = 1 - Math.max(0, b.timer) / m.flash;
    ctx.save();
    ctx.fillStyle = hexA(p.accent, 0.5 * (1 - k));
    circle(ctx, b.x, b.y, b.r);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.globalAlpha = 1 - k;
    circle(ctx, b.x, b.y, b.r * (1 + 0.35 * k));
    ctx.stroke();
    ctx.restore();
  }
}

/** Draws the region's active mechanic telegraph, if one is on screen. */
function drawBiomeField(ctx, world, t) {
  const b = world.biome;
  if (!b || b.phase === 'idle') return;
  const p = pal(world);
  if (b.id === 'gust') drawGust(ctx, b, t, p);
  else if (b.id === 'tide') drawTide(ctx, b, t, p);
  else drawSnare(ctx, b, t, p);
}

function drawParticles(ctx, effects) {
  for (const p of effects.parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.color;
    circle(ctx, p.x, p.y, p.size);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTrail(ctx, effects) {
  for (const tr of effects.trail) {
    ctx.globalAlpha = tr.life * 0.35;
    ctx.fillStyle = C.COLORS.gold;
    circle(ctx, tr.x, tr.y, 4.5 * tr.life + 1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx) {
  // Soft edge shading only: heavy vignettes swallowed the field edges.
  const l = ctx.createLinearGradient(0, 0, 110, 0);
  l.addColorStop(0, 'rgba(2,5,12,0.32)');
  l.addColorStop(1, 'rgba(2,5,12,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, 110, C.LOGICAL_H);
  const r = ctx.createLinearGradient(C.LOGICAL_W - 110, 0, C.LOGICAL_W, 0);
  r.addColorStop(0, 'rgba(2,5,12,0)');
  r.addColorStop(1, 'rgba(2,5,12,0.32)');
  ctx.fillStyle = r;
  ctx.fillRect(C.LOGICAL_W - 110, 0, 110, C.LOGICAL_H);
}

/**
 * The playfield frame: a quiet accent border and bright corner ticks so the
 * field edges and the HUD band above them separate at any size.
 */
function drawFieldFrame(ctx, world) {
  const p = pal(world);
  const { x0, y0, x1, y1 } = C.FIELD;
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 2;
  rrect(ctx, x0 - 7, y0 - 7, x1 - x0 + 14, y1 - y0 + 14, 16);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const tick = 24;
  for (const [cx, cy, sx, sy] of [
    [x0 - 7, y0 - 7, 1, 1],
    [x1 + 7, y0 - 7, -1, 1],
    [x0 - 7, y1 + 7, 1, -1],
    [x1 + 7, y1 + 7, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * tick);
    ctx.stroke();
  }
  ctx.restore();
}

/** Renders the scenery and entities pass (chunky, low-res buffer). */
export function renderWorld(ctx, world, view) {
  const t = view.t;
  ctx.save();
  if (view.effects.shake > 0 && !view.reducedMotion) {
    ctx.translate(Math.sin(t * 89) * view.effects.shake * 0.5, Math.cos(t * 97) * view.effects.shake * 0.4);
  }

  drawSky(ctx, world, t, view);
  drawProps(ctx, world, t, view, 'back');
  drawGround(ctx, world, t, view);
  drawProps(ctx, world, t, view, 'front');
  drawSeeds(ctx, world, t);
  drawBloom(ctx, world, t);
  for (const b of world.brambles) drawBramble(ctx, b, t);
  drawBiomeField(ctx, world, t);
  drawTrail(ctx, view.effects);
  drawLantern(ctx, world, t, view);
  drawFlareRing(ctx, world, view);
  drawSeedPointer(ctx, world);
  drawParticles(ctx, view.effects);
  drawFireflies(ctx, world, t, view);
  drawFieldFrame(ctx, world);
  drawVignette(ctx);

  ctx.restore();
}

// ---------------------------------------------------------------- UI: HUD

function drawHeart(ctx, x, y, filled, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (filled) {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
    glow.addColorStop(0, 'rgba(255,207,107,0.45)');
    glow.addColorStop(1, 'rgba(255,207,107,0)');
    ctx.fillStyle = glow;
    circle(ctx, 0, 0, 16);
    ctx.fill();
  }
  ctx.strokeStyle = filled ? C.COLORS.gold : C.COLORS.faint;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -5, 5.5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = filled ? C.COLORS.gold : 'rgba(232,244,255,0.18)';
  rrect(ctx, -6, -1, 12, 12, 3);
  ctx.fill();
  if (filled) {
    ctx.fillStyle = '#fff4d6';
    circle(ctx, 0, 5, 4.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawEmberMeter(ctx, world, t, reducedMotion) {
  const frac = Math.max(0, Math.min(1, world.ember / C.EMBER.max));
  const full = frac >= 1;
  const x = 520;
  const y = C.LOGICAL_H - 54;
  const w = 240;
  const h = 24;
  rrect(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(9,18,38,0.75)';
  ctx.fill();
  if (frac > 0) {
    const pulse = full && !reducedMotion ? 0.85 + 0.15 * Math.sin(t * 6) : 1;
    ctx.globalAlpha = pulse;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, C.COLORS.goldDeep);
    g.addColorStop(1, full ? '#fff4d6' : C.COLORS.gold);
    ctx.fillStyle = g;
    rrect(ctx, x + 3, y + 3, Math.max(6, (w - 6) * frac), h - 6, 9);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = full ? C.COLORS.goldBright : 'rgba(232,244,255,0.22)';
  ctx.lineWidth = 1.5;
  rrect(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = full ? C.COLORS.goldBright : C.COLORS.dim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(full ? 'FLARE READY — E' : 'EMBER', x + w / 2, y + h / 2 + 1);
}

function drawHUD(ctx, world, t, view) {
  const p = pal(world);
  // Readability scrim behind the top band.
  const scrim = ctx.createLinearGradient(0, 0, 0, 100);
  scrim.addColorStop(0, 'rgba(4,8,18,0.88)');
  scrim.addColorStop(1, 'rgba(4,8,18,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, C.LOGICAL_W, 100);

  for (let i = 0; i < C.MAX_HEARTS; i++) drawHeart(ctx, 40 + i * 42, 48, i < world.hearts, 1.3);

  // Timer bar with big numeric seconds.
  const frac = Math.max(0, world.timeLeft / world.region.time);
  rrect(ctx, 168, 38, 290, 18, 9);
  ctx.fillStyle = 'rgba(232,244,255,0.12)';
  ctx.fill();
  if (frac > 0) {
    const g = ctx.createLinearGradient(168, 0, 458, 0);
    g.addColorStop(0, C.COLORS.teal);
    g.addColorStop(1, C.COLORS.gold);
    ctx.fillStyle = g;
    rrect(ctx, 170, 40, 286 * frac, 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = C.COLORS.ink;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(Math.max(0, world.timeLeft))}s`, 472, 48);

  // Region name above the seed count.
  ctx.textAlign = 'center';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = p.accentDim;
  ctx.fillText(world.region.name, 690, 24);
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillStyle = p.accent;
  ctx.fillText(`MOONSEEDS ${world.collected}/${world.region.seeds}`, 690, 52);

  // Score and streak.
  ctx.textAlign = 'right';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.dim;
  ctx.fillText('SCORE', 1112, 24);
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.ink;
  ctx.fillText(String(world.score), 1112, 50);
  if (world.combo > 1) {
    const a = Math.max(0.25, Math.min(1, world.comboTimer / C.COMBO.window));
    ctx.globalAlpha = a;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillStyle = C.COLORS.gold;
    ctx.fillText(`COMBO ×${world.combo}`, 1112, 74);
    ctx.globalAlpha = 1;
  }

  // Dash readiness pill.
  const ready = world.player.dashCooldown <= 0;
  rrect(ctx, 26, C.LOGICAL_H - 54, 132, 28, 14);
  ctx.fillStyle = 'rgba(9,18,38,0.7)';
  ctx.fill();
  ctx.strokeStyle = ready ? C.COLORS.tealDim : 'rgba(232,244,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!ready) {
    ctx.fillStyle = C.COLORS.tealDim;
    rrect(ctx, 28, C.LOGICAL_H - 52, 128 * (1 - world.player.dashCooldown / C.PLAYER.dashCooldown), 24, 12);
    ctx.fill();
  }
  ctx.fillStyle = ready ? C.COLORS.goldBright : C.COLORS.dim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ready ? 'DASH READY' : 'DASH', 92, C.LOGICAL_H - 40);

  drawEmberMeter(ctx, world, t, view.reducedMotion);
  drawBiomeBanner(ctx, world, t, view);

  // Touch buttons for dash and flare.
  if (view.touch) {
    drawCircleActionButton(ctx, { x: 1180, y: 630, r: 50 }, 'DASH', 1, t);
    drawCircleActionButton(ctx, { x: 1052, y: 640, r: 40 }, 'FLARE', world.ember / C.EMBER.max, t);
  }

  // The run's objective, spoken once at the start of every region.
  if (world.elapsed < 3) {
    const a = Math.max(0, Math.min(1, 3 - world.elapsed)) * 0.95;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = p.accent;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(world.region.name, 640, 268);
    ctx.fillStyle = C.COLORS.goldBright;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(`GATHER ${world.region.seeds} MOONSEEDS`, 640, 310);
    ctx.fillStyle = C.COLORS.dim;
    ctx.font = '400 17px system-ui, sans-serif';
    ctx.fillText('Graze the brambles to charge the ember — a full ember flares.', 640, 344);
    // Each later grove also speaks its own field mechanic once, up front.
    if (world.region.mechanic) {
      ctx.fillStyle = p.accent;
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(world.region.mechanic.tell, 640, 374);
    }
    ctx.globalAlpha = 1;
  }
}

function drawCircleActionButton(ctx, b, label, charge, t) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  circle(ctx, b.x, b.y, b.r);
  ctx.fillStyle = 'rgba(9,18,38,0.6)';
  ctx.fill();
  const full = charge >= 1;
  ctx.strokeStyle = full ? C.COLORS.goldBright : C.COLORS.gold;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (charge > 0 && charge < 1) {
    ctx.strokeStyle = C.COLORS.goldDeep;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge);
    ctx.stroke();
  }
  ctx.fillStyle = full ? C.COLORS.goldBright : C.COLORS.gold;
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x, b.y);
  ctx.restore();
}

/**
 * The regional mechanic's concise banner, in the HUD band where it never
 * covers the playfield: the tell while it warns, a short status while it acts.
 */
function drawBiomeBanner(ctx, world, t, view) {
  const b = world.biome;
  if (!b) return;
  const warn = b.phase === 'warn';
  const acting = b.phase === 'active' || b.phase === 'flash';
  if (!warn && !acting) return;
  const p = pal(world);
  let label = '';
  let sub = null;
  if (b.id === 'gust') {
    label = warn
      ? `SHARD GUST ${b.dir > 0 ? '→' : '←'}`
      : `HOLD AGAINST THE WIND ${b.dir > 0 ? '→' : '←'}`;
    if (warn) sub = 'Steer against the shove';
  } else if (b.id === 'tide') {
    label = warn
      ? `GLUM TIDE ${-b.side > 0 ? '→' : '←'}`
      : `TIDE SWEEPING THE GROVE ${-b.side > 0 ? '→' : '←'}`;
    if (warn) sub = 'Outrun it or dash through';
  } else {
    label = warn ? 'UMBRA SNARE' : 'SNARE ERUPTING';
    if (warn) sub = 'Leave the violet ring';
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const pulse = warn && !view.reducedMotion ? 0.8 + 0.2 * Math.sin(t * 6) : 0.95;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = warn ? p.accent : C.COLORS.goldBright;
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.fillText(label, 640, 84);
  if (sub) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = C.COLORS.ink;
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillText(sub, 640, 103);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- buttons

/** Shared button layout; main.js hit-tests the same rectangles it draws. */
export function getButtons(phase, opts = {}) {
  const touch = !!opts.touch;
  if (phase === PHASE.RUNNING || phase === PHASE.PAUSED) {
    const list = [
      { id: 'mute', shape: 'circle', x: 1158, y: 44, r: 22 },
      { id: 'pause', shape: 'circle', x: 1208, y: 44, r: 22 },
    ];
    if (phase === PHASE.PAUSED) {
      list.push({ id: 'resume', shape: 'rect', x: 500, y: 418, w: 280, h: 54, label: 'RESUME' });
      list.push({ id: 'route', shape: 'rect', x: 540, y: 488, w: 200, h: 40, label: 'THE ROUTE' });
    }
    if (touch && phase === PHASE.RUNNING) {
      list.push({ id: 'dash', shape: 'circle', x: 1180, y: 630, r: 50 });
      list.push({ id: 'flare', shape: 'circle', x: 1052, y: 640, r: 40 });
    }
    return list;
  }
  if (phase === PHASE.MAP || phase === PHASE.MENU) {
    const list = [{ id: 'mute', shape: 'circle', x: 1208, y: 44, r: 22 }];
    MAP_NODES.forEach((n, i) => list.push({ id: `region${i}`, shape: 'circle', x: n.x, y: n.y, r: 46 }));
    return list;
  }
  if (phase === PHASE.WON || phase === PHASE.LOST) {
    const list = [];
    if (phase === PHASE.WON && opts.next) {
      list.push({ id: 'primary', shape: 'rect', x: 500, y: 492, w: 280, h: 54, label: 'NEXT REGION' });
      list.push({ id: 'route', shape: 'rect', x: 540, y: 560, w: 200, h: 40, label: 'THE ROUTE' });
    } else if (phase === PHASE.WON) {
      list.push({ id: 'primary', shape: 'rect', x: 500, y: 492, w: 280, h: 54, label: 'THE ROUTE' });
    } else {
      list.push({ id: 'primary', shape: 'rect', x: 500, y: 492, w: 280, h: 54, label: 'RETRY REGION' });
      list.push({ id: 'route', shape: 'rect', x: 540, y: 560, w: 200, h: 40, label: 'THE ROUTE' });
    }
    return list;
  }
  return [];
}

/** The route screen's node positions, shared by the drawing and hit-testing. */
export const MAP_NODES = [
  { x: 210, y: 434 },
  { x: 500, y: 356 },
  { x: 790, y: 434 },
  { x: 1080, y: 356 },
];

function labelButton(ctx, b, t) {
  if (!b) return;
  const pulse = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.save();
  rrect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
  ctx.fillStyle = 'rgba(9,18,38,0.85)';
  ctx.fill();
  ctx.strokeStyle = C.COLORS.teal;
  ctx.lineWidth = 2;
  ctx.globalAlpha = pulse;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.COLORS.goldBright;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  ctx.restore();
}

function drawCircleButton(ctx, b, icon, active) {
  ctx.save();
  circle(ctx, b.x, b.y, b.r);
  ctx.fillStyle = 'rgba(9,18,38,0.6)';
  ctx.fill();
  ctx.strokeStyle = active ? C.COLORS.gold : C.COLORS.panelEdge;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = C.COLORS.ink;
  ctx.fillStyle = C.COLORS.ink;
  ctx.lineWidth = 2.4;
  if (icon === 'pause') {
    for (const dx of [-6, 6]) {
      ctx.beginPath();
      ctx.moveTo(b.x + dx - 2.5, b.y - 8);
      ctx.lineTo(b.x + dx - 2.5, b.y + 8);
      ctx.moveTo(b.x + dx + 2.5, b.y - 8);
      ctx.lineTo(b.x + dx + 2.5, b.y + 8);
      ctx.stroke();
    }
  } else if (icon === 'mute') {
    ctx.beginPath();
    ctx.moveTo(b.x - 9, b.y - 4);
    ctx.lineTo(b.x - 4, b.y - 4);
    ctx.lineTo(b.x + 2, b.y - 9);
    ctx.lineTo(b.x + 2, b.y + 9);
    ctx.lineTo(b.x - 4, b.y + 4);
    ctx.lineTo(b.x - 9, b.y + 4);
    ctx.closePath();
    ctx.fill();
    if (active) {
      ctx.beginPath();
      ctx.moveTo(b.x + 6, b.y - 6);
      ctx.lineTo(b.x + 12, b.y + 6);
      ctx.moveTo(b.x + 12, b.y - 6);
      ctx.lineTo(b.x + 6, b.y + 6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(b.x + 7, b.y, 5, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- overlays

function dim(ctx, a) {
  ctx.fillStyle = `rgba(4,8,18,${a})`;
  ctx.fillRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);
}

function card(ctx, x, y, w, h) {
  rrect(ctx, x, y, w, h, 14);
  ctx.fillStyle = C.COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = C.COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLock(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.COLORS.faint;
  ctx.fillStyle = C.COLORS.faint;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -4, 4.5, Math.PI, 0);
  ctx.stroke();
  rrect(ctx, -7, -3, 14, 12, 2.5);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- route map

function drawMap(ctx, world, t, view) {
  dim(ctx, 0.7);
  const camp = view.camp;
  const sel = view.mapSel;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try {
    ctx.letterSpacing = '6px';
  } catch {}
  ctx.save();
  ctx.shadowColor = 'rgba(255,207,107,0.5)';
  ctx.shadowBlur = 22;
  ctx.fillStyle = C.COLORS.gold;
  ctx.font = '800 50px system-ui, sans-serif';
  ctx.fillText('MOSSLIGHT COURIER', 640, 92);
  ctx.restore();
  try {
    ctx.letterSpacing = '3px';
  } catch {}
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('THE FOUR-GROVE ROUTE — CHOOSE YOUR NEXT RUN', 640, 124);
  try {
    ctx.letterSpacing = '0px';
  } catch {}
  ctx.textAlign = 'right';
  ctx.fillStyle = C.COLORS.teal;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`${totalCleared(camp)}/4 GROVES LIT`, 1208, 92);

  // The dashed route connecting the groves.
  ctx.strokeStyle = 'rgba(232,244,255,0.22)';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 12]);
  for (let i = 0; i < MAP_NODES.length - 1; i++) {
    const a = MAP_NODES[i];
    const b = MAP_NODES[i + 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - 62, b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // One node per region: locked, unlit, or cleared with its best run.
  MAP_NODES.forEach((n, i) => {
    const region = REGIONS[i];
    const rec = camp.regions[i];
    const unlocked = i === 0 || (camp.regions[i - 1] && camp.regions[i - 1].cleared);
    const selected = i === sel;
    ctx.save();
    ctx.globalAlpha = unlocked ? 1 : 0.55;
    circle(ctx, n.x, n.y, 44);
    ctx.fillStyle = region.colors.skyTop;
    ctx.fill();
    ctx.strokeStyle = unlocked ? region.colors.accent : 'rgba(232,244,255,0.25)';
    ctx.lineWidth = selected ? 3.5 : 2.5;
    ctx.stroke();
    if (selected && !view.reducedMotion) {
      ctx.strokeStyle = C.COLORS.gold;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4);
      ctx.lineWidth = 2;
      circle(ctx, n.x, n.y, 55);
      ctx.stroke();
      ctx.globalAlpha = unlocked ? 1 : 0.55;
    }
    if (unlocked) {
      ctx.fillStyle = C.COLORS.ink;
      ctx.font = '800 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), n.x, n.y - 5);
      if (rec.cleared) {
        ctx.fillStyle = region.colors.accent;
        ctx.font = '800 16px system-ui, sans-serif';
        ctx.fillText(rec.bestGrade ?? '—', n.x, n.y + 16);
      }
    } else {
      drawLock(ctx, n.x, n.y);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillStyle = unlocked ? region.colors.accent : C.COLORS.dim;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(region.name, n.x, n.y + 68);
    ctx.fillStyle = C.COLORS.dim;
    ctx.font = '400 13px system-ui, sans-serif';
    const status = !unlocked
      ? 'LOCKED'
      : rec.cleared
        ? `BEST ${rec.bestScore} · ${rec.bestGrade}`
        : 'UNLIT — READY';
    ctx.fillText(status, n.x, n.y + 88);
    ctx.restore();
  });

  // Selected region panel.
  const region = REGIONS[sel];
  const rec = camp.regions[sel];
  card(ctx, 340, 568, 600, 92);
  ctx.textAlign = 'left';
  ctx.fillStyle = region.colors.accent;
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.fillText(`${sel + 1}. ${region.name}`, 364, 598);
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText(region.tag, 364, 622);
  // The grove's field mechanic, so the choice of region is an informed one.
  if (region.mechanic) {
    ctx.fillStyle = region.colors.accentDim;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(`FIELD — ${region.mechanic.name}`, 364, 646);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = rec.cleared ? C.COLORS.gold : C.COLORS.goldBright;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(rec.cleared ? `BEST ${rec.bestScore} · ${rec.bestGrade}` : 'ENTER TO DEPART', 916, 622);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.COLORS.faint;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText('←/→ or tap a grove · Enter departs · M mutes', 640, 700);

  const muteBtn = getButtons(world.phase, view).find((b) => b.id === 'mute');
  if (muteBtn) drawCircleButton(ctx, muteBtn, 'mute', view.muted);
}

// ---------------------------------------------------------------- results

function drawResults(ctx, world, t, view) {
  dim(ctx, 0.72);
  const sum = runSummary(world);
  const won = sum.won;
  const region = REGIONS[world.regionIdx] ?? REGIONS[0];
  const rec = view.camp.regions[world.regionIdx] ?? { bestScore: 0, bestGrade: null, cleared: false };
  const next = REGIONS[world.regionIdx + 1];
  const last = world.regionIdx >= REGIONS.length - 1;
  card(ctx, 300, 106, 680, 478);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = region.colors.accentDim;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(`REGION ${world.regionIdx + 1} — ${region.name}`, 640, 146);

  ctx.fillStyle = won ? C.COLORS.gold : C.COLORS.magenta;
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText(won ? (last ? 'EVERY GROVE LIT' : 'REGION CLEARED') : 'THE LIGHT FADED', 640, 194);

  let reason;
  if (won) {
    reason = last
      ? 'The whole route burns with lantern light. Well carried.'
      : `THE PATH OPENS — ${next.name} IS NOW LIT`;
  } else {
    reason = sum.loseReason === 'time' ? 'Dawn came before the last moonseed was found.' : 'A bramble snuffed the lantern.';
  }
  ctx.fillStyle = won && !last ? C.COLORS.goldBright : C.COLORS.dim;
  ctx.font = won && !last ? '700 17px system-ui, sans-serif' : '400 17px system-ui, sans-serif';
  ctx.fillText(reason, 640, 228);

  // Grade medallion.
  const grade = gradeFor(sum.score);
  circle(ctx, 434, 330, 54);
  ctx.fillStyle = 'rgba(9,18,38,0.9)';
  ctx.fill();
  ctx.strokeStyle = won ? C.COLORS.gold : C.COLORS.magenta;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = won ? C.COLORS.goldBright : C.COLORS.ink;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, 434, 336);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.dim;
  ctx.fillText('GRADE', 434, 410);

  // Stats column.
  const newBest = !!(view.lastResult && view.lastResult.newBest && sum.score > 0);
  const rows = [
    ['Score', String(sum.score)],
    ['Region best', `${rec.bestScore}${newBest ? '  ·  NEW BEST' : ''}`],
    ['Moonseeds', `${sum.collected}/${sum.total}`],
    ['Best combo', `×${sum.maxCombo}`],
    ['Near misses', `${sum.nearMisses}`],
    ['Ember flares', `${sum.flares} (${sum.stilled} stilled)`],
    ['Hits taken', `${sum.hitsTaken}`],
    ['Time bonus', `+${sum.timeBonus}`],
  ];
  // The grove's own mechanic stat, right after the near misses.
  if (sum.biomeLabel) rows.splice(5, 0, [sum.biomeLabel, String(sum.biome)]);
  ctx.textAlign = 'left';
  let y = 256;
  for (const [k, v] of rows) {
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillStyle = C.COLORS.dim;
    ctx.fillText(k, 540, y);
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = k === 'Region best' && newBest ? C.COLORS.gold : C.COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText(v, 906, y);
    ctx.textAlign = 'left';
    y += 27;
  }
  ctx.textBaseline = 'alphabetic';
  const buttons = getButtons(world.phase, { next: view.nextAvailable });
  labelButton(ctx, buttons[0], t);
  labelButton(ctx, buttons[1], t);
  ctx.fillStyle = C.COLORS.faint;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(won ? 'Enter — continue · R — retry · B — the route' : 'Enter — retry · R — retry · B — the route', 640, 614);
}

function drawPaused(ctx, t) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.COLORS.ink;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 320);
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · B — abandon to the route', 640, 362);
  ctx.textBaseline = 'alphabetic';
  const buttons = getButtons(PHASE.PAUSED);
  labelButton(ctx, buttons.find((b) => b.id === 'resume'), t);
  labelButton(ctx, buttons.find((b) => b.id === 'route'), t);
}

// ---------------------------------------------------------------- UI frame

/** Renders the full-resolution UI pass over the pixelated world pass. */
export function renderUI(ctx, world, view) {
  const t = view.t;
  const phase = world.phase;
  if (phase === PHASE.RUNNING || phase === PHASE.PAUSED) {
    drawHUD(ctx, world, t, view);
    for (const b of getButtons(phase, view)) {
      if (b.id === 'mute') drawCircleButton(ctx, b, 'mute', view.muted);
      else if (b.id === 'pause') drawCircleButton(ctx, b, 'pause', false);
    }
  }
  if (phase === PHASE.MAP || phase === PHASE.MENU) drawMap(ctx, world, t, view);
  else if (phase === PHASE.PAUSED) drawPaused(ctx, t);
  else if (phase === PHASE.WON || phase === PHASE.LOST) drawResults(ctx, world, t, view);
}

// Mosslight Courier — canvas renderer.
//
// Every visual is drawn here with vector paths: no images, no fonts fetched,
// no external assets. The logical canvas is 1280x720 and the transform is set
// once per frame by setupTransform, so the same drawing serves every display.

import * as C from './config.js';
import { createRng } from './rng.js';
import { PHASE, gradeFor, runSummary } from './world.js';

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
  teal: sceneryRng.chance(0.6),
}));

const TRUNKS = [
  { x: 34, w: 46, lean: 0.03, canopy: 250 },
  { x: 168, w: 30, lean: -0.02, canopy: 180 },
  { x: 1108, w: 34, lean: 0.02, canopy: 190 },
  { x: 1236, w: 48, lean: -0.03, canopy: 260 },
];

const CRATERS = [
  { dx: -18, dy: -12, r: 12 },
  { dx: 14, dy: 6, r: 9 },
  { dx: -4, dy: 22, r: 7 },
];

const MOON = { x: 1032, y: 132, r: 62 };

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

/** Sets the logical 1280x720 transform for the frame. */
export function setupTransform(ctx, canvas) {
  ctx.setTransform(canvas.width / C.LOGICAL_W, 0, 0, canvas.height / C.LOGICAL_H, 0, 0);
}

// ---------------------------------------------------------------- scenery

function drawSky(ctx, t, view) {
  const g = ctx.createLinearGradient(0, 0, 0, C.LOGICAL_H);
  g.addColorStop(0, C.COLORS.skyTop);
  g.addColorStop(1, C.COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.LOGICAL_W, C.LOGICAL_H);

  for (const s of STARS) {
    const a = view.reducedMotion ? 0.55 : 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = C.COLORS.star;
    circle(ctx, s.x, s.y, s.r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon with a wide teal halo and a few soft craters.
  const halo = ctx.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.4, MOON.x, MOON.y, MOON.r * 3.1);
  halo.addColorStop(0, C.COLORS.moonHalo);
  halo.addColorStop(1, 'rgba(110,255,220,0)');
  ctx.fillStyle = halo;
  circle(ctx, MOON.x, MOON.y, MOON.r * 3.1);
  ctx.fill();
  ctx.fillStyle = C.COLORS.moon;
  circle(ctx, MOON.x, MOON.y, MOON.r);
  ctx.fill();
  ctx.fillStyle = C.COLORS.moonCrater;
  for (const c of CRATERS) {
    circle(ctx, MOON.x + c.dx, MOON.y + c.dy, c.r);
    ctx.fill();
  }

  // Moonlight rays fanning down through the canopy.
  ctx.fillStyle = C.COLORS.ray;
  for (let i = 0; i < 4; i++) {
    const x0 = 880 + i * 64;
    ctx.beginPath();
    ctx.moveTo(MOON.x - 30 + i * 22, MOON.y + 20);
    ctx.lineTo(x0 - 60, C.LOGICAL_H);
    ctx.lineTo(x0 + 70, C.LOGICAL_H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawForest(ctx) {
  for (const tr of TRUNKS) {
    ctx.fillStyle = C.COLORS.treeFar;
    ctx.beginPath();
    ctx.moveTo(tr.x, C.LOGICAL_H);
    ctx.quadraticCurveTo(tr.x + tr.lean * 300, 420, tr.x + tr.lean * 560, 40);
    ctx.lineTo(tr.x + tr.w + tr.lean * 560, 40);
    ctx.quadraticCurveTo(tr.x + tr.w + tr.lean * 300, 420, tr.x + tr.w, C.LOGICAL_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.COLORS.treeNear;
    circle(ctx, tr.x + tr.w / 2 + tr.lean * 520, 70, tr.canopy);
    ctx.fill();
  }
  // Canopy scallop shading the top corners.
  ctx.fillStyle = C.COLORS.treeNear;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(C.LOGICAL_W, 0);
  ctx.lineTo(C.LOGICAL_W, 30);
  ctx.quadraticCurveTo(960, 74, 640, 40);
  ctx.quadraticCurveTo(320, 6, 0, 52);
  ctx.closePath();
  ctx.fill();
}

function drawGround(ctx, t, view) {
  const g = ctx.createLinearGradient(0, 590, 0, C.LOGICAL_H);
  g.addColorStop(0, C.COLORS.groundTop);
  g.addColorStop(1, C.COLORS.groundBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 590, C.LOGICAL_W, C.LOGICAL_H - 590);

  for (const p of GLOW_PATCHES) {
    const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
    grad.addColorStop(0, p.teal ? C.COLORS.mossGlowTeal : C.COLORS.mossGlowGold);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    circle(ctx, p.x, p.y, p.r);
    ctx.fill();
  }

  ctx.strokeStyle = C.COLORS.mossTuft;
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

function drawFireflies(ctx, t, view) {
  for (const f of FIREFLIES) {
    const dx = view.reducedMotion ? 0 : Math.sin(t * f.sp + f.ph) * 14;
    const dy = view.reducedMotion ? 0 : Math.cos(t * f.sp * 0.8 + f.ph) * 9;
    const a = view.reducedMotion ? 0.5 : 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + f.ph * 3));
    ctx.globalAlpha = a;
    ctx.fillStyle = C.COLORS.goldBright;
    circle(ctx, f.x + dx, f.y + dy, f.r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawVignette(ctx) {
  const l = ctx.createLinearGradient(0, 0, 130, 0);
  l.addColorStop(0, 'rgba(2,5,12,0.55)');
  l.addColorStop(1, 'rgba(2,5,12,0)');
  ctx.fillStyle = l;
  ctx.fillRect(0, 0, 130, C.LOGICAL_H);
  const r = ctx.createLinearGradient(C.LOGICAL_W - 130, 0, C.LOGICAL_W, 0);
  r.addColorStop(0, 'rgba(2,5,12,0)');
  r.addColorStop(1, 'rgba(2,5,12,0.55)');
  ctx.fillStyle = r;
  ctx.fillRect(C.LOGICAL_W - 130, 0, 130, C.LOGICAL_H);
}

// ---------------------------------------------------------------- entities

function drawSeeds(ctx, world, t) {
  for (const s of world.seeds) {
    if (s.taken) continue;
    const pulse = 1 + 0.08 * Math.sin(t * 3 + s.twinkle);
    const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26);
    glow.addColorStop(0, 'rgba(94,225,190,0.5)');
    glow.addColorStop(1, 'rgba(94,225,190,0)');
    ctx.fillStyle = glow;
    circle(ctx, s.x, s.y, 26);
    ctx.fill();
    ctx.fillStyle = C.COLORS.teal;
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
  ctx.restore();
}

function drawLantern(ctx, world, t, view) {
  const p = world.player;
  const blink = p.invuln > 0 && p.dashTime <= 0 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 14)) : 1;

  ctx.save();
  ctx.globalAlpha = blink;

  // Warm glow around the lantern.
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 58);
  glow.addColorStop(0, 'rgba(255,207,107,0.5)');
  glow.addColorStop(0.55, 'rgba(255,207,107,0.14)');
  glow.addColorStop(1, 'rgba(255,207,107,0)');
  ctx.fillStyle = glow;
  circle(ctx, p.x, p.y, 58);
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

  // The lantern: warm orb inside a little cage with a handle.
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

// ---------------------------------------------------------------- HUD

function drawHeart(ctx, x, y, filled) {
  ctx.save();
  ctx.translate(x, y);
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

function drawHUD(ctx, world, t, view) {
  // Readability scrim behind the top band.
  const scrim = ctx.createLinearGradient(0, 0, 0, 92);
  scrim.addColorStop(0, 'rgba(4,8,18,0.85)');
  scrim.addColorStop(1, 'rgba(4,8,18,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, C.LOGICAL_W, 92);

  for (let i = 0; i < C.MAX_HEARTS; i++) drawHeart(ctx, 36 + i * 34, 44, i < world.hearts);

  // Timer bar with numeric seconds.
  const frac = Math.max(0, world.timeLeft / C.RUN_SECONDS);
  rrect(ctx, 150, 34, 250, 14, 7);
  ctx.fillStyle = 'rgba(232,244,255,0.12)';
  ctx.fill();
  if (frac > 0) {
    const g = ctx.createLinearGradient(150, 0, 400, 0);
    g.addColorStop(0, C.COLORS.teal);
    g.addColorStop(1, C.COLORS.gold);
    ctx.fillStyle = g;
    rrect(ctx, 152, 36, 246 * frac, 10, 5);
    ctx.fill();
  }
  ctx.fillStyle = C.COLORS.ink;
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(Math.max(0, world.timeLeft))}s`, 412, 42);

  // Seeds gathered.
  ctx.textAlign = 'center';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.dim;
  ctx.fillText('SEEDS', 640, 28);
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.teal;
  ctx.fillText(`${world.collected}/${C.TOTAL_SEEDS}`, 640, 50);

  // Score and streak.
  ctx.textAlign = 'right';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.dim;
  ctx.fillText('SCORE', 1112, 24);
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = C.COLORS.ink;
  ctx.fillText(String(world.score), 1112, 48);
  if (world.combo > 1) {
    const a = Math.max(0.25, Math.min(1, world.comboTimer / C.COMBO.window));
    ctx.globalAlpha = a;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillStyle = C.COLORS.gold;
    ctx.fillText(`COMBO ×${world.combo}`, 1112, 70);
    ctx.globalAlpha = 1;
  }

  // Dash readiness pill.
  const ready = world.player.dashCooldown <= 0;
  rrect(ctx, 26, C.LOGICAL_H - 52, 128, 26, 13);
  ctx.fillStyle = 'rgba(9,18,38,0.7)';
  ctx.fill();
  ctx.strokeStyle = ready ? C.COLORS.tealDim : 'rgba(232,244,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!ready) {
    ctx.fillStyle = C.COLORS.tealDim;
    rrect(ctx, 28, C.LOGICAL_H - 50, 124 * (1 - world.player.dashCooldown / C.PLAYER.dashCooldown), 22, 11);
    ctx.fill();
  }
  ctx.fillStyle = ready ? C.COLORS.goldBright : C.COLORS.dim;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ready ? 'DASH READY' : 'DASH', 90, C.LOGICAL_H - 39);

  // On-screen dash button for touch players.
  if (view.touch) drawDashButton(ctx, t);
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
      list.push({ id: 'resume', shape: 'rect', x: 540, y: 430, w: 200, h: 54, label: 'RESUME' });
    }
    if (touch && phase === PHASE.RUNNING) {
      list.push({ id: 'dash', shape: 'circle', x: 1180, y: 630, r: 50 });
    }
    return list;
  }
  if (phase === PHASE.MENU) {
    return [{ id: 'start', shape: 'rect', x: 500, y: 566, w: 280, h: 62, label: 'BEGIN THE RUN' }];
  }
  if (phase === PHASE.WON || phase === PHASE.LOST) {
    return [{ id: 'restart', shape: 'rect', x: 540, y: 512, w: 200, h: 54, label: 'RUN AGAIN' }];
  }
  return [];
}

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

function drawDashButton(ctx, t) {
  const b = { x: 1180, y: 630, r: 50 };
  ctx.save();
  ctx.globalAlpha = 0.9;
  circle(ctx, b.x, b.y, b.r);
  ctx.fillStyle = 'rgba(9,18,38,0.6)';
  ctx.fill();
  ctx.strokeStyle = C.COLORS.gold;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 3);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.COLORS.goldBright;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DASH', b.x, b.y);
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

function drawTitle(ctx, t) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try {
    ctx.letterSpacing = '10px';
  } catch {}
  ctx.save();
  ctx.shadowColor = 'rgba(255,207,107,0.55)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = C.COLORS.gold;
  ctx.font = '800 88px system-ui, sans-serif';
  ctx.fillText('MOSSLIGHT', 640, 138);
  ctx.restore();
  try {
    ctx.letterSpacing = '18px';
  } catch {}
  ctx.fillStyle = C.COLORS.teal;
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillText('COURIER', 649, 192);
  try {
    ctx.letterSpacing = '0px';
  } catch {}
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillText('A lantern-lit dash through the moonlit grove', 640, 226);
}

function drawMenu(ctx, t, view) {
  dim(ctx, 0.62);
  drawTitle(ctx, t);
  const cards = [
    {
      x: 96,
      head: 'THE RUN',
      lines: ['Gather all 12 moonseeds', 'before 72 seconds run out.', 'Keep all three hearts lit.'],
    },
    {
      x: 470,
      head: 'CONTROLS',
      lines: ['WASD / Arrows — steer', 'Space / Shift — dash', 'P — pause · M — mute'],
    },
    {
      x: 844,
      head: 'THE GROVE',
      lines: ['Magenta brambles sting.', 'Dash through, unharmed —', 'a close graze earns +35.'],
    },
  ];
  for (const c of cards) {
    card(ctx, c.x, 268, 340, 148);
    ctx.fillStyle = C.COLORS.gold;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.head, c.x + 170, 300);
    ctx.fillStyle = C.COLORS.dim;
    ctx.font = '400 15.5px system-ui, sans-serif';
    c.lines.forEach((line, i) => ctx.fillText(line, c.x + 170, 330 + i * 26));
  }
  ctx.fillStyle = C.COLORS.teal;
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Rare moonbloom: heals a heart — +150 points at full health.', 640, 452);
  labelButton(ctx, getButtons(PHASE.MENU)[0], t);
  ctx.fillStyle = C.COLORS.faint;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillText(`Enter to begin · Best score ${view.best} · M mutes the grove`, 640, 664);
}

function drawResults(ctx, world, t, view) {
  dim(ctx, 0.72);
  const sum = runSummary(world);
  const won = sum.won;
  card(ctx, 330, 122, 620, 460);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = won ? C.COLORS.gold : C.COLORS.magenta;
  ctx.font = '800 46px system-ui, sans-serif';
  ctx.fillText(won ? 'GROVE DELIVERED' : 'THE LIGHT FADED', 640, 196);
  const reason =
    won
      ? 'Every moonseed carried home through the dark.'
      : sum.loseReason === 'time'
        ? 'Dawn came before the last moonseed was found.'
        : 'A bramble snuffed the lantern.';
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 17px system-ui, sans-serif';
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
  const rows = [
    ['Score', String(sum.score)],
    ['Best score', `${view.best}${view.best <= sum.score && sum.score > 0 ? '  ·  NEW BEST' : ''}`],
    ['Moonseeds', `${sum.collected}/${sum.total}`],
    ['Best combo', `×${sum.maxCombo}`],
    ['Near misses', `${sum.nearMisses}`],
    ['Hits taken', `${sum.hitsTaken}`],
    ['Dashes used', `${sum.dashesUsed}`],
    ['Time bonus', `+${sum.timeBonus}`],
  ];
  ctx.textAlign = 'left';
  let y = 262;
  for (const [k, v] of rows) {
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillStyle = C.COLORS.dim;
    ctx.fillText(k, 540, y);
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = k === 'Best score' && view.best <= sum.score && sum.score > 0 ? C.COLORS.gold : C.COLORS.ink;
    ctx.textAlign = 'right';
    ctx.fillText(v, 906, y);
    ctx.textAlign = 'left';
    y += 30;
  }
  ctx.textBaseline = 'alphabetic';
  labelButton(ctx, getButtons(world.phase)[0], t);
  ctx.fillStyle = C.COLORS.faint;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Enter or R — run again', 640, 606);
}

function drawPaused(ctx, t) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.COLORS.ink;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 330);
  ctx.fillStyle = C.COLORS.dim;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · M mutes', 640, 372);
  ctx.textBaseline = 'alphabetic';
  labelButton(ctx, getButtons(PHASE.PAUSED).find((b) => b.id === 'resume'), t);
}

// ---------------------------------------------------------------- frame

/** Renders one complete frame of the game from live state. */
export function render(ctx, world, view) {
  const t = view.t;
  ctx.save();
  if (view.effects.shake > 0 && !view.reducedMotion) {
    ctx.translate(Math.sin(t * 89) * view.effects.shake * 0.5, Math.cos(t * 97) * view.effects.shake * 0.4);
  }

  drawSky(ctx, t, view);
  drawForest(ctx);
  drawGround(ctx, t, view);
  drawSeeds(ctx, world, t);
  drawBloom(ctx, world, t);
  for (const b of world.brambles) drawBramble(ctx, b, t);
  drawTrail(ctx, view.effects);
  drawLantern(ctx, world, t, view);
  drawParticles(ctx, view.effects);
  drawFireflies(ctx, t, view);
  drawVignette(ctx);

  const phase = world.phase;
  if (phase === PHASE.RUNNING || phase === PHASE.PAUSED) {
    drawHUD(ctx, world, t, view);
    for (const b of getButtons(phase, view)) {
      if (b.id === 'mute') drawCircleButton(ctx, b, 'mute', view.muted);
      else if (b.id === 'pause') drawCircleButton(ctx, b, 'pause', false);
    }
  }
  if (phase === PHASE.MENU) drawMenu(ctx, t, view);
  else if (phase === PHASE.PAUSED) drawPaused(ctx, t);
  else if (phase === PHASE.WON || phase === PHASE.LOST) drawResults(ctx, world, t, view);

  ctx.restore();
}

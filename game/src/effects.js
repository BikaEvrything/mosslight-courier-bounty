// Mosslight Courier — particle bursts and the lantern's spark trail.
// Visual-only state: it never affects the simulation, so Node tests need
// none of it. Bursts are seeded so screenshot fixtures stay reproducible.

import { createRng } from './rng.js';

export function createEffects() {
  return { parts: [], trail: [], shake: 0, rng: createRng(0xc0ffee) };
}

/** Spawns a ring or cone of particles at a point. */
export function burst(effects, x, y, opts = {}) {
  const { count = 10, color = '#ffffff', speed = 120, life = 0.5, size = 3, dir = 0, spread = Math.PI * 2, drag = 2.2 } = opts;
  if (effects.parts.length > 360) return;
  for (let i = 0; i < count; i++) {
    const a = dir + effects.rng.range(-spread / 2, spread / 2);
    const v = effects.rng.range(0.35, 1) * speed;
    const l = effects.rng.range(0.6, 1.05) * life;
    effects.parts.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: l,
      maxLife: l,
      size: effects.rng.range(0.6, 1.3) * size,
      color,
      drag,
    });
  }
}

export function pushTrail(effects, x, y, max = 36) {
  effects.trail.push({ x, y, life: 1 });
  if (effects.trail.length > max) effects.trail.shift();
}

export function updateEffects(effects, dt) {
  const parts = effects.parts;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = Math.max(0, 1 - p.drag * dt);
    p.vx *= f;
    p.vy *= f;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  const trail = effects.trail;
  for (let i = trail.length - 1; i >= 0; i--) {
    trail[i].life -= dt * 2.6;
    if (trail[i].life <= 0) trail.splice(i, 1);
  }
  effects.shake = Math.max(0, effects.shake - dt * 26);
}

/** Maps one simulation event to its visual feedback. */
export function eventBurst(effects, ev, reducedMotion) {
  if (reducedMotion) return;
  switch (ev.type) {
    case 'collect':
      burst(effects, ev.x, ev.y, { count: 10, color: '#5ee1be', speed: 150, life: 0.5, size: 3 });
      burst(effects, ev.x, ev.y, { count: 6, color: '#ffcf6b', speed: 90, life: 0.6, size: 2.4 });
      break;
    case 'near':
      burst(effects, ev.x, ev.y, { count: 5, color: '#e8f4ff', speed: 70, life: 0.35, size: 2 });
      break;
    case 'dash':
      burst(effects, ev.x, ev.y, {
        count: 9,
        color: '#ffcf6b',
        speed: 210,
        life: 0.4,
        size: 2.6,
        dir: Math.atan2(-ev.dirY, -ev.dirX),
        spread: 1.1,
      });
      break;
    case 'hit':
      burst(effects, ev.x, ev.y, { count: 16, color: '#ff4fa0', speed: 230, life: 0.55, size: 3.4 });
      effects.shake = 10;
      break;
    case 'heal':
      burst(effects, ev.x, ev.y, { count: 14, color: '#5ee1be', speed: 95, life: 0.7, size: 3 });
      break;
    case 'bloomFull':
      burst(effects, ev.x, ev.y, { count: 18, color: '#ffcf6b', speed: 115, life: 0.7, size: 3 });
      break;
    case 'bloom':
      burst(effects, ev.x, ev.y, { count: 10, color: '#ffe9b0', speed: 45, life: 0.9, size: 2.2 });
      break;
    case 'win':
      burst(effects, ev.x, ev.y, { count: 34, color: '#ffcf6b', speed: 250, life: 0.9, size: 3.4 });
      burst(effects, ev.x, ev.y, { count: 22, color: '#5ee1be', speed: 180, life: 1.1, size: 3 });
      break;
    case 'lose':
      burst(effects, ev.x, ev.y, { count: 26, color: '#ff4fa0', speed: 190, life: 0.9, size: 3.2 });
      break;
    case 'stage':
      burst(effects, ev.x ?? 640, ev.y ?? 380, { count: 12, color: '#5ee1be', speed: 75, life: 0.7, size: 2.6 });
      break;
    case 'flare':
      burst(effects, ev.x, ev.y, { count: 30, color: '#fff4d6', speed: 330, life: 0.6, size: 3 });
      burst(effects, ev.x, ev.y, { count: 20, color: '#ffcf6b', speed: 210, life: 0.8, size: 3.2 });
      effects.shake = 8;
      break;
    // Regional mechanics: feedback only at the moment each mechanic acts.
    // The warnings rely on their field telegraphs and HUD banner instead, so
    // nothing extra competes with them.
    case 'gust':
      burst(effects, ev.x, ev.y, {
        count: 12,
        color: '#ffab4d',
        speed: 200,
        life: 0.45,
        size: 2.6,
        dir: Math.atan2(0, ev.dir || 1),
        spread: 0.9,
      });
      break;
    case 'tide':
      burst(effects, ev.x, ev.y, { count: 10, color: '#6fd6ff', speed: 110, life: 0.6, size: 2.4 });
      break;
    case 'snare':
      burst(effects, ev.x, ev.y, {
        count: ev.hit ? 18 : 10,
        color: '#c9a6ff',
        speed: ev.hit ? 220 : 120,
        life: 0.6,
        size: 2.8,
      });
      if (ev.hit) effects.shake = 5;
      break;
    default:
      break;
  }
}

// Mosslight Courier — the four-grove campaign route.
//
// Pure data: every region is a self-contained difficulty and palette kit that
// the simulation (world.js) and the renderer both read, so tuning and art stay
// in one place per region. No DOM access in this module.
//
// Regions escalate in challenge: the timer tightens, the seed count grows,
// hazards start faster and stack higher, the hazard mix shifts, and (V3) each
// later grove adds one telegraphed field mechanic of its own — see biomes.js.
// Mosslight Hollow carries `mechanic: null` and stays the learnable baseline.
//
// Ground palettes are deliberately lifted above the dark sky so the field,
// its seeds and its hazards separate cleanly even at thumbnail size.

import * as C from './config.js';

export const REGION_COUNT = 4;

export const REGIONS = [
  {
    index: 0,
    id: 'hollow',
    name: 'MOSSLIGHT HOLLOW',
    tag: 'Where the first lanterns were lit.',
    props: 'trees',
    time: C.RUN_SECONDS,
    seeds: C.TOTAL_SEEDS,
    initial: C.BRAMBLE.initial,
    max: C.BRAMBLE.max,
    stageEvery: C.BRAMBLE.stageEvery,
    speedRamp: C.BRAMBLE.speedRamp,
    weights: { drifter: 1, lunger: 1, orbiter: 1 },
    mechanic: null, // the hollow: pure baseline, no field mechanic
    colors: {
      skyTop: '#13294e',
      skyBottom: '#1d4070',
      moon: '#cffff2',
      moonCrater: 'rgba(140,220,200,0.35)',
      moonHalo: 'rgba(110,255,220,0.14)',
      star: '#bfeee2',
      ray: 'rgba(94,225,190,0.05)',
      moonX: 1032,
      moonY: 132,
      moonR: 62,
      propFar: '#0e2242',
      propNear: '#0a1930',
      groundTop: '#1b3d4d',
      groundBottom: '#132c3c',
      tuft: '#2e6b52',
      glowA: 'rgba(94,225,190,0.16)',
      glowB: 'rgba(255,207,107,0.16)',
      seed: '#5ee1be',
      seedGlow: 'rgba(94,225,190,0.65)',
      accent: '#5ee1be',
      accentDim: 'rgba(94,225,190,0.45)',
    },
  },
  {
    index: 1,
    id: 'ambershard',
    name: 'AMBERSHARD WASTES',
    tag: 'Shard storms under a dying dusk sun.',
    props: 'shards',
    time: 68,
    seeds: 12,
    initial: 4,
    max: 7,
    stageEvery: 15,
    speedRamp: 0.18,
    weights: { drifter: 3, lunger: 1, orbiter: 1 },
    mechanic: {
      id: 'gust',
      name: 'SHARD GUST',
      statLabel: 'Gusts weathered',
      tell: 'Shard gusts shove the lantern sideways — read the arrows and lean against the wind.',
      firstDelay: 9, // seconds before the first cycle
      idleMin: 5.5, // seeded pause between cycles
      idleMax: 7.5,
      warn: 1.1, // telegraph time before the shove
      active: 2.0, // how long the wind blows
      push: 215, // downwind shove, px per second
    },
    colors: {
      skyTop: '#2b1509',
      skyBottom: '#572c11',
      moon: '#ffd9a0',
      moonCrater: 'rgba(255,170,90,0.35)',
      moonHalo: 'rgba(255,170,90,0.14)',
      star: '#f5c99a',
      ray: 'rgba(255,160,80,0.05)',
      moonX: 980,
      moonY: 150,
      moonR: 70,
      propFar: '#2a1808',
      propNear: '#1c1005',
      groundTop: '#4d2712',
      groundBottom: '#361b0b',
      tuft: '#8a4d1e',
      glowA: 'rgba(255,171,77,0.16)',
      glowB: 'rgba(255,120,60,0.13)',
      seed: '#ffab4d',
      seedGlow: 'rgba(255,171,77,0.65)',
      accent: '#ffab4d',
      accentDim: 'rgba(255,171,77,0.45)',
    },
  },
  {
    index: 2,
    id: 'tideglum',
    name: 'TIDEGLUM DEPTHS',
    tag: 'A drowned grove lit by a cold lantern moon.',
    props: 'kelp',
    time: 64,
    seeds: 13,
    initial: 4,
    max: 8,
    stageEvery: 13,
    speedRamp: 0.2,
    weights: { drifter: 1, lunger: 2, orbiter: 3 },
    mechanic: {
      id: 'tide',
      name: 'GLUM TIDE',
      statLabel: 'Tides outswum',
      tell: 'Glum tides sweep the grove — outrun the glowing wall or dash straight through it.',
      firstDelay: 10,
      idleMin: 6,
      idleMax: 8,
      warn: 1.4,
      speed: 240, // the wall's sweep speed, px per second
      thickness: 64, // the damaging band, px
    },
    colors: {
      skyTop: '#0a2338',
      skyBottom: '#135062',
      moon: '#bff2ff',
      moonCrater: 'rgba(120,220,255,0.35)',
      moonHalo: 'rgba(120,220,255,0.16)',
      star: '#a9dff0',
      ray: 'rgba(120,220,255,0.05)',
      moonX: 250,
      moonY: 140,
      moonR: 58,
      propFar: '#0d2c3c',
      propNear: '#09202e',
      groundTop: '#17505f',
      groundBottom: '#0f3745',
      tuft: '#2b8577',
      glowA: 'rgba(111,214,255,0.16)',
      glowB: 'rgba(94,225,190,0.13)',
      seed: '#6fd6ff',
      seedGlow: 'rgba(111,214,255,0.65)',
      accent: '#6fd6ff',
      accentDim: 'rgba(111,214,255,0.45)',
    },
  },
  {
    index: 3,
    id: 'umbral',
    name: 'UMBRAL CROWN',
    tag: 'The thorn summit where no moonlight rests.',
    props: 'thorns',
    time: 60,
    seeds: 14,
    initial: 5,
    max: 9,
    stageEvery: 11,
    speedRamp: 0.24,
    weights: { drifter: 1, lunger: 3, orbiter: 2 },
    mechanic: {
      id: 'snare',
      name: 'UMBRA SNARE',
      statLabel: 'Snares evaded',
      tell: 'Umbra snares erupt in violet rings — step out before they close.',
      firstDelay: 9,
      idleMin: 5,
      idleMax: 7,
      warn: 1.4,
      flash: 0.35, // the eruption's brief visual burst
      radius: 150, // the ring, in px
      maxOffset: 170, // the ring centers this close to the courier, never closer than 40
    },
    colors: {
      skyTop: '#191034',
      skyBottom: '#372363',
      moon: '#e6d5ff',
      moonCrater: 'rgba(190,150,255,0.35)',
      moonHalo: 'rgba(190,150,255,0.14)',
      star: '#cdb6f0',
      ray: null,
      moonX: 640,
      moonY: 116,
      moonR: 54,
      propFar: '#201240',
      propNear: '#140b2a',
      groundTop: '#37225f',
      groundBottom: '#241645',
      tuft: '#5f3d96',
      glowA: 'rgba(201,166,255,0.15)',
      glowB: 'rgba(150,110,220,0.13)',
      seed: '#c9a6ff',
      seedGlow: 'rgba(201,166,255,0.65)',
      accent: '#c9a6ff',
      accentDim: 'rgba(201,166,255,0.45)',
    },
  },
];

/** Clamps any integer into the valid region index range. */
export function clampRegionIndex(idx) {
  const i = Math.trunc(Number(idx) || 0);
  return Math.max(0, Math.min(REGION_COUNT - 1, i));
}

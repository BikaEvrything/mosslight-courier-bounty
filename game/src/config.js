// Mosslight Courier — shared tuning constants and the original palette.
// Every runtime number the simulation or renderer needs lives here so the
// game can be tuned from one file. No DOM access in this module.

/** Logical canvas size; the renderer scales this to any display. */
export const LOGICAL_W = 1280;
export const LOGICAL_H = 720;

/** One courier run lasts this many seconds. */
export const RUN_SECONDS = 72;
/** Moonseeds to gather to win the run. */
export const TOTAL_SEEDS = 12;
/** Lantern hearts the courier carries. */
export const MAX_HEARTS = 3;

/** The playfield the lantern may roam (logical pixels). The top band is HUD space. */
export const FIELD = { x0: 64, y0: 116, x1: 1216, y1: 664 };

export const PLAYER = {
  r: 15,
  maxSpeed: 350,
  steer: 9, // how quickly velocity chases the input axis (per second)
  dashSpeed: 980,
  dashTime: 0.22,
  dashCooldown: 2.4,
  dashInvuln: 0.45,
  hitInvuln: 1.6,
};

/** Fast-collection streak: seeds gathered within the window keep the combo. */
export const COMBO = { window: 5 };

export const SCORE = {
  seedBase: 100,
  seedStep: 50, // each extra combo link adds this much
  seedCap: 400, // combo ceiling per seed
  nearMiss: 35,
  bloomFullHealth: 150,
  timeBonusPerSecond: 10,
};

/** Near-miss band: awarded between contact and contact + reach, once per hazard. */
export const NEAR_MISS = { reach: 52 };

/**
 * The Ember: grazing a hazard charges the lantern. A full ember may be spent
 * on one FLARE (E key / touch button) that stills every nearby bramble for a
 * moment — risk pays twice: score now, safety later. Pure simulation data.
 */
export const EMBER = {
  max: 100,
  grazeGain: 34, // one close graze adds this much ember
  flareRadius: 230, // brambles within this radius are stilled
  stunTime: 2.6, // a stilled bramble hangs frozen this long
  stunPoints: 40, // points per bramble stilled
  flareInvuln: 0.9, // invulnerability granted by the flare
  flareActive: 0.5, // how long the flare ring shows
};

export const BRAMBLE = {
  radius: { drifter: 21, lunger: 19, orbiter: 17 },
  initial: 3,
  max: 6,
  stageEvery: 18, // seconds of elapsed run time per difficulty stage
  speedRamp: 0.15, // hazard speed multiplier per stage
  minSpawnDist: 230, // hazards never appear this close to the courier
  contact: 4, // collision forgiveness in pixels
};

export const SEED = {
  r: 13,
  pickup: 30,
  minSpacing: 118, // seeds never spawn this close to each other
  minPlayerDist: 150, // nor this close to the courier's starting point
};

export const BLOOM = {
  r: 15,
  pickup: 30,
  intervalMin: 15, // seconds between rare moonbloom attempts
  intervalMax: 21,
  life: 7, // a bloom lingers this long
  minPlayerDist: 160,
};

/**
 * The Waylight Relay: three lantern posts seeded through every grove. Standing
 * inside an unlit beacon's ring rekindles it — no new controls, only the
 * choice to detour and hold the commit while hazards roam. Each beacon pays
 * points, ember charge and a little time exactly once per run, and lighting
 * all three pays a relay bonus. One-shot per run, so it can never be farmed.
 */
export const WAYLIGHT = {
  count: 3,
  r: 26, // the post's lantern core, in px
  ring: 64, // the activation radius the courier must stand inside
  channel: 0.9, // seconds inside the ring to rekindle one beacon
  scorePerBeacon: 90,
  timePerBeacon: 2.0, // seconds returned per beacon
  emberPerBeacon: 20, // ember charge per beacon (the ember cap still applies)
  relayBonus: 250, // lighting all three
  relayTime: 3.0,
  minSpacing: 300, // beacons never spawn this close to each other
  minPlayerDist: 240, // nor this close to the courier's starting point
};

/** Grade thresholds for a finished run's score. */
export const GRADES = [
  { min: 3400, letter: 'S' },
  { min: 2600, letter: 'A' },
  { min: 1900, letter: 'B' },
  { min: 1200, letter: 'C' },
  { min: 0, letter: 'D' },
];

// Original palette: navy grove, teal moonlight, warm gold lantern, magenta brambles.
export const COLORS = {
  pageBg: '#04070f',
  skyTop: '#070d20',
  skyBottom: '#122447',
  moon: '#cffff2',
  moonCrater: 'rgba(140,220,200,0.35)',
  moonHalo: 'rgba(110,255,220,0.14)',
  star: '#bfeee2',
  ray: 'rgba(94,225,190,0.05)',
  treeFar: '#0b1a32',
  treeNear: '#071021',
  groundTop: '#0e2130',
  groundBottom: '#0a1626',
  mossTuft: '#1d4d3c',
  mossGlowGold: 'rgba(255,207,107,0.10)',
  mossGlowTeal: 'rgba(94,225,190,0.10)',
  gold: '#ffcf6b',
  goldBright: '#ffe9b0',
  goldDeep: '#c98a2e',
  teal: '#5ee1be',
  tealDim: 'rgba(94,225,190,0.45)',
  magenta: '#ff4fa0',
  magentaDeep: '#7c1c50',
  ink: '#e8f4ff',
  dim: 'rgba(232,244,255,0.62)',
  faint: 'rgba(232,244,255,0.28)',
  white: '#ffffff',
  panel: 'rgba(9,18,38,0.72)',
  panelEdge: 'rgba(94,225,190,0.35)',
  scrim: 'rgba(4,8,18,0.55)',
};

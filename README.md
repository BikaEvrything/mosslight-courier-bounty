# Mosslight Courier — V3

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/BikaEvrything/mosslight-courier-bounty/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/BikaEvrything/mosslight-courier-bounty/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A lantern courier carries the light along a **four-grove route**: pick a
region on the route map, gather all of its **moonseeds** before dawn, keep
your **3 hearts** away from the magenta shadow brambles, and dash through
danger when the cooldown allows. Grazing a bramble **charges the ember** —
a full ember buys one **Ember Flare** that stills every nearby bramble for
a moment. Rare **moonblooms** heal a heart, or pay **+150** at full health.
Fast collections chain into a **combo streak** worth escalating points, and
each cleared region earns a letter grade and a locally kept best score.

The V3 draft answers the V2 review with two changes: a **more readable
field** (lifted skies, prop silhouettes and ground palettes, a visible
field frame, stronger seed and lantern contrast, a quieter vignette) and
one **telegraphed field mechanic per later grove**, so the region you pick
changes moment-to-moment play, not just the palette. See the regional
mechanics below.

An original static offline canvas game. Every visual is hand-drawn vector
art on a 1280×720 logical canvas, every sound is synthesized WebAudio, and
there are no images, fonts, libraries, or network requests.

## Status — read this first

**V3 is approved for publication and submission.** This repository contains
the V3 revision; publication alone is not proof of make.fun acceptance or
a score. Earlier V2 badges and scores say nothing about V3. The make.fun
entry page is the authority for submission and judging status.

The four `screenshots/*.jpg` files were recaptured from the current V3 code
in a local Chrome browser, and `dossier.json` was rebuilt from those exact
screenshots and game files. The images are arranged review fixtures, not
proof of human gameplay.

## Play

```sh
node serve.ts          # serves game/ at http://127.0.0.1:8080 (loopback only)
```

Then open <http://127.0.0.1:8080> in a desktop browser. `PORT=9000 node serve.ts`
picks another port. Any static file server pointed at `game/` works too.

### Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Steer | WASD or Arrow keys | drag anywhere on the field |
| Dash | Space or Shift | on-screen DASH button (bottom right) |
| Ember Flare | E | on-screen FLARE button (bottom right) |
| Route map: move between groves | ←/→ or A/D | tap a grove to select it |
| Route map / results: depart, continue | Enter | tap the region again, or the button |
| Pause / resume | P or Escape | on-screen pause button (top right) |
| Back to the route map | B | THE ROUTE button |
| Restart at results | R | RETRY REGION button |
| Mute | M | on-screen mute button (top right) |

Movement is drag-steered: hold and pull from where you pressed; the lantern
chases the offset. Keyboard and pointer both feed the same simulation.
V3 adds no new control — every regional mechanic is played with steering,
dash, and the flare you already have.

### The campaign route

Four groves, each its own palette, timer, seed target, hazard mix and —
from the second grove on — its own field mechanic. Clearing one lights the
next; progress is saved locally (localStorage) and best scores and best
grades per region never regress. A corrupted or tampered save is discarded
safely and the campaign restarts fresh.

| # | Region | Time | Seeds | Hazards | Mix leans | Field mechanic |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Mosslight Hollow | 72 s | 12 | 3 → 6, stages every 18 s | even | — (learnable baseline) |
| 2 | Ambershard Wastes | 68 s | 12 | 4 → 7, stages every 15 s | drifters | Shard gust |
| 3 | Tideglum Depths | 64 s | 13 | 4 → 8, stages every 13 s | orbiters | Glum tide |
| 4 | Umbral Crown | 60 s | 14 | 5 → 9, stages every 11 s | lungers | Umbra snare |

Each region's own seed count is the win condition — in Tideglum and Umbral
Crown, twelve seeds is not enough. Hazards also run faster in later groves
(speed ramp 0.15 → 0.24 per stage).

### Rules

- Collect **every moonseed** within the region's time to win; the run ends
  in a loss if the timer empties or all hearts are gone.
- **Brambles** sting for one heart. A dash grants brief invulnerability;
  its cooldown shows as a ring around the lantern and a HUD pill.
- **Ember & Flare**: passing close to a hazard pays +35 **once per hazard**
  and charges the ember by +34, to a cap of 100. A full ember lets you
  press **E** once: every bramble within ~230 px is **stilled for 2.6 s**
  (frozen and harmless), each pays **+40**, and you get **0.9 s** of
  invulnerability. The ember is then empty and must be recharged; a flare
  cannot be spent early or twice.
- **Combo**: each seed collected within 5 s of the previous one raises the
  streak; points climb 100 → 400 per seed.
- **Moonbloom** (rare): heals a heart, or +150 at full health.
- **Regional mechanics**: every later grove runs one telegraphed field
  hazard on its own seeded clock. Every cycle warns visibly before it
  acts, and all of them cost at most the same shared one-heart rule a
  bramble does — one heart, one invulnerability window, no double damage.
  Dashing (and the flare's invulnerability) works against all of them.
- Winning pays a time bonus of +10 per second left. Grades: S ≥ 3400,
  A ≥ 2600, B ≥ 1900, C ≥ 1200, else D. Per-region bests are kept locally
  (localStorage, save format v2).

### The regional mechanics (V3)

- **Shard gust (Ambershard Wastes).** Marching arrows warn the wind's
  direction across the field, then a ~2 s gust shoves the lantern
  downwind (~215 px/s) while streaks stream with it. Lean against the
  shove, dash with or against it, or position upstream before it lands.
  The result screen counts **gusts weathered**.
- **Glum tide (Tideglum Depths).** The origin edge glows and chevrons
  point the sweep's way, then a glowing wall crosses the whole grove at
  ~240 px/s; its band stings on contact. Outrun it, or dash straight
  through its band during the dash's own invulnerability. A tide that
  catches you doesn't count; the result screen counts **tides outswum**.
- **Umbra snare (Umbral Crown).** A violet ring appears near the courier
  with a shrinking countdown ring inside it; after ~1.4 s it erupts and
  catches anyone still inside. Step out in time, or be invulnerable when
  it closes. The result screen counts **snares evaded**.

Every mechanic's timing and placement comes from the run's own seed, so a
given seed always produces the same schedule. The HUD speaks each grove's
mechanic once at the start of the run, banners each cycle in the HUD band
(where it never covers the playfield), and the route map names the
mechanic on the selected region's panel.

Reduced motion: with `prefers-reduced-motion: reduce`, particles, trails,
screen shake, firefly drift, star twinkle and banner pulsing are
suppressed; the mechanic telegraphs themselves stay drawn so warnings are
never lost. Sound starts only after your first interaction (browser
autoplay policy); M mutes.

## Screenshot fixtures (V3 review aids only)

`game/index.html?shot=map|play|win|lose` renders one truthful frame with
the game's own renderer at an arranged game state and sets
`window.__shotReady = true` after the render completes, for capture
tooling. (`?shot=start` is an alias for `map`.) The fixtures mean:

- `map` — the route map over a mid-route campaign (two groves lit, one
  locked), selection parked on Tideglum Depths.
- `play` — mid-run in Tideglum Depths with the **glum tide mid-sweep**: the
  real simulation is stepped with the courier parked and shielded until the
  tide's wall is sweeping, then the wall is arranged deterministically with
  its leading edge at the field's center and the lantern staged 320 px
  ahead of it, so the wall, its HUD banner (with the sweep direction) and
  normal play HUD all read in one frame. A short scripted steering pass
  follows (fixture guard keeps hearts ≥ 2; the ember is set to a partial
  charge so the meter reads).
- `win` — a region-cleared results screen, reached by real simulation
  steps that collect every seed.
- `lose` — a heart-loss results screen in Umbral Crown, reached through a
  real sim step against a pinned bramble.

**These are review fixtures, not proof of human gameplay.** The four
1280×720 images were captured from this V3 renderer in local Chrome, and
`dossier.json` was rebuilt from the same V3 game and screenshot files.

## Structure

```
main.ts                    entry program: copies game/ + screenshots/ to the
                           output dir and writes dossier.json (kit's buildDossier)
serve.ts                   minimal loopback static server for game/ (node:http)
vendor/makefun-game.ts     kit helper, unmodified
tests/world.test.mjs       node:test suite over the pure simulation
tests/campaign.test.mjs    node:test suite over campaign, ember/flare, regions
tests/biomes.test.mjs      node:test suite over the three regional mechanics
game/index.html            page shell (loads style.css + src/main.js)
game/style.css             letterboxed 16:9 canvas styling
game/src/config.js         tuning constants and the original palette
game/src/regions.js        the four-grove route: per-region tuning, palette
                           and field-mechanic kit
game/src/biomes.js         the three regional field mechanics (pure simulation)
game/src/rng.js            seeded mulberry32 RNG (deterministic)
game/src/world.js          pure simulation: no DOM, importable in Node
game/src/campaign.js       unlock chain, per-region records, strict save v2
game/src/input.js          keyboard + pointer drag steering, edge triggers
game/src/effects.js        particle bursts and the lantern trail
game/src/renderer.js       all vector drawing: scenery, entities, telegraphs,
                           HUD, screens
game/src/audio.js          synthesized WebAudio cues + mute
game/src/main.js           bootstrap, fixed-timestep loop, campaign flow, fixtures
```

The world simulation (`world.js`, `biomes.js`, `rng.js`, `config.js`,
`regions.js`, `campaign.js`) never touches `document` or `window`, so the
same code runs in the browser and in Node.

## Test

```sh
node --test tests/*.mjs
```

Three deterministic suites over the pure modules; no browser is needed to
run them:

- `tests/world.test.mjs` (18 tests): seeded RNG determinism, fair spawn spacing,
  collection and combo scoring, combo decay, timer loss, pause, dash
  cooldown and burst speed, invulnerability after a hit, heart loss and
  heart-based loss, near-miss deduplication per hazard, moonbloom healing
  and full-health bonus, winning with the time bonus, grades, and combo
  point caps.
- `tests/campaign.test.mjs` (18 tests): four-region unlock progression,
  ignored locked-region results, prefix-valid saves, best-score and grade
  retention, `firstIncomplete`/`totalCleared`, deterministic weighted
  hazards, region-specific 13/14-seed win targets, ember charging and cap,
  flare gating/spending/stunning/invulnerability, and inert stunned hazards.
- `tests/biomes.test.mjs` (9 tests): the hollow stays mechanic-free, each
  later grove runs only its own mechanic, same-seed schedule determinism
  (and cross-seed difference), the gust's warn-then-shove behavior, the
  tide's one-hit cap with downwind knockback, dash-through-the-tide
  counterplay, the snare's caught/escaped/shielded outcomes, a paused
  world freezing a live mechanic, the summary's mechanic stat, and a
  lethal mechanic hit ending its step immediately — with a seed staged
  under the courier that must stay uncollected.

### Validation status

**Local verification passed:** `node --check` succeeded for all 11 game
modules plus `main.ts` and `serve.ts`; `node --test tests/*.mjs` passed
**45/45 tests** (18 world, 18 campaign, 9 biome). The Chrome smoke test
captured all four fixtures at 1280×720, exercised map → run → pause → route
→ reselect, logged zero JavaScript exceptions and zero requests outside
localhost, and returned HTTP 400 for a malformed URL. Two independent local
builds produced byte-identical `dossier.json` files. These checks validate
the V3 draft only; it has not been assessed by make.fun.

## Build / local dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into an output directory and
writes `dossier.json` via `vendor/makefun-game.ts` with the kit's caps
(`text_max_bytes: 163840`, screenshots max 4 × 262144 bytes,
`game_max_files: 993`, `game_max_bytes: 50331648`,
`game_path_max_bytes: 1000`). The checked-in dossier matches the current
V3 source and screenshots. See the make.fun entry page for acceptance and
judging status.

## Originality

All names, art, sounds, mechanics, and text are original to this project:
navy-forest / teal-moonlight / warm-gold-lantern / magenta-bramble palette,
hand-drawn canvas scenery, oscillator-based audio, and the gust / tide /
snare field mechanics. No commercial art, names, or copying; no external
assets, network, analytics, or remote fonts.

Licensed under the MIT License — see [LICENSE](LICENSE).

<sub>Prepared for [make.fun](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

# Mosslight Courier

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

An original static offline canvas game. Every visual is hand-drawn vector
art on a 1280×720 logical canvas, every sound is synthesized WebAudio, and
there are no images, fonts, libraries, or network requests.

## Status — read this first

**This is the user-approved v2 campaign revision.** Its source authoring
is recorded in an authentic OpenCode session. Publication and submission to
make.fun are approved; consult the entry page for server acceptance and scores.
The current kit's local check passes its game and transcript/run-record gates;
that local result is not a prize guarantee. Badges may describe an earlier
submission until this revision has been received and assessed.

The four screenshots and `dossier.json` in this working copy now reflect
the current four-region build. These are arranged review fixtures, not
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
Arrow/A/D keys double as map navigation only on the route screen; movement
presses made elsewhere never leak into the map.

### The campaign route

Four groves, each its own palette, timer, seed target and hazard mix.
Clearing one lights the next; progress is saved locally (localStorage) and
best scores and best grades per region never regress. A corrupted or
tampered save is discarded safely and the campaign restarts fresh.

| # | Region | Time | Seeds | Hazards | Mix leans |
| --- | --- | --- | --- | --- | --- |
| 1 | Mosslight Hollow | 72 s | 12 | 3 → 6, stages every 18 s | even |
| 2 | Ambershard Wastes | 68 s | 12 | 4 → 7, stages every 15 s | drifters |
| 3 | Tideglum Depths | 64 s | 13 | 4 → 8, stages every 13 s | orbiters |
| 4 | Umbral Crown | 60 s | 14 | 5 → 9, stages every 11 s | lungers |

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
- Winning pays a time bonus of +10 per second left. Grades: S ≥ 3400,
  A ≥ 2600, B ≥ 1900, C ≥ 1200, else D. Per-region bests are kept locally
  (localStorage, save format v2).

Reduced motion: with `prefers-reduced-motion: reduce`, particles, trails,
screen shake, firefly drift, and star twinkle are suppressed. Sound starts
only after your first interaction (browser autoplay policy); M mutes.

## Screenshot fixtures (review aids only)

`game/index.html?shot=map|play|win|lose` renders one truthful frame with
the game's own renderer at an arranged game state and sets
`window.__shotReady = true` after the render completes, for capture
tooling. (`?shot=start` is an alias for `map`.) The fixtures mean:

- `map` — the route map over a mid-route campaign (two groves lit, one
  locked), selection parked on Tideglum Depths.
- `play` — mid-run in Ambershard Wastes: a short scripted steering pass
  through the real simulation (with a fixture guard keeping hearts ≥ 2)
  and a partially charged ember so the meter reads.
- `win` — a region-cleared results screen, reached by real simulation
  steps that collect every seed.
- `lose` — a heart-loss results screen in Umbral Crown, reached through a
  real sim step against a pinned bramble.

**These fixtures are review fixtures, not proof of human gameplay.**

The four `screenshots/*.jpg` files are current 1280×720 browser captures
of these fixtures. `dossier.json` was regenerated from the same game and
screenshots and is deterministic for an unchanged source tree.

## Structure

```
main.ts                    entry program: copies game/ + screenshots/ to the
                           output dir and writes dossier.json (kit's buildDossier)
serve.ts                   minimal loopback static server for game/ (node:http)
vendor/makefun-game.ts     kit helper, unmodified
tests/world.test.mjs       node:test suite over the pure simulation
tests/campaign.test.mjs    node:test suite over campaign, ember/flare, regions
game/index.html            page shell (loads style.css + src/main.js)
game/style.css             letterboxed 16:9 canvas styling
game/src/config.js         tuning constants and the original palette
game/src/regions.js        the four-grove route: per-region tuning + palette
game/src/rng.js            seeded mulberry32 RNG (deterministic)
game/src/world.js          pure simulation: no DOM, importable in Node
game/src/campaign.js       unlock chain, per-region records, strict save v2
game/src/input.js          keyboard + pointer drag steering, edge triggers
game/src/effects.js        particle bursts and the lantern trail
game/src/renderer.js       all vector drawing: scenery, entities, HUD, screens
game/src/audio.js          synthesized WebAudio cues + mute
game/src/main.js           bootstrap, fixed-timestep loop, campaign flow, fixtures
```

The world simulation (`world.js`, `rng.js`, `config.js`, `regions.js`,
`campaign.js`) never touches `document` or `window`, so the same code runs
in the browser and in Node.

## Test

```sh
node --test tests/*.mjs
```

Two deterministic suites over the pure modules; no browser is needed to
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

Local verification passed: **36/36 tests**, `node --check` for every
`game/src/*.js` plus `main.ts`, and a Chrome smoke test of map → run → pause
→ route → reselect. The browser logged zero JavaScript exceptions and zero
requests outside localhost.

## Build / hand-in bundle

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Copies `game/` and `screenshots/` into the output directory and writes
`dossier.json` via `vendor/makefun-game.ts` with the kit's caps
(`text_max_bytes: 163840`, screenshots max 4 × 262144 bytes,
`game_max_files: 993`, `game_max_bytes: 50331648`,
`game_path_max_bytes: 1000`). The current local dossier was generated from
the current screenshots; two clean builds produced byte-identical JSON.
Local verification is distinct from make.fun's server assessment; consult
the entry page for the current submission status and score.

## Originality

All names, art, sounds, and text are original to this project: navy-forest /
teal-moonlight / warm-gold-lantern / magenta-bramble palette, hand-drawn
canvas scenery, oscillator-based audio. No commercial art, names, or
copying; no external assets, network, analytics, or remote fonts.

Licensed under the MIT License — see [LICENSE](LICENSE).

<sub>Prepared for [make.fun](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

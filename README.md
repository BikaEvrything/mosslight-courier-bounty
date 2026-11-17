# Mosslight Courier

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/BikaEvrything/mosslight-courier-bounty/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/BikaEvrything/mosslight-courier-bounty/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A lantern courier weaves through a moonlit grove: gather all **12 moonseeds**
before **72 seconds** run out, keep your **3 hearts** away from the magenta
shadow brambles, and dash through danger when the cooldown allows. Rare
**moonblooms** heal a heart — or pay **+150** points at full health. Close
grazes pay **+35** once per hazard. Fast collections chain into a **combo
streak** worth escalating points. Finish to earn a letter grade and a local
best score.

An original static offline canvas game. Every visual is hand-drawn vector
art on a 1280×720 logical canvas, every sound is synthesized WebAudio, and
there are no images, fonts, libraries, or network requests.

## Status

This is a **fresh recorded rebuild** written from scratch in this recorded
OpenCode session; the native transcript and all authoring are authentic.
Publication to <https://github.com/BikaEvrything/mosslight-courier-bounty>
and submission to make.fun's best-game-01 bounty are **user-approved and in
progress, but not yet confirmed**. A prior local official-kit preflight
returned `ok:true` with zero failures, including the transcript gates — that
is a local preflight only, **not** official server acceptance and not a
prize guarantee. The official scorer has not yet run on the submission. The
earlier unrecorded local prototype is not part of this session and was not
read, copied, or reused.

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
| Start / run again | Enter, or click the button | tap BEGIN THE RUN / RUN AGAIN |
| Pause / resume | P or Escape | on-screen pause button (top right) |
| Mute | M | on-screen mute button (top right) |
| Restart at results | R | RUN AGAIN button |

Movement is drag-steered: hold and pull from where you pressed; the lantern
chases the offset. Keyboard and pointer both feed the same simulation.

### Rules

- Collect **12 moonseeds** within **72 seconds** to win; the run ends in a
  loss if the timer empties or all hearts are gone.
- **Brambles** sting for one heart. A dash grants brief invulnerability;
  its cooldown shows as a ring around the lantern and a HUD pill.
- **Combo**: each seed collected within 5 s of the previous one raises the
  streak; points climb 100 → 400 per seed.
- **Near miss**: passing close to a hazard pays +35, once per hazard.
- **Moonbloom** (rare): heals a heart, or +150 at full health.
- Difficulty rises gently: an extra hazard joins and hazards speed up every
  18 seconds (stages at 18/36/54 s).
- Winning pays a time bonus of +10 per second left. Grades: S ≥ 3400,
  A ≥ 2600, B ≥ 1900, C ≥ 1200, else D. Best score is kept locally
  (localStorage).

Reduced motion: with `prefers-reduced-motion: reduce`, particles, trails,
screen shake, firefly drift, and star twinkle are suppressed. Sound starts
only after your first interaction (browser autoplay policy); M mutes.

## Screenshot fixtures and captures (review aids only)

`game/index.html?shot=start|play|win|lose` renders one truthful frame with
the game's own renderer at an arranged game state and sets
`window.__shotReady = true` after the render completes, for capture tooling.
**These fixtures are review fixtures, not proof of human gameplay.** The
`play` fixture runs a short scripted steering pass through the real
simulation (with a fixture guard keeping hearts ≥ 2), and `win`/`lose` reach
their end states through real sim steps.

`screenshots/` holds four unedited browser renders of those fixtures
(1280×720 JPEG, each ≤ 256 KiB), captured by the coordinator outside the
agent session: `01-title.jpg` (67522 bytes), `02-gameplay.jpg` (41335),
`03-victory.jpg` (48185), `04-loss.jpg` (41509). The coordinator also loaded
the actual non-fixture game and sent Enter, ArrowRight, Space, M, P, P: the
live screenshot showed gameplay and the last screenshot showed PAUSED — a
limited keyboard smoke test, not exhaustive play-testing; touch, gamepad,
and full-run completion remain unverified. Runtime exceptions: zero.
Requests outside the local game origin: zero. A malformed-URL probe to the
static server returned HTTP 400. Publication and submission are in progress
(user-approved) but unconfirmed; the official server scorer has not run yet
— no score, win, or prize is claimed.

## Structure

```
main.ts                  entry program: copies game/ + screenshots/ to the
                         output dir and writes dossier.json (kit's buildDossier)
serve.ts                 minimal loopback static server for game/ (node:http)
vendor/makefun-game.ts   kit helper, unmodified
tests/world.test.mjs     node:test suite over the pure simulation
game/index.html          page shell (loads style.css + src/main.js)
game/style.css           letterboxed 16:9 canvas styling
game/src/config.js       tuning constants and the original palette
game/src/rng.js          seeded mulberry32 RNG (deterministic)
game/src/world.js        pure simulation: no DOM, importable in Node
game/src/input.js        keyboard + pointer drag steering, edge triggers
game/src/effects.js      particle bursts and the lantern trail
game/src/renderer.js     all vector drawing: scenery, entities, HUD, screens
game/src/audio.js        synthesized WebAudio cues + mute
game/src/main.js         bootstrap, fixed-timestep loop, screens, fixtures
```

The world simulation (`world.js`, `rng.js`, `config.js`) never touches
`document` or `window`, so the same code runs in the browser and in Node.

## Test

```sh
node --test tests/*.mjs
```

Covers: seeded RNG determinism, fair spawn spacing, collection and combo
scoring, combo decay, timer loss, pause (no progression), dash cooldown and
burst speed, invulnerability after a hit, heart loss and heart-based loss,
near-miss deduplication per hazard, moonbloom healing and full-health bonus,
winning with the time bonus, grades, and combo point caps.

Coordinator validation (run outside the agent session; source authoring is
recorded in this session): all 18 tests passed, `node --check` passed every
`game/src/*.js`, and `node main.ts` ran twice with a byte-identical
(SHA-256) `dossier.json` and a vendor file matching the kit byte for byte.

## Build / hand-in bundle

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Copies `game/` and `screenshots/` into the output directory and writes
`dossier.json` via `vendor/makefun-game.ts` with the kit's caps
(`text_max_bytes: 163840`, screenshots max 4 × 262144 bytes,
`game_max_files: 993`, `game_max_bytes: 50331648`,
`game_path_max_bytes: 1000`). It has run twice locally to an output
directory with identical dossier bytes; the official scorer's checks have
not been run.

## Originality

All names, art, sounds, and text are original to this session: navy-forest /
teal-moonlight / warm-gold-lantern / magenta-bramble palette, hand-drawn
canvas scenery, oscillator-based audio. No commercial art, names, or copying;
no external assets, network, analytics, or remote fonts.

<sub>Prepared for [make.fun](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

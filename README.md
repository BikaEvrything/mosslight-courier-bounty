# Mosslight Courier — V4 (LOCAL DRAFT)

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

The V4 draft adds one new, genuinely meaningful route objective: the
**Waylight Relay**. Three lantern posts are seeded through every grove;
standing inside an unlit beacon's ring for a moment **rekindles** it — no
new controls, only the choice to detour and hold your position while
hazards roam. Each beacon pays points, ember charge and a little time
exactly once; lighting all three pays a relay bonus. The seed objective
stays the win condition — the relay is the tempting detour, never the goal.
It also keeps V3's strengths: a readable, brighter field with
biome-specific landmarks, differentiated palettes, and one telegraphed
field hazard per later grove.

An original static offline canvas game. Every visual is hand-drawn vector
art on a 1280×720 logical canvas, every sound is synthesized WebAudio, and
there are no images, fonts, libraries, or network requests.

## Status — read this first

**This is a LOCAL V4 DRAFT.** It has **not been assessed, scored, or
submitted** to make.fun, and nothing here should be read as a claim that it
wins, ranks, is eligible, or is public. **V3 remains the live public entry**
on make.fun; **no submission of this draft was made**. Earlier V2/V3 badges,
scores and ranks say nothing about this draft.

The four `screenshots/*.jpg` files were **recaptured locally from this V4
renderer** at exactly 1280×720, each under the kit's 262144-byte
per-screenshot cap. `dossier.json` was rebuilt from the V4 game files and
these screenshots — **two independent V4 builds were byte-identical**, and
the generated dossier is the one in this draft (see *Validation status*).
The current kit's local pre-submit check also passed locally; that is a
local check only, never a server acceptance, score, or eligibility.

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
**V4 adds no new control** — rekindling a waylight is steering and standing
still, and every regional mechanic is played with steering, dash, and the
flare you already have.

### The campaign route

Four groves, each its own palette, timer, seed target, hazard mix, its own
three-beacon waylight relay, and — from the second grove on — its own field
mechanic. Clearing one lights the next; progress is saved locally
(localStorage) and best scores and best grades per region never regress. A
corrupted or tampered save is discarded safely and the campaign restarts
fresh.

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
- **Waylight relay**: every grove carries **three beacons**. Stand inside
  an unlit beacon's ring (64 px) for **0.9 s** to rekindle it. Each beacon
  pays **+90**, **+20 ember** and **+2 s** — once per run, so the relay
  cannot be farmed. Lighting all three pays a **+250 relay bonus** and
  **+3 s** more. A hit **cancels the commit** (the charge resets where you
  stand), so rekindling a beacon that hazards are closing on is the real
  risk/reward decision. Beacons never spawn on the courier's start, on
  each other, or on a moonseed, and no hazard spawns on top of one. The
  ember and timer caps both hold: a beacon cannot overcharge the ember or
  push the timer past the region's time.
- **Regional mechanics**: every later grove runs one telegraphed field
  hazard on its own seeded clock. Every cycle warns visibly before it
  acts, and all of them cost at most the same shared one-heart rule a
  bramble does — one heart, one invulnerability window, no double damage.
  Dashing (and the flare's invulnerability) works against all of them.
- Winning pays a time bonus of +10 per second left. Grades: S ≥ 3400,
  A ≥ 2600, B ≥ 1900, C ≥ 1200, else D. Per-region bests are kept locally
  (localStorage, save format v2).

### The Waylight Relay (V4)

Three lantern posts are laid through every grove — the hollow included —
from the run's own seed, so a given seed always lays the same relay.
Everything about them reads **gold**, the courier's own light, so the
objective never shares a hue with a hazard: magenta brambles, violet
snares, ice-blue tides, amber gusts. An unlit post shows a thin activation
ring and a slow pulse; a committing courier banks a bright **charge arc**
around the ring; a lit post burns as a warm landmark with four short rays.
The HUD tracks the relay under the timer (`WAYLIGHT RELAY 1/3`), the route
map's region panel names it, and the result screen reports it
(`LIT — 3/3` when the whole chain paid). Leaving the ring or taking a hit
resets the charge; the rewards are one-shot, capped and bounded
(3 × 90 + 250 = 520 points at most), so the relay deepens routing
decisions without becoming the game.

### The regional mechanics (V3, unchanged)

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

### Field readability (V3 → V4)

The lifted skies, prop silhouettes and ground palettes, the visible field
frame, the stronger seed and lantern contrast, and the quieter vignette
are unchanged. V4 adds one **distant landmark silhouette per grove** (the
hollow's stone arch with a strung waylight, the wastes' leaning
mega-shard, the depths' sunken bell arch, the crown's horn ring) for depth
and a stronger sense of place, plus the gold relay itself — bright
positive-object silhouettes that read at thumbnail size. Reduced motion:
with `prefers-reduced-motion: reduce`, particles, trails, screen shake,
firefly drift, star twinkle, banner pulsing and the relay's pulse are
suppressed; the relay rings, charge arcs and mechanic telegraphs stay
drawn so warnings are never lost. Sound starts only after your first
interaction (browser autoplay policy); M mutes.

## Screenshot fixtures (V4 review aids only)

`game/index.html?shot=map|play|win|lose` renders one truthful frame with
the game's own renderer at an arranged game state and sets
`window.__shotReady = true` after the render completes, for capture
tooling. (`?shot=start` is an alias for `map`.) The fixtures mean:

- `map` — the route map over a mid-route campaign (two groves lit, one
  locked), selection parked on Tideglum Depths; the region panel names the
  grove's field mechanic and the relay.
- `play` — mid-run in Tideglum Depths with the **glum tide mid-sweep and
  the waylight relay live**: the real simulation is stepped with the
  courier parked and shielded until the tide's wall is sweeping, then the
  wall is arranged deterministically with its leading edge at the field's
  center and the lantern staged 320 px ahead of it. One beacon is lit, and
  the nearest unlit one is staged mid-channel (the charge arc ~60% banked)
  just ahead of the lantern, so the frame shows the tide wall, its HUD
  banner, the relay HUD count and a filling charge arc in one shot. A
  short scripted steering pass follows (fixture guard keeps hearts ≥ 2;
  the ember is set to a partial charge so the meter reads).
- `win` — a region-cleared results screen with the relay **completed**:
  the courier rekindles all three beacons through real simulation steps
  (shielded, hazards pinned to the corners) before the scripted seed
  collection, so the results card reports `Waylight relay LIT — 3/3`.
- `lose` — a heart-loss results screen in Umbral Crown, reached through a
  real sim step against a pinned bramble.

**These are review fixtures, not proof of human gameplay.** The images
checked in were captured from this V4 renderer in a local headless
browser by `tools/smoke-v4.mjs` (see the next section) and show the V4
relay and contrast work.

## Smoke test and capture (local, private)

`tools/smoke-v4.mjs` is a dependency-free Node script (DevTools protocol
over Node's built-in WebSocket) that:

- serves `game/` on loopback with `serve.ts`,
- recaptures the four fixture screenshots from the game's own renderer
  into `screenshots/` (01-title, 02-gameplay, 03-victory, 04-loss),
- walks title → run → pause → route → reselect with real key events while
  watching for JavaScript exceptions, console errors, and any request
  that leaves localhost,
- checks that traversal URLs are refused with HTTP **404** and that an
  invalid percent escape (`/%ZZ`) is refused with HTTP **400** — in both
  cases with none of the refused file's contents leaking into the response
  body,
- and exits non-zero if any check fails.

```sh
node tools/smoke-v4.mjs                # full pass: screenshots + smoke
node tools/smoke-v4.mjs --skip-shots   # smoke checks only
node tools/smoke-v4.mjs --chrome /path/to/chrome --port 8130
```

The script lives outside `game/` and `screenshots/`, so it never enters
the published dossier, and it writes only into this draft. `game/src/main.js`
exposes one **read-only** probe (`window.__probe()`) for the smoke walk: it
reports the current phase, selection and run counters and changes nothing.

## Structure

```
main.ts                    entry program: copies game/ + screenshots/ to the
                           output dir and writes dossier.json (kit's buildDossier)
serve.ts                   minimal loopback static server for game/ (node:http)
vendor/makefun-game.ts     kit helper, unmodified
tools/smoke-v4.mjs         private V4 smoke test + screenshot capture (not shipped)
tests/world.test.mjs       node:test suite over the pure simulation
tests/campaign.test.mjs    node:test suite over campaign, ember/flare, regions
tests/biomes.test.mjs      node:test suite over the three regional mechanics
tests/waylights.test.mjs   node:test suite over the V4 waylight relay
game/index.html            page shell (loads style.css + src/main.js)
game/style.css             letterboxed 16:9 canvas styling
game/src/config.js         tuning constants and the original palette
game/src/regions.js        the four-grove route: per-region tuning, palette
                           and field-mechanic kit
game/src/biomes.js         the three regional field mechanics (pure simulation)
game/src/rng.js            seeded mulberry32 RNG (deterministic)
game/src/world.js          pure simulation: world, seeds, hazards, relay
game/src/campaign.js       unlock chain, per-region records, strict save v2
game/src/input.js          keyboard + pointer drag steering, edge triggers
game/src/effects.js        particle bursts and the lantern trail
game/src/renderer.js       all vector drawing: scenery, landmarks, beacons,
                           entities, telegraphs, HUD, screens
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

Four deterministic suites over the pure modules; no browser is needed to
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
- `tests/waylights.test.mjs` (9 tests): three fairly spaced, seeded and
  deterministic beacons in every grove (never on the courier's start, a
  seed, another beacon, or a spawning hazard), activation paying
  score/ember/time after the full channel, a lit beacon never paying
  again, leaving the ring cancelling the commit, a hit cancelling the
  commit, the relay bonus paying exactly once and never winning the run,
  the ember and timer caps holding (with the `emberFull` cue), a paused
  world freezing the channel, the summary reporting the relay in all four
  groves, and a pass through the ring lighting nothing.

### Validation status

**Verified locally, against this exact worktree** — run for real; nothing
below is projected:

1. **Syntax** — `node --check` over every module: all `game/src/*.js`,
   `main.ts`, `serve.ts` and `tools/smoke-v4.mjs` parse cleanly.
2. **Unit tests** — `node --test tests/*.mjs`: **all 54 tests pass with
   zero failures** (18 world, 18 campaign, 9 biomes, 9 waylights).
3. **Browser smoke** — `node tools/smoke-v4.mjs`, full log kept at
   `/tmp/mosslight-v4-smoke-final.log`. Every check passed:
   - the fresh-profile route walk (title → run → pause → route → the
     locked grove cannot be selected → re-depart → the relay starts
     unlit),
   - all four fixtures rendered (`window.__shotReady`),
   - no JavaScript exceptions or console errors, no requests outside
     localhost,
   - traversal URLs refused with HTTP 404 and `/%ZZ` with HTTP 400, with
     no file content leaked in any response body,
   - all four screenshots recaptured from this V4 renderer at exactly
     1280×720, each under the kit's 262144-byte screenshot cap,
   - the script awaited Chrome's and the server's actual exit and its
     temporary profile directory was removed.
4. **Deterministic dossier rebuild** — two independent builds
   (`MAKEFUN_OUTPUT_DIR=out1 node main.ts`, then `out2`) produced
   **byte-identical** `dossier.json` files, and the generated dossier is
   the one copied into this draft.
5. **Local make.fun pre-submit check** — the latest kit (downloaded
   2026-11-18; current `skill.md` 1.5.201) was run **locally**, with
   `--worktree`, against the authentic combined three-session OpenCode
   transcript bundle for this draft. Command exit 0, `ok: true`:
   - `thinking_reproduces` **passed**: 3,904/5,653 counted lines authored
     (69.0%), 78 copied, 0 pasted, 1,543 read, 128 absent, and 190 starter
     lines excluded; 123/5,648 text lines unwritten (2.1%, under the 40%
     cap); `main.ts` has 12 authored lines.
   - `thinking_priced` **passed**: all 265 usage records accounted for.
   - `transcripts_run_record` **passed**: 3 sessions / 625 messages, with
     timestamps and tool results verified.
   - `thinking_committed` / `thinking_fresh` **skipped**: this draft is
     unsigned and local, so there is no commit or fresh-checkout state for
     them to check.

**Deferred — server-dependent and unverified.** These kit checks require
the repository to be public on make.fun, which would mean a submission;
V4 remains local, so they have **not run** and nothing is claimed about
them: `repo_public`, `repo_owner`, `repo_created_after_open`,
`commit_in_repo`, `duplicate_snapshot`.

**Crucial boundary:** a passing local check is not a server acceptance,
score, ranking, or eligibility of any kind. This draft was built and
verified entirely locally, using only the approved free GLM model (no
model switch); no submission was made, and **V3 remains the live public
entry** on make.fun.

## Build / local dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into an output directory and
writes `dossier.json` via `vendor/makefun-game.ts` with the kit's caps
(`text_max_bytes: 163840`, screenshots max 4 × 262144 bytes,
`game_max_files: 993`, `game_max_bytes: 50331648`,
`game_path_max_bytes: 1000`). The `dossier.json` in this draft was built
from the V4 game files and the recaptured V4 screenshots; two independent
builds were byte-identical (see *Validation status*). It describes this
local draft only — nothing was published or submitted, and **V3 remains
the live public entry** on make.fun.

## Originality

All names, art, sounds, mechanics, and text are original to this project:
navy-forest / teal-moonlight / warm-gold-lantern / magenta-bramble palette,
hand-drawn canvas scenery, oscillator-based audio, the gust / tide / snare
field mechanics, and the waylight relay and per-grove landmark silhouettes.
No commercial art, names, or copying; no external assets, network,
analytics, or remote fonts.

Licensed under the MIT License — see [LICENSE](LICENSE).

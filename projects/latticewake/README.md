# Latticewake

**Latticewake 1.0.0** is an original browser fixed shooter. M9 prepares a minified, hashed, offline-capable PWA build with original install/share artwork and menu-safe updates. M8 added three-engine browser journeys, bounded local crash recovery, cross-browser replay parity and an automated accessibility audit; M7 added accessible UX, local scores, touch and gamepad support. The M1–M6 shooter, Echo Lattice, powers, boss, optional audio and effects remain intact. Local automated release checks pass, but real hardware/browser and actual-host qualification remain open; no deployment or git tag was created.

## Install and run

Prerequisite: **Node.js 22.22.x**, npm 10 or later. `.nvmrc` pins 22.22.0; with nvm, run `nvm install && nvm use` first. No keys or environment files are needed.

Run inside this project folder, containing package.json:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/?seed=42**. Expect “Run ready · Latticewake 1.0.0” and **Start run**. Press Enter or click the button. Canvas 2D and JavaScript are required; `file://` is unsupported. Failed loading retains reload instructions; Canvas failure offers **Retry canvas**. Service-worker registration is intentionally disabled on the Vite development server.

Ports are strict. If another project owns 5173, leave it alone:

```sh
npm run dev -- --port 5183
```

Then open **http://127.0.0.1:5183/?seed=42**. Stop your own server with Ctrl-C. For trusted-LAN layout testing, use `npm run dev -- --host 0.0.0.0 --port 5183`, then `http://<computer-LAN-IP>:5183/`; this is not HTTPS or real-device qualification.

## Play the M7 checkpoint

- **Left/Right or A/D:** steer horizontally. Acceleration/deceleration is 1,600 units/s², maximum speed 250 units/s, bounds x=8/352. Opposing keys cancel.
- **Space/J (hold):** immediate shot, then every nine simulation ticks, at 540 units/s. Shots are non-piercing; swept collisions handle moving enemies. The existing 128-slot player pool retains its peak-seven ordinary firing bound.
- **Escape/P / Pause run:** freeze everything, including respawn/protection, bonus timers, HP, score and projectiles. **Enter / Resume run** resumes explicitly with held input cleared. Blur, hidden tabs and page-cache lifecycle suspension pause too; no catch-up.
- **G / End session:** abandon the run without scoring remaining enemies. **Restart run** starts fresh; **Return to menu** is available while paused or ended. Losing all lives displays **Game over** automatically.
- **F3 / Debug:** read-only stage/tick/life/respawn/protection/tally, score/hits/kills, divers, player and hostile pool pressure, input, seed/rules and performance diagnostics. No debug controls or gameplay cheats are exposed.
- **X/K:** open the Echo Lattice (details below). Keyboard, standard gamepad and touch feed the same actions; see below.

### Title, briefing, settings and local scores (M7)

- **How to play** opens a skippable briefing from the title and from pause. Opening it during a run pauses the run; **Escape** or **Back to game** closes it. It is not forced before the first run.
- **Audio & effects** saves on this device: Master / Music / SFX levels, mute, low effects, fragments, shake, glow, scanlines, **Colors** (Original, Color-safe blue / amber, High contrast), **Motion** (Follow system or Reduce motion), **Touch movement** (drag pad or large direction buttons) and **Autofire during runs**. Settings never change the rules.
- **Game over** shows the score, stage, seed and rules version, with a **Pilot alias** field (1–12 letters, digits, spaces, `_` or `-`; other characters are removed, blank becomes `PILOT`). **Save local score** records one entry per finished run. **Local top ten** lists the best ten by score, then stage, then insertion order, and is shown as text only.
- **Touch** (phones and narrow windows): drag the pad to steer or use the large left/right buttons; hold **Fire**; tap **Echo** for the capture; **Pause run** stays on screen during play. Several fingers work at once. Lifting a finger, cancelling a touch, losing pointer capture or blurring the window clears the held input.
- **Standard controller** (when the browser exposes one): left stick or D-pad steers, South or right trigger fires, West presses Echo, Start pauses. Menus use D-pad/stick up-down, South to confirm and East to go back. Disconnecting pauses the run. Physical controllers are not tested in this environment.
- **Keyboard-only menus:** Tab / Shift-Tab move focus, Enter activates, and Escape closes the briefing or settings panel.
- **Storage** uses one versioned browser key, `latticewake.meta`, and only for settings and the top ten. If storage is denied, full or unreadable, the status line says data stays in memory until the page closes, and play continues normally.

### Audio and visual controls (M6)

- Click **Enable audio** to opt in. No AudioContext or synthesis blocks the initial menu; no asset downloads or microphones are used. Silent play has exactly the same rules. Ten original synthesized SFX accompany accepted shots, impacts, destruction, captures, pickups, Ward, loss and stage/phase cues; an original 16-bar sequence plays at 110 BPM during runs.
- Open **Audio & effects**. **Master / Music / SFX** sliders default to **60% / 35% / 65%**; **Mute all audio** silences both buses. Gains ramp, effects cap at **24 voices**, music at **8**, and sources release after their short envelopes. The read-only audio meter shows current/peak voices, dropped sounds, retained nodes and the **21-buffer** cache. Muted/disabled events never replay later.
- Pause, blur, background or page-cache suspension clears voices and stops scheduling. Returning/focusing does **not** resume a run or audio. Click **Resume run** (or the existing resume key), or **Resume audio** after a browser audio interruption. A denied/missing/pending API becomes **Retry audio**, not a broken game; try again explicitly when available. Audio enable alone never resumes a paused run.
- **Fragments** and **Small impact shake** default on. Loss shake is at most two logical units for 0.2s. **Canvas glow** and **Scanlines** default off; both use cached images, not per-frame filters. Local boss-hit/capture/ward/pickup/loss outlines never flash the full screen.
- **Low effects** caps DPR at **1.25**, hides fragments/glow/scanlines and freezes decorative parallax/rotation; it never reduces simulation speed or hides hazards, HP, warnings, Echo or protection cues. OS reduced motion also disables shake and scanlines, while retaining gameplay motion and steady cues. Settings survive restarts **and page reloads** where storage is available; audio opt-in is never restored automatically.

### Waves and fair warnings

Each normal stage has 24 raiders entering along seeded 120-tick Bézier paths, staggered six ticks apart into a swaying 6×4 grid. At six seconds the first eligible raider receives **steady brackets and a downward chevron** for **36 ticks (0.6 s)** before its dive and first shot. Move away from the warned column; do not wait at a wall for long.

| Raider | HP | Formation / dive points | Attack |
| --- | ---: | ---: | --- |
| Shardlet — split diamond | 1 | 100 / 180 | Fast shallow pass, straight downward shot, exits below and re-enters its own slot |
| Spindle — three prongs | 2 | 180 / 300 | Hook dive and return; shot aimed at the player's **launch-time** position, never homing |
| Bellframe — hollow arch/core | 3 | 300 / 500 | Slow sweeping dive and return; ringed, diamond-centered capturable pulses |

Stages 1, 2 and 3 progressively enable Shardlet, Spindle and Bellframe attacks. All three silhouettes remain present, preserving M3. Filled/missing pips show HP. Destruction awards points once; a fully formation-scored normal wave is 48 hits / 4,640 points, with higher totals for diving kills. Score and lives carry between stages.

M5 resolves capture first, then hostile damage, then player-shot kills, pickups and completion. **A last kill no longer cancels an earlier hostile hit.** Completion clears all shots, then shows a **150-tick safe tally** before the next stage. The difficulty multiplier is `min(1 + 0.08 × (stage − 1), 2.2)`; the telegraph never shortens. There are at most six warning/diving/returning/exiting enemies and 128 hostile shots, with per-stage lower caps and at least 30 ticks between a shooter's shots. Overflow defers firing without spending cooldown. No unavoidable bullets spawn near the ship.

### Lives, protection and bonus stages

Start with **three lives**. Enemy contact or a hostile chevron costs one life, with at most one damage event in a tick. The ship disappears for **90 ticks**, respawns at center with nearby hostile shots removed (96-unit radius), then has **120 ticks of protection**, shown by a **steady, non-flashing ring**. Movement and firing work while protected. Extra lives arrive at **20,000**, then **70,000**, **120,000**, etc., capped at five; thresholds are consumed even at the cap.

Every fourth stage is a **20-second / 1,200-tick precision bonus**: 20 one-hit targets, 150 points per hit, no shooting, dives or contact damage. Clear all 20 for another 3,000 points at timeout (6,000 total). The fixed timer continues even after a perfect clear. Misses never cost lives. The next wave follows the safe tally. **Every fifth stage is a boss instead.** At stage 20, 40, etc., the boss takes precedence; the bonus follows at the same stage number before advancing to 21, 41, etc.

Restart resets stage, score, lives, extra-life thresholds, all timers, shots, enemies, effects, input/tick counters and player pose. Optional `?seed=` accepts decimal or `0x` uint32 (0–4294967295); invalid seeds show feedback and use crypto-generated run seeds. Seed 0 maps to xorshift32 internal `0x6d2b79f5`. Stage entries use `(rootSeed + stage.seedOffset) >>> 0`, one RNG choice per slot; stars use separate salt `0x9e3779b9`. Rules version: **`m5-signature-1`**. Action tapes are unit regressions, not user-facing replay or cross-browser determinism certification.

The logical field stays 360×640, letterboxed with DPR capped at two. OS reduced motion freezes decorative parallax/rotation and hides fragments/shake/scanlines, **not** gameplay movement, warnings, hostile shots or protection cues. The surrounding HUD is not live-announced on every hit; real-time visual play is not claimed fully screen-reader accessible.

### Echo Lattice, power-ups and the Meridian Engine

- Tap **X/K** as a ringed, diamond-centered pulse approaches. The 32-unit field lasts **24 ticks / 0.4s**; recharge starts immediately for **240 ticks / 4s**, even on a miss. Ordinary chevrons and enemy contact remain dangerous. An uncaptured marked pulse also damages the ship; Ward does not absorb it.
- One capture closes the field and grants one prismatic drone for **360 ticks / 6s**, with no score or life reward. Up to two drones have independent timers; each adds one straight side shot per firing event. Capacity blocks activation without consuming a pulse/recharge. The HUD shows each duration.
- Destroying authored formation slots 2, 11 and 18 drops **W — Ward**, **F — Fan**, **O — Overclock** respectively (zero-based slots). These are not random rolls. Pickups drift down at 60 units/s, have a generous 28-unit swept pickup radius, and expire after **480 ticks / 8s**. A stage transition retires uncollected drops safely.
- **Ward:** one ordinary projectile/contact absorption, **900 ticks / 15s**. **Fan:** three center shots at horizontal velocities 0/−140/+140, **480 ticks / 8s**. **Overclock:** six-tick firing interval, **360 ticks / 6s**. Repeat pickups refresh, never stack. Fan plus two drones gives five shots; the complete volley reserves pool capacity before spawning or spending cooldown.
- Death clears drones, the field and powers. Capture/recharge/drone/power timers freeze during respawn and resume on return; they count down through safe tallies. Pause/background freezes everything. Restart resets all mechanics and counters.
- **Meridian Engine:** no regular formation. Break both side emitters (8 HP each), then the exposed gate (16 HP), then its alternating sweep (20 HP). Each phase has a steady **60-tick / 1s warning**, with no firing or damage to boss parts during that warning. Ordinary volleys and optional marked pulses are mixed. Phase transitions clear only that phase's hazards; victory clears all hazards and awards **5,000 + 500 × boss index** once. Later boss HP increases are capped; shot speed stays 150 units/s.

Plain steering/fire can beat the boss; capture is an optional damage advantage. Automated targeted-policy measurements: **19.93s plain / 17.08s with two captures**, zero deaths; an untargeted sweep loses its three lives in phase 3. These are reproducible scripted tuning observations, **not human novice/experienced playtests or balance sign-off**. See CHANGELOG and ADR-027 for details.

## Diagnostics, recovery and quality checks (M8)

- **Crash log:** errors thrown in the game loop, uncaught page errors and unhandled promise rejections are saved locally in the single `latticewake.meta` key (schema v3). The newest five records keep a timestamp, scene, stage, rules version and a redacted message: URLs, file paths and control characters are removed and the text is capped at 160 characters. No stack traces, aliases or scores are stored, and nothing is uploaded.
- **Recovery:** a failed frame is logged and the run returns to **Resume run** (from play) or the menu (from pause or game over), with a notice. Four consecutive failing frames stop the loop with a notice; reload the page to continue.
- **Export and clear:** open **Diagnostics** on the title, pause or game-over screen. It shows the JSON report. **Download report** saves `latticewake-diagnostics.json`; **Clear crash log** removes the records.
- **Replay parity:** `tests/replay/canonical.ts` runs a 6,000-tick seed-42 tape. The unit test pins its SHA-256; the Playwright replay journey reproduces the same state inside Chromium, Firefox and WebKit.
- **Accessibility audit:** automated checks for accessible names, visible focus on each title-screen keyboard stop, and WCAG contrast of visible text in every palette and in pause. This is not a screen-reader or real-Safari audit.
- **Browser matrix:** `chromium-desktop`, `chromium-touch`, `firefox-desktop` and `webkit-desktop` (Playwright's WebKit, not Safari). Chromium-only CDP journeys (multi-touch emulation and the ten-minute profile) are skipped on the other engines.

## M9 — install, offline play and updates

- A first visit must complete online. On a secure HTTPS origin (or localhost), the page registers a same-scope service worker and precaches the generated static build. Wait for **Offline play ready on this device** before going offline. Settings, scores and the bounded crash log remain local to that browser origin.
- Install from the browser's own **Install app / Add to Home Screen** control where supported; the web manifest uses standalone display and original 192/512px, maskable and Apple touch icons. No installation prompt is forced.
- Test offline after the first online visit: reload once so the worker controls the page, disconnect the network, close/reopen the app, and confirm the title and **Start run** work. The first-ever offline visit is not cached and cannot launch.
- Updates wait in the background. **Install update** is exposed only at the title screen; it activates the waiting worker and reloads there. Updates are never force-activated mid-run. The active build's cache is replaced on activation; a rollback requires restoring the prior static build while online, then allowing its worker to install. No push/background sync is used.
- Vite development disables service-worker registration. The release preview below is local HTTP; localhost is a secure browser context for testing but is not an internet deployment.

## Build, preview and release artifacts

From this folder, run the exact release build and preview commands:

```sh
npm ci
npm run build
npm run preview
```

Build runs strict TypeScript, generates original icons and social art, creates the minified hashed Vite output in `dist/`, emits the scope-relative versioned service worker, and writes SHA-256 + gzip/Brotli measurements to ignored `release-artifacts/release-manifest.json`. Compressed `.gz`/`.br` sidecars are in `release-artifacts/precompressed/`, **outside `dist/`**. Upload only `dist/` to a static host. Never upload sidecars without matching `Content-Encoding` headers, and never publish the source/workspace folder.

Open **http://127.0.0.1:4173/**. If occupied, use `npm run preview -- --port 4185` and **http://127.0.0.1:4185/**. Relative hashed assets, manifest, icons and worker support nested paths; E2E validates `/nested/latticewake/`. Preview is not a production host.

### Static HTTPS host and release checklist

PLAN selects GitHub Pages as the intended static host, with HTTPS required and only the built `dist/` artifact published. The current project-local workflow is **CI only**; it does not publish. After deployment is explicitly authorized, configure the repository's Pages destination to consume the `dist/` artifact from an approved deployment workflow and enable **Enforce HTTPS**. Keep the deployed project at its own path. GitHub Pages controls response compression and headers; local `.gz`/`.br` files are not a claim about production transfer encoding. No destination/domain or authorized deployment is available in this workspace, so actual HTTPS headers, first-visit install, browser cache upgrade/rollback and offline reload on the host remain unverified. Do not deploy this snapshot or create a tag as part of this handoff.

## Verify

From this project folder:

```sh
npm test
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit --audit-level=low
```

On Linux CI, install the browsers with `npx playwright install --with-deps chromium firefox webkit`. Installation is once per Playwright revision. E2E needs a fresh build and owns strict preview ports **4183/4184**; do not run parallel copies or stop unrelated servers. Allow up to 25 minutes on a comparable host for the serial four-project journeys, including real-time two-minute profiles; actual duration depends on browser startup and host speed. Project CI allows 45 minutes on Linux.

- M9 automated verification: `npm run check` passes with **184/184 unit tests** (97.66/95.93/95.75/98.35% coverage); build output includes generated original PWA artwork, relative scope manifest, generated worker, hashed assets and validated gzip/Brotli sidecars. The Playwright release journey tests first-online registration, offline reload and an update held until the title menu. Actual host response headers, physical install surfaces and external hardware/browser qualification are not claimed; see [CHANGELOG.md](CHANGELOG.md). M8's recorded four-engine outcome and remaining cross-device limitations are also in the changelog.
- Individual Certo gates: `npm run build`, `npm test`, `npm run lint`, `npm run typecheck`.
- `check`: zero-warning lint → strict types → unit coverage → build → locked license/origin/notices gate → gzip/Brotli budgets. Coverage floors remain 90% statements/lines/functions, 85% branches.
- The **139 M1–M5 unit cases and their versioned goldens remain unchanged**. M6 adds 16 cases for PCM/score bounds, event deduplication/storage, real feedback emission, effect/checksum parity and missing audio. The earlier M5 added 22 cases covering exact capture/drone timing, marked-only swept contacts, capacity, death/reset, all power combinations, pickup expiry/configs, boss shields/phases/saturation/awards, stages 20/40 precedence, tuning policies and replay. M4 assertions change only for intended M5 rules: boss precedence, powered peak 11, damage-before-kill and the versioned whole-run golden.
- Seed-42 M5 tape: **3,600 recorded actions**, identical full rules snapshots at 30/60/90/120/144 Hz and under cosmetic saturation. SHA-256: `a7ecd372325f6359f0ff6b0baca16337d332aba7c77eb0b95577ca25ca8707a5`. The prior whole-run sweep now ends at tick 5,811 under M5 rules; its versioned hash is in ADR-027.
- Production-browser journeys retain loading/retry, native keys/focus/lifecycle, resize, reduced motion, shot/HP pixels, exact pause/reset, nested assets and clean-console checks. M5 extends the real-control stages 1–4 journey into the boss, plus visible capture-field pause/reset checks. Two-minute stationary-fire profiles collect authored powers and may reach game over; they are **not sustained late-stage benchmarks**.
- Results and intentional test changes are recorded in [CHANGELOG.md](CHANGELOG.md). Traces/screenshots live in ignored `test-results/` and `playwright-report/`. Local Chromium phone-layout emulation is **not** real phone/controller, Safari/Firefox/WebKit, thermal/GC or M8/M9 qualification. Hosted CI remains unverified.

### Optional ten-minute M6 audit

After a fresh `npm run build`, run from this folder:

```sh
CI=1 LATTICEWAKE_PROFILE=1 npm run test:e2e -- --grep 'M6 ten-minute'
```

Two Chromium viewports run in parallel on this host: 20 seconds warmup plus at least ten minutes of real-key stages 1–5, bonus stages, repeated boss captures and restarts, with audio/glow/scanlines on. Reports include frame intervals, post-GC heap, listeners/nodes and sampled allocation stacks. The test driver/raster readback adds measurement overhead. This is not a configured-cap late-stage benchmark, human listening test, reference-laptop or physical-phone sign-off; those and actual Safari/iOS remain M8. Do not run another Playwright copy while its strict ports are owned. The normal suite does not include this opt-in long audit.

## Stack, licenses and boundaries

Strict TypeScript 6.0.3, Vite 7.3.8, native Canvas and WebAudio; **no runtime npm dependencies**, external fonts, analytics, accounts or application network API calls; only validated local settings/scores are stored. Vitest, ESLint and Playwright are development tools. No dependencies, lockfile changes or new permissions were added for M6. Original art/audio recipes are in ASSETS.md; nothing is fetched from third parties. [DECISIONS.md](DECISIONS.md) records architecture and milestone boundaries; [ASSETS.md](ASSETS.md) records original art recipes.

[LICENSE](LICENSE) covers original code/assets. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) inventories 208 distinct locked development packages. After an intentional dependency change, regenerate/review notices with `node scripts/check-licenses.mjs --write`, then rerun checks. Project-local read-only CI is [`.github/workflows/latticewake-ci.yml`](.github/workflows/latticewake-ci.yml), intended for this folder as repository root; no parent workflow was installed.

[PLAN.md](PLAN.md) is APPROVED. Do not launch nested Certo. No push, git tag, deployment or publication is part of this work. Production sign-off remains open for M8 real-device/browser qualification, actual-host cache/header checks and title/trademark review.

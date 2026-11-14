# Latticewake — decision log

**2026-11-11 · Plan APPROVED; M0-B/M1/M2/M3/M4/M5 complete; M6 implementation authorized.** ADR-001–013 preserve the original M0-A proposal/history. Explicit approval and current choices are recorded below; M2 choices are ADR-017–018; M3 choices are ADR-019–021; M4 choices are ADR-022–024; M5 choices and continuation verification are ADR-025–028. M6 choices are ADR-029–031. They supersede the old approval-only workflow where stated. Detailed option scores, sources, risks, and reversal criteria remain in [PLAN.md](PLAN.md), section 2.

## ADR-001 — Approval precedes foundations

The request explicitly forbids game code before plan approval. Therefore this delivery contains documentation only. Split M0 into M0-A (research/plan) and M0-B (approved tooling, CI, blank canvas). M0-A has no runnable game; M0-B is a canvas foundation; M1 is an interactive engine testbed. Those exceptions to the general combat-playability rule are proposed explicitly for approval. M2 starts playable shooting. Each later checkpoint preserves delivered play, is checked and committed, and stops for approval. Resuming an interrupted run is not plan approval.

No remote push, PR, publication, host change, or external message is authorized by this planning task. Local milestone commits are explicitly requested. Project location: `projects/latticewake/`; preserve the shared workspace and all `.certo/` state.

## ADR-002 — Native runtime, not a game framework

Choose Canvas 2D, browser input APIs, native WebAudio, and analytical collision tests. Compared Canvas/PixiJS/Phaser; WebAudio/Howler/HTML audio; native/framework/standalone input; custom sweeps/Matter.js/framework arcade collision. The finite 360 × 640 playfield and capped scene favor a small transparent runtime and DOM-free deterministic tests. There are **no runtime npm dependencies**.

Trade-off: we own pooling, browser lifecycle, accessibility, and input/audio edge cases. Bound that work with small interfaces, profiles, and real-browser tests. Reconsider PixiJS only after a measured rendering bottleneck survives atlas/DPR/culling optimization. No rigid-body solver without a new physical-simulation requirement. See D1a–D1d in PLAN.

## ADR-003 — Strict TypeScript, compatible rather than newest

TypeScript over checked JSDoc JavaScript and unchecked JavaScript: typed actions, state/events, pooled handles, and stage data reduce long-term errors without adding runtime weight. Use strict checks and keep browser adapters out of simulation.

Research found TypeScript 7.0.2 is latest, but typescript-eslint 8.72.2 declares `<6.1.0`. Propose TypeScript 6.0.3 with compatible Vite 8/ESLint 10/Vitest 5/Playwright 1.65 candidates, Node 22.22.x and npm lockfile. These are metadata-checked **candidates**, not an installed/verified toolchain. Recheck maintenance, engines, peers, vulnerabilities, and licenses in M0-B. If support changes, select a supported compiler/parser pair; never force incompatible peer dependencies or suppress warnings.

## ADR-004 — Vite and npm; HTTP/HTTPS, never file URLs

Vite over custom esbuild wiring and unbundled server-served JS for documented dev/build/asset handling. npm is the package manager; commit the project lockfile, use `npm ci` thereafter, and keep dependencies/configuration local. No scaffolding into or overwriting an existing workspace directory.

Development: loopback Vite port 5173; production preview: port 4173; both strict-port. Production is static `dist/` over HTTPS, not the Vite server. `file://` is unsupported due to module/asset origins and PWA constraints. Relative asset base and no history routing permit project subpaths. LAN development is useful for layout, but does not substitute for HTTPS gamepad/PWA validation. Proposed exact commands are documented in README; none exists before M0-B.

## ADR-005 — Tests begin with foundations, not M8

Choose Vitest + Playwright over Node test runner + separate TS compilation + Playwright, and Jest + Cypress. They are development-only and reuse the selected toolchain while covering Chromium/Firefox/WebKit. Test actual rules with seed/action tapes and manual clocks, not mocks of the rules. Browser smoke starts M0-B and grows each milestone; M8 qualifies real-device/browser performance and coverage.

Targets by M8: 90% core statements/lines/functions, 85% branches. WebKit is not real Safari, emulated touch is not a real phone, and injected gamepad snapshots only verify normalization. Hardware performance, controller interaction, and iOS audio must be checked honestly. No app tests are invented for this documentation-only milestone.

## ADR-006 — Static hosting and controlled offline lifecycle

GitHub Pages is primary; compared Netlify, Vercel, and itch.io. It needs no application server and is free for public repositories. Verify private-repository eligibility and any existing shared Pages site before publishing; do not overwrite another project. Deployment is artifact-only and requires explicit authorization. Netlify is the fallback if Pages eligibility/destination conflicts, subject to current terms.

M9 adds an original, small scoped service worker and manifest rather than Workbox/plugin dependencies or an online-only release. Cache only the finite first-party build, version caches by build, never clear others' caches, and offer updates at the menu, not mid-run. First visit needs a network connection. Generate compressed artifacts, but verify the chosen host's actual transfer encoding; do not promise Pages will directly serve precompressed `.br` files.

## ADR-007 — Original procedural assets, cached for play

Create original vector ship/enemy/particle recipes; bake a bounded atlas once and use image blits in play. Compare a hand-authored original atlas/recordings and licensed free packs. Packs may be legally free yet conflict with original-design requirements. No imported music, enemy sprites, recognizable lookalike silhouettes, or external fonts.

WebAudio synthesizes short PCM buffers; the music is an original bounded-voice sequence. No audio codec/download dependency. Audio and decorative randomness use separate streams from gameplay. Original icon/social images derive from the same recipes. Add ASSETS.md when assets exist with author/source/license/generator records; add notices before any outside asset is used. Intended project code and original-asset license: MIT, finalized before release; no third-party license is overwritten by that choice.

## ADR-008 — Deterministic rules own time and randomness

60 Hz fixed steps with interpolation; bounded catch-up and explicit hidden-tab pause. Xorshift32 with documented zero-seed mapping and known vectors; URL uint32 seed or one crypto-generated seed at new-run start. Log rules version with each run. No simulation `Math.random`, wall clock, render/audio dependency, or unstable iteration.

Effective actions are indexed by simulation tick. Separate streams for gameplay, visuals, and audio; quantized state and sampled paths avoid reliance on cross-engine transcendental math. A seed alone is not a replay without action history and the same rules version. Cross-browser replay equivalence is an M8 evidence gate, not a claim from planning. Dropped catch-up time slows a struggling device instead of silently fast-forwarding hazards.

## ADR-009 — Small bounded arcade design

Provisional original title **Latticewake**; not a legal/trademark clearance claim. Horizontal fixed shooter, 360 × 640 logical portrait playfield, letterboxed on larger screens. Original Needle player, Shardlet/Spindle/Bellframe enemies, Meridian Engine boss; no inherited commercial names or assets.

Default run: three lives, deterministic stage configs, escalating capped difficulty, nonlethal bonus every fourth stage, boss every fifth. At a common multiple, boss first, bonus immediately after, then the next numbered stage. Score/HP/timing values in PLAN are initial tuning data, not playtest findings. Extra-life thresholds: 20,000, 70,000, 120,000, etc.; cap five lives. No accounts, multiplayer, server scores, monetization, or editor.

## ADR-010 — Signature capture is a risk/reward energy intercept

Echo Lattice captures only explicitly marked enemy pulses, not ships or ordinary shots. Open for 24 ticks, cooldown 240 ticks, one pulse per activation; up to two independently expiring 360-tick side-fire drones. Disable capture at capacity; no hidden refresh or farming score. This keeps the genre's capture/power-up theme while giving it an original mechanism and clear failure case.

Ward/Fan/Overclock are deterministic pickups with bounded timers and non-multiplying refresh rules. Simultaneous collisions have a specified stable precedence. M5 records actual tuning and optional-mechanic viability; do not assume numbers are balanced before playtesting.

## ADR-011 — Accessibility, platform limits, and privacy

Native semantic DOM menus/HUD, keyboard focus, color-independent hazard cues, high contrast, reduced motion, separate audio buses/mute, and touch targets. Keyboard first, touch/gamepad parity in M7. Standard gamepad supported; arbitrary rebinding and every nonstandard device are out of v1.0 scope. English strings are extracted for later translation; no translation service dependency.

Store only validated settings and local top-ten scores, with safe aliases and in-memory fallback if storage fails. Crash records remain local, bounded, redacted, and manually exportable. Omit optional analytics entirely: no tracking/network permissions for v1.0. Do not claim a real-time visual shooter is fully screen-reader playable.

## ADR-012 — Dependency and evidence policy

Only justified, actively maintained permissive dependencies. Review direct/transitive locked packages, licenses, vulnerabilities, and compatibility before installation is accepted. Allow MIT/Apache-2.0/BSD-2-Clause/BSD-3-Clause/ISC/0BSD; unknown/copyleft entries require replacement or an explicit revised plan, not a bypass. Keep notices. The direct candidates and inspected release dates are in PLAN; transitive inventory is deferred because no lockfile exists yet.

Performance/size values are targets, not measurements: 60 Hz on documented laptop and real reference phones, capped entities/DPR, ≤120 KiB gzip JS, ≤250 KiB critical first-load payload. M8/M9 cannot be signed off with fabricated hardware, Safari, deployment, or compression evidence. A future plan change needs an explicit entry, trade-offs, tests, and milestone impact.

## ADR-013 — Revalidation preserves approval and workspace boundaries

A repeated `tasks/galakka.md` request identifies the same M0 planning deliverable; it is not explicit approval of the existing proposal. Revision 2 therefore reviews the documents and rechecks candidate registry metadata without installing tooling or starting M0-B. The README validator excludes only the managed `.certo/` directory, not arbitrary hidden entries, and still rejects unexpected implementation files. Certo state remains unread and untouched.

## ADR-014 — Retain the installed, verified foundation toolchain

**M0-B/M1 · 2026-11-10.** Build on the existing npm lockfile rather than replacing working tooling with the original research candidates. Actual pins: TypeScript 6.0.3, Vite 7.3.8, Vitest and coverage-v8 4.1.12, ESLint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.2, Playwright 1.65.0, and @types/node 22.20.5. Node 22.22.0 is pinned in .nvmrc (npm 11.11.0 used locally). The installed build/test/type/lint integration passes with no runtime npm dependencies. The earlier attempt's reason for diverging from Vite 8/Vitest 5 was not recorded; do not invent a peer-conflict history. An upgrade is a separately evidenced change, not a prerequisite for this passing M1 foundation.

Retain the existing minimatch 11.0.5 security override; it pins a transitive package, not an incompatible compiler/parser peer override. `npm audit --audit-level=low` reports zero known vulnerabilities in this run. The lock/license/origin gate inventories 208 distinct development packages and matches THIRD_PARTY_NOTICES.md. Explicitly accept BlueOak-1.0.0, a permissive grant to use/copy/change/distribute/sublicense with license retention and warranty disclaimer, alongside the original allowlist. No copyleft or unknown licenses are waived. Audit results are time-bound, not a guarantee against future disclosures.

## ADR-015 — Project-only CI and Certo-controlled milestones

**M0-B/M1 · 2026-11-10.** The user explicitly approves PLAN.md and authorizes finishing only M0-B/M1; Certo advances milestones after checks. Do not launch a nested `certo` process or inspect the parent workspace to execute the task preamble's launch command. Do not start M2.

The strict project-only boundary takes precedence over the old proposed parent-workspace CI path. Provide `.github/workflows/latticewake-ci.yml` within this project, configured for this folder as repository root. It has path-filtered push/PR plus manual triggers, a 15-minute limit, read-only contents access, no persisted checkout credentials, no deployment, and exact official action commits: checkout v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1`. Release-tag references and Node 24 action runtimes were checked through GitHub's API; Ubuntu 24.04 hosted runners run the actions while the project uses Node 22.22.0. YAML parses locally; hosted execution is not claimed. GitHub does not discover workflows in a parent repository's project subfolder, and no parent workflow was installed. There is no Git repository in this snapshot, so no commit is made.

## ADR-016 — Preserve the M1 testbed and verify its real boundaries

**M1 · 2026-11-10.** The existing core already satisfies the engine design: accumulator with 250 ms delta/five-update caps, fractional interpolation, explicit scene transitions, per-tick keyboard samples, resource cancellation checks, and letterboxed DPR-capped rendering. Preserve it rather than rewrite it. G / End test is a visible M1-only scene-navigation control, not a production combat cheat. Entity count remains honestly zero. The cached grid and moving marker demonstrate rendering/interpolation, not player movement. Root seed and `m1-testbed-1` are metadata, not replay implementation.

Extend tests without altering old behavioral assertions: jittered manual clocks, awaited loader ordering/cancellation, capture down/up between ticks, and actual rendered probe movement/frozen pause. No rule mocks or production test API are added. Existing Canvas fault injection is necessary to exercise browser API denial; retry returns to native contexts. Pixel polling uses a separate readback canvas with `willReadFrequently` rather than weakening the console-warning gate or changing the game's drawing context. Filesystem test scratch data now lives under ignored project-local test-results/ and is removed in finally blocks, avoiding system temporary directories. Full replay, pooling, combat, audio, other devices, and real-hardware qualification remain their planned later milestones.


## ADR-017 — M2 fixed-tick firing range and atomic bullet pool

**M2 · 2026-11-10.** Certo now authorizes player/shooting only; this supersedes ADR-015's historical instruction not to start M2. Keep the engine, action adapter, loader, scene transitions and lifecycle. `FiringRange` composes DOM-free `Player` and `BulletPool`; App samples effective actions once per fixed tick. No enemies, collision, lives, scoring, audio, storage or new input devices are implemented.

Use the approved 250 units/s maximum, 1,600 units/s² approach-to-target acceleration/deceleration, 1/1024 position/velocity quantization, hit-radius clamp (8; visible craft is wider), fixed y=580 and muzzle y=560. Held fire spawns immediately then on ticks 1, 10, 19… (9-tick interval); shots move 540 units/s. Release does not bypass cooldown. Existing shots move/expire before new shots spawn; new previous/current poses are synchronized. Exactly seven ordinary shots coexist at steady state (63 movement ticks of lifetime).

Preallocate 128 stable slots and reuse the same objects across updates and range restarts. Reserve the entire requested volley before touching any slot, ID or generation; denial increments diagnostics, consumes no cooldown/shot count, and retries on the next tick. Stable slot-order scans, monotonic per-run shot IDs, and slot generations reject stale or duplicate releases. Reset clears occupancy/counters/IDs, but retains generations so handles from the old run cannot release a new occupant. Generations are allocator bookkeeping, not part of replay snapshots; tests compare effective tick state. A fixed single-shot velocity array is shared, not allocated while firing. Hostile/enemy/particle/event pools stay with their owning later milestones.

G / **End session** remains an explicit firing-range session exit through the existing gameover scene; it is not a combat win/death cheat. Start/restart resets player, bullets, cooldown, shot/input counters, tick count and visual seed. An explicit URL seed repeats the layout; without one each new session gets a crypto seed. A pause preserves state and clears held actions. Replay tests use tick-indexed action tapes at 30/60/90/120/144 Hz, not raw browser timing; no user-facing recording/replay or cross-engine parity claim is added.

## ADR-018 — M2 presentation and baseline evidence boundaries

**M2 · 2026-11-10.** Replace only the M1 interpolation probe with cached original Needle/shot art and three star layers. Retain the cached grid and existing renderer/UI files rather than performing unrelated renames. Bake a 160×96 atlas once at boot; render sprites with blits and interpolated previous/current poses. Seed the 72-star layout with `(rootSeed ^ 0x9e3779b9) >>> 0`, independent of all gameplay state. Starfield objects are reused at session reset; continuous vertical scroll and player-relative lateral parallax use render time only. Reduced motion fixes decorative time/player offset, never gameplay transforms. Resource failure/retry now covers grid, atlas and renderer creation.

Expose ordinary, read-only DOM diagnostics (actual entity count = ship + active bullets, shots, pool peak/denials, x/velocity/cooldown) and a non-live shot-count text; no window-owned game object or test-control API. Preserve all earlier browser assertions except deliberate M2 labels/rules version and changing the autonomous-probe pixel journey to real key-driven ship movement. New browser tests await scene and diagnostic boundaries, preserving exact reset/pause assertions without relying on 250 ms UI refresh timing.

Initial performance evidence uses actual local headless Chromium desktop and DPR-3 phone-layout emulation, with two minutes of held fire in each. RAF measurement arrays belong to tests, not production; they add observer overhead. These are firing-range regression baselines, not late-stage combat, physical phone/controller, thermal/display, allocation-profile or M8/M9 hardware sign-off. Real reference devices remain explicitly unverified. No dependencies, permissions, network requests, external assets or credentials are added.


## ADR-019 — M3 one owned formation, not M4 stage progression

**M3 · 2026-11-10.** The current request authorizes enemies and formation only, superseding ADR-017's historical M2-only boundary. Compose the unchanged default M2 `FiringRange` rules inside a DOM-free `FormationSession`. Eight each of Shardlet/Spindle/Bellframe reserve a 6×4 layout, with 1/2/3 HP and 100/180/300 points. The 48 preallocated enemy objects are interleaved concrete subclasses (16 per type); the authored formation uses only eight per type. A future stage author must respect these typed capacities or explicitly revise the allocator. No unused hostile/boss/drop pools or attacks are implemented ahead of their owning milestones.

Keep 24 slot records separate from entity storage. Slots transition empty → reserved → occupied or destroyed; owners carry pool index plus generation. Destroying an enemy does not free its formation slot for reuse. Restart/repeat resets reservations and per-run IDs, not allocator generations. Every slot launches at tick `1 + 6 × slotIndex`, follows one of two precomputed 120-tick cubic offset paths, and then holds its moving destination. Root-seeded xorshift32 consumes exactly one bit selection per slot at reset; draw order, effects and firing never consume it. The whole grid uses a fixed 64-sample quarter-sine lookup (256-tick period, ±12 X and ±2 Y); positions are quantized to 1/1024. No gameplay transcendental sway evaluation, browser time or allocation in updates.

No dives, enemy shooting, stage number/difficulty, bonus rounds, lives, extra lives or power-ups. All kills, including entry kills, use the approved formation score (the higher diving values are inapplicable). A complete formation is exactly **48 hits / 24 kills / 4,640 points**. Clearing suppresses new shots, lets existing shots and 30-tick explosions drain, then uses the existing gameover scene for a focused **Repeat formation** button. This resets score as a fresh attempt; it is not an automatic wave. G / End session remains an explicitly labeled early session exit, not a kill/score cheat.

## ADR-020 — Relative swept contacts with bounded grid, ordering and effects

**M3 · 2026-11-10.** Use conservative circle radii 12/14/16 for the three enemies, plus player-shot radius 3. Shared layer categories reject friendly/cosmetic contacts. Build a 64-unit uniform grid from expanded previous/current enemy bounds, and query swept bullet bounds. Each of the 60 cells can hold all 48 enemies; query scratch flags deduplicate without discarding candidates. A preallocated 6,144-contact buffer covers the entire 128×48 Cartesian product. In-place heapsort orders by impact fraction, bullet ID, then enemy ID, without a hot-path comparator closure or resized array. Generation and liveness checks precede resolution; a consumed shot cannot damage twice, and a later shot falls through an already destroyed target to its next valid contact.

In collision-aware sessions, advance existing shots/enemies → gather/resolve contacts → recycle offscreen shots → spawn the new volley. The range's default M2 step is preserved. Deferring only expiry but not spawning caused a temporary peak-eight ordering defect during development; the fixed composition restores the original peak-seven bound and has a dedicated 7,200-tick regression. Offscreen recycling must follow the final sweep so a fast crossing shot cannot disappear before contact resolution.

Score and HP are rules, not event-consumer effects. A reusable 192-event buffer emits one hit/destroy record per accepted impact, tagged with tick and entity ID (at most 128 impacts in a normal tick). Overflow is counted and cannot change score. Twelve fixed radial fragments per kill use 512 reused particle slots, expire after 30 ticks, and count dropped cosmetics instead of growing. Cosmetic capacity/visibility never influences rules or gameplay RNG. Full allocation/GC qualification remains M8; storage-identity tests and source review are not a heap-profile claim.

## ADR-021 — M3 readable original art and honest verification scope

**M3 · 2026-11-10.** Extend the original in-memory atlas to 448×192 pixels, retaining the Needle/shot/star texels and adding split diamonds, rotating three-prong Spindles, hollow Bellframe arches with cores, damaged variants and explosion texels. Render interpolated blits, with persistent filled/missing HP pips above each silhouette; no per-frame sprite-path construction. OS reduced motion freezes decorative parallax/Spindle rotation and omits fragments, never entry/sway, shot motion, hits or score. Pause/clear controls stack above the expanded optional debug panel to remain readable on portrait layouts. The surrounding HUD exposes score, kills and shot occupancy without live-announcing every hit. Read-only diagnostics add actual reserved/live enemy count, hits, damaged enemies and effect/event pressure; no production test-control API.

The scene UI now owns scene status; the loading/error shell only reveals the ready canvas instead of overwriting the menu with stale M2 text. Existing browser assertions change only for intentional M3 copy/rules metadata, actual ship+shot+enemy counts, and the fact that enemies continue moving under reduced motion. Seeded/frozen decoration assertions now read an enemy-free lower-field region; exact paused full-canvas assertions remain. Seeded raster comparisons await fitted backing dimensions after scene-driven toolbar resizing. A real-input browser journey takes a single nonlethal shot before inspecting a missing HP pip (continuous firing can destroy a target between 250 ms diagnostic samples). It then sweeps with ordinary keys/fire to 4,640 points and repeats. Test-only readback/RAF allocations are not production features. Chromium emulation is not real phone, Safari/Firefox/WebKit or M8/M9 hardware sign-off.


## ADR-022 — M4 composed waves, validated data and milestone boundary

**M4 · 2026-11-11.** Certo authorizes attacks/waves only. Keep `FiringRange` and `FormationSession` as unchanged-behavior M2/M3 fixtures; App now owns `RunSession`, composing those player/formation/effect objects with an attack director, separate hostile pool and vitals. The supplied baseline had an unfinished `fireEnemy` path putting upward enemy shots in the player pool: 97/99 earlier tests passed. Remove that incorrect path rather than bless its changed checksum. Both earlier golden fixtures pass unchanged.

Typed stage data validates kind, uint32 seed offset, layout (≤24, ≤16/type), two path IDs, entry duration/stagger, warning/cadence, diver/shot caps, shooter interval/speed, bonus duration and empty reserved drops. No external config or executable strings. All M3 silhouettes remain; stages 1–3 introduce their attacks progressively. Entry seeds are `(rootSeed + imul(stage − 1, 0x9e3779b9)) >>> 0`; stars retain the separate visual stream. Firing and effects consume no gameplay RNG.

M4 has ordinary combat and every-fourth-stage bonuses only. Stage 5+ is ordinary combat pending M5's Meridian Engine, marked pulses, power-ups and stage-20 boss/bonus precedence. Difficulty caps at 2.2, dive duration floors at 90 ticks, cadence at 90, warning stays 36, simultaneous warnings/dives/returns/exits cap at six, hostile pool at 128 and shooter interval at least 30. These are regression-tested initial settings, not human balance sign-off.

## ADR-023 — Owned telegraphs, hostile sweeps and damage precedence

**M4 · 2026-11-11.** Split formation advance/resolution without changing default M3 stepping. Slot index/generation ownership survives warnings/dives/returns/exits and death until stage/reset. First warning is at stage tick 360; steady brackets/down-chevron precede launch by 36 ticks. Quantized sampled paths give Shardlet a shallow pass, bottom exit beyond y=690 and re-entry after 30 ticks; Spindle hooks and Bellframe sweeps, then returns over 90 ticks to the current swaying slot. Shardlet/Spindle path targets use launch-time player X; Bellframe uses mirrored X. Spindle shots aim at launch-time player position, never home. Bellframe shots are ordinary unmarked chevrons. Diving/returning/exiting kills score 180/300/500; warning/entry/formation use 100/180/300.

Hostiles own 128 stable objects, IDs/generations and velocity components, never player-shot layers or scoring. Stage limits defer fire and count overflow without consuming cooldown. Divers fire only above y=480, from a 20-unit downward muzzle offset, after contacts. Existing sweeps precede expiry and new volleys.

Tick order: vitals/player/old shots → formation/attacks → player shots and scoring → completed-objective safe tally → remaining hostile/contact player damage → expiry → new volleys. A last kill wins a simultaneous lethal hazard, clears all projectiles and starts a safe 150-tick tally. Otherwise earliest relative swept impact wins; hostile IDs break shot ties and shots precede contact on equal times. At most one life loss per tick; contact does not destroy/score an enemy. Tests include fast offscreen crossing and simultaneous hazards. Cosmetics never alter rules.

## ADR-024 — Run vitals, fixed bonus timing and browser evidence

**M4 · 2026-11-11.** Start with three lives. Extra life at 20,000 then every 50,000, cap five, thresholds consumed at cap. Death clears player shots/velocity, disables control/fire for 90 ticks, centers/stops the craft and clears hostiles within radius 96 on respawn. A steady non-flashing ring marks 120 ticks of protection; movement/fire work while protected. Pause/blur freezes all timers. No drones/power-ups exist yet. Third death freezes rules at game over; explicit restart resets counters/timers/thresholds/pools but retains allocator generations.

Bonus waves use 20 mixed original silhouettes, one effective HP each, no dives/shots/contact damage, 150 points per hit and invariant 1,200-tick duration even after a perfect clear. Award the extra 3,000 once at timeout. Retire missed targets without kill credit. After any wave a safe 150-tick tally precedes the next seeded layout, carrying score/lives. G/End session abandons, never wins or grants score.

Read-only HUD/diagnostics show stage/lives/score, bonus/tally/protection/death state and actual entities (visible ship + reserved/live enemies + both projectile pools). Brackets, hostile chevrons and the ring persist under reduced motion. Browser clear/repeat intentionally becomes automatic progression and start/pause/restart run. The old browser equation `shots = ceil(total ticks / 9)` no longer applies through death/tally/cleared-bonus firing suppression; unchanged M2/M3 unit fixtures still enforce active cadence and peak seven. Real-key M4 journeys have no mutation hooks, cheats or rule mocks. New exact-pause assertions await the actual scene boundary before sampling diagnostics. No dependencies, storage, network APIs or permissions added. Chromium emulation is not physical-phone, cross-engine or M8/M9 qualification.


M4 completion retains the existing frame-local first-resumed-diagnostic observer rather than raising the no-catch-up bound or altering the simulation to accommodate driver latency. The full 40-case suite and 20 repeated resume cases pass with no further code/test changes. Compare paused rule state or canvas, not the live render-FPS value. The two-minute stationary-fire profiles reach game over at tick 1,497 and cannot stand in for sustained combat, reference-device or M8/M9 qualification. M4 is complete locally; Certo controls the next milestone.


## ADR-025 — M5 capture, power-ups and deterministic contact precedence

**M5 · 2026-11-11.** Compose DOM-free `EchoLattice`, `PowerUps`, `DropPool` and `MeridianEngine` in the existing `RunSession`; retain the M2/M3 standalone fixtures and their goldens. No new dependency, browser mutation interface, storage, network request or permission. Rules version is `m5-signature-1`.

Echo uses a 32-unit field, exactly 24 active ticks, immediate 240-tick cooldown and two independent 360-tick drone slots. Sweep marked pulses against relative ship motion and resolve earliest impact, then stable projectile ID; ordinary shots cannot be captured. One successful capture closes the field, removes one pulse and adds a drone without points/lives or RNG draws. Capacity blocks activation before spending cooldown. Bellframe shots are now marked; boss volleys mix marked and ordinary shots. Uncaptured pulses remain lethal and are not absorbed by Ward.

The approved M5 contract supersedes ADR-023's M4 last-kill-wins ordering: advance → marked capture → remaining hostile/contact damage → player-shot deaths/score → drops → completion/expiry → new volleys. Damage clears the player's old shots before they can kill. Earliest hazard wins, shots precede contact on equal times, at most one damage/absorption per tick. Ward absorbs one ordinary projectile or enemy contact, with no points; it is not another drone or a general capture shield. The conflicting M4 test and versioned whole-run checksum intentionally change; no unrelated M1–M3 assertions are relaxed.

Ward/Fan/Overclock refresh to 900/480/360 ticks. Fan contributes center velocities 0/−140/+140; drones independently add straight shots at −24/+24 origin offsets. Overclock changes firing events to every six ticks; otherwise nine. `BulletPool.spawnVolley` accepts optional offsets and reserves the entire 1–5-shot volley before mutating; denial consumes no cooldown. Power combinations cannot grow the 128-slot pool. Death removes field/drones/powers; capture cooldown freezes during respawn, resumes on return, and resets on a fresh run. Alive timers count through safe tallies; pause/background advances no rules.

Twelve stable drop slots hold authored pickups, not random rolls: combat formation slots 2/11/18 drop Ward/Fan/Overclock once on destruction. Drops drift at 60 units/s, expire after 480 ticks, and use a 28-unit relative swept pickup radius. This drift lets even a top-row drop reach the ship's pickup radius within its lifetime. Collect after damage, so death cannot grant a replacement power in the same tick. Clear uncollected drops/fields at stage boundaries; retain live powers/drones and their own expiries. Config validation rejects unknown kinds, duplicate/out-of-range source slots, >12 entries and drops in boss/bonus stages.

## ADR-026 — Meridian Engine phases and numbered-stage precedence

**M5 · 2026-11-11.** One boss with three stable circular parts, no regular formation. First break left/right emitters (radius 20, 8 HP each); shielded central gate (radius 27) then exposes for 16 HP; final alternating sweep has 20 HP. Later indices add 2 HP per emitter and 4 per gate phase, capped after twelve increments. Award `5000 + 500 × floor(stage / 5)` once, only at final defeat. Count the shielded gate as a visible entity too.

Initial entry and both phase changes use 60-tick steady bracket warnings, no outgoing fire and no boss damage. Part contacts gather into a bounded 384-record buffer and sort by impact time, bullet ID, part ID; stale, consumed, dead or newly shielded parts cannot score another hit. Phase-specific negative hostile owner IDs do not overlap regular enemies. Clear only the retiring phase's hazards during a phase change; the safe victory tally clears all hazards. Stage-five cadences are 90/72/54 ticks at 150 units/s, with two emitter shots or three gate shots; every other gate volley (and a live left emitter) offers a marked pulse. A whole boss volley defers at capacity without spending cooldown. The final fan alternates its horizontal bias and moves on the quantized sway lookup, never a homing aim.

Every fifth numbered stage is a boss, ahead of the fourth-stage bonus rule. A boss at 20, 40, etc. sets a run-owned bonus-interlude flag after its safe tally, runs the nonlethal 1,200-tick bonus under the same stage number, then advances exactly once. Test both 20 and 40 through real session phase damage/award/tally paths. Restart clears the interlude and every boss timer. No stage-select URL or production fixture was added.

## ADR-027 — M5 tuning evidence and its limits

**M5 · 2026-11-11.** Retain the approved 24/240/360 capture timings and 900/480/360 power durations. Set the explicit first-boss HP/cadences above and 60-unit drop drift; do not shorten telegraphs or raise ordinary projectile speed to compensate for drone damage. Reproduce with `npx vitest run tests/unit/signature.test.ts --reporter=verbose`.

| Automated policy, stage 5 | Clear/outcome | Deaths | Captures / activations | Points |
| --- | --- | --- | --- | --- |
| Target exposed parts and dodge ordinary shots; no capture | 1,196 ticks / 19.93s, clear | 0 | 0 / 0 | 5,500 |
| Same targeting, approach marked pulses and capture | 1,025 ticks / 17.08s, clear | 0 | 2 / 2 | 5,500 |
| Basic 80-tick alternating sweep/fire, seed 42 | 2,313 ticks / 38.55s, game over in phase 3 | 3 | 0 / 0 | 0 |

The targeted comparison repeats at seeds 7/42/2026; identical results are expected because boss patterns have no RNG draws and each comparison starts at the same stage-five pose. Capture succeeds on 100% of this scripted policy's two activations and shortens clear time by about 14.3%, without farming points or healing. This demonstrates optional advantage, not population success rate. The basic sweep exposes a positioning/targeting risk: blindly crossing lanes is not sufficient; readable exposed-part labels and steady one-second phase warnings are retained rather than making capture mandatory. All 24 combinations of three power toggles × drone counts are tested separately.

No humans were available in this noninteractive run. These are **automated novice-proxy/targeted-policy observations, not novice/experienced human playtests**, accessibility sign-off or final balance certification. Human/device/cross-engine qualification remains outside this M5 claim. A recorded 3,600-action M5 tape spans capture, boss phases and subsequent combat at 30/60/90/120/144 Hz plus cosmetic saturation; checksum `a7ecd372325f6359f0ff6b0baca16337d332aba7c77eb0b95577ca25ca8707a5`. The former M4 whole-run input policy now ends at tick 5,811 under M5 drops/boss/damage precedence, checksum `bf65b25930fb3753ce47125e1b46ad2740f0f3d6bdacea31433607ee0d358a86`. Historical M4 evidence stays historical; M2/M3 goldens remain unchanged.


## ADR-028 — Complete the interrupted M5 without changing passing rules

**M5 · 2026-11-11.** The continuation audits the delivered implementation against the approved capture, power-up, boss and precedence contracts, then reruns the full unit/common/browser gates and a real dev-server smoke. The initial full browser run passes 41/42 cases: the desktop boss driver captures three pulses but dies in phase 2 before two drones overlap. Its trace/raster shows it repeatedly returning to the central ordinary-shot lane while fire is deliberately held for the two-drone check. Repair the test's real-key steering, not the passing capture rules: hold beside that lane within the wider capture radius, and estimate braking distance from rendered ship motion instead of overshooting into hazards. All phase/capture/two-drone/victory assertions, timeouts, coverage floors and versioned goldens stay intact. No production cheat, rules mutation, retry or gameplay easing is added. Reconcile the stale M4 handoff and M5 verification placeholders after fresh verification; do not launch nested Certo.

The ad hoc dev smoke initially pressed Capture and Pause before a simulation sample, so the existing transition correctly cleared the pending capture. Await the visible capture diagnostic before pausing; exact capture, frozen-tick and frozen-raster assertions then pass. This is smoke synchronization, not a rule change or a reason to weaken the checked-in browser tests. Human tuning remains unverified as stated in ADR-027; completion means the M5 feature checkpoint, not M8/M9 production qualification. Certo alone authorizes the next milestone.



## ADR-029 — M6 optional native audio, never a rules dependency

**M6 · 2026-11-11.** Add one lazily created `GameAudio` adapter, explicit **Enable audio** and native master/music/SFX gain buses. No context, buffers, permission prompt, synthesis or audio download occurs before activation. Default levels are 60% / 35% / 65%; mute and all bus changes ramp over 15 ms. Settings are session-only; persistence/input expansion remains M7. Silent play is complete play.

Ten original mono PCM patches are cached after unlock: glassy triangle/sine shots, low-pass seeded-noise impacts/destruction/loss, rising capture/pickup/open/ward tones and phase/clear cues. Audio noise uses `(runSeed ^ 0x85ebca6b) >>> 0`, never the gameplay stream. An authored 16-bar, 4/4, 110-BPM score uses eight lead pitches and three bass pitches; 128 eighth-note positions loop. All 21 buffers are in memory, generated at the context sample rate; run restart replaces only the ten SFX buffers. No codec, external music, asset library or runtime dependency.

Use 24 fixed SFX and eight fixed music voice slots. Their gain nodes/buses are retained; each playback needs a native one-shot AudioBufferSourceNode (WebAudio sources cannot be restarted). One stable per-slot `onended` handler disconnects/releases the source. Overflow discards cosmetic sound, never queues delayed sounds or changes gameplay. Per-voice SFX/music ceilings 0.1/0.06 plus bounded PCM keep even maximum-bus theoretical combined peaks below 1. Music schedules only 120 ms ahead from AudioContext time, without a setInterval or wall-clock gameplay dependency; overdue scheduling anchors at now instead of replaying a backlog.

Pause/game-over/menu stop sources with a 10-ms ramp, then suspend after 20 ms; blur/hidden/pagehide latch a gesture requirement. Resume run or Resume audio explicitly resumes an already opted-in context. Browser interruptions clear voices and never auto-resume on focus/state recovery. Unlock has a 1.5-s timeout and lifecycle cancellation so pending activation cannot reactivate a paused/disposed app. Missing APIs, denied/pending activation, partial buffer allocation and source/start failures release the graph and present **Retry audio** while gameplay continues. Native state events cannot overwrite an unavailable state with a misleading ready/suspended state. Teardown cancels activation/timers, disconnects nodes and closes the owned context.

## ADR-030 — Event-only feedback and conservative cached effects

**M6 · 2026-11-11.** Preserve `m5-signature-1` and all earlier golden fixtures. `RunSession.events` is a separate 192-slot reused presentation queue: global run tick, stable entity ID, kind and logical position. Formation's historical queue is unchanged in behavior. Forward accepted hits/deaths and emit accepted volley, field, capture, pickup, ward, player loss, phase and clear events. Boss swept contacts optionally write part events; no SFX adapter is imported into rules. App consumes each completed tick immediately, including multiple simulation steps in one RAF. Audio deduplicates by tick/entity/kind in fixed storage, intentionally coalescing same-part same-tick hits; stale ticks are ignored, history resets on a new run. Queue saturation drops presentation only.

Retain existing 512-slot fragments and damaged enemy atlas variants. Add 32 reused short localized outline marks for boss hits/captures/pickups/ward/loss; no full-screen flash or strobe. Player loss can shake at most two logical units for twelve ticks, never shifting collision coordinates. OS reduced motion suppresses shake, parallax, rotation, scanlines and fragments, keeping static hit outlines and every hazard/protection/capture cue. Low effects additionally caps backing DPR at 1.25 and suppresses decoration. Fragments/shake default on; glow/scanlines default off. Controls never reset or step rules.

Reuse unused space in the **704×304** 2× atlas for the identical hostile chevron and a radial glow texel; no per-projectile path building or per-frame shadowBlur. Cache a 360×640 transparent scanline sheet once. Glow blits behind the player, never hiding a hazard; scanlines are a subtle static overlay. Do not expand into M7 persistence, color settings, tutorial, touch/gamepad or scores.

## ADR-031 — M6 evidence boundaries and native adapter tests

**M6 · 2026-11-11.** Unit coverage expands to pure synthesis, dispatch and feedback; native WebAudio/Canvas/DOM adapters remain real-browser tested, like the existing rendering/UI adapters, not counted as fully unit-covered. Keep the 90/85/90/90 floors unchanged. No mocked rules or weakened old assertions: only the expected menu checkpoint copy changes from M5 to M6. Native Enter/Space on the new details summary must bypass game confirm/fire, like buttons and links; a production repro demonstrated accidental run start before extending that existing input predicate.

Playwright production journeys cover native unlock, actual gain ramps, mute, explicit pause/blur/interruption resume, teardown, visual quality changes and unchanged paused rules. Only failure boundaries unavailable as reliable browser controls are injected (missing API, rejected/pending resume, single buffer/source/start failure); then real code/native rendering continues. The voice-cap unit stress bundles the unchanged audio adapter in memory via Vite (`write:false`) and drives native AudioContext nodes with bounded event fixtures; it is not an app cheat, test endpoint, alternate game implementation or shipped harness.

The opt-in `LATTICEWAKE_PROFILE=1` browser audit uses real semantic controls/KeyboardEvents through stages 1–5, safe bonuses, optional boss captures and repeated restarts, with glow/scanlines on. After 20 seconds warmup, measure at least ten minutes per viewport, CDP post-GC heap, DOM/listener metrics, native audio counters and allocation sampling. Arrays/readback and the steering observer allocate in the test, not the production loop. This is sustained repeated combat rather than the older mostly-game-over stationary profile, but not a cap-filled late-stage workload, real phone, reference laptop, audible human mix review, Safari/iOS interruption, thermal or cross-engine qualification. Those remain explicit M8 gates. Exact results, limitations and commands belong in CHANGELOG/README.

## ADR-032 — M7 local storage: one versioned key, validated, memory-safe

**M7 · 2026-11-14.** One localStorage key, `latticewake.meta`, holds schema `version: 2`: validated settings and at most ten local scores. Other keys are never read or written. A stored payload that is oversized (over 32 KiB), malformed, a future version, has a non-object `settings`, or holds more than 100 scores is rejected: the stored text stays untouched and play continues in memory with a visible notice. Version 1 audio/effect settings migrate to version 2, keeping the new accessible defaults for everything else.

Every persisted field is validated on read and write: finite 0–1 bus levels, booleans, enumerated palette/motion/touch values, safe-integer score, stage and seed bounds, and a bounded rules-version string. Aliases reduce to 1–12 letters, digits, spaces, `_` or `-`, defaulting to `PILOT`; score rows are rendered with `textContent`, never HTML. Ranking is score descending, then stage descending, then insertion order, keeping ten rows. A finished run offers one score entry, cleared after saving. Quota, denied access and corrupt payloads fall back to memory. No accounts, cookies, network leaderboards, telemetry or personal data.

## ADR-033 — M7 input parity and accessibility settings

**M7 · 2026-11-14.** Keyboard, standard gamepad and touch all feed the M1 action contract. Touch uses Pointer Events with pointer capture: a drag pad (48 logical pixels of travel for full speed), optional large left/right buttons, a held **Fire** button and a separate **Echo** button that emits one capture edge. Up to ten pointers are tracked; cancellation, lost capture, blur and pause clear them. Gamepads use the standard mapping only: left stick with a 0.18 dead zone, D-pad, South/right-trigger fire, West capture edge, Start pause, and menu back/next/previous/decrease/increase/confirm commands. A disconnect clears held controls and pauses; buttons held through pause or reconnect stay suppressed until released.

The mixer keeps the strongest movement magnitude and breaks ties by the latest change; fire and capture are OR-combined. **Autofire** only forces fire during runs. Palette, reduced motion, touch layout and autofire are presentation or input choices: the paused rules snapshot is identical with and without them, and browser tests assert it.

No physical controller or phone was available. Browser automation injects standard snapshots only at `navigator.getGamepads`, and touch uses CDP touch events in emulated Chromium. Real controller connection behaviour, real phone multitouch and iOS/Android quirks remain unverified until M8.

## ADR-034 — M7 UX boundaries, colour mapping and deferred polish

**M7 · 2026-11-14.** Title, pause, game-over and the **How to play** briefing are semantic DOM. Every visible string comes from the English dictionary in `src/ui/strings.ts`; a unit test proves every `data-i18n` key exists and every template has all of its placeholders. Only the structure is i18n-ready: no language switcher ships.

The briefing is a native, skippable dialog reached from the title and from pause, with focus trapped while open and Escape or **Back to game** to close. It is deliberately **not** forced before the first run: immediate and seeded starts stay identical to the M6 journeys, while the briefing stays one action away from the title. This is a documented deviation from the design's "title → tutorial → stage" wording, not a hidden omission.

Colour-safe mode maps lit sprite families: cyan allies to blue, amber hazards to orange, and magenta capture accents and lavender Spindle tones to a reddish purple. High contrast maps each pixel to black or white. Pixels below a brightness floor, meaning the navy field, grid and dim frame, are left unchanged. The first M7 version mapped the navy field to bright blue, so ivory shots and the ship lost contrast. Visual review caught it, and `tests/unit/palette.test.ts` now covers the mapping. The earlier browser palette journey only asserted that the raster changed, so it could not detect the defect.

Deferred to their milestones: crash diagnostics and export (M8), real Safari/Firefox/iOS/Android and controller evidence (M8), and offline/PWA behaviour (M9).

## ADR-035 — M8 crash diagnostics: bounded, redacted, local, recoverable

**M8 · 2026-11-14.** Crash records extend the single `latticewake.meta` key to **schema version 3** with a `crashes` array, kept to the newest five. Version 1 and 2 payloads migrate with an empty list. Oversized, malformed or future payloads keep the M7 rule: the stored text is untouched and play continues in memory. A record holds only an ISO timestamp, the scene, the stage, the rules version and a redacted message. The message strips control characters, replaces URLs and path-like tokens and is capped at 160 characters; stacks, aliases, scores and the page URL are never stored. The pure module `src/platform/diagnostics.ts` owns redaction and validation; `src/ui/diagnostics.ts` renders the JSON report, downloads it and clears it, with no network path.

Recovery is frame-scoped. Each RAF callback reschedules itself first, then runs the game step inside a guard. One failure is recorded and the run returns to pause (or a menu or game-over screen returns to the menu) with a notice. Four consecutive failing frames halt the loop with a notice instead of retrying forever. Uncaught `error` and `unhandledrejection` events are recorded but do not change the scene, because they may come from code outside the loop.

## ADR-036 — M8 cross-engine evidence and documented platform accommodations

**M8 · 2026-11-14.** Playwright's Firefox and WebKit join the Chromium desktop and touch projects. The shared suite runs on all four. Chromium-only CDP journeys are skipped elsewhere, with the reason stated in the test: multi-touch emulation and the M6 ten-minute heap profile.

Two real cross-engine findings were fixed in the adapter, not the test. Firefox does not implement `AudioParam.cancelAndHoldAtTime`, so the stop-voice path threw after the state change and left a pause stuck in play. The adapter now detects the method and falls back to cancel-then-hold at the current gain. Firefox also makes an overflowing scroll region keyboard-focusable, so the settings panel is now a labelled group and the focus journey accounts for that stop. macOS Safari's default Tab order skips range inputs and checkboxes, so the WebKit journey focuses the volume slider programmatically and still checks the End-key control. The title-screen focus audit uses a lower WebKit minimum for the same reason.

Three WebKit injected-failure audio journeys (buffer, source and start failures) are marked `fixme` for WebKit only. Their probe reads the stored context as `running` after the app-side `close()` resolves `closed`, while an explicit `close()` on the same probed context does reach `closed`. The cause is not established, so these remain open and are not counted as passed.

The four-project suite now uses one worker and zero retries. The two-worker run caused 150ms of dropped frame time in Firefox's pixel-guided boss driver and made a two-minute soak collect one instead of two expected pickups. Both unchanged journeys passed alone. Serial execution avoids concurrency-induced loss of input/RAF budget rather than loosening their real-control assertions.

## ADR-037 — M8 measurement scope, replay parity and what remains unsigned

**M8 · 2026-11-14.** Replay parity uses `tests/replay/canonical.ts`, a 6,000-tick seed-42 tape with a sweeping hold-fire input and periodic capture presses. The unit test pins its SHA-256 (`b5c17c94…e371`). The E2E replay journey bundles the same module in memory with Vite, runs it inside each browser and compares the exact JSON string and hash. The rules use no transcendental `Math` functions; only the audio patches call `Math.sin`, so the parity result is about the rules path.

Automated accessibility checks cover accessible names for every visible control, visible focus on each title-screen stop, and WCAG contrast of visible text in the three palettes and the pause scene. Contrast composites translucent panels over their ancestors and does not sample the canvas beneath them. The checks are not a screen-reader audit and do not cover real Safari, iOS, Android or controllers.

Performance evidence comes from this Apple M1 host only, not the Intel i5 reference laptop, and no phone was tested. The opt-in ten-minute profile is still the only heap and frame evidence. Its results are recorded in CHANGELOG as local measurements, not reference-hardware sign-off. M8 production sign-off stays open until reference hardware, real phone and real Safari runs are recorded.

## ADR-038 — M9 local release candidate, bounded offline cache and safe updates

**M9 · 2026-11-14.** Release version is `1.0.0` in the package and lockfile. Vite remains at relative base `./` so the game, manifest and worker can live beneath a project path. Build generates original icons/share art and a service worker from the static `dist/` inventory; a content-derived build ID names each cache. Cache keys include the service worker's scope path, installation precaches only same-origin release files, navigations use network-first with the cached entry document as offline fallback, and only exact precache assets are cache-first. Activation removes only older cache names bearing this game's scope-specific prefix. No navigation runtime cache, external content, push or background sync.

An updated worker waits for explicit user activation from the title menu. The app does not message `skipWaiting()` during play; activation claims clients and the update flow reloads after the user has reached the title. Vite development does not register a worker. The first visit needs a connection and the service worker needs a successful install before offline use. Generated gzip/Brotli sidecars and checksums live outside `dist/`; the host must not serve those sidecars without correct `Content-Encoding` headers.

GitHub Pages remains the planned static HTTPS host, but no URL, Pages slot, remote credentials or deployment authorization was available. The local workflow remains CI-only. Therefore production HTTPS headers, actual-host compression, installation/offline/cache rollback, M8 real-device/browser qualification, the known WebKit failure-path probe, and title/trademark review are unsigned. Per task instruction, no deployment, publication or git tag was performed; the result is a local release candidate, not a production sign-off.


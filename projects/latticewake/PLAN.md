# Latticewake — implementation plan

**Revision:** 2 · **Research date:** 2026-11-10 · **Status:** PROPOSED — awaiting plan approval

An original, single-player fixed shooter about defending a luminous navigation lattice from geometric raiders. All names, silhouettes, visual recipes, sound patches, and musical phrases will be original. This document proposes work; it does not claim that the game exists yet.

## 1. Approval boundary and scope

The current deliverable is **M0-A: research, design, and plan only**. No game source, package manifest, dependency installation, CI workflow, canvas, or service worker may be created before approval of this plan. Documentation is committed locally; nothing is pushed or deployed.

The request both prohibits implementation before approval and asks every milestone to be playable. Those cannot both apply to a plan-only deliverable. Proposed resolution:

- **M0-A (this delivery):** documents and documentation checks; gameplay, FPS, lint, unit tests, and build are explicitly **not applicable**, not reported as passing.
- **M0-B (only after plan approval):** repository-local tooling, CI, loading/error shell, and blank responsive canvas. This is a working foundation, not a shooter.
- **M1:** an interactive navigation/state testbed, not yet combat.
- **M2 onward:** a playable firing range, then a progressively complete shooter. Each checkpoint preserves all previously implemented play.
- Stop after each approved checkpoint, run its checks, update this plan plus [CHANGELOG.md](CHANGELOG.md) and [DECISIONS.md](DECISIONS.md), and make one scoped local commit. Never infer approval of later milestones from approval of an earlier one.

The project lives at `projects/latticewake/` in a shared workspace. Existing projects, the task specification, and `.certo/` state are outside its implementation scope. The provisional original title is **Latticewake**; a distribution-name/trademark check is a release gate, not an assertion of legal clearance.

### v1.0 boundaries

Included: endless staged arcade runs; three common enemies plus a boss; deterministic seeded simulation; formation entries and dives; bullet-capture Echo Lattice mechanic; bonus stages; three lives; power-ups; original procedural art/audio; keyboard, standard gamepad, touch; settings, local scores, offline PWA; responsive accessible surrounding UI.

Excluded: accounts, multiplayer, server scores, monetization, copied assets, external fonts, remote content, required analytics, complex physics, WebGL-only effects, and a level editor. Analytics is optional in the brief and is deliberately omitted for v1.0.

## 2. Research and technology decisions

### How to read the comparisons

Scores are engineering judgments, **not measured benchmarks or package-size measurements**. Each column uses 1–5, where 5 is favorable: **Ready** = production maturity; **Phone** = expected mid-range-phone suitability; **Small** = small shipped payload; **Cost** = low learning/maintenance effort; **Test** = isolation/testability; **Life** = long-term maintainability; **Ship** = fit for this scoped v1.0. Build tools ship no browser runtime merely by being used. Actual payload and performance are measured after implementation. Native APIs have no npm license/dependency burden.

### D1a — rendering: native Canvas 2D

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Canvas 2D, cached procedural sprites (chosen) | 5 | 4 | 5 | 4 | 5 | 5 | 5 |
| PixiJS renderer | 5 | 5 | 3 | 3 | 4 | 4 | 4 |
| Phaser full game framework | 5 | 4 | 2 | 4 | 3 | 4 | 4 |

**Recommendation:** Canvas 2D behind a renderer interface, with vector designs rasterized into an atlas once, not redrawn as complex paths per entity per frame. A small fixed playfield, bounded entity counts, and simple blend effects do not justify a GPU scene graph. PixiJS provides better large-batch GPU throughput (MIT; latest registry release inspected: 8.22.0, 2026-10-01), but adds renderer lifecycle and GPU recovery work. Phaser supplies mature scenes/input/physics (MIT; 4.2.1, 2026-07-09), but duplicates our deterministic simulation and couples tests to more framework behavior. No Three.js: no 3D requirement. Risk: Canvas fill-rate on high-DPR phones; cap DPR, cache sprites, and degrade decorative effects before gameplay.

**Would change my mind:** profiling the actual representative combat scene at DPR 1–1.5 still misses the M8 CPU/render budgets after batching and culling. Consider PixiJS through the renderer boundary, preserving simulation and tests; document and approve the added dependency before adoption.

### D1b — audio: native WebAudio

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| WebAudio synthesis/buffers (chosen) | 5 | 4 | 5 | 3 | 4 | 5 | 5 |
| Howler with recorded assets | 5 | 4 | 3 | 5 | 4 | 3 | 3 |
| HTML audio elements alone | 5 | 3 | 4 | 5 | 3 | 5 | 2 |

**Recommendation:** WebAudio buses, cached synthesized SFX buffers, and an original scheduled music sequence. Howler (MIT; latest npm release inspected: 2.2.4, 2023-09-19) simplifies media loading, but is unnecessary for generated audio and its release age warrants a maintenance review before adoption; age alone does not prove abandonment. HTML audio is useful for recordings, but not sample-accurate short effects or synthesis. Native audio costs more lifecycle work: gesture unlock, interruptions, suspension, and silent fallback. Audio events cannot influence simulation.

**Would change my mind:** scope changes to long licensed recordings, streaming, or many codecs and Howler's current maintenance can be demonstrated. Audio remains optional for play if the browser denies activation.

### D1c — input: browser APIs and an action map

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Keyboard + Pointer Events + Gamepad API adapters (chosen) | 5 | 5 | 5 | 3 | 5 | 5 | 5 |
| Phaser input subsystem | 5 | 4 | 2 | 4 | 3 | 4 | 3 |
| Standalone keyboard/gamepad mapping libraries | 3 | 4 | 4 | 4 | 4 | 3 | 3 |

**Recommendation:** normalize all devices into the same per-tick actions; poll gamepads, capture pointers for multitouch, clear held states on focus loss. A two-axis/two-action game does not justify a library. Phaser input makes sense only with Phaser; a separate mapping package adds churn without removing browser-specific testing. Risk: gamepad mappings and mobile gesture/focus quirks.

**Would change my mind:** extensive remapping or nonstandard-controller requirements exceed a small adapter. Any specific library must pass the dependency policy first.

### D1d — collision: purpose-built kinematic hit tests

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Swept segment/circle and AABB tests (chosen) | 4 | 5 | 5 | 4 | 5 | 5 | 5 |
| Matter.js rigid-body solver | 5 | 3 | 2 | 3 | 4 | 4 | 2 |
| Framework arcade collision | 5 | 4 | 2 | 4 | 3 | 4 | 3 |

**Recommendation:** analytical shapes, stable ID iteration, collision layers, swept bullets against relative target motion, and a simple uniform-grid broad phase once enemies arrive. No rigid bodies, contact impulses, or gravity are needed. Matter.js is MIT but introduces unwanted solver semantics and payload; framework collision ties the game to its engine. Native tests need careful boundary/tunneling coverage but are small and deterministic.

**Would change my mind:** physical debris or many interacting rigid bodies become an approved design requirement. First profile the capped scene; do not add a solver to fix a broad-phase issue.

### D2 — language: strict TypeScript

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strict TypeScript (chosen) | 5 | 5 | 5 | 4 | 5 | 5 | 5 |
| JavaScript + JSDoc + checkJs | 5 | 5 | 5 | 4 | 5 | 4 | 4 |
| Unchecked JavaScript | 5 | 5 | 5 | 5 | 4 | 2 | 3 |

All compile to ordinary JavaScript with comparable runtime cost. TypeScript earns its tooling cost through typed events, pooled entity handles, state transitions, and validated data boundaries. Checked JS is viable for a smaller no-build project but becomes verbose for discriminated state/actions. Plain JS minimizes setup but pushes preventable mistakes into runtime tests. Enable strict checking, unchecked-index checks, and explicit browser/simulation boundaries; avoid a class hierarchy beyond the small requested enemy base abstraction.

**Compatibility finding:** npm's latest TypeScript is 7.0.2, but inspected `typescript-eslint@8.72.2` declares TypeScript `>=4.8.4 <6.1.0`. Proposed baseline is **TypeScript 6.0.3**, not blindly `latest`. Verify supported versions again in M0-B. **Would change my mind:** unsupported compiler/linter combinations cannot be resolved on maintained branches, or approval explicitly prioritizes zero build; choose checked JS rather than disable checking.

### D3 — project setup: Vite, npm, Node.js

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vite vanilla TypeScript (chosen) | 5 | 5 | 5 | 4 | 5 | 5 | 5 |
| esbuild + custom dev/build scripts | 5 | 5 | 5 | 3 | 4 | 4 | 4 |
| Unbundled ES modules + local HTTP server | 5 | 4 | 4 | 5 | 4 | 4 | 3 |

**Recommendation:** Vite's development server and production static build, npm lockfile, Node **22.22.x** baseline. No UI framework. Vite provides hot reload, asset hashing, deployment-base handling, and a documented build path. esbuild (MIT; 0.28.2 inspected) is excellent but leaves server, watch, asset, and deployment wiring to us. A no-build HTTP setup works for plain JS, but loses compilation/bundling and complicates tests/cache versioning. Opening ES modules or fetched assets through `file://` is **not supported**: origin/CORS behavior differs and service workers need a secure origin.

Development after M0-B: `npm ci`, then `npm run dev` at `http://127.0.0.1:5173/`. Production preview: `npm run build`, then `npm run preview` at `http://127.0.0.1:4173/`. Production serves only `dist/` over HTTPS; Vite's preview server is not a public production server. Phone testing uses `npm run dev -- --host 0.0.0.0` on a trusted LAN (same Wi-Fi, host LAN IP, port 5173); PWA/gamepad secure-origin acceptance testing uses an HTTPS deployment instead. Port conflicts fail rather than silently choosing a different port.

**Would change my mind:** a host explicitly requires a single unbundled file or the supported Vite toolchain becomes too costly; compare an esbuild build without changing game modules.

### D4 — tests: Vitest and Playwright

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Vitest + Playwright (chosen) | 5 | 5 | 5 | 4 | 5 | 5 | 5 |
| Node test runner + TS compilation + Playwright | 5 | 5 | 5 | 3 | 5 | 5 | 4 |
| Jest + Cypress | 5 | 4 | 5 | 3 | 4 | 4 | 3 |

These are development-only dependencies; none contributes to player download size. Phone score reflects available browser/mobile integration coverage, not desktop test speed. Vitest shares Vite module handling and offers coverage; Playwright tests the production preview across Chromium, Firefox, and WebKit plus touch viewports. Node's runner is a credible smaller-dependency alternative but needs a separate TS compile/coverage path. Jest/Cypress are mature, but add redundant transforms/configuration and provide less direct fit to the chosen multi-engine mobile smoke matrix.

**Recommendation:** real deterministic simulation tests in Node without DOM mocks, real browser smoke tests, and manual hardware validation. Inject a manual clock/action source into the actual loop; do not mock game rules. Synthetic gamepad snapshots test the normalizer only; real controllers must verify the browser API. WebKit and touch emulation are not proof of real Safari or phone performance.

**Would change my mind:** Vite/Vitest version support or installation cost is demonstrably worse than the Node runner. Keep browser tests. No test-free option is acceptable for this release.

### D5a — hosting: GitHub Pages, static HTTPS

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GitHub Pages (chosen) | 5 | 5 | 5 | 4 | 5 | 5 | 5 |
| Netlify static deployment | 5 | 5 | 5 | 5 | 5 | 4 | 4 |
| Vercel static deployment | 5 | 5 | 5 | 5 | 5 | 4 | 4 |
| itch.io HTML upload | 4 | 3 | 5 | 4 | 4 | 4 | 3 |

Static hosts deliver the same build; scores are not claims of measured network superiority. **Recommendation:** a Pages artifact containing only this project's `dist/`, published via a manually triggered workflow after authorization. Free Pages is available for public repositories; private repository eligibility depends on the account's plan. No promise of a free private deployment. Netlify/Vercel provide previews and headers but introduce account/plan limits not needed by a serverless game. itch.io is useful secondary distribution; its iframe, storage, fullscreen, audio, and service-worker context need separate testing.

Use a relative Vite asset base (`./`), no history router, scope-correct manifest and service worker URLs, and test a nested deployment path. Do not replace another project's existing Pages site or expose workspace source. If this repository's Pages destination is occupied, stage the artifact and select an approved separate destination. GitHub Pages manages transfer encoding; generate gzip/Brotli release artifacts, but verify actual response headers rather than claim it serves our `.br` files. No domain purchase or paid service is required.

**Would change my mind:** the repository must stay private on a free plan, the Pages slot is unavailable, or mandatory custom security/cache headers are introduced. Netlify is the next choice, subject to its then-current free-tier terms and deployment authorization.

### D5b — offline/PWA: small first-party service worker

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Own bounded precache worker (chosen, M9) | 4 | 5 | 5 | 3 | 5 | 5 | 5 |
| Workbox via a Vite PWA plugin | 5 | 5 | 3 | 4 | 4 | 4 | 4 |
| Online-only static page | 5 | 4 | 5 | 5 | 5 | 5 | 1 |

**Recommendation:** a small versioned precache for the immutable first-party build, generated from build output using a Node script. No runtime CDN resources, push, or background sync. A manifest, standalone display, icons, HTTPS, correct scope, first-load-online behavior, update prompt, and tested offline restart are required. Workbox is mature and useful for complex caching; its dependency/configuration surface is unnecessary for this finite asset set. Online-only cannot satisfy M9.

Never force activation/reload mid-run; offer updates at a safe menu boundary. Delete only caches bearing this game's prefix. Disable registration during ordinary development. A first visit without network must show the browser's failure, not pretend the game was cached. **Would change my mind:** complex routing or large optional downloads justify maintained Workbox tooling, after license/size review.

### D6 — assets: original procedural designs baked once

| Option | Ready | Phone | Small | Cost | Test | Life | Ship |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Own vector recipes → boot-time atlas + WebAudio buffers (chosen) | 4 | 5 | 5 | 3 | 5 | 5 | 5 |
| Own hand-authored atlas + original recorded audio | 5 | 5 | 3 | 3 | 4 | 4 | 4 |
| Licensed free sprite/audio packs | 4 | 5 | 3 | 4 | 4 | 3 | 2 |

**Recommendation:** original geometric vector recipes rendered once into a resolution-bounded Canvas atlas; `drawImage` during play. Generate short PCM SFX buffers from oscillator/noise envelopes after audio unlock, and schedule an original low-polyphony music sequence. No external files/codecs are required for audio; buffers live only in memory. A separate decorative seed controls noise textures/audio; never consume gameplay RNG for presentation. Icon/social PNGs are generated from the same original ship/vector source during release build.

A hand-authored atlas is efficient but adds export/source synchronization and audio file weight. Free packs can be legally usable yet still fail the request for original designs; they are rejected for ships, enemies, music, and SFX. If any other third-party asset becomes necessary, its source, author, exact license, modifications, and required attribution must enter the asset register before use. No scraped assets, fonts, or imitation melodies. Original assets will be licensed alongside the project; third-party notices remain separate.

**Would change my mind:** art direction needs detailed illustrated frames and the startup atlas or audio preparation exceeds budgets. Prebake our same original recipes as an atlas/short WAV files rather than import another game's visual language.

### Proposed dependencies and license gate

**Runtime npm dependencies: none.** The following are proposed direct development dependencies, researched from the official npm registry on 2026-11-10. Versions are candidates for the first approved lockfile, not installed or compatibility-tested here.

| Package | Candidate | License | Latest/candidate release inspected | Why needed |
| --- | --- | --- | --- | --- |
| `vite` | 8.3.7 | MIT | 2026-11-09 | Dev server, static production bundling/minification |
| `typescript` | 6.0.3 | Apache-2.0 | 2026-04-16 | Strict type checking; compatible linter range |
| `eslint` | 10.14.0 | MIT | 2026-10-30 | Source correctness/style gates |
| `@eslint/js` | 10.0.1 | MIT | 2026-02-06 | Maintained baseline lint rules |
| `typescript-eslint` | 8.72.2 | MIT | 2026-11-09 | TS parser and typed lint rules |
| `vitest` | 5.1.0 | MIT | 2026-11-02 | Deterministic unit/integration tests |
| `@vitest/coverage-v8` | 5.1.0 | MIT | 2026-11-02 | Core coverage reporting; match Vitest exactly |
| `@playwright/test` | 1.65.0 | Apache-2.0 | 2026-11-05 | Production-browser smoke suite |
| `@types/node` | 22.20.5 | MIT | 2026-10-01 | Node/tooling type definitions |

All nine candidate versions were rechecked against official npm version metadata during revision 2: declared licenses and Node/peer ranges match this proposal. Vite and Vitest accept the proposed Node baseline; typescript-eslint accepts ESLint 10 and TypeScript 6.0, but **not** current TypeScript 7. Registry metadata is research evidence only, not an installed-toolchain test. M0-B must resolve without peer overrides, run all checks, pin actual versions and `package-lock.json`, and confirm each selected branch is actively supported. If TypeScript 6 ceases to be supported before setup, select a supported compiler/parser pair; do not suppress incompatibility warnings.

Before any dependency is accepted: inspect direct/transitive licenses and maintenance, reject unresolved/unknown or copyleft terms, review known vulnerabilities, retain notices in `THIRD_PARTY_NOTICES.md`, and record justification. Permissive allowlist: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, and 0BSD; ISC/0BSD are treated as permissive equivalents, not exceptions for copyleft. Review dual licenses and non-code asset licenses explicitly. No package installation or package-manager configuration changes in M0-A. Browser binaries are testing infrastructure, not distributed game assets; record their separate notices if redistributed (none planned).

### Primary sources consulted

Read on 2026-11-10; recheck at implementation. No code was downloaded or executed from these sources.

- [Vite guide](https://vite.dev/guide/) and [static deployment](https://vite.dev/guide/static-deploy.html): Node requirements, dev/build workflow, hosting.
- [typescript-eslint dependency support](https://typescript-eslint.io/users/dependency-versions/); npm package metadata also supplied the explicit peer ranges.
- [Pixi performance guide](https://pixijs.com/8.x/guides/concepts/performance-tips) and [Phaser overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser): batching versus full-engine responsibilities.
- [Vitest coverage](https://vitest.dev/guide/coverage.html) and [Playwright browsers](https://playwright.dev/docs/browsers): real browser matrix and coverage tooling.
- [MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API): gesture, origin, HTTPS, and lifecycle constraints.
- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and [limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): free-public eligibility and static-host limits.
- Official npm metadata endpoints, e.g. [Vite](https://registry.npmjs.org/vite), [TypeScript](https://registry.npmjs.org/typescript), [typescript-eslint](https://registry.npmjs.org/typescript-eslint), [Vitest](https://registry.npmjs.org/vitest), [Playwright](https://registry.npmjs.org/@playwright%2ftest), [PixiJS](https://registry.npmjs.org/pixi.js), [Phaser](https://registry.npmjs.org/phaser), [Howler](https://registry.npmjs.org/howler), [esbuild](https://registry.npmjs.org/esbuild). Release dates/licenses above are observed metadata, not security or performance certification.

## 3. Game design document

All numbers below are **initial tuning targets**, not claims of completed balance. M5 records tested changes in DECISIONS.md and the stage configuration. The reference simulation rate is 60 ticks/second.

### Identity, screen, and core loop

- **Fantasy:** pilot the tiny faceted **Needle** craft through a failing navigation lattice; raiders are abstract drifting instruments, not insects or borrowed arcade silhouettes.
- **Playfield:** 360 × 640 logical units, portrait, letterboxed into any desktop/mobile viewport. UI controls sit outside the active playfield where possible. Movement is horizontal only; no wrapping or vertical ship movement.
- **Run:** title → short skippable tutorial → stage entry → formation combat and telegraphed dives → stage tally → next stage. Pause preserves the run; all lives lost leads to score entry and restart/menu. Starting a new run resets all gameplay state and accepts a recorded seed.
- **Player:** accelerate toward target velocity (initial maximum 250 units/s; acceleration 1,600 units/s²), decelerate smoothly, clamp by hit radius. Hold Fire for one shot every 9 ticks; shots travel 540 units/s. No frame-rate-dependent movement or firing.
- **Fairness:** player damage radius is smaller than the visible ship; no unavoidable spawning on the player. Dives/projectiles give readable shape/motion cues. A plain offline run needs no login, connection, audio, or special mechanic mastery.

### Controls and parity

| Action | Keyboard default | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Move | Left/Right or A/D | Left stick X (0.18 dead zone), D-pad | Horizontal drag pad; optional large left/right buttons |
| Fire | Space or J (hold) | South face button or right trigger | Large hold-to-fire button; optional autofire setting |
| Echo Lattice | X or K (edge press) | West face button | Separate large capture button |
| Confirm/back | Enter / Escape | South / East face button | Semantic DOM buttons |
| Pause | P or Escape during play | Start/Menu | Persistent pause button |

Movement sources choose the strongest magnitude, not a sum; ties use the last active device. Fire is OR-combined; capture/pause are edge-triggered. Cancelled pointers, blur, disconnected controllers, and hidden tabs cannot leave inputs stuck. Pause is always available through the keyboard/DOM even if a controller disconnects. Remapping is limited to named presets in v1.0; full arbitrary rebinding is not required. Touch/gamepad adapters arrive in M7, with the device-independent action contract established in M1.

### Enemies, formation, and attacks

Use a small abstract `Enemy` base with IDs, hit shapes, state, and behavior hooks; concrete types supply data/behavior without owning the game clock or browser APIs. Standard formation: up to 6 columns × 4 rows, bounded sinusoidal idle sway; slot occupancy is separate from entity existence. Entry paths are deterministic cubic Béziers with authored durations and staggered launch ticks. Divers return to their slot or exit/re-enter; destroyed/reserved slots cannot be reused accidentally.

| Original enemy | Silhouette/role | HP | Score: formation / diving | Behaviors |
| --- | --- | ---: | ---: | --- |
| **Shardlet** | Split diamond with a central notch | 1 | 100 / 180 | Fast shallow dives; straight shots |
| **Spindle** | Rotating three-prong tuning fork | 2 | 180 / 300 | Hook-shaped dives; aimed shot at launch-time player position |
| **Bellframe** | Hollow angular arch with visible inner core | 3 | 300 / 500 | Slow sweep; announces capturable ringed pulses from M5 |
| **Meridian Engine** | Segmented gyroscopic gate, never an insect silhouette | Phase-scaled | 5,000 + 500 × boss index | Three readable phases, breakable emitters, capture-pulse opportunities |

Before M4, enemies enter and hold formation; before M5, Bellframe shots are ordinary shots. Warning cues anticipate a dive by at least 24 ticks. Damage/score is resolved once per destroyed ID; a single non-piercing bullet cannot score twice. Explosions and particles are cosmetic and never collide.

### Stages, lives, and scoring

- Typed stage data specifies seed offset, formation layout, path IDs, entry timings, dive cadence, bullet caps, and drops; validate it at load. No executable strings or `eval`.
- Stages 1–3 introduce silhouettes and dives progressively. Every 4th stage is a nonlethal precision bonus stage. Every 5th stage is a boss; when both rules apply (stage 20, etc.), boss takes precedence and the bonus stage follows before the next numbered stage. This precedence is explicit in tests.
- Bonus stages have 20 non-shooting targets and a fixed duration; each hit scores 150, a perfect clear awards 3,000 extra, misses cost no lives. Bosses spawn no regular formation until defeated. Stage transitions wait for hostile projectiles to be cleared safely.
- Initial difficulty multiplier: `min(1 + 0.08 × (stage - 1), 2.2)` affects dive speed/cadence within configured safe limits. Separately cap simultaneous divers (6), hostile projectiles (128), and aimed-shot rate (at least 30 ticks between shots per shooter). Increase pattern complexity before raw projectile speed. Never scale away the minimum telegraph time.
- Start with **3 lives**. Contact or an ordinary hostile projectile costs one life, clears active drones/power-ups, and grants no duplicate hits in the same tick. Respawn after 90 ticks with 120 ticks of invulnerability, a visible non-flashing ring, and nearby hostile bullets cleared. A hidden tab cannot burn invulnerability or lives.
- Award one extra life at 20,000 and then every 50,000 points; max 5 lives, threshold awards still consumed at the cap. Display score, lives, stage, capture cooldown, drone duration, and power-up timers. No score multiplier that hides the base scoring rules.
- Local top ten records contain score, stage reached, seed, rules version, and a sanitized 1–12 character alias. Ties sort by stage then insertion order. No online leaderboard or personal information.

### Signature mechanic — Echo Lattice (M5)

This captures **enemy energy**, not the player's ship. Bellframes and bosses emit a clearly ringed, diamond-centered **echo pulse** distinct by outline/motion as well as color.

1. Press Capture to open a short field around the ship for **24 ticks** (0.4 s). Cooldown starts immediately and lasts **240 ticks** (4 s), successful or not. No effect during pause/death/respawn.
2. The field can intercept **one marked pulse per activation**. Ordinary bullets and enemy contact remain dangerous; this is not a general shield. At most two echo drones may be active.
3. A successful interception removes that pulse and adds an original prismatic drone for **360 ticks** (6 s). Each drone independently adds a side shot to every normal firing event, tracking its own expiry. Captures at capacity are disabled rather than silently consuming the pulse/cooldown.
4. The activation closes on capture. Death removes all drones; pausing freezes timers. Capturing never changes RNG consumption outside gameplay rules and never restores lives.
5. There is no additional score for farming pulses; bonus points come from actual enemies destroyed. Essential survival must remain possible with plain movement/fire. M5 measures success rate, risk/reward, and boss clear time with and without capture.

Stable collision precedence: gather candidate contacts; resolve a valid marked-pulse capture first, then remaining hostile hits, then player shots/enemy deaths, then drops/expiry/stage completion. Sort ties by impact time then stable ID. Expired/dead/consumed entities cannot hit again that tick.

### Power-ups and boss design

Deterministic config-authored drops, not unseeded random rolls. Drops expire after 480 ticks and move slowly down the field; collect via a safe generous pickup radius.

- **Ward:** absorb one ordinary hit; expires after 900 ticks. Does not stack; a replacement refreshes duration. No score for absorption.
- **Fan:** 3-way center weapon for 480 ticks; companions still add one shot each. Refresh, do not multiply fan spread on repeated pickup.
- **Overclock:** center firing interval 6 ticks for 360 ticks; refresh only. All combinations obey the bullet-pool cap and unchanged deterministic rules.
- Boss every five stages: break left/right emitters, expose central gate, then a final alternating sweep. Phase changes telegraph for 60 ticks and clear only phase-owned hazards. Capture windows are optional advantages. Initial boss HP/shot timings are config values; document M5 balance evidence rather than invent playtest results now.

### Art, audio, and accessibility direction

Near-black navy space, warm ivory player, cyan allies, amber hazards, and magenta capturable accents. Every important category also differs in shape, outline, and animation; offer a colorblind-safe alternative and high contrast. Original compass/grid motifs and three-layer restrained parallax communicate depth without copying recognizable sprites. No external font; use system UI text with canvas-independent HUD labels.

Original WebAudio timbres: short glassy triangle/sine shots, filtered seeded-noise impacts, rising capture chord, and a restrained original 16-bar sequence around 110 BPM. Master/music/SFX sliders, mute, and a visible audio-enable affordance; quiet/silent play is complete play. Limit voices (24 SFX, 8 music) and ramp gains to avoid clicks.

Reduced motion honors `prefers-reduced-motion` by default and disables shake/parallax/strobes; cosmetic scanline/glow effect is optional and off in low-quality mode. Do not require bloom/WebGL. Hit flashes avoid rapid full-screen flashes. Use semantic DOM menus, visible focus, 44 CSS-pixel touch targets where possible, keyboard navigation, and polite announcements for pause/stage/game-over (not every shot). Real-time aiming is visual; do not claim the canvas action game is fully screen-reader playable.

## 4. Architecture and determinism contract

### Ownership and dependency direction

One composition root creates an `App` instance and injects engine, simulation, input, renderer, audio, storage, and UI adapters. No mutable module globals, singleton services, window-owned game object, or browser side effects on import. Immutable configuration/module constants are allowed. Teardown removes listeners, RAF handles, audio nodes, and references.

`input adapters → per-tick actions → game simulation → bounded event queue → render/audio/UI adapters`

The engine supplies time/state transitions; it does not know enemy rules. Simulation imports only deterministic math, typed data, and the RNG. Rendering reads state/snapshots and may not mutate it. Audio consumes events tagged with simulation tick/entity ID. DOM/UI/storage handle user interactions outside simulation and send explicit actions. Data validation and loading errors reach a usable retry/menu screen; optional audio failure becomes silent mode.

### Proposed folder layout (created only after approval)

```text
projects/latticewake/
  PLAN.md, DECISIONS.md, CHANGELOG.md, README.md
  package.json, package-lock.json, tsconfig.json, eslint.config.js
  vite.config.ts, vitest.config.ts, playwright.config.ts
  index.html
  public/                  # generated icons/manifest; release worker output
  scripts/                 # build precache, compression, license/budget checks
  src/
    main.ts                # composition root and teardown only
    engine/                # clock, fixed loop, state machine, resource loader
    game/                  # DOM-free rules, world, player, enemy types, waves
      data/                # typed stages, tuning, versioned rules
    math/                  # RNG, geometry, splines, deterministic helpers
    input/                 # action map; keyboard, gamepad, pointer adapters
    render/                # Canvas renderer, atlas, particles, viewport
    audio/                 # synthesis patches, music scheduler, buses
    ui/                    # semantic menus/HUD, English string dictionary
    platform/              # validated localStorage, lifecycle, local diagnostics
    styles/                # responsive layout, focus and touch styles
  tests/unit/              # real simulation/engine/data/storage-adapter tests
  tests/e2e/               # production-preview flows; no production fixtures
  LICENSE, ASSETS.md, THIRD_PARTY_NOTICES.md  # introduced/maintained with content
  dist/                    # generated, ignored; deploy this only
```

CI lives in a **project-specific** workspace `.github/workflows/latticewake-ci.yml`, with path filters and explicit working directory. Add it only in M0-B; do not alter unrelated workflows. Release deployment is a separate manually authorized workflow in M9. Pin third-party actions by reviewed commit SHA and grant read-only permissions by default; only a deploy job needs Pages/OIDC permissions.

### Timing and replay invariants

- Simulation steps are exactly **1/60 second**. `requestAnimationFrame` is presentation only. Accumulate elapsed time from an injected monotonic clock; clamp a single frame delta to 250 ms; run at most 5 updates before rendering. Drop excess accumulated whole steps after that cap and record a debug counter, retaining the fractional remainder. Do not fast-forward game rules to wall time.
- Render interpolation uses `alpha = remainder / step` between previous/current transforms. Teleports/spawn/despawn synchronize previous/current poses; never interpolate a new entity from an old pooled occupant.
- Pause on `visibilitychange`/blur; clear held input and the accumulator, reset the previous timestamp, and require explicit resume. No catch-up burst, score drift, or audio resume without the appropriate interaction.
- Gameplay randomness: versioned xorshift32 using unsigned integer operations; disallow zero internal state by mapping seed 0 to a documented nonzero constant. Parse an optional decimal/hex seed from the URL with bounds/length validation; otherwise use `crypto.getRandomValues` once at run start and display/record the resulting uint32 seed. Never use `Math.random`, wall time, audio state, or draw order in rules.
- Separate gameplay, starfield/particles, and audio streams derived from a root seed using fixed documented salts. Unit-test known RNG vectors and save the rules version with seeds. Entity IDs and iteration order are stable and recycled handles have a generation to prevent stale references.
- Record effective normalized **actions per simulation tick**, not raw device timing. Same rules version + seed + tick-indexed actions must produce the same state checksum regardless of render cadence or muted/reduced-motion mode. No promise that raw browser event timing is repeatable or that different future rule versions replay identically.
- To bound cross-engine floating-point drift, quantize gameplay positions/velocities at tick boundaries to 1/1024 logical unit; use authored/quantized path samples and a fixed lookup for simulation sway instead of relying on cross-platform transcendental results. Render/audio can use floating-point curves freely. Validate replay checksums on all three engines before claiming cross-browser determinism; no blanket bit-exact guarantee without that evidence.

### Collision, pools, and capacity

Player/enemies use conservative circles or AABBs, bullets sweep from previous to new position against relative target motion, and broad-phase cells cover swept bounds. Unit cases include tangency, zero movement, simultaneous impacts, high-speed crossing, slot reuse, and invulnerable targets. Boss emitters use explicit shapes and phase ownership.

Preallocate gameplay pools by M2/M3: 128 player bullets, 128 hostile bullets, 48 regular enemies (only 24 occupy formation slots), one boss with bounded emitters, 12 drops, 512 particles, and a fixed-capacity event queue. Expire/recycle with stable iteration; no per-frame `map`/`filter`, entity objects, arrays, closures, or temporary vectors in hot update/render paths. Allocation at transitions/load is allowed and measured. Pool overflow is observable: cosmetic particles may drop; enemy shots defer; player fire never partially spawns a volley or consumes cooldown if required slots are unavailable. Author stages within limits and test saturation.

### Persistence, browser targets, and security

Versioned localStorage stores settings and the top ten scores only. Validate shape, bounds, strings, and schema version; use text nodes, never HTML injection. Quota/security/corruption errors fall back to in-memory play with an unobtrusive explanation. No secrets, accounts, cookies, network leaderboards, or production debug control interface. Crash diagnostics are bounded, local, and manually exportable; no automatic upload, player actions, or personal data in logs.

Target current and previous stable Chrome/Firefox desktop, current/previous Safari on macOS/iOS, and current Android Chrome; minimum planned Safari/iOS 17, with Vite output targeting ES2022. Exact versions/devices are recorded at M8. Feature-detect Canvas, AudioContext, storage, gamepads, and service workers; unsupported optional features degrade, missing Canvas shows a useful fallback. No user-agent-only compatibility claims. All production resources are first-party same-origin; gamepad/PWA validation uses HTTPS or loopback.

## 5. Verification and production budgets

### Commands to implement in M0-B (not available in M0-A)

All npm commands run in `projects/latticewake/`. Commit `package-lock.json`; subsequent installs use `npm ci`. Test/build scripts must exit without watch mode or interactive prompts.

| Command | Contract |
| --- | --- |
| `npm run dev` | Vite, loopback host, port 5173, strict port |
| `npm run lint` | ESLint across source/config/tests, `--max-warnings 0` |
| `npm run typecheck` | `tsc --noEmit` with strict options |
| `npm test` | `vitest run`; fail on zero tests |
| `npm run test:coverage` | Same full unit suite with V8 coverage and thresholds |
| `npm run build` | Typecheck then Vite production build; M9 adds offline generation and compression |
| `npm run preview` | Vite preview, loopback host, port 4173, strict port |
| `npm run test:e2e` | Playwright; manages production preview lifecycle, fails on console/page errors |
| `npm run check:licenses` | Inspect locked package licenses against allowlist; unresolved entries fail |
| `npm run check:budget` | Node-built-in gzip/Brotli measurement of built first-load assets; fail over budget |
| `npm run check` | Lint → typecheck → full unit coverage → build → license check → size check |

After initial approved dependency installation: `npx playwright install chromium firefox webkit` (Linux CI also uses Playwright's documented `--with-deps`). No package-manager registry changes. CI runs `npm ci`, `npm run check`, browser installation, and `npm run test:e2e`. Browser tests use a fresh profile and the production build, not a dev-only test harness. Add Chromium smoke in M0-B; expand coverage as features arrive; add all three engines and real-device evidence by M8. No retries that hide flaky logic; preserve traces on failure.

### Automated acceptance

- Core logic: at least **90% statements/lines/functions and 85% branches** over `engine/`, `game/`, and `math/` by M8. No blanket coverage exclusions to make thresholds pass. Cover input normalization and storage boundary failures too. Start with honest tests for existing code only; raise coverage scope as modules arrive.
- Loop: 30/60/90/120/144 Hz render cadence produces the same tick state for equivalent inputs; large gaps cap work; hidden-tab resume has no catch-up; interpolation stays in [0, 1). RNG vectors, seed-zero mapping, known-seed whole-run snapshots, stable event order, and generation-safe pool reuse have regression tests.
- Rules: bounds, shot intervals, pool exhaustion, spline endpoints, swept collisions, single-score awards, spawn safety, stage rules, deaths/lives/invulnerability, power-up expiry, captures at capacity, same-tick capture/damage, bosses, bonus precedence, replay checksums.
- Browser journeys: boot/menu → play → move/fire → pause/resume → game-over/restart; resize/orientation; touch multitouch/cancel; settings/reload; corrupt/unavailable storage; reduced motion; audio denied/unlocked; controller connect/disconnect; nested-path build; new-version PWA update and offline reload. Only use deterministic test actions through the real input/simulation path. Do not add production cheats to force outcomes.
- Keep asset/license and dependency/security reviews current; no test-only data, assets, or debug endpoints in production. The game makes no application fetches to third parties.

### Measured performance gates (M2 baseline, M6 audit, M8 sign-off)

Targets, not results from this planning milestone:

- Representative laptop: Intel i5-class integrated graphics, 8 GB RAM, 60 Hz display. Reference phones: Pixel 6a-class Android and iPhone 11-class iOS, or documented comparable devices. Record actual hardware/OS/browser, viewport, DPR, quality, and thermal state.
- Run a seeded 10-minute late-stage/boss workload at configured entity caps after warmup. Aim for sustained **59–60 FPS** on 60 Hz displays, p95 frame interval ≤20 ms, <1% frames >33.3 ms, simulation p95 ≤4 ms, rendering p95 ≤8 ms. Report long frames rather than averaging away stalls. Automated CPU throttling is a regression aid, not hardware proof.
- DPR capped at 2; low-quality mode caps at 1–1.5 and removes decorative particles/glow/parallax first, not hazards, simulation steps, or collision precision. Default quality is conservative; gameplay remains 60 Hz.
- Player-critical compressed assets ≤250 KiB gzip total; JavaScript ≤120 KiB gzip. First playable menu target ≤3 s on a documented 10 Mbps / 100 ms-latency profile. First user interaction is not blocked by optional audio synthesis.
- Pool saturation and a 15-minute restart/stage soak show no unbounded growth: JS heap target <64 MiB with no sustained >10 MiB post-GC increase after warmup, bounded listeners/audio nodes, and no recurring gameplay allocations in allocation profiles. Browser/OS memory is recorded separately.
- If reference hardware is unavailable, record the gap honestly and **do not sign off M8/M9 production readiness** based only on emulation. No FPS or Safari success is claimed by this plan.

### M0-A documentation-only checks and manual review

This milestone has no `package.json`, game, test runner, or build. Do not run another project's tests and call them Latticewake checks. Validate the four project Markdown files exist and are nonempty, their local document links resolve, code fences are balanced, all six decision areas and M0–M9 definitions are present, no implementation files slipped in, and `git diff --check` passes. Exclude only the managed `.certo/` directory from the project-entry check; never inspect or modify its contents. Review the staged paths for unrelated files/secrets before committing. No testing infrastructure is introduced just to test Markdown.

Manual review now: read sections 1–2 for the approval boundary and trade-offs; section 3 for the proposed game; section 4 for architecture/determinism; sections 5–7 for gates and risks. Verify the approval status remains PROPOSED and that install/run commands are explicitly future contracts. Confirm only planning documents were added. The M0 handoff records actual check output and the local commit; later milestones record their actual commands, manual results, and remaining limitations rather than copying this plan as evidence.

## 6. Milestones and Definition of Done

### Common gate (M0-B onward)

Run `npm run check` and `npm run test:e2e` for the current feature set. Zero build/type/lint errors or warnings; real tests pass; no console/page errors in browser journeys; previously delivered play still works. Update PLAN status/evidence, CHANGELOG, DECISIONS, and README when commands/behavior change. Provide manual reproduction steps and actual results, record performance evidence appropriate to that checkpoint, review licenses/security, then commit only scoped work and stop for milestone approval. Never tag an unverified release. If a device/browser is unavailable, mark its check unverified, not passed; the M8/M9 gates remain open.

| Milestone | Definition of Done / checkpoint experience | Focused automated checks beyond common gate | Manual verification at handoff |
| --- | --- | --- | --- |
| **M0-A — Plan (current)** | Research comparisons/recommendations, design, architecture, risks, acceptance criteria, commands, and approval boundary in docs. No game/tooling code. | Documentation consistency, links/fences, scope, whitespace and staged-path review only. Unit/lint/build/FPS: N/A. | Open the plan and decisions; confirm status is PROPOSED, original design, and no application/dependencies exist. |
| **M0-B — Approved foundations** | Only after plan approval: manually create vanilla TS/Vite files without overwriting workspace state; npm lock, strict types/lint, real initial tests, CI, responsive blank canvas with loading/error fallback. Prepare original-asset/license registers. | At least one real viewport/resource-validation unit test; build/preview Chromium smoke with visible canvas and no page errors; dependency resolution/license gate and path-safe build. | `npm ci`; `npm run dev`; open localhost; resize/rotate blank canvas; build/preview; inspect clean console. Not combat or a completed game. |
| **M1 — Engine core** | 60 Hz accumulator/interpolation, owned state machine (boot/menu/play/pause/game over), keyboard action map, resource loader, letterboxing/DPR, FPS/entity overlay. Interactive state/viewport testbed. | Manual-clock timing/cap/interpolation, legal/illegal state transitions, listener teardown, loader failure/retry, normalized key edges and lost focus. | Enter the testbed, navigate states, pause/resume, blur, resize, toggle overlay; no time jump or stretched playfield. |
| **M2 — Player and shooting** | Bounded accelerated horizontal movement, hold-to-fire rhythm, pooled bullets, seeded parallax, resettable firing range. First playable shooting checkpoint. | Bounds/cooldown, no partial volleys under pool pressure, recycle/expiry, seed repeatability and render-cadence invariance. | Hold each direction against edges; fire for 2 minutes; restart/pause; background and shot rhythm stay smooth. Capture initial laptop/phone profile. |
| **M3 — Enemies and formation** | Enemy base plus three original types, grid/sway, Bézier entries, collision layers/sweeps, pooled explosions, scoring/HUD. Clear/repeat a formation. | Path endpoints/slot ownership, hit/miss/tunneling, HP/single score, particle limits, saturated broad phase, deterministic formation clear. | Clear a formation with all three silhouettes; confirm HP feedback and score once per kill, no bullets passing through at high relative speed. |
| **M4 — Attacks and waves** | Data-validated stages, telegraphed dives and enemy shots, bounded difficulty, bonus stages, 3 lives, respawn invulnerability, complete game-over/restart. | Diver return/exit, config validation, difficulty caps, simultaneous hits, lives/extra-life thresholds, bonus scoring, restart reset. | Play stages 1–4; dodge dives, lose all lives, restart; verify safe respawn and nonlethal bonus stage. |
| **M5 — Signature mechanics** | Echo Lattice capture/drone timings, three power-ups, Meridian Engine every fifth stage, boss/bonus precedence, documented tuning pass. Complete feature-level arcade loop. | Capture windows/cooldowns/marked-only behavior, capacity and expiry, power-up combinations, boss phases, stage 20 precedence, fixed-seed replay. | Capture a marked pulse without absorbing an ordinary shot; try two drones, each power-up, and the stage-5 boss; record novice/experienced tuning observations and changes. |
| **M6 — Audio and visual polish** | Original SFX and music, master/music/SFX/mute, safe audio unlock/interruption handling, hit feedback, shake, particles, optional Canvas glow/scanlines, optimized atlas. | Event-to-SFX dispatch/deduplication and voice caps; effect toggles cannot alter simulation checksums; browser audio-denial fallback; size/allocation regression. | Tap Enable Audio, mute/unmute, change buses, pause/background/return; reduced motion and low effects remain readable. Run 10-minute combat profile and check audio voices are released. |
| **M7 — UX, meta, persistence** | Final title/settings/pause/game-over, tutorial, color-safe/high-contrast and reduced-motion settings, local top ten, touch and gamepad parity, responsive layouts, i18n-ready English string dictionary. | Storage migration/corruption/quota, safe alias rendering, action mapping and simultaneous touches, focus order, string-key completeness; real browser journeys. | Keyboard-only menus; real standard controller connect/disconnect; phone movement+fire+capture; rotate screen; reload settings/scores; deny storage and keep playing. |
| **M8 — Quality and performance** | Coverage thresholds met; production E2E across three engines; seeded replay parity; laptop and real-phone 60 FPS evidence; memory/GC audit; bounded local crash logging and recovery; accessibility and real Safari audits; no unresolved release-blocking defects. | Full unit/coverage and browser matrix, soak/pool limits, resource failures, diagnostics redaction, reproducible perf/bundle reports and dependency review. | Run specified hardware workloads, actual Chrome/Firefox/macOS Safari and iOS Safari, controller/touch/audio, keyboard/focus/contrast/reduced motion. Record exact versions, evidence, and limitations. |
| **M9 — Production release** | Minified hashed build, generated gzip/Brotli artifacts, validated static-host configuration, HTTPS PWA/offline/update flow, original icons/favicon/meta/social image, final license/notices, complete run/build/deploy README, signed-off QA checklist, local `v1.0.0` tag after green checks. No analytics. | Clean `npm ci` reproduction, all common/M8 gates, nested-path boot, first-online/offline reload, cache upgrade/rollback, manifest/scope, no mixed content; verify compression response headers on an authorized deployment. | Install where supported, disconnect/reopen, reconnect/update only at menu, confirm scores persist; rehearse artifact rollback and read exact deployment docs. Actual publish/push needs explicit authorization. |

### Stack-driven adjustments to the requested milestone sequence

1. Split M0 into plan-only M0-A and post-approval M0-B; mark the blank canvas and M1 testbed exceptions to combat playability honestly. No implementation before approval.
2. Keep M1–M9 feature order. Establish native input/audio/renderer contracts early, but implement touch/gamepad and polished UI in M7 as requested.
3. Seeded RNG and replay contract begin in M1/M2 rather than waiting for quality work; collision tests begin in M3, lives/waves in M4. A whole-run checksum fixture grows with each rules version.
4. Add baseline unit tests, Chromium smoke, license/size gates, and CI in M0-B; do not defer all testing to M8. M8 extends/qualifies these gates with three engines, real devices, and soak profiling.
5. Use typed TypeScript config files for waves instead of external JSON unless designer editing becomes necessary; validate either format. No physics-engine or asset-pack work.
6. Use generated Canvas atlas and WebAudio; no renderer/audio framework setup. Performance audits start in M2/M6. PWA/cache generation stays in M9 to avoid stale development builds.
7. Keep release artifacts in this project only. A v1.0.0 tag is local; no branch push, remote release, hosting change, or deployment without explicit authorization. A deployment evidence gap cannot be relabeled a successful deployment.

## 7. Risk register and mitigations

| Risk | Likelihood / impact | Mitigation, owner checkpoint, and trigger |
| --- | --- | --- |
| Approval boundary vs every-milestone playability | Certain / high | M0 split and testbed exceptions explicitly proposed here; approval must cover these before M0-B. No invented gameplay claims. |
| Canvas fill-rate/GC on phones | Medium / high | Atlas + fixed pools + capped DPR; profile M2/M6; qualify real hardware M8; renderer change only after measured failure. |
| Replay drift / floating point / RNG coupling | Medium / high | Tick input tapes, quantization, sampled paths, separate RNG streams, versioned checksums and cross-engine fixtures from M1–M8. |
| Tunneling, double scoring, stale pooled handles | Medium / high | Swept relative-motion collisions, stable contact order, deferred cleanup, generation IDs and saturation tests M2–M5. |
| Capture becomes mandatory or abusive | Medium / medium | Ordinary bullets remain dangerous; marked pulses bounded; no pulse-farming score; compare plain-fire and capture runs in M5 balance pass. |
| Mobile autoplay / interruptions / gamepad quirks | High / medium | Gesture unlock, silent fallback, disconnect/blur reset, semantic pause, real iOS/controller checks in M6–M8. |
| Phone ergonomics / motion / visual accessibility | Medium / high | Safe-area layout, multitouch, separate capture button, non-color cues, reduced motion, focus/touch audit M7–M8. |
| Dependency licenses, stale versions, peer incompatibility | Medium / high | No runtime dependencies; lock compatible maintained dev versions; metadata and transitive/license/vulnerability review M0-B and each upgrade. Never use force/legacy-peer-deps. |
| Service worker stale caches or shared-site collision | Medium / high | Project scope/prefix, finite precache, menu-only updates, offline/upgrade/rollback tests M9; never delete another site's caches. |
| Hosting slot/permissions/free-plan eligibility | Medium / medium | Deploy only project artifact; validate destination eligibility and existing site; no auto-publish; fallback host decision documented before M9 deployment. |
| Private data, corrupt storage, crash-log leakage | Low / high | Local-only schema validation, text-safe aliases, bounded redacted logs, no accounts/telemetry, failure fallback M7–M8. |
| Originality/licensing/name conflict | Low / high | Create all art/music/designs, keep source recipes and asset register, inspect resemblance and name before M9. No legal-clearance claim in M0. |
| Hardware/browser evidence unavailable | Medium / high | Use automation for regressions, but retain M8/M9 real-device gates as unverified until actual evidence; do not fabricate 60 FPS/Safari results. |
| Scope/polish expands beyond v1 | Medium / high | Fixed caps, three enemy archetypes, one boss family, two main actions; no networking, accounts, editor, advanced shaders, or analytics. Review changes at milestone boundaries. |

## 8. Checkpoint ledger

| Checkpoint | Status | Evidence |
| --- | --- | --- |
| M0-A research and planning | Revision 2 documentation complete and checked; plan approval pending | Corrected README validator PASS with managed `.certo/` excluded; links/fences/whitespace/scope review PASS; nine direct candidates rechecked against official npm metadata. Handoff commit subject/evidence in CHANGELOG. Game tests/lint/build/FPS: N/A, not run. |
| Plan approval | **NOT RECEIVED** | No approval is implied by resuming the interrupted planning task. |
| M0-B foundations | NOT STARTED — gated by plan approval | No manifests, application source, dependencies, CI, or canvas created. |
| M1–M9 | NOT STARTED | Future definitions above are acceptance targets, not completion evidence. |

**Approval requested:** approve this plan (including the M0 split/testbed exceptions, stack, original game concept, and scope) or request revisions. This handoff stops at M0-A; approval authorizes M0-B only, not implementation of M1–M9 in one run.

# Latticewake — decision log

**2026-11-10 · M0-A · Proposed, not yet approved.** These defaults make the plan reviewable without silently authorizing implementation. Detailed option scores, sources, risks, and reversal criteria are in [PLAN.md](PLAN.md), section 2. Record subsequent changes here with evidence and the milestone that adopted them; do not overwrite the original rationale.

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

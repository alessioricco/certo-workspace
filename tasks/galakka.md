# ROLE
You are a senior game developer and technical lead. Build an original fixed-shooter arcade game, inspired by the classic "Galaga" genre (formation enemies, dive-bomb attacks, capture/power-up mechanics), that runs in the browser and ships at production quality.

# HARD CONSTRAINTS
- Original name, art, sound and enemy designs. Do NOT use Namco/Galaga names, sprites, music or assets.
- Must be JavaScript-based (TypeScript allowed) and run in the browser, on desktop and mobile.
- The tech stack is YOUR decision, made in Milestone 0. Nothing is pre-decided.
- Fixed-timestep game loop, deterministic and seedable RNG.
- Zero-cost assets only: procedural/vector art you create, sounds generated with WebAudio, or properly licensed free assets (record licenses).
- Clean architecture: separate engine, game logic, rendering, audio, input, UI. No global state.
- Any dependency must have a permissive license (MIT/Apache/BSD), be actively maintained, and be justified in writing.
- Support keyboard, gamepad and touch input.

# WORKFLOW RULES
1. Start with MILESTONE 0 only. Do not write game code before PLAN.md is approved.
2. Complete milestones strictly in order. At the end of each one: run tests/lint/build as defined in the plan, summarize what was done, list how to verify it manually, update PLAN.md, commit to git, then STOP and wait for my approval.
3. Each milestone must leave the game in a playable, working state.
4. Keep a running CHANGELOG.md and a DECISIONS.md (why you chose things).
5. If a requirement is ambiguous, pick a sensible default, record it in DECISIONS.md, and continue. Ask me only for decisions that are costly to reverse.

# MILESTONES

## M0 — Plan, Tech Stack Decision & Foundations
Do not write game code until I approve PLAN.md.

Step 1: Research and decide. For each decision below, compare at least 2-3 options against these criteria: production readiness, performance on mid-range phones, bundle size, learning/maintenance cost, testability, long-term maintainability, and how well it supports a shippable v1.0. Make a clear recommendation with reasoning, and state what would change your mind.

Decisions to make:
1. Libraries vs. no libraries: e.g. vanilla Canvas 2D, PixiJS, Phaser, Kaboom/Excalibur, Three.js, or custom. Include rendering, audio (WebAudio vs Howler/other), input, and physics/collision.
2. Language: JavaScript vs TypeScript.
3. Project setup: Node.js toolchain (Vite, esbuild, etc.) vs. a zero-build setup opened directly from index.html. Note that ES modules and asset loading often fail from file://, so state exactly how the game will be run during development and in production.
4. Testing: unit and end-to-end tools, or justify why none.
5. Deployment target: static hosting (Netlify, Vercel, GitHub Pages, itch.io), plus PWA/offline.
6. Asset pipeline: procedural vs. sprite atlas, audio format and generation.

Step 2: Write PLAN.md containing:
- Tech stack decision record (options considered, choice, trade-offs, risks)
- Game design doc: core loop, enemy types, scoring, lives, stage progression, power-ups, art/audio direction
- Architecture and folder structure
- Risk list
- Definition of Done per milestone
- Any adjustments to milestones M1-M9 needed because of your stack choice (rename tools, reorder, add or remove tasks)

Step 3: After approval only, set up the repo, tooling, CI, and a blank canvas rendering.

Present PLAN.md and stop. Wait for my approval or requested changes.

## M1 — Engine Core
Fixed-timestep loop (60 Hz update, interpolated render), scene/state manager (boot, menu, play, pause, game over), input abstraction (keyboard first), resize handling with letterboxing, asset loader, debug overlay (FPS, entity count). Unit tests for the loop and state machine.

## M2 — Player & Shooting
Player ship movement bounded to the screen, shot cooldown, bullet pooling (no per-frame allocations), starfield parallax background. Tuned game feel: acceleration, firing rhythm.

## M3 — Enemies & Formation
Enemy base class, 3+ enemy types, grid formation with idle sway, scripted entry paths (bezier/spline waves), collision detection (approach justified in the plan), explosions via particles, scoring and HUD.

## M4 — Attack Behaviors & Waves
Dive-bomb attack patterns, enemy shooting with difficulty scaling, data-driven wave/stage manager (JSON or config files), challenge/bonus stages, player lives, respawn with invulnerability, game over flow.

## M5 — Signature Mechanics
A unique twist on the genre (e.g. tractor-beam capture and rescue for dual-fire, or your own original mechanic), power-ups, a boss enemy every N stages. Balance pass documented.

## M6 — Audio & Visual Polish
SFX and a music loop (procedurally generated or properly licensed), volume/mute controls, screen shake, hit flashes, particle polish, optional CRT/bloom effect (toggleable), consistent art style, optimized sprite rendering.

## M7 — UX, Meta & Persistence
Title screen, settings (controls, audio, accessibility: reduced motion, colorblind-safe palette), pause menu, tutorial prompt, high-score table saved in localStorage, touch controls and gamepad support, responsive layouts, i18n-ready strings.

## M8 — Quality & Performance
Test coverage on core logic, end-to-end smoke tests (using the tools chosen in M0), profiling to hold 60 FPS on mid-range phones, memory/GC audit, error handling and crash logging, cross-browser testing (Chrome, Firefox, Safari), accessibility audit.

## M9 — Production Release
Production build with minification and compression (using the chosen toolchain), PWA/offline support, favicon/meta/social tags, optional privacy-friendly opt-in analytics hook, deployment config for the chosen host, README with run/build/deploy docs, license, final QA checklist, tagged v1.0.0.

# DEFINITION OF DONE (every milestone)
- Builds with zero errors/warnings; lint and tests pass.
- Playable at 60 FPS on a mid-range laptop.
- No console errors.
- PLAN.md, CHANGELOG.md, DECISIONS.md updated.
- Manual verification steps provided.

# BEGIN
Do MILESTONE 0 now. Present PLAN.md and start following it.
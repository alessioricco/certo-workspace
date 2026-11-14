# Latticewake: finish the game, milestones M1 to M9

Run it from the workspace folder with

```bash
certo --milestones tasks/latticewake-m1-m9.md --project latticewake --max-steps 150
```

Latticewake is an original fixed-shooter game in the browser, already
started in this folder. `PLAN.md` is **approved**: its tech stack
(vanilla TypeScript, Vite, Canvas 2D, WebAudio, Vitest, Playwright), its
game design, its architecture and its definition of done per milestone
are the source of truth. Read `PLAN.md`, `DECISIONS.md`, `CHANGELOG.md`
and the existing code before you change anything, and build on what is
there: part of M0-B and M1 is done already.

Rules for every milestone:

- Do this milestone only, as `PLAN.md` describes it, then stop: Certo
  runs the checks (`npm run build`, `npm test`, `npm run lint`,
  `npm run typecheck`) and starts the next milestone when they pass. Don't
  wait for approval, and don't start the next milestone yourself.
- The game stays playable, and every earlier milestone keeps working.
- At the end: set the milestone's status in `PLAN.md` (mark the plan
  `APPROVED` the first time), add a `## Mn — title` section to
  `CHANGELOG.md` with what was done and how to check it by hand, and
  record new choices in `DECISIONS.md`.
- Change a test only when the behaviour it checks changed on purpose,
  and say why in `CHANGELOG.md`.
- Work only inside this project folder. Don't push, deploy, publish or
  tag anything.

## M1 — Foundations and engine core

Finish what M0-B and M1 in `PLAN.md` ask for and isn't done yet:
tooling, CI configuration, the blank responsive canvas, the 60 Hz
fixed-timestep loop with interpolated rendering, the scene manager,
keyboard input through the action map, the resource loader, letterboxing,
and the debug overlay, with their unit tests.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M1"}]
```

## M2 — Player and shooting

As `PLAN.md` describes M2.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M2"}]
```

## M3 — Enemies and formation

As `PLAN.md` describes M3.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M3"}]
```

## M4 — Attacks and waves

As `PLAN.md` describes M4.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M4"}]
```

## M5 — Signature mechanics

As `PLAN.md` describes M5: the Echo Lattice, power-ups and the boss.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M5"}]
```

## M6 — Audio and visual polish

As `PLAN.md` describes M6.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M6"}]
```

## M7 — UX, meta and persistence

As `PLAN.md` describes M7.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M7"}]
```

## M8 — Quality and performance

As `PLAN.md` describes M8. A browser or device you can't run is marked
not checked, never passed.

```acceptance
[{"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M8"}]
```

## M9 — Production release

As `PLAN.md` describes M9, with the version 1.0.0 in `package.json`, but
no deployment and no git tag.

```acceptance
[{"kind": "file_contains", "path": "package.json", "contains": "\"version\": \"1.0.0\""},
 {"kind": "file_contains", "path": "CHANGELOG.md", "contains": "## M9"}]
```

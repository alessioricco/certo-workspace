# Changelog

Only delivered work belongs here; future acceptance targets live in [PLAN.md](PLAN.md). This project has no released version yet.

## 2026-11-10 — M0-A revision 2: revalidation

- Reviewed the existing proposal against `tasks/galakka.md`; a repeated task reference does not approve the plan. M0-B and M1–M9 remain unstarted.
- Reproduced the README documentation validator's `Unexpected project files` failure caused by the managed `.certo/` directory. Corrected the entry check to exclude only that directory; all other unexpected entries still fail. No Certo contents were read or modified.
- Rechecked all nine proposed development package versions using official npm version endpoints: versions exist, declared licenses are MIT/Apache-2.0, and engine/peer ranges support the proposed Node 22.22.x/compiler/linter/test stack. This is metadata verification, not dependency installation, a transitive audit, or an executed toolchain check.
- **PASS:** executed the corrected README shell block: `PASS: four nonempty docs; links, fences, whitespace, decisions, milestones, approval boundary`.
- **PASS:** `git diff --check` and `git diff --cached --check`; scoped review covers only the four project documents and the repository AGENTS validator note. Unrelated task/project files remain unstaged.
- Manual verification: from `projects/latticewake/`, read PLAN sections 1–7, run the README documentation block, and confirm PROPOSED / approval NOT RECEIVED. The only project entries are the four planning documents and managed `.certo/` state.
- Game tests, lint, build, browser-console and FPS checks remain **not applicable / not run**: there is no executable implementation. Nothing was installed, pushed, published, or tagged.
- Local handoff commit subject: `Keep Latticewake plan verification compatible with managed run state`; retrieve its identifier with `git log -1 --oneline -- projects/latticewake` from the workspace root.

## 2026-11-10 — M0-A: research and plan for review

### Added

- Original **Latticewake** design proposal: geometric enemies, formation/dive combat, marked-pulse **Echo Lattice** captures, temporary firing drones, deterministic stages, power-ups, bonus stages, and a recurring boss.
- Technology comparisons across production readiness, mobile performance, bundle size, effort, testability, longevity, and v1 fit; recommendations, trade-offs, and reversal criteria for rendering, audio, input, collision, language, setup, testing, hosting/offline, and assets.
- Official-source research and candidate direct dependency licenses/release activity. Recorded the TypeScript 7 versus typescript-eslint peer mismatch and proposed the compatible TypeScript 6.0 branch instead of forcing latest versions.
- DOM-free deterministic simulation contract, 60 Hz timing/interpolation, seeded RNG, action tapes, fixed pools, explicit collision order, architecture, budgets, risk register, and M0–M9 acceptance/manual checks.
- [DECISIONS.md](DECISIONS.md) with rationale/assumptions; [README.md](README.md) with current document-review/check commands and clearly future-only install/run/build/deploy contracts.
- Workspace memory entry identifying the new project and unapproved plan-only state.

### Workflow interpretation

- M0 split proposed as M0-A (this plan) and M0-B (post-approval tooling/CI/blank canvas). M1 is an engine testbed; M2 starts shooting. Plan approval must explicitly cover these foundation/playability exceptions.
- Resumed the interrupted planning task after inspecting the actual filesystem; no prior planning documents had been saved. No approval inferred from the resume request.
- No game code, manifests, lockfile, dependencies, CI, canvas, assets, or service worker created. Existing projects, unrelated untracked files, task input, and `.certo/` were not modified. No push, PR, deployment, or tag.

### Verification

- **PASS:** executed the exact README documentation validator: four nonempty project docs; local links resolve; fences/whitespace valid; all technology decision areas and M0–M9 checkpoints present; approval boundary intact; no implementation files.
- **PASS:** `git diff --check` and `git diff --cached --check`; staged-path review contains only the four project Markdown files and the two-line root AGENTS memory addition. Unrelated untracked files remain unstaged. Reviewed new content for secrets; none added.
- **PASS:** manual consistency review of the proposed stack, originality/scope, design, determinism/ownership, milestone gates, risks, and the README's current-versus-future command distinction. No approval inferred.
- Handoff commit subject: `Define Latticewake scope before committing to implementation`. The commit identifier is available in `git log -1 --oneline -- projects/latticewake`; no remote operation is included.
- Game unit tests, ESLint, TypeScript compilation, production build, browser console, and FPS: **not applicable / not run** for this documentation-only milestone. There is no executable project to verify yet; no gameplay or production-readiness claim is made.
- Manual review steps: open PLAN sections 1–2 (approval/choices), 3–4 (design/architecture), 5–7 (checks/milestones/risks); compare DECISIONS and README; verify only four Markdown files exist in the project and the plan remains PROPOSED.

### Approval status

**Not received.** M0-B and M1–M9 have not started. This checkpoint ends with a local planning commit and presentation of PLAN.md for review.

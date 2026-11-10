# Latticewake

An original browser fixed-shooter project, currently at **M0-A: plan review only**.

**There is no game, canvas, package.json, lockfile, or installed dependency yet.** This is intentional: the request requires approval of PLAN.md before any implementation or tooling setup. No playable/build/FPS/console-clean claim is made for this checkpoint. Resuming the planning task does not approve its plan.

## Review the current deliverable

From the workspace root:

```sh
cd projects/latticewake
cat PLAN.md
cat DECISIONS.md
cat CHANGELOG.md
```

No dependency installation is needed to read the documents. Use a Markdown viewer for tables, or read the files directly. The documents are:

- [PLAN.md](PLAN.md): compared stacks, selected recommendation and reversal criteria, original game design, architecture, deterministic timing/input/RNG contract, milestone definitions, performance/test gates, risks, and approval status.
- [DECISIONS.md](DECISIONS.md): rationale and explicit defaults, including the M0 split and originality/accessibility/privacy boundaries.
- [CHANGELOG.md](CHANGELOG.md): work actually delivered and verification performed.

### Documentation verification (available now)

With Python 3, run this from `projects/latticewake/`. It uses only the standard library; it is a documentation check, **not** a game test suite.

```sh
python3 - <<'PY'
from pathlib import Path
import re
root = Path.cwd()
names = {'PLAN.md', 'DECISIONS.md', 'CHANGELOG.md', 'README.md'}
assert {p.name for p in root.iterdir()} == names, 'Unexpected project files'
for name in sorted(names):
    text = (root / name).read_text()
    assert text.strip(), f'{name}: empty'
    assert sum(line.startswith('```') for line in text.splitlines()) % 2 == 0, name
    assert all(line == line.rstrip() for line in text.splitlines()), name
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
        if not target.startswith(('https://', 'http://', '#')):
            assert (root / target.split('#')[0]).is_file(), (name, target)
plan = (root / 'PLAN.md').read_text()
for heading in ('D1a', 'D1b', 'D1c', 'D1d', 'D2', 'D3', 'D4', 'D5a', 'D5b', 'D6'):
    assert f'### {heading} —' in plan, heading
for milestone in ('M0-A', 'M0-B', *(f'M{i}' for i in range(1, 10))):
    assert f'**{milestone} —' in plan, milestone
assert 'PROPOSED' in plan and '**NOT RECEIVED**' in plan
print('PASS: four nonempty docs; links, fences, whitespace, decisions, milestones, approval boundary')
PY
```

From the workspace root, also review Git scope and whitespace:

```sh
git diff --check
git diff --cached --check
git status --short
```

Manual review: confirm PLAN sections 1–2 describe the approval boundary and trade-offs, section 3 defines the original game, section 4 isolates deterministic logic from browser adapters, and sections 5–7 provide verification, milestone, and risk gates. No implementation files should exist. Game unit tests, lint, build, browser/FPS checks are **not applicable yet**, not passed.

## Recommended stack (proposed)

Strict TypeScript + Vite, native Canvas 2D with an original generated atlas, WebAudio synthesis/music, and native keyboard/Pointer Events/Gamepad adapters. No runtime npm libraries. Vitest, Playwright, ESLint, and TypeScript are proposed development dependencies, with compatible candidate versions and permissive license research in PLAN. The suggested title **Latticewake** is provisional pending release-name checks.

The signature **Echo Lattice** captures marked enemy energy to create temporary side-fire drones. Three original enemy archetypes, formation entries/dives, bosses, bonus stages, lives, power-ups, and all-device input are planned; none is implemented at this checkpoint.

## Exact install/run/check contract after approved M0-B

**The following commands are planned, not runnable in this plan-only checkout. Do not run `npm ci` now.** M0-B must create and verify these scripts and a project-local lockfile, then update this README to reflect their actual output. M0-B itself is a responsive blank-canvas foundation; playable combat begins in M2.

Prerequisite: Node.js **22.22.x** and its npm. From the workspace root, once M0-B has been implemented:

```sh
cd projects/latticewake
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/**. No `file://` launch: browser ES-module, resource, and service-worker origin rules make that unsupported. Ports are strict; stop the specific conflicting process or choose an explicit port rather than trusting an auto-selected URL.

For production build and local preview, from the project directory:

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/**. `dist/` will be the static output; the preview server is local verification, not production hosting. To test layout on a phone on the same trusted LAN, run `npm run dev -- --host 0.0.0.0` and open `http://<computer-LAN-IP>:5173/`. Use a secure HTTPS deployment, not insecure LAN HTTP, for final gamepad/PWA checks.

Verification after M0-B:

```sh
npm test
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

`check` is planned to run lint, strict types, full unit coverage, build, license audit, and bundle-budget checks. `test:e2e` starts/stops its own production preview and therefore requires the build produced by `check`. Linux CI may require `npx playwright install --with-deps chromium firefox webkit`. No watch commands, placeholder tests, or prompts in checks. M0-B begins with Chromium smoke; M8 qualifies all engines plus actual Safari/phone/controller tests.

## Deployment and offline status

Planned target: GitHub Pages, HTTPS, deploying **only this project's built `dist/`**, with relative asset URLs for subpaths. Free-public-repository eligibility and an unoccupied destination must be checked before publishing. Do not publish the shared workspace or replace another project's Pages site. No remote push/deploy has been performed or authorized by M0.

M9 will supply verified deployment instructions/configuration, original icons, a manifest, a bounded versioned service worker, offline reload after first online load, safe menu-only updates, and gzip/Brotli release artifacts. Offline/PWA support is **not present now**. No analytics, accounts, API keys, or third-party runtime assets are planned. Actual deployment still requires authorization.

## Current handoff

M0-A documentation is the full scope of this delivery. Read and approve [PLAN.md](PLAN.md) or request revisions before foundations are implemented. Approval is for M0-B only; subsequent milestones retain their own review/commit/stop checkpoints.

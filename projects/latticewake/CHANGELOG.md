# Changelog

Only delivered work belongs here; future acceptance targets live in [PLAN.md](PLAN.md). Version 1.0.0 is prepared as a local release candidate; production sign-off, deployment and tagging remain open/not performed.

## M9 — Production release

**2026-11-14 · LOCAL RELEASE CANDIDATE PREPARED; PRODUCTION SIGN-OFF OPEN.** Version `1.0.0` is recorded in `package.json` and the lockfile. M9 changes no game rules, score/storage schema or replay goldens. No dependency or license inventory changes.

### Delivered

- Vite's production build emits minified, content-hashed application assets and works with the existing relative base beneath a nested path. `npm run build` now generates original PNG app icons, favicon, Apple touch icon and social card; copies the PWA manifest; then creates a finite, scope-relative service worker and a SHA-256 release manifest with gzip/Brotli measurements and sidecars outside `dist/`.
- First successful online visit precaches only this release's same-origin static files. Navigation is network-first with cached `index.html` fallback; exact precached assets are cache-first. Cache names are scoped to the deployed path. The worker deletes only prior `latticewake-<scope>-` caches, never unrelated origin caches.
- Worker updates wait by default. The app reveals **Install update** only on the title menu; explicit activation reloads there, not during play. Registration is disabled in Vite development. No analytics, push, background sync or external runtime service was added.
- Added release-install/offline/update documentation, host boundaries, M9 artwork to ASSETS.md and ADR-038. CI remains read-only and has no publishing step.
- Updated the visible menu's M7 checkpoint wording to the v1.0.0 identity. This intentionally changed the exact status text asserted by the foundation E2E journey; that single assertion now checks the release label. Gameplay assertions and goldens are unchanged.

### Verification

- `npm run check`: **184/184 unit tests pass**, coverage **97.66% statements / 95.93% branches / 95.75% functions / 98.35% lines**, lint and strict typecheck pass, production build passes, license/origin gate passes (208 development packages, zero runtime dependencies), and budget passes (**141,091 raw / 56,261 gzip / 50,871 Brotli bytes; 33,279 gzip JavaScript**). Build produced 14 static files and 28 validated `.gz`/`.br` sidecars, with 20-character release ID `594b811758f710a5d608` at the recorded check.
- Release artifact unit tests round-trip every generated gzip/Brotli output and check PNG dimensions, manifest contents, generated worker scope/build ID and output-path bounds: **2/2 pass** (included in 184).
- Focused Chromium production-preview offline/update journey: **1/1 pass**. Full four-project E2E suite is running; its final result will be recorded before handoff. No remote-host, device or title/trademark claims are inferred from local automation.

### Check by hand

From the project root: `npm ci`, `npm run build`, then `npm run preview`; open **http://127.0.0.1:4173/**. For nested behavior, the automated preview starts `/nested/latticewake/` on port 4184. In the top-level preview, wait for the offline-ready status, reload once, take the browser offline, and reload/launch; confirm the title and **Start run** remain usable. Return online, deploy a changed build only on an authorized test host, confirm the update notice is shown only on the title screen, play and pause without activating it, then return to the title and use **Install update**. Confirm it reloads to the new build.

### Boundaries and open sign-off

No hosting destination/domain or deployment authorization was available; nothing was deployed, published or tagged. GitHub Pages/HTTPS response headers, compression behavior, actual-host offline startup, update/rollback and installation on real devices are not checked here. M8 reference i5/phone/real-Safari/controller qualification, the WebKit injected-audio failure-path probe, and title/trademark review remain open. This is a local release candidate, not signed-off production readiness.

## M8 — Quality and performance

**2026-11-14 · AUTOMATED CHECKS PASS; QUALIFICATION OPEN.** M8 only. No gameplay rules changed; M7 settings and score behavior are preserved while the same storage key extends compatibly to diagnostics schema v3. Canonical replay parity is preserved. Real reference-laptop, phone and Safari qualification remain unverified. One WebKit injected-audio-failure probe remains an open defect.

### Delivered

- **Cross-engine Playwright coverage:** Firefox and WebKit projects join Chromium desktop and touch emulation. The shared production-preview suite includes a canonical rules replay in each browser, accessible-name checks, visible-focus checks and WCAG contrast audits for all three palettes and pause. Chromium CDP-only touch and heap-profiler journeys are explicitly gated where unsupported.
- **Seeded replay parity:** `tests/replay/canonical.ts` defines a 6,000-tick seed-42 action tape. A SHA-256 unit golden (`b5c17c9456011a15e29681ea592a27ab70d84f9187bb80325c7351471410e371`) and in-browser execution in each engine detect replay drift.
- **Bounded local diagnostics:** same `latticewake.meta` storage key, schema v3, migrates v1/v2 settings and scores and keeps only the newest five crash records. Records contain timestamp, scene, stage, rules and a redacted 160-character message; no stack, alias, score or upload. Diagnostics shows, downloads and clears JSON. Oversized or corrupt storage stays untouched and the record remains in memory.
- **Frame recovery:** one frame error is logged and returns a live run to pause (or a menu/game-over screen to menu); four consecutive frame errors stop the loop with a notice. Uncaught errors and promise rejections are recorded without automatically changing the scene.
- **Firefox WebAudio compatibility:** Firefox lacks `AudioParam.cancelAndHoldAtTime`; stopping a voice previously threw during pause. Feature detection now falls back to cancelling scheduled values and holding the current gain before its 10ms ramp. The real Firefox pause journey passes.
- **Accessibility findings:** the settings panel is labelled as a group so Firefox's focusable overflow region is named. WebKit automation accommodates macOS's default keyboard focus order without claiming physical Safari results.

### Tests and intentional changes

- Added diagnostics redaction/storage tests and a replay golden. Coverage includes the crash module and remains above all approved thresholds.
- E2E now includes diagnostics recovery, repeat-failure halt, reload persistence, download, accessibility and three-engine replay journeys.
- Changed M7 focus E2E assertions only for real engine-specific keyboard behavior: Firefox exposes an overflow-panel Tab stop; WebKit's default macOS Tab order skips range controls and buttons. Tests focus those controls directly and still assert their behavior. The WebKit focus audit records the smaller platform-default stop set.
- CDP multi-touch and Chromium CDP heap profiling are skipped outside Chromium because the APIs are Chromium-specific. WebKit's three injected audio allocation/start-failure journeys are explicitly `fixme`; the adapter's app-owned context closes, but the test probe continues to observe its wrapper as running. The cause is unknown and this is not a passing check.
- Full four-project E2E rerun after the focus accommodation: **189 passed, 5 skipped, 2 failed** in 11.5 minutes. WebKit's remaining keyboard failure was then corrected by explicitly focusing its menu button, and that journey passed in isolation. The existing Chromium held-fire soak collected one power-up instead of two under two-worker load; its unmodified 2-minute journey passed in isolation. This is a known load-sensitive soak and remains a full-suite failure until a complete matrix rerun passes. The final rerun summary below records the current state.

### Verification

- `npm run check`: **182/182 unit tests**, **97.66% statements / 95.93% branches / 95.75% functions / 98.35% lines**, strict typecheck, zero-warning lint, production build, license/origin check (208 locked dev packages, zero runtime dependencies) and size check all pass. Build output: 5 files, **114,068 raw / 37,945 gzip / 33,181 Brotli / 31,707 gzip JavaScript bytes**.
- `npm audit --audit-level=low`: **0 known vulnerabilities**. No runtime dependencies or package versions were added.
- **Local opt-in 10-minute profile:** Apple M1, macOS 26.6.2, headless Chromium 158.0.8127.18, 1280×900. 621.8 s total, 36,104 measured frames, **60.0007 FPS average, 16.70 ms p95, 1/36,104 frames >33.3 ms**. Post-GC JS heap: 3,384,396 → 4,839,404 bytes (**+1,455,008 bytes**). Six bosses and six restarts. This is local headless regression evidence including driver/profile overhead, **not** the planned Intel i5 laptop or real phone evidence; the measured workload is not a cap-filled late-stage profile.
- **Real Chrome, Firefox, macOS Safari, iOS Safari, Android phone, controller and touch hardware audits:** NOT CHECKED. Playwright WebKit is not Safari. These remain required before M8 production sign-off.

### Check by hand

From the project root, run `npm ci`, `npm run dev`, then open `http://127.0.0.1:5173/?seed=42`. For a deterministic error-record check, open DevTools on the title screen and run `window.dispatchEvent(new ErrorEvent('error', { error: new Error('manual probe https://example.invalid/private') }))`; open **Diagnostics**, verify the URL is replaced by `[url]`, reload and confirm persistence, then use **Download report** and **Clear crash log**. This is only a local diagnostics check, not physical device/browser qualification. Open **Audio & effects** in Firefox and pause; the run should pause without an AudioParam exception. For automated checks use `npm run check` and `npm run test:e2e` after installing Chromium, Firefox and WebKit.

### Boundaries

- No reference Intel i5 laptop, physical phone/controller, macOS Safari, iOS Safari or Android Chrome was available; performance and accessibility qualification on them is **unverified**. Profile evidence is M1 local headless Chromium only.
- The M8 production readiness gates remain open: real-device 60 FPS, real Safari audit, WebKit injected audio-failure context probe, plus the M9 release work. No M9 work is included.
- No push, tag, publication, deployment or parent-workspace change.

## M7 — UX, meta and persistence

**2026-11-14 · COMPLETE for Certo's checks.** M7 only; M8–M9 remain unstarted. Certo controls advancement. Gameplay rules remain `m5-signature-1`: no rule, RNG consumption, golden fixture or whole-run checksum changed.

### Delivered

- **Screens and text:** title, pause, game-over and the briefing use semantic DOM. Every visible string comes from the English dictionary in `src/ui/strings.ts`; a unit test proves every `data-i18n` key exists and every template placeholder is filled. The structure is i18n-ready; no language switcher ships.
- **Briefing:** a skippable **How to play** dialog from the title and from pause. Opening it during a run pauses it; Escape or **Back to game** closes it. It is not forced before the first run (ADR-034).
- **Settings:** Audio & effects choices persist on this device: Master / Music / SFX, mute, low effects, fragments, shake, glow, scanlines, **Colors** (Original, Color-safe blue / amber, High contrast), **Motion** (Follow system or Reduce motion), **Touch movement** (drag pad or large direction buttons) and **Autofire during runs**.
- **Storage:** one versioned key, `latticewake.meta` (schema v2), holds only validated settings and up to ten local scores. Version 1 audio/effect settings migrate. Oversized, malformed, future-version or corrupt payloads are left untouched and play continues in memory with a notice. Denied, quota-full or unreadable storage falls back the same way (ADR-032).
- **Local top ten:** game-over offers one score entry per finished run with an alias field. Aliases keep 1–12 letters, digits, spaces, `_` or `-` (blank becomes `PILOT`) and are rendered as text. Ranking is score, then stage, then insertion order. Scores reload after a page reload.
- **Touch parity:** pointer-captured drag pad or large left/right buttons, held **Fire**, a separate **Echo** button and a persistent **Pause run**. Up to ten pointers; cancellation, lost capture and blur clear held input.
- **Gamepad parity:** standard mapping only: left stick (0.18 dead zone), D-pad, South / right trigger fire, West Echo, Start pause, and menu back/next/previous/decrease/increase/confirm. A disconnect pauses the run; buttons held through pause or reconnect stay suppressed until released (ADR-033).
- **Keyboard-only menus:** Tab / Shift-Tab focus order, Enter activates native controls, Escape closes the briefing or the settings panel.
- **Responsive layouts:** browser tests check 390×844 and 844×390 (rotation, touch controls, canvas aspect); screenshots check 1280×900 and 390×844.

### Fixed during this milestone

- **Colour-safe palette.** The first M7 mapping treated the navy field as "cyan" and turned it bright blue, washing out ivory shots and the ship. Its "amber" branch also caught magenta capture accents instead of the amber hazards. Screenshot review caught both. The mapping is now per-pixel by hue family (cyan → blue, amber → orange, magenta/lavender → reddish purple), skips dark field, grid and frame tones, and keeps ivory unchanged. High contrast still maps each pixel to black or white. The browser palette journey only asserted that the raster changed, so it did not detect the defect (ADR-034).

### Tests and intentional changes

- **New:** `tests/unit/palette.test.ts` (4 cases) for the color mapping, navy field preservation, alpha preservation and high-contrast mapping. Meta, storage, string-key and input-parity unit suites were added with the M7 code and pass (172 unit cases in 14 files, up from 155).
- **Checkpoint text:** the ready-menu assertion in `foundation.spec.ts` moved from the M6 label to `Run ready · M7 UX, meta and persistence`. No gameplay, timing, HP, shot, capture, boss or golden assertion changed.
- **Audio release check (M6 test, `polish.spec.ts`):** the voice-cap journey sampled released voices after a fixed 1.2 s wait. Once in a full parallel run it caught one music voice still sounding (`music 1`, `nodes 36`, chromium-touch). The fixed wait assumed every note had ended. The journey now polls, up to five seconds, until active voices drain, then records the same released values. The expected values (`sfx 0 / music 0 / nodes 35`, 24 SFX cap, 168 dropped) are unchanged. Eight isolated repeats passed.
- **Echo Lattice resume (M5 test, `foundation.spec.ts`):** in one full run, the debug text stayed at tick 19 with the field at 13 for five seconds after **Resume run**, so the journey failed. I could not reproduce it: 16/16 under two-worker load with the audio stress test, 12/12 isolated repeats, and 10/10 earlier isolated runs. The cause is not established. The journey now also asserts `data-scene = play` right after resume, so a recurrence names the scene state. No expected value, timeout or assertion was loosened. Treat this as a known, unexplained intermittent failure until a trace shows the cause.
- **One-shot fire press (M3 test, `foundation.spec.ts`):** the journey released Space after one animation frame. On a loaded host a frame can run no simulation tick, so the press was never sampled and `Shots` stayed 0 (serial run). The press now spans three frames. The expected single shot, one hit and one damaged pip are unchanged; the 9-tick cooldown still allows only one shot. Four repeats under two-worker load passed.
- **Boss journey (M5 real-control test, `plays stages one through five…`):** failed once under two-worker load, with the driver's frame guard stopping at stage 5 (stage tick 3,611, two lives) before the boss fell. It passed in the serial run. This is the same class as the recorded M6 profile failure. It is **not fixed**, and its cause is not established.

### Verification (this milestone's final run)

- `npm run check`: zero-warning lint; strict typecheck; **172/172 unit cases** in 14 files; coverage over the declared core and pure modules **97.62% statements / 95.9% branches / 95.56% functions / 98.32% lines**; production build; locked license/origin gate (**208** development packages, no runtime dependencies); gzip/Brotli budget.
- Build budget: **5 files, 108,996 raw / 36,381 gzip / 31,821 Brotli / 30,453 gzip JavaScript** bytes, each file compressed independently; far below the 120-KiB JS and 250-KiB total gates.
- `npm audit --audit-level=low`: **0 known vulnerabilities**.
- Visual review at 1280×900 and 390×844 (device pixel ratio 2): menu, briefing, High-contrast settings, Color-safe settings, phone play with touch controls and game-over score entry. Screenshots are in ignored `test-results/` and were checked after the palette fix.
- Browser suite: see the final line in the verification block below.

### Check by hand

From this folder: `npm ci`, `npm run dev`, open **http://127.0.0.1:5173/?seed=42** (or `npm run dev -- --port 5183` with that URL).

1. Keyboard only: Tab through the title; open **How to play** (Escape closes it); open **Audio & effects**, set Colors to **High contrast** and Motion to **Reduce motion**, then close with Escape. Reload: both choices remain.
2. Press Enter, then Escape to pause. Resume explicitly with **Resume run**, then **End session** (G). In the game-over panel enter alias `<b>ACE</b>`: it saves as `bACEb`. Reload and open **Local top ten**: the entry remains.
3. Deny storage (private window with site data blocked) or fill it: a notice says settings and scores stay in memory until the page closes, and play still works.
4. Phone: in DevTools choose a 390×844 touch device. Drag the pad, hold **Fire**, tap **Echo** and touch with two fingers at once. Rotate to 844×390: the layout still fits and touch controls remain usable.
5. Standard controller: connect one and check that **Controller connected** appears. Disconnect it mid-run: the run pauses with a notice.

Results from these steps were not recorded with physical hardware here. Controller and phone checks remain manual, and automation covers them only through the injected/emulated paths described above.

### Boundaries

- No physical controller, real phone, Safari, Firefox or iOS evidence exists in this environment; those remain M8. Storage failures were injected in Chromium only.
- The briefing is optional, not forced, per ADR-034.
- No push, tag, publication, deployment or parent-workspace change. Crash diagnostics, offline/PWA and release artifacts remain later milestones.

## M6 — Audio and visual polish

**2026-11-11 · Checked by Certo.** M6 only. The opt-in ten-minute audit is **unverified** (see its section). Gameplay rules remain `m5-signature-1`.

### Delivered

- Optional, original WebAudio: ten cached mono SFX patches (glassy shots, filtered seeded-noise impacts/destruction/loss, rising capture/pickup/ward/open tones, phase/clear cues) plus an authored restrained sixteen-bar, 110-BPM lead/bass score. Independent audio seed salt `0x85ebca6b`; no gameplay RNG consumption, audio files, codec, asset download or new dependency. Twenty-one native-rate buffers; only SFX regenerate on a fresh seed/run.
- Visible **Enable audio**, accessible **Master / Music / SFX** sliders (60/35/65%), **Mute all audio**, status/retry affordance and read-only audio diagnostics. Gains ramp; 24 SFX / 8 music slots bound polyphony. Native one-shot sources disconnect on end/stop; the scheduler looks ahead 120 ms and drops stale playback rather than catching up. Fixed worst-case mix ceilings avoid summed clipping. Settings persist across runs only, not reloads (M7 boundary).
- Pause/game-over/menu fades voices then suspends; blur/hidden/pagehide require explicit resume. Audio interruption never silently reactivates on focus. Unlock timeout/cancellation and lifecycle generations prevent deferred activation after pause/teardown. Missing APIs, rejected/pending resume, partial buffer allocation, source allocation/start failures release resources and leave a playable silent game with **Retry audio**. Native context and pending timers are owned/closed at teardown.
- Separate 192-slot run presentation queue forwards accepted formation/boss hits plus shot, field, capture, pickup, Ward, player loss, phase and clear events with global tick/entity IDs. Fixed tick/entity/kind dispatch history deduplicates audio, coalesces same-part/same-tick hits and ignores stale events. Overflow drops feedback, never score, HP, cooldown or firing.
- Existing damaged sprites / 512 fragments retained; 32 fixed localized outline marks add readable boss-hit, capture, pickup, Ward and loss feedback without full-screen flashes. Loss shake is bounded to two logical units / twelve ticks. Optional glow and static scanlines default off; unused cells in the existing 704×304 atlas cache the glow and identical hostile chevron. No per-shot vector path, per-frame filters, shadowBlur or sprite baking.
- Fragments/shake toggles and **Low effects** (DPR ≤1.25). Low/reduced motion suppress decorative parallax/rotation/shake/fragments/scanlines without removing hazards, HP, warnings, field/ward/protection or fixed simulation updates. Small/landscape pause panels scroll within the playfield; persistent audio/effect controls remain above them and clickable.

### Tests and intentional changes

- Added **16 Vitest cases**, retaining all **139 prior cases and every existing golden** unchanged. New coverage: each PCM envelope/seed/bounds, original score looping, event mapping/dedup/stale/reset/overflow, fixed feedback storage/shake gating, actual accepted mechanic/boss events, complete rules-checksum parity under toggled/saturated effects and absent audio.
- Pure audio/feedback modules join unit coverage, with unchanged 90% statement/line/function and 85% branch floors. Browser-only native WebAudio/Canvas/DOM adapters are tested through actual APIs, not falsely included in the unit percentage or mocked away.
- Production browser additions exercise native unlock/bus gains/mute/pause/background/interruption/teardown, all optional-audio failure/retry boundaries, pending-activation cancellation, effect/pause-rule parity and compact-landscape control usability. Only impossible-to-reliably-request native denial/exhaustion boundaries are injected; no game state is mocked/mutated. An in-memory Vite bundle of the unchanged adapter stress-tests real native source caps and release; no test harness or control endpoint ships.
- Existing browser assertions change **only** from the M5 to M6 ready-menu checkpoint text. All old timing, HP/shot/pool counts, capture/two-drone/boss outcomes, checksums and no-retry assertions remain. The layout fix is intentional: the dev smoke reproduced the pause panel blocking the new settings summary in 844×390; a scrolling bounded panel plus control stacking fixes it, and a regression clicks actual controls without `force`. Final keyboard review also reproduced Enter on the native settings summary starting a run instead of opening it; the existing native-button/link exclusion now includes summary, with a real Enter/Space/menu regression.
- Initial focused native tests also exposed a late `suspended` event replacing an audio-denial retry state; failure now tears down the graph, preserves the unavailable state, and retries a clean native context. A library-bundle test initially assumed Vite returned a single output rather than an output array; its harness was corrected, not the voice-cap assertion. PCM silence tests treat signed zero as silence; no audio rule was changed to satisfy `Object.is(+0, -0)`.

### Verification

- `npm test`: **155/155 PASS**, ten files. `npm run check`: zero-warning lint, strict types, full unit coverage, production build, locked license/origin/notices and gzip/Brotli gates **PASS**. Coverage (declared core/pure modules): **99.56% statements / 97.45% branches / 100% functions / 99.82% lines**; not whole-application coverage. All M1–M5 goldens remain intact.
- `CI=1 npm run test:e2e`: **66/66 PASS in 4.7 minutes**, both Chromium viewports, no retries. Includes every earlier gameplay/HP/capture/two-drone/boss journey and all M6 native-audio/fallback/layout cases. Log: `m6-e2e.log`. Native stress fills **24 SFX** slots, drops the other **168** of 192 simultaneous events, and releases to **0 SFX / 0 music / 35 retained bus+slot nodes** after envelopes; repeated resets keep **21 buffers**, dispose leaves **0 nodes / 0 buffers**.
- Build: **5 files / 76,690 raw bytes / 25,732 gzip / 22,693 Brotli / 22,479 gzip JavaScript** (each file compressed independently), far below 250-KiB total / 120-KiB JS gates. `check:licenses`: **208** distinct locked development packages, zero runtime dependencies; `npm audit --audit-level=low`: **0 known vulnerabilities**. Node **22.22.0**, npm **11.11.0**; no lockfile or package-source changes.
- Actual `npm run dev -- --port 5189` smoke passes audio enable, movement/fire/capture, pause/effect controls, resume/end/restart and **1280×900 / 390×844 / 844×390** fitted layouts, with clean page errors; screenshots inspected after the landscape repair. The noninteractive smoke server uses `CI=1` and closed stdin to avoid Vite's terminal-shortcut job-control stop; owned dev processes were stopped before profiling. No temporary app/test-control script was retained.
- Source/security review: presentation never writes rule state or consumes gameplay RNG; no globals/test cheats in shipped code, eval/HTML injection, secrets, storage, remote requests, telemetry, new permissions or dependency sources. Original generators/score and license records are in ASSETS; architectural choices are ADR-029–031.

### Ten-minute combat/allocation audit

The paired real-control audits are being rerun after an audit-pilot repair; measured results follow once verified. The first phone-layout attempt stopped at 5.8 minutes: three lives, phase two, 10 HP remaining and no live drones. The reused two-drone pilot kept firing from its safe x≈222 waiting lane after side-firing drones expired, so center shots missed the gate until its existing 3,600-frame guard fired. The long audit now explicitly aims/dodges through the gate once two-drone overlap has been observed; original journey assertions, timeout and gameplay rules are unchanged.

Local host metadata: **Apple M1 / 8 logical CPUs / 16 GiB RAM / Darwin 25.6.0 arm64**. Two headless Chromium workers share the host. No M8/M9 hardware or release qualification is implied.

### Check by hand

From this folder: `npm ci`, `npm run dev`, open **http://127.0.0.1:5173/?seed=42**. If occupied: `npm run dev -- --port 5189`, use that matching URL. Production: `npm run build && npm run preview`, **http://127.0.0.1:4173/**. Exact test/browser-install commands and the opt-in ten-minute audit command are in README.

1. Before enabling audio, start/move/fire/capture/pause/restart: silent play works. Click **Enable audio**; start and listen for shots, impacts, destruction, clear/phase cues and the restrained loop. Capture a ringed pulse / collect a plaque / take a hit for the distinct cues. No sound is required to survive.
2. Open **Audio & effects**; move Master/Music/SFX independently, including zero, and toggle **Mute all audio** while firing. Watch voice counts return to zero when muted/paused, stay within 24/8, and retain 21 buffers. Unmute does not replay old events. The music starts only in a live run.
3. Pause, switch tabs/blur, return: run and audio stay suspended. Explicitly Resume run; simulate/experience an OS audio interruption then use **Resume audio**. With unsupported/denied audio, expect **Retry audio** while movement/fire/pause still work. Never grant microphone access; none is requested.
4. Enable glow/scanlines, disable fragments/shake, compare **Low effects** and OS reduced motion. Check real hostile chevrons, ringed pulses, boss HP/phase warnings and steady protection/field/Ward cues remain clear. Pause; toggles change pixels/backing resolution but never score, lives, stage, timers or held actions.
5. Resize to portrait and short landscape; open/close settings, scroll sliders/effect controls and the bounded pause panel, and resume via the real button. Restart keeps presentation choices but resets gameplay/effect/audio history; reload resets presentation choices to defaults. No persistence/touch/gamepad/offline feature is added here.

Stop at M6. No push, tag, publication, deployment, nested Certo or parent-workspace changes.


## M5 — Signature mechanics

**2026-11-11 · COMPLETE.** Finished the interrupted M5 delivery and its verification. Only M5 is authorized; M6–M9 remain unstarted. Certo controls advancement.

### Delivered

- Echo Lattice: X/K edge opens a 24-tick radius-32 field with immediate 240-tick cooldown, hit or miss. Only swept marked ring/diamond pulses can be intercepted; stable impact-time/ID ordering, one pulse per activation, no score/heal. Capacity blocks activation without spending a pulse/cooldown. Two independent 360-tick prismatic drones add one side shot each. Bellframes and bosses emit marked pulses; ordinary chevrons/contact remain dangerous.
- Deterministic authored Ward / Fan / Overclock drops from destroyed formation slots 2/11/18, not random rolls. Twelve fixed drop objects, 480-tick lifetime, 60-unit/s downward drift and generous 28-unit swept pickups. Ward absorbs one ordinary projectile/contact for up to 900 ticks; Fan supplies three center shots for 480 ticks; Overclock supplies six-tick fire for 360 ticks. Refresh, not stack; all 24 power-toggle/drone-count combinations tested. Whole 1–5-shot volleys reserve player-pool capacity before mutation/cooldown. Existing ordinary nine-tick range and 128-slot limits remain.
- Meridian Engine every fifth stage: no regular formation, break both 8-HP emitters, expose a 16-HP gate, then a 20-HP alternating sweep. One-second steady entry/phase warnings, explicit swept part shapes, bounded HP scaling, phase-owned hazard clearance, capped atomic boss volleys and optional capture opportunities. Final victory awards 5,000 + 500 × boss index exactly once. Stages 20 and 40 run boss → safe tally → same-numbered nonlethal bonus → safe tally → next numbered stage.
- Death removes field/drones/powers; respawn freezes capture/power timers, pause/background freezes every rule, safe tallies count alive durations, fresh restart resets all counters/objects/interlude state. Power/drop/boss state is read-only in the HUD/diagnostics. Original cached 704×304 atlas adds ringed pulses, prismatic drones, W/F/O plaques and segmented gate/emitters. Shape labels/steady cues survive reduced motion; no audio or other M6 work.
- New choices and reproducible tuning observations: ADR-025–027; original asset recipes: ASSETS. No dependencies, storage, permissions, external runtime resources or production cheats were added.

### Tests and intentional changes

- Added **22 unit cases** to the 117-case baseline. Tests execute real rules (no mocks): exact capture/cooldown/drone boundaries, one marked pulse, impact/ID ordering and high-speed crossing, capacity without spending, ordinary/contact danger, death/respawn/reset, exact power refresh/expiry, all combinations and atomic saturation, authored drops/validation/pickups/expiry, boss shields/warnings/stable sweeps/phase ownership/deferred fire/awards/HP cap, stage-20/40 precedence, plain-fire and capture tuning, and fixed-seed action-tape parity.
- M5's approved contact order **intentionally replaces M4's last-kill-wins rule**: capture → remaining hostile damage → player shots/deaths → drops/completion. The old conflicting regression now proves that the hostile costs a life, cancels the old shot and leaves the final enemy alive, then verifies the later legitimate kill/tally and unchanged 4,640-point result. No unrelated assertions are weakened.
- Stage validation now expects bosses ahead of bonuses at multiples of 20. The original whole-run sweep intentionally changes under drops, marked shots, boss phases and damage precedence; rules become `m5-signature-1`, its run ends at tick **5,811**, SHA-256 `bf65b25930fb3753ce47125e1b46ad2740f0f3d6bdacea31433607ee0d358a86`. M1–M3 tests and both M2/M3 golden fixtures remain unchanged.
- A new **3,600-action recorded M5 tape**, with real capture/boss/subsequent combat, yields identical full rules snapshots at **30/60/90/120/144 Hz** and under saturated cosmetics: `a7ecd372325f6359f0ff6b0baca16337d332aba7c77eb0b95577ca25ca8707a5`. No replay UI or cross-browser determinism claim.
- Powered pressure is an intentional change, not a pool regression: the plain-controls stages 1–4 policy automatically collects powers and now has exact peak **11**. The browser stationary-fire policy also collects **two** authored powers and peaks at **11**, so its old unpowered peak-seven expectation is replaced with exact peak-11/two-pickup assertions. The unchanged M2/M3 cases still enforce ordinary peak seven. Zero denied volleys and 128-slot hard bounds remain.
- Browser copy/rules metadata follows M5. Added a real X/K field/cooldown pause/reset journey and extended ordinary-input stages 1–4 through the boss, all three phases and two simultaneous drones. Browser raster steering reads the actual ship/pulse pixels and emits native KeyboardEvents; it never reads/mutates simulation internals. The boss driver stops firing in phase 2 to exercise two drones before finishing, rather than weakening that assertion or changing gameplay timings. The completion observer reads the actual tally HUD, not the debug panel which has no tally text.
- Continuation repair: the fresh full browser run initially passed **41/42**; the desktop driver captured three pulses but died in phase 2 while waiting for overlapping drones. The trace and raster show unsafe center-lane targeting, not a capture defect. Change only its input policy to wait beside the ordinary-shot lane, intercept within the larger field and brake using rendered ship motion. **No outcome assertion, timeout, test count, production rule or golden is weakened or changed.** The checked-in test change fixes how the policy plays the intended behavior; ADR-028 records the diagnosis. The full unit/common suite is rerun after this edit.

### Tuning pass and limitations

- Targeted dodge/fire policy, stage-five starts at seeds **7 / 42 / 2026**: plain fire **1,196 ticks / 19.93s**, no deaths, no captures; optional capture **1,025 ticks / 17.08s**, no deaths, **2 successes / 2 activations**; both award **5,500**. Boss patterns consume no RNG, so these identical seed results are expected. Capture shortens this policy's clear by about **14.3%**, without points/healing abuse. No capture is required to win.
- Basic seed-42 80-tick sweep/fire (automated novice proxy): reaches phase 3 but loses all three lives at **2,313 ticks / 38.55s**. Preserve one-second phase warnings and exposed-part text rather than raising projectile speed or making capture mandatory. Approved capture/power durations are unchanged; explicit first-boss HP/cadences and reachable drop drift are documented tuning choices.
- **No human novice/experienced playtest occurred** in this noninteractive run. These policy measurements do not establish human success rates, final balance or reference-device qualification. M6–M9, physical phones/controllers, Safari/Firefox/WebKit, thermal/GC and hosted CI remain outside this completion claim.

### Verification from this run

- `npm test` / `npm run check`: **139/139 tests, 9 files PASS**, zero-warning lint, strict typecheck, coverage, production build, locked license/origin/notices and size gates PASS. Core coverage: **99.76% statements, 98.00% branches, 100% functions, 99.80% lines**; floors unchanged, not whole-application coverage.
- Node **22.22.0**, npm **11.11.0**; dependency audit: **0 known vulnerabilities**. No lockfile/package-source changes. Source review: DOM-free rules, finite project-authored config, no eval, HTML injection, secret, remote telemetry or mutation endpoint added.
- Build: **5 files; 60,363 raw bytes; 20,613 gzip; 18,109 Brotli; 18,051 gzip JavaScript**, compressing each file independently. Both budgets PASS; no host transfer-encoding/release claim.
- Actual Vite dev-server smoke on owned **5188**: movement/fire/capture, exact paused canvas, explicit resume, end/restart, clean console and fitted **1280×900 / 390×844 / 844×390** layouts PASS; screenshots inspected. Owned dev server stopped; temporary script removed. Browser test logs use root `m5-*.log`, not the directory Playwright deletes at startup.
- Final fresh `CI=1 npm run test:e2e`: **42/42 PASS in 4.4 minutes**, Chromium **158.0.8127.18**, desktop and DPR-3 phone-layout emulation. Report totals: **0 unexpected, 0 flaky, 0 skipped**; retries remain disabled. Both two-minute profiles, native-key/focus/respawn/HP/raster journeys, nested assets, visible capture-field pause/reset and stages 1–5 through all boss phases/two drones/victory pass. Strict console/page-error checks pass. Final log: `m5-e2e.log`; ignored HTML report: `playwright-report/`.
- Before that full run, `CI=1 npm run test:e2e -- --grep 'plays stages one through five' --repeat-each=2`: **4/4 PASS in 3.3 minutes**, no retries, covering two complete journeys per viewport after the driver repair. Log: `m5-focused.log`. All 139 unit cases and the full common gate were rerun after editing the driver; no production-code or unit-test changes were required in this continuation. Boss entry/victory and desktop/portrait/landscape dev screenshots were visually inspected.
- Final stationary-fire profiles: desktop **59.986 FPS / 16.70 ms p95**, phone-layout emulation **59.977 FPS / 16.70 ms p95**; each measured **120,011.9 ms**, collected two powers, peak **11/128**, zero denied volleys. Both reach game over at tick **1,498** (162 firing events, 10 kills, 1,920 points), so most of each profile is a frozen game-over scene, **not sustained combat qualification**. Coarse heap estimates are 10,000,000 bytes, not a leak/GC audit. The final suite ran without a concurrent dev smoke; two browser workers shared the host. Human/device/cross-engine/M8/M9 evidence remains unverified.
- Reconciled PLAN's checkpoint/ledger/handoff, README, decisions and repository memory with the delivered M5 state. Install/run/build commands remain concrete and unchanged; no new dependency, package-source setting, runtime data exposure or later-milestone feature was introduced.

### Check by hand

From this folder: `npm ci`, `npm run dev`, then **http://127.0.0.1:5173/?seed=42** (if occupied: `npm run dev -- --port 5188` and matching URL). `npm run build && npm run preview` serves the build at **http://127.0.0.1:4173/**. Exact automated commands and browser installation are in README.

1. Start run; hold Space/J and steer with arrows/A–D. Tap X/K: steady ring/square for 0.4s, cooldown starts at 4s even on a miss. Tapping during recharge does not reopen it. Pause/blur: canvas and all mechanics freeze; resume explicitly.
2. Reach stage 3 and leave a Bellframe alive, or stage 5's boss. Align with a ringed diamond pulse and tap X/K as it nears the ship: pulse disappears, one prismatic drone joins for 6s and adds a side shot. Capture again after recharge while the first drone remains; observe two independent timers and three straight shots. Ordinary chevrons/contact still hurt during an open field; there is no capture score/healing reward.
3. Catch W/F/O plaques as they drift down. Ward adds a rectangular outline and absorbs one ordinary hit; Fan gives three center directions; Overclock quickens volleys. Combine with drones; repeated pickups refresh timers, never multiply. Death clears these advantages; protection/respawn and three-life game over/restart still work.
4. Play to stage 5 without capture too. Break the two exposed emitters, wait out the steady warning, attack the gate, then dodge the alternating sweep. Boss HP bars and phase labels show the objective. Victory adds 5,500 once, clears hazards, then safely advances to stage 6. Stage 20's boss-before-bonus order is directly unit-tested (no stage-select cheat).
5. F3 shows field/recharge/captures, independent drones, all power timers, pickups, boss phase/warning/part HP and actual entities. Restart: stage 1, three lives, score/cooldown/drones/powers/pickups reset. Resize and enable reduced motion: gameplay cues remain readable.

Stop at M5. No push, tag, publication, deployment or parent-workspace changes.



## M4 — Attacks and waves

**2026-11-11 · COMPLETE.** Only M4 is authorized. M5–M9 remain unstarted; Certo controls advancement.

### Delivered

- Typed, validated seeded stage data: layout/path IDs, entry duration/stagger, warning/dive cadence, attack kinds, shot/diver caps, shooter rate/speed, bonus duration and empty drop reservations. Stages 1–3 enable Shardlet, Spindle and Bellframe attacks progressively; all earlier silhouettes, HP, entries/sway and shooting remain.
- Steady 36-tick bracket/chevron warning before dives and first shots. Original quantized shallow/hook/sweep paths; Shardlet exits below and re-enters its own slot, Spindle/Bellframe return to their moving owned slots. Launch-time aiming, never homing. Higher diving kill scores 180/300/500, one award per enemy. Difficulty caps at 2.2, six simultaneous warnings/dives/returns/exits, 128 hostile shots and at least 30 ticks between a shooter's shots.
- A distinct preallocated 128-slot hostile pool with IDs/generations, downward/aimed velocities, per-stage caps, observed overflow and deferred cooldown. Hostiles cannot become upward player shots or kill enemies. Relative swept player contacts precede expiry; earliest hazard applies at most one life loss. A last enemy kill wins a simultaneous hazard and clears all shots before the safe tally.
- Three lives, 90-tick respawn, centered safe return/96-unit hostile clearance, 120-tick protection with steady non-flashing ring, extra lives at 20,000 then every 50,000, maximum five with capped thresholds consumed. Third death enters real game over. Restart resets all run-owned state; allocator generations remain safe. Pause/focus lifecycle freezes every timer and clears held inputs.
- Automatic 150-tick safe wave tally with cumulative score/lives. Every fourth stage has 20 one-hit non-shooting targets, 150 points each, fixed 1,200-tick duration, no contact damage and 3,000 extra for perfect clear at timeout. Misses retire without kill credit or life loss. Stage 5+ remains ordinary combat until M5; no boss/precedence, capture, power-up, audio, persistence, offline or new input-device work was started.
- Start/Pause/Resume/Restart run UI, stage/life/score/bonus/protection/tally HUD, actual visible ship/enemy/both-projectile entity count, attack and hostile-pressure diagnostics, readable threat shapes that survive reduced motion. Original M3 atlas retained; new simple cue recipes recorded in ASSETS. README has exact install/run/build/check and manual controls. ADR-022–024 record choices.

### Tests and intentional changes

- Baseline was **97/99**, not green: an unfinished `fireEnemy` path put upward shots in the player pool, causing stationary fire to clear the formation and changing the M3 checksum. Removed that path and implemented real separate hostiles. **All 99 earlier unit cases and both M2/M3 golden fixtures pass unchanged.**
- Added **18 real rule cases**: malformed configs, per-type pool limits, capped difficulty, exact warning, owned exit/re-entry/return, launch-time aim/deferred shots, diving scores, hostile saturation/generation/reuse/expiry, simultaneous high-speed player contacts, exact respawn/protection, extra-life boundaries/cap consumption, plain movement/fire stages 1–4, bonus timeout/perfect award once, last-kill safe precedence, late-stage two-minute limits, game-over/reset and render-cadence invariance. No rules mocks or threshold reductions.
- Seed-42 M4 action tape: **10,800 ticks / 180 seconds**, ordinary fire and 80-tick alternating steering, identical full rule snapshots at 30/60/90/120/144 Hz and under cosmetic saturation. SHA-256 `e6fe053f999387e8cac641d942dc6dd6bcea41185146e7ad2974cc527367e002`, rules `m4-waves-1`. The long new replay test allows 30 seconds because coverage instrumentation alone measured over eight seconds; no simulation assertion was loosened.
- Browser behavior intentionally changes from one formation's clear/repeat to cumulative automatic waves and start/pause/restart run. Labels/rules metadata follow M4. Full-clear end-screen assertions move to real staged journeys; unchanged M3 unit fixtures retain exact 48 hits / 4,640 points. The two-minute profile no longer equates shots to all elapsed ticks because death/tally/cleared-bonus suppress fire; exact active cadence/peak seven remain unit-tested and peak seven remains a browser assertion.
- Kept native key/focus/lifecycle, resize/DPR, loading/retry, nested assets, reduced motion, shot/HP pixels, exact paused canvas/score and fresh-reset assertions. Added real controls through stages 1–4 and nonlethal bonus timeout, plus warning/hostile/death/protection/game-over/restart journeys. No production game mutation hooks or cheats.
- Browser development exposed observer races, not a nine-tick cadence defect: an exact pause read preceded Escape's frame; a delayed 50 ms HP tap produced two real shots; delayed steering overshot its column; CDP round trips missed short warning/hostile/protection windows and inflated a no-catch-up sample. Tests now await scene boundaries, use rendered-raster steering and one-RAF native KeyboardEvents for the single HP probe, and use frame-local read-only diagnostic observers with the ordinary Pause/Resume buttons. The original `< paused + 45` no-catch-up bound now measures the first resumed diagnostic, not later CDP latency. Exact one-shot/one-hit/HP-pixel, warning-before-launch and frozen-state assertions remain; real-key held-fire journeys remain. No game state is mutated by these observers.

### Verification from the completion run

- `npm test`: **117 tests / 8 files PASS**. `npm run check`: lint, strict types, coverage, build, 208-package license/origin/notices and size budgets PASS. Coverage: **99.79% statements, 98.80% branches, 100% functions, 99.75% lines** over configured DOM-free core, not the whole app. No coverage floors changed.
- Node **22.22.0**, npm **11.11.0**. `npm audit --audit-level=low`: **zero known vulnerabilities**. No dependency/lockfile, permission, remote service, storage, secret or credential additions. Source review found no eval/HTML injection or gameplay mutation API; configs are project-authored typed values.
- Final-code build: **5 files; 48,628 raw bytes; 17,110 gzip; 14,980 Brotli; 14,561 gzip JavaScript**, compressing files independently; both budgets PASS. No host encoding or release-readiness claim.
- `CI=1 npm run test:e2e`: **40/40 PASS in 4.2 minutes**, two workers, **zero retries, flaky results or skips**, headless Chromium **158.0.8127.18**. Desktop and DPR-3 phone-layout journeys cover real steering/fire through stages 1–4 and the safe bonus timeout into stage 5, warnings/hostiles, death/protected respawn, pause/no drift, three-life game over/restart, exact HP/shot pixels, lifecycle/focus, loading/retry, resize and nested-path assets. Strict console/page-error gates pass. Full report and screenshots remain in ignored `playwright-report/`; runner output is `m4-e2e.log`.
- Rechecked the earlier failed resume case with `CI=1 npm run test:e2e -- --grep 'keyboard journey' --repeat-each=10 --reporter=list --output=test-results/m4-resume-regression`: **20/20 PASS in 28.2 seconds**, no retries. Retained the supplied frame-local observer repair and the original `< paused + 45` bound. This completion run needed **no further production-code or test changes**; both earlier rule goldens and all precise assertions remain intact.
- Actual `npm run dev -- --port 5183` smoke: native Enter/start, steer/fire, Escape/pause, exact paused rule diagnostics, Enter/resume, G/end and fresh restart PASS with a clean console. Inspected screenshots at **1280×900**, **390×844** and **844×390**, plus production warning/protection canvas and bonus-stage screenshots: canvas fits; brackets/chevron and steady protection ring are visible. The FPS diagnostic remains live while paused; simulation ticks, pose, score, timers and pools freeze. The owned dev server and E2E previews were stopped.

### Local stationary-fire profile (not late-stage qualification)

Current full-run `m4-two-minute-profile` attachments, seed 42, Chromium 158.0.8127.18, eight reported logical cores, default effects, no CPU throttling, two shared workers. A brief development smoke shared the host during the desktop run. Both runs reached game over at tick **1,497** (about 25 simulation seconds); most of the two-minute measurement is therefore a **frozen game-over scene**, not sustained combat. No M8 performance sign-off is inferred.

| Local workload | Frames / elapsed | Mean FPS | Frame p95 | Intervals >33.3 ms | Player pool |
| --- | --- | --- | --- | --- | --- |
| Desktop 1280×900, DPR 1 | 7,201 / 120,011.9 ms | 60.002 | 16.80 ms | 0% | peak 7/128; 0 denied |
| Phone-layout emulation 390×844, DPR 3 (backing cap 2) | 7,201 / 120,011.8 ms | 60.002 | 16.70 ms | 0% | peak 7/128; 0 denied |

Both ended with **147 shots, 10 kills, 1,920 points**. Chromium returned a coarse **10,000,000-byte** heap estimate for each; this is not post-GC/leak evidence. Test RAF arrays add overhead. Physical phone/reference laptop, cross-engine replay, Safari/Firefox/WebKit, display/thermal and memory-allocation qualification remain unverified M8/M9 gates.

### Check by hand

Inside this folder: `npm ci`, `npm run dev`, then **http://127.0.0.1:5173/?seed=42**. If occupied, `npm run dev -- --port 5183` and use **http://127.0.0.1:5183/?seed=42**; leave unrelated servers alone.

1. Enter / Start run. Watch the original entries settle. At about six seconds, steady brackets/down-chevron warn an enemy for 0.6 seconds before a dive/ordinary shot. Move away with arrows/A–D. F3 shows stage/divers/launches/hostiles. X/K still only records capture edges.
2. Hold Space/J and sweep the formation, avoiding waiting at walls. HP pips fall; score is awarded once. A normal kill is 100/180/300, diving kill 180/300/500. Last kill clears shots, shows a safe tally for 2.5 seconds, then stage 2 starts carrying score/lives; stage 3 adds Bellframe attacks. No boss exists yet.
3. Stand still without firing to lose a life to a real dive/shot. The craft disappears for 1.5 seconds, then returns at center with nearby hostiles cleared and a steady ring for two seconds. You can steer/fire while protected. Pause mid-death/protection: ticks and timers freeze; resume explicitly. Repeat deaths to **Game over**; Restart run restores stage 1, three lives, zero score/shots and centered/stopped craft.
4. Clear stages 1–3 with ordinary steering/fire. Stage 4 is 20 nonlethal one-hit targets for 20 seconds. Shoot for 150 each and 3,000 extra for all 20, or deliberately miss: no lives lost. The timer persists after a perfect clear. After the tally, stage 5 is another ordinary M4 wave. Extra lives at 20,000/70,000/etc. are visible, capped at five.
5. Resize portrait/landscape; enable OS reduced motion: decoration freezes, but gameplay/warnings/hostile chevrons/protection remain. G/End session abandons without granting kills. Return to menu and restart; fixed seed repeats entries/background. Run `npm run build && npm run preview` at **http://127.0.0.1:4173/**, or choose `--port 4185` if occupied. Full checks: `npm test`, `npm run check`, `npm run test:e2e` (Chromium installation in README).

### Boundaries

M4 only. No nested Certo, parent-project access, push, tag, deployment or publication. M5–M9 remain unstarted. Real reference hardware, Safari/Firefox/WebKit, controller/touch/audio/offline, memory/GC audit and release sign-off remain later evidence gates, not fabricated passes.


## M3 — Enemies and formation

**2026-11-10 · COMPLETE.** Implemented only the authorized M3 checkpoint on the approved M1/M2 foundation. M4–M9 remain unstarted; Certo controls advancement.

### Delivered

- Small DOM-free abstract `Enemy` base and original Shardlet/Spindle/Bellframe subclasses: 1/2/3 HP, conservative 12/14/16-unit circles, 100/180/300 points. Preallocated 48 typed objects (16 per type), stable per-run IDs, generation-safe releases, and eight of each in the authored formation.
- Independent 24-slot ownership with reserved/occupied/destroyed states; no accidental reuse after a kill or through a stale handle. Six columns/four rows, fixed quantized lookup sway, two authored 120-tick cubic entry tables, six-tick launch staggering and root-seeded entry choices. Spawn poses synchronize; entry endpoints meet the current swaying slot. No browser time or presentation RNG in rules.
- Layer-filtered relative-motion circle sweeps, swept-bound uniform grid, 48 candidates per cell, deduplication and a 6,144-contact fixed buffer. Stable impact-time → bullet-ID → enemy-ID ordering, non-piercing shots, generation/liveness guards, single death/score per ID, and fall-through to the next valid target if an earlier shot already destroyed the nearest one. Expiry follows collision resolution, before the new volley.
- Cached original split diamonds, rotating three-prong Spindles and hollow/core Bellframe arches in a 448×192 atlas. Damaged variants and filled/missing HP pips make damage visible without color alone. Bounded hit/destroy events feed 512 reusable radial fragment slots; overflow is counted, never gameplay-affecting. Reduced motion hides fragments/freezes decorative rotation/parallax, not entry/sway/hits.
- External score/kill/shot HUD and read-only enemy/hit/damage/effect-pressure diagnostics. All 24 cleared means **48 hits / 4,640 points**. Pause/clear controls remain above the expanded optional debug panel on portrait layouts. Existing shots/effects drain, then a semantic **Repeat formation** button resets a fresh attempt through the existing gameover scene. G remains an explicit early session exit. No automatic waves, dives, hostile shots, lives, stage rules, audio, power-ups, capture, storage or new input devices.
- `FormationSession` composes the existing range; M2 movement, shot interval, atomic volley handling, pool reuse and golden fixture remain. Scene status is owned by the scene UI instead of being overwritten with M2 text by the startup shell. Updated PLAN, README, decisions ADR-019–021 and original asset records.

### Tests and intentional changes

- Added **19 real unit cases** to the original **80 unchanged** cases: cubic samples/endpoints/quantization, fixed sway bounds/period, collision tangency/overlap/miss/relative crossing, slot ownership/stale damage, all three HP/score values, entire 128×48 contact saturation and deterministic order, high-speed offscreen sweep, event/particle pressure, repeat reset and composed two-minute firing.
- Seed-42 M3 action tape: **2,400 ticks**, ordinary steering/fire, 24 kills / 4,640 points, identical state at 30/60/90/120/144 Hz and under forced cosmetic pool pressure. SHA-256 `817e80140a97c739f613e428e7efe119c6b8f156dc5b7d017ee8cbaca4bfe7b8`, rules `m3-formation-1`. Allocator generations are deliberately excluded from rule snapshots, as in M2. The original `m2-range-1` range action-tape checksum remains unchanged and passes independently.
- Existing E2E assertions changed **only where M3 deliberately changes behavior**: labels/rules version, initial gameplay entity count now **25** (ship + 24 reserved targets), and reduced-motion full-canvas equality no longer applies to moving gameplay enemies. Exact seed/frozen-decoration equality now samples an enemy-free lower-field region **and still asserts the full scene changes**; exact full-canvas paused equality remains. All earlier bounds/cooldown/reset/drain/lifecycle/console assertions are retained; no test threshold or peak-seven assertion was relaxed.
- New production-browser journey verifies all three rendered silhouettes, a single ordinary nonlethal shot (one missing HP pip, no kill/score), paused HP/score/canvas, then ordinary key sweeps/fire to exactly 48 hits / 24 kills / 4,640 points, stable score at clear and exact repeat reset. Runs in both viewport projects without rules mocks, production fixtures or cheats.
- Development checks exposed and fixed two real integration defects: shell overwrote the M3 ready status; deferred offscreen expiry spawned the next volley too early and briefly allowed eight active shots. A new composed 7,200-tick test now enforces **800 shots / peak seven / zero denied volleys**, retaining the original pool invariant. Sweeps must finish before recycling, but recycling must finish before spawning.
- Test synchronization corrections, not weakened behavior: continuous firing could kill a partially damaged enemy between 250 ms diagnostic samples, so the HP journey now takes one shot and aims through actual ship pixels. Scene-driven toolbar resizing could change Canvas backing resolution between seeded raster snapshots; readback now waits for the actual fitted backing dimensions. The complete clear journey passed **twice per viewport** and seed-restart equality **five times per viewport** during focused verification, with retries disabled.

### Verification from this run

- Baseline before edits: **80/80 unit tests PASS**. Clean `npm ci --no-fund` on Node **22.22.0**, npm **11.11.0**, darwin/arm64: PASS, zero reported vulnerabilities. After the locked install, `npm test`: **99 tests / 7 files PASS**. Final `npm run check`: zero-warning lint, strict typecheck, full coverage, production build, 208-package locked license/origin/notices and size budgets all PASS.
- Coverage of the current engine/game/math/input/viewport/starfield: **99.83% statements, 98.71% branches, 100% functions, 99.81% lines**. This is not whole-application coverage. The unreachable authored-capacity assertion and defensive branches remain visible; no blanket exclusions or lowered thresholds.
- Final `npm run test:e2e`: **36/36 PASS**, **zero flaky/skipped/unexpected cases**, Chromium **158.0.8127.18**, desktop and DPR-3 phone emulation, ~3 minutes. Both 120-second soaks, all earlier journeys and real-input HP/clear/repeat pass on the final menu-stacking build. No console warnings/errors or uncaught exceptions. Named M3 screenshot/profile attachments are in the ignored HTML report; desktop/portrait silhouettes, HP feedback and clear controls were visually inspected.
- Actual Vite dev-server scripted smoke on **5183**: seed-42 menu/play, movement/fire, exact paused-canvas equality, explicit resume, end/restart and fitted **1280×900**, **390×844**, **844×390** layouts with a clean console PASS. Clean gameplay screenshots were visually reviewed. The owned server was stopped and temporary smoke script removed. Responsive letterboxing is verified, not touch-control/physical-phone parity.
- Final build: **5 files; 36,156 bytes raw; 13,501 gzip; 11,736 Brotli; JavaScript 10,963 gzip**, each file compressed independently. Both 120 KiB JS / 250 KiB total gzip budgets PASS; no host transfer-encoding claim. `npm audit --audit-level=low`: **0 known vulnerabilities**. No dependency/lockfile, registry, permission, external runtime request or secret-bearing file was added.
- Documentation links/fences/whitespace, approval/ledger scope and project-only file review PASS. Source review found no simulation `Math.random`, unsafe HTML/eval, persistence, external API or mutable window-owned game/debug controls. Existing license/notices remain valid; original enemy/effect recipes entered ASSETS. No Git diff/commit claim is made in this non-Git snapshot.

### Local formation profile (not M8 hardware sign-off)

Final build; Apple **M1**, **8 cores / 16 GiB**, Darwin **25.6.0 arm64**, headless Chromium **158.0.8127.18**. Default effects, no injected CPU throttling, seed 42, stationary held Space. Each begins with 24 entry targets; this input destroys nine and leaves 15 swaying targets (score 1,660), so the workload includes real hits but **not hostile attacks or later-stage caps**. Two automation workers share the host. Test-only RAF/readback work adds observer overhead; physical display refresh/thermal state are unqualified.

| Local workload | Frames / elapsed | Mean FPS | Frame p95 | Intervals >33.3 ms | Pools |
| --- | --- | --- | --- | --- | --- |
| Desktop 1280×900, DPR 1 | 7,200 / 120,011.8 ms | 59.994 | 16.70 ms | 0% | bullets peak 7/128; 0 denied; 0 event/particle drops |
| Phone-layout emulation 390×844, DPR 3 (backing cap 2) | 7,200 / 120,011.8 ms | 59.994 | 16.70 ms | 0% | bullets peak 7/128; 0 denied; 0 event/particle drops |

Both Chromium heap estimates were a coarse **10,000,000 bytes**; this is **not** a post-GC leak/allocation audit. Ten-minute late-stage/boss work, 15-minute stage/restart soak, reference i5 laptop, real phones/controllers and Safari/Firefox/WebKit parity remain unverified M8 gates. No release-readiness claim is inferred from these profiles.

### Check by hand

Inside this project: `npm ci`, `npm run dev`, open **http://127.0.0.1:5173/?seed=42**. If occupied, use `npm run dev -- --port 5183` and **http://127.0.0.1:5183/?seed=42**; leave other servers alone.

1. Enter / Start formation. Watch staggered left/right curves settle into 6×4 slots in about 4.3 seconds. Identify split diamond, three prongs and hollow arch/core; the menu lists their HP/points. Targets sway but do not dive or shoot.
2. Steer with arrows/A–D, hold Space/J, and sweep across columns. Pips fall on hits; Spindles need two, Bellframes three. Score changes only on destruction (100/180/300), including during entry. Try a brief shot against a Spindle to see a persistent missing pip before destroying it.
3. F3 shows hits, damaged targets, kills, score, shot/enemy/effect capacity. No shot can hit two enemies; dense entries and crossing paths still register. Sweep until **Formation cleared**: 48 hits, 24 kills, score **4,640**, no remaining enemies. Remaining shots/fragments drain before this screen.
4. Enter / Repeat formation: score/hits/kills/shots/effects reset to zero; ship is centered/stopped; all 24 slots reserve fresh targets, with the same seed-42 entry/background layout. There is no next stage. G / End session early, restart and return-to-menu still work.
5. Pause with Escape/P or the button mid-entry and mid-fire; ticks, HP, score, bullets and fragments freeze. Blur/switch tabs, return and explicitly resume; held actions are cleared and no time catches up. Check each movement bound and fire for two minutes without a clear; occupancy never exceeds seven in ordinary single-shot play.
6. Resize portrait/landscape, enable OS reduced motion: decoration freezes/fragments hide, but all gameplay remains. Build/preview with `npm run build && npm run preview` at **http://127.0.0.1:4173/**. Reproduce checks with `npm test`, `npm run check`, `npm run test:e2e` (Chromium installation commands in README).

### Boundaries

M3 only. No nested Certo process, parent-workspace access, push, commit, tag, publication or deployment. This isolated snapshot has no Git repository. Browser emulation and local headless frame sampling are regression evidence, **not** real phone/reference laptop, Safari/Firefox/WebKit replay parity, thermal/GC or M8/M9 release qualification. Hosted CI remains unverified.

## M2 — Player and shooting

**2026-11-10 · COMPLETE.** Implemented only the authorized M2 firing range on the approved M1 foundation. M3–M9 remain unstarted; Certo controls advancement.

### Delivered

- DOM-free fixed-tick Needle movement: 1,600 units/s² acceleration/deceleration toward 250 units/s, smooth reversal, hit-radius horizontal bounds (8–352), fixed y=580, and quantized 1/1024 positions/velocities. Gameplay stays independent of render cadence.
- Immediate held-fire response followed by one shot every nine ticks at 540 units/s. Preallocated 128-slot player-bullet pool, atomic whole-volley capacity checks, observable denials/peak occupancy, stable slot iteration, fresh per-run IDs, generation-safe releases, offscreen expiry, synchronized spawn poses and storage reuse on restart. A denied volley consumes no cooldown or shot count.
- Original Needle/shot/star atlas baked once at boot; interpolated blits replace the autonomous M1 probe. Seeded 72-star, three-layer scrolling/player-relative parallax uses an independent salted visual stream; reduced motion freezes decoration, never ship/shot gameplay. Updated ASSETS; no imported assets or dependencies.
- Resettable range menu/pause/end/restart, visible shot/active count, real ship+bullet entity diagnostics, x/velocity, cooldown, pool peak/blocked volleys. Preserved aliases, capture-edge diagnostics, native button/editable behavior, resize/DPR/letterboxing, loader/retry, teardown and explicit resume after focus/page lifecycle suspension. G / End session remains clearly labeled range-session navigation, not a combat cheat.
- Recorded tuning/pool/presentation/evidence choices in ADR-017–018; updated README and repository memory. No enemy, collision, score, lives, power-up, audio, storage, touch/gamepad or offline feature was started.

### Tests and intentional changes

- Preserved all 64 earlier unit cases unchanged; added 13 real player/pool/range cases and three starfield cases. Expanded coverage scope to all current game rules and DOM-free starfield math without weakening thresholds or excluding uncovered rule modules.
- Replay fixture: seed 42, 600 ticks, 54 shots, no denials; identical state for a tick-indexed action tape at 30/60/90/120/144 Hz. SHA-256 of the explicit snapshot is `59e4f81639a13ae7cb9bcae5d53066acf272d764ef09574caac7849fd7ea9b58` for `m2-range-1`. This is local rules regression evidence, not user-facing replay or cross-browser parity.
- Existing browser assertions changed **only because behavior intentionally changed**: M1 testbed labels → range labels; rules metadata → `m2-range-1`; autonomous-probe pixel motion → key-driven Needle motion at its real y=580. Added idle parallax animation and retained exact paused-canvas equality. Reduced-motion idle equality, every earlier lifecycle/input/layout assertion and the strict console gate remain.
- Extended Canvas-denial cases from grid/renderer to grid/atlas/renderer (one denied native API call, then real retry). Added actual shot pixels, both wall clamps, pool drain, exact restart state and seeded layout repetition/difference. Two-minute held-fire journeys run in both viewport projects; no simulation mocks or production test hooks.
- Corrected a new unit-soak expectation during development: muzzle y=560 to expiry below −3 at 9 units/tick gives 63 movement ticks, hence **seven**, not eight, simultaneous shots with a nine-tick interval. Also synchronized new browser snapshots with the existing 250 ms diagnostic refresh and awaited each scene boundary for rapid G/Enter/Escape sequences. Exact pause/reset assertions were not relaxed.

### Verification from this run

- Unchanged baseline: **64 unit / 26 browser cases PASS**. Clean `npm ci` on Node **22.22.0**, npm **11.11.0**: PASS. `npm test`: **80 tests / 6 files PASS**. `npm run check`: zero-warning lint, strict typecheck, full coverage, build, 208-package license/origin/notices and size budgets PASS.
- Coverage over current engine/game/math/input/viewport/starfield: **100% statements/lines/functions, 98.86% branches**; not whole-application coverage. One defensive sparse-array velocity fallback is not exercised. No existing test threshold was lowered.
- `npm run test:e2e`: **34/34 Chromium cases PASS** across desktop and DPR-3 phone emulation, including real input/render/pause/reset/drain and two full 120-second firing profiles. Browser version **158.0.8127.18**; no console warnings/errors or uncaught exceptions. Desktop/portrait screenshots reviewed; landscape/tiny resize remains automated.
- 7,200-tick unit soak: **800 shots**, peak seven bullets, zero denials; all 128 slot objects retain identity. This checks entity-storage reuse, not a complete allocation/GC profile.
- After a fresh locked install, reran `npm test`, the full `npm run check` and all **34** browser cases (including both 120-second soaks): PASS. Actual Vite dev-server smoke on **5183** verified seed-42 movement/fire/pause/resume/end/reset and fitted **1280×900**, **390×844**, **844×390** layouts with a clean console; screenshots inspected. The owned server was stopped afterward; no persistent smoke script was created.
- Build: **5 files; 24,428 bytes raw; 9,625 gzip; 8,299 Brotli; JS 7,093 gzip**, compressing each file independently. Both budgets PASS; no host encoding claim. `npm audit --audit-level=low`: **0 known vulnerabilities**. No runtime dependencies, permissions, external requests, secret-bearing files or debug-control interface added.

### Initial firing-range profile

Initial full browser run: Apple **M1**, 8 cores, **16 GiB** RAM, Darwin **25.6.0 arm64**; headless Chromium **158.0.8127.18**, default effects, no CPU throttling, seed 42, held Space, 72 stars and one ship. Two workers share the host; test RAF sampling arrays add measurement overhead. Physical display refresh and thermal state are not qualified.

| Local workload | Frames / elapsed | Mean FPS | Frame p95 | Intervals >33.3 ms | Pool |
| --- | --- | --- | --- | --- | --- |
| Desktop 1280×900, DPR 1 | 7,200 / 120,011.8 ms | 59.994 | 16.70 ms | 0.0139% | peak 7/128; 0 denied |
| Phone-layout emulation 390×844, DPR 3 (backing cap 2) | 7,201 / 120,011.8 ms | 60.002 | 16.70 ms | 0% | peak 7/128; 0 denied |

Named `m2-two-minute-profile` attachments live in the ignored Playwright HTML report. Chromium returned a coarse 10,000,000-byte heap estimate in both; this is **not** a post-GC leak or allocation audit. This baseline is not combat, a physical phone or reference i5 laptop qualification. Actual phone/controller/Safari/Firefox/WebKit, ten-minute late-stage work, 15-minute stage/restart soak, thermal and GC evidence remain unverified M8 gates.

### Check by hand

From this project folder: `npm ci`, then `npm run dev` and open **http://127.0.0.1:5173/?seed=42**. If occupied, `npm run dev -- --port 5183` and use **http://127.0.0.1:5183/?seed=42**; do not stop another project's server.

1. Enter / Start range. Hold Left/A to x=8 and Right/D to x=352; release to see smooth deceleration, reverse, and confirm no vertical travel or wrap. F3 shows x/velocity and actual entities.
2. Hold Space/J for **two minutes**. Shots form a steady nine-tick stream; the active pool settles at seven, peak seven, blocked volleys zero. Release: shots drain in about a second. The count is range activity, not a score.
3. Pause with Escape/P or the button while steering/firing. The canvas, ticks, shots and cooldown freeze. Blur/change tab too; explicit Enter/Resume range is required, held actions are cleared and no pause time catches up.
4. G / End session; wait for Range complete. Enter / Restart range: ship centered/stopped, bullets/shots/cooldown reset, seed-42 background repeats. Return to menu also works from pause/end. X/K remains diagnostics only.
5. Resize/rotate; enable OS reduced motion. Decorative stars freeze while steering/shooting still works. `npm run build && npm run preview`, then **http://127.0.0.1:4173/**. Reproduce automated checks with `npm test`, `npm run check`, `npm run test:e2e` (Chromium installed as in README).

### Boundaries

M2 ends at the firing range. Real phone/reference-hardware evidence is unavailable, not fabricated or marked passed; M8/M9 readiness remains open. CI hosted execution is unverified. No nested Certo process, parent-workspace access, Git commit, push, tag, publication or deployment was performed.


## M1 — Foundations and engine core

**2026-11-10 · COMPLETE.** Explicit plan approval received in the M1 task; PLAN.md is now APPROVED. This handoff finishes M0-B/M1 only. M2–M9 are not started.

### Delivered

- Audited and preserved the existing engine instead of replacing it: exact 60 Hz updates, 250 ms frame clamp, five-update catch-up cap with discarded-time diagnostics, fractional render interpolation, owned boot/menu/play/pause/gameover transitions, and explicit resume after focus/visibility suspension.
- Verified keyboard actions (aliases, held fire, edge-triggered capture/pause/confirm/debug), per-tick sampling, listener/RAF/resize/UI teardown, sequential resource preparation with cancellation and failure/retry, 360 × 640 letterboxing with DPR capped at 2, cached grid/probe rendering, reduced motion, and semantic controls. Debug shows FPS, zero entities, ticks/alpha/dropped time, seed/rules and normalized inputs.
- Completed the missing project-local, path-filtered, SHA-pinned read-only CI configuration; reconciled stale README/PLAN approval and evidence records; recorded installed-toolchain, CI-boundary, and testbed choices in ADR-014–016. Registered original diagnostic art in ASSETS.md.
- Added four focused unit cases: jittered frame delivery with time/alpha invariants, async loader sequencing, cancellation while awaiting an asset, and a capture tap entirely between simulation samples. Added a real-browser pixel case for moving probe/frozen pause in both viewport projects.
- **Existing behavioral test assertions were not changed or weakened.** The filesystem test helper now creates/removes fixtures under ignored project-local test-results/ rather than the system temp directory, to respect the project-only boundary. Pixel polling uses its own readback canvas; the strict console-warning gate remains intact. Runtime game behavior is unchanged because the pre-existing core already passed its M1 tests.

### Verification from this run

- Baseline before changes: **60 unit tests / 24 Chromium browser cases PASS**.
- Clean `npm ci`: PASS on Node **22.22.0**, npm **11.11.0**, darwin/arm64. Then `npm run check`: lint (zero warnings), strict typecheck, full coverage, production build, 208-package locked license/origin/notices check, and size budgets **PASS**.
- `npm test`: **64 tests / 4 files PASS**. Current engine/math/input/viewport coverage: **100% statements, branches, functions, and lines**; this is not whole-application coverage.
- `npm run test:e2e`: **26/26 PASS** on Playwright Chromium **158.0.8127.18**, desktop and DPR-3 touch emulation. Real production-preview journeys cover states/input, retry/fallback, pause/no tick drift, reduced motion, resize, nested paths, teardown, rendered probe movement/pause, and 120-interval local frame-cadence sampling. No console warnings/errors or uncaught exceptions.
- Actual Vite dev-server browser smoke on **5183**: menu boot, seed 42, start/debug/pause/resume/gameover controls and clean console PASS. Screenshots at **1280 × 900**, **390 × 844**, **844 × 390** inspected: canvas remains correctly fitted. Owned dev/preview ports **5183/4183/4184** confirmed released; temporary smoke script removed.
- Build: **5 files; 20,049 raw bytes; 8,133 gzip; 6,949 Brotli; 5,728 gzip JS** (each file compressed independently). Both 120 KiB JS / 250 KiB total gzip budgets pass. No host transfer-encoding claim.
- `npm audit --audit-level=low`: **0 known vulnerabilities**. Workflow YAML parses; official action tag→commit pins and Node 24 runtimes checked through GitHub's API. No remote CI run, push, publish, deploy, or tag.

### Check by hand

From this project folder: `npm ci`, then `npm run dev` and open **http://127.0.0.1:5173/?seed=42** (or `npm run dev -- --port 5183` with the matching URL if occupied).

1. Confirm the grid/menu; press Enter to start and F3 to show diagnostics. The probe moves on its own; there is no player or combat.
2. Hold A/Left and Space/J; check move/fire. Tap X/K; capture presses increases once per press, not while held. Opposing directions cancel.
3. Press Escape/P; ticks freeze. Wait, then explicitly resume with Enter. Blur/switch tabs and return: still paused, no catch-up. End with G, restart with Enter, or return to menu.
4. Resize/rotate: no stretched field. Toggle OS reduced motion: probe centered, ticks still advance. Native buttons remain keyboard-operable.
5. `npm run build && npm run preview`; open **http://127.0.0.1:4173/**. Run `npm run check`, `npm test`, and `npm run test:e2e` for automated reproduction (install Chromium with `npx playwright install chromium` if needed).

### Boundaries

The CI file is inside this project and is discoverable when this directory is the Git repository root; it was not installed in the parent workspace, which is out of scope. Hosted execution is unverified. This snapshot has no Git repository, so no local commit was possible. No real phone/controller/Safari/Firefox/WebKit, combat FPS, full replay, audio, persistence, offline, or production-release claim is made; those remain the planned later checkpoints.

## M0-B — Approved foundations

**2026-11-10 · COMPLETE as part of the authorized M1 catch-up.** Retained the existing strict TypeScript/Vite/npm setup, lockfile, initial viewport/resource tests, loading/error/retry shell, responsive canvas, original-asset/license registers, dependency policy and budget scripts. Added the missing CI configuration within the project boundary. The M1 grid/testbed extends the earlier blank canvas; no earlier functionality was removed. Clean install/build/preview/browser verification and manual reproduction commands are recorded in M1 above. This foundation is not combat gameplay.


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

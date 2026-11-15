# Changelog

## Milestone 1: Worlds as data, and their physics

What changed:

- Project set up with TypeScript, Vite, Vitest and ESLint, with the scripts
  `dev`, `build`, `test`, `typecheck` and `lint`.
- Level format and validation. `validateLevel` returns plain-language errors
  (an empty list means valid) for missing fields, out-of-range numbers and
  unknown star classes.
- `loadLevel` reads a level by id, by file name in `levels/`, or by URL.
  `levels/index.json` lists the worlds.
- Physics in `src/engine/`: `mulberry32`, surface gravity, escape velocity,
  equilibrium and surface temperature, habitable zone, oxygen partial pressure
  and breathability.
- Three worlds: `verdant-g`, `ember-m` and `boulder-k`.
- The page shows each world's facts (gravity, escape velocity, temperature,
  habitable zone, air), or the validation errors of an invalid level.

How to check by hand:

1. `npm ci`, then `npm run dev`, and open http://localhost:5173/.
   The page shows Verdant: gravity 9.81 m/s², surface temperature about
   287.8 K, in the habitable zone, breathable air.
2. Open `?level=ember-m`: a red dwarf world at 0.15 AU, with a surface temperature
   about 310.8 K, outside the habitable zone, and too thin air.
3. Open `?level=boulder-k`: gravity 21.80 m/s², habitable zone, breathable air.
4. Open `?level=nope`: the page shows an error instead of a world.
5. Open `?level=./tests/fixtures/bad-level.json` (dev server): the page lists the
   validation errors (unknown star class, mass out of range).
6. `npm test` passes; `npm run typecheck` and `npm run lint` report no errors.
7. `npm run build` produces `dist/` with `dist/levels/` copied from `levels/`.

## Milestone 2: Terrain and walking

What changed:

- First-person walking on generated terrain. Mouse look uses pointer lock;
  W A S D (or the arrow keys) walk, Space jumps, Shift runs, Esc releases the
  mouse.
- `terrainHeight(x, z, seed)` builds the ground from three octaves of
  simplex-noise seeded by `mulberry32(seed)`: broad hills, hummocks, detail.
  The same seed always gives the same land; a different seed gives a different
  one.
- The ground is built in 64 m chunks around the player. Chunks ahead are built
  nearest first, a few per frame, and chunks left far behind are dropped.
- `jumpHeight(gravity)` gives the jump height for a 3.13 m/s take-off. Heavy
  worlds give low jumps: about 0.50 m on Verdant, 0.22 m on Boulder.
- Walking refuses slopes steeper than 45° (the player slides along a wall
  instead), follows downhill ground, and falls under the planet's gravity.
- Low-poly, flat-shaded ground in three colours: lowland, highland, and rock on
  slopes of 30° or more. Fog hides the edge of the loaded area.
- The page keeps the milestone 1 facts as a panel, with a **Start exploring**
  button that starts the game.
- New runtime dependencies: `three` and `simplex-noise`. `@types/three` for the
  types. Listed in `THIRD_PARTY_NOTICES.md`; decisions in `DECISIONS.md`.

How to check by hand:

1. `npm ci`, then `npm run dev`, and open http://localhost:5173/?level=verdant-g.
   The panel shows the Verdant facts and a **Start exploring** button, and the
   terrain shows behind it.
2. Click **Start exploring**. The panel hides and a crosshair appears. Move the
   mouse to look around. Hold W: the ground ahead keeps appearing and the
   scene moves. Hold Shift with W to run faster. Press A and D to strafe.
3. Press Space: the player jumps. Press Esc: the mouse is released and the
   panel comes back; **Continue exploring** resumes.
4. Open `?level=boulder-k`, click **Start exploring**, and press Space: the
   jump is visibly lower and heavier than on Verdant (about 0.22 m against
   0.50 m).
5. Edit the `seed` in `levels/verdant-g.json` (for example to 7), reload the
   page, and see different land. Put it back to 42 to see the original.
6. Walk up a steep slope (the rock-coloured ground): above 45° the player
   stops or slides along the slope instead of climbing it.
7. `npm test` passes all tests, including the worked examples for
   `jumpHeight` and `terrainHeight`; `npm run typecheck` and `npm run lint`
   report no errors; `npm run build` completes with no warnings.

## Milestone 3: An alien sky

What changed:

- The sky follows the star. `starElevation(timeHours, dayLengthHours)` gives the
  star's height, `asin(sin(2πt / day))`. The star rises ahead, peaks overhead at
  a quarter of the day and sets behind.
- `blackbodyColor(kelvin)` gives the star's colour (Tanner Helland's
  approximation). `skyColor(kelvin)` gives the sky's colour: the star's light
  weighted by Rayleigh scattering, so blue scatters most.
- A day has dawn, day, dusk and night. The light, the sky colour and the fog
  follow the star. Daylight ramps across the 8° either side of the horizon.
- Stars appear at night. `visibleStarFraction(pressureAtm)` says how many show:
  all at vacuum, none at 3 atm and above.
- The fog density grows with the atmosphere's pressure.
- Zero, one or two moons, from the seed, cross the sky on their own periods.
  Verdant (seed 42) has none, Ember (seed 7) has one, Boulder (seed 1234) has one.
- The clock in the top right shows the phase, the star's height and the hour
  since sunrise. `?hour=` starts the game at another hour.
- Engine: `src/engine/color.ts`, `sky.ts`, `stars.ts`, `moons.ts`, `math.ts`.
  Render: `src/render/sky.ts` (dome, sun, stars, moons, fog, lights).
- No new dependencies.

How to check by hand:

1. `npm ci`, then `npm run dev`, and open http://localhost:5173/?level=verdant-g&hour=2.
   The clock reads `day · star 30° · hour 2.0 of 24`, and the sun is a pale disc
   in the upper part of the view, above the hills.
2. Open `?level=verdant-g&hour=9`: the clock reads `day · star 45°`, the sky is
   blue, and the sun is above the top of the view. Click **Start exploring** and
   look up to find it. Open `?level=verdant-g&hour=6`: the clock reads `star 90°`
   and the sun is overhead, above the top of the view.
3. Open `?level=verdant-g&hour=22`: night. The clock reads `night · star -30°`,
   the sky is dark, stars show, and the ground is dim but readable under moonlight
   (the ambient light).
4. Open `?level=ember-m&hour=18`: a red dwarf, so the light is warm. A pale moon
   is in the sky, above the ridge ahead. Open `?level=verdant-g`: there is no moon.
5. Thick air hides stars: in `levels/verdant-g.json`, set `pressureAtm` to `2.5`,
   reload `?level=verdant-g&hour=22`. About one star in six shows (at 3 atm and
   above, none), and the fog is denser than before. Set it back to `1.0`.
6. Time moves: at the default start, watch the clock for a few seconds. The hour
   advances about one hour every 10 seconds.
7. `npm test` passes all tests, including the worked examples for
   `blackbodyColor`, `skyColor`, `starElevation` and `visibleStarFraction`.
   `npm run typecheck` and `npm run lint` report no errors, and `npm run build`
   completes with no warnings.

## Milestone 4: Plants and animals

- Generated three plant and two harmless grazing animal species per world, with
  seeded names, descriptions and low-poly parts. Plant colour follows the star;
  animal size and proportions follow surface gravity.
- Plants favour gentle, lower, temperate ground, with higher density in moist
  lowlands. Herds graze, wander and flee from running or very close explorers.
- Right-click an aimed plant or animal to identify it; Tab opens the survey log,
  which records each species once for the current page session.
- Life streams with terrain chunks. Its rendered bases and scan points follow
  the terrain's actual triangles. No dependencies were added.

How to check by hand:

1. Run `npm ci` and `npm run dev`, then open
   http://localhost:5173/?level=verdant-g. Click **Start exploring** and look
   around for green stalks, caps, rosettes and grazing herds.
2. Aim the crosshair at a nearby plant or animal until the scan hint appears,
   then right-click. Press Tab to see its name and description. Scan the same
   species again: the log still has one entry. Tab closes the log.
3. Approach a herd at a run with Shift+W and observe it flee. Stand back and
   watch animals graze and wander.
4. Open http://localhost:5173/?level=ember-m to see dark violet plants under a
   red dwarf; open http://localhost:5173/?level=boulder-k to see rust-red plants
   and stockier animals on a heavier world.
5. Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.

## Milestone 5: Survival and danger

What changed:

- Oxygen. The suit's tank (0 to 100%) drains 0.1% per second when resting or
  walking and 0.3% per second when running, but only in air that is not
  breathable (Ember). Breathable worlds (Verdant, Boulder) need no oxygen. The
  lander refills the tank at 25% per second. An empty tank costs 2 health per
  second.
- Temperature. Outside 0 °C to 40 °C (273.15 K to 313.15 K), health falls 0.1
  per second for each kelvin beyond that band. The lander shelters the player.
- Health starts at 100. The lander restores 4 per second. At zero health the
  player wakes at the lander with full health and oxygen, and the survey log is
  kept.
- Predators: two species per world, larger and darker than the grazers. Each
  predator's den has a 16 m territory marked on the ground by bones and claw
  scratches. A player who enters is warned by a call and a raised head. A player
  who stays for 4 s is charged and struck for 20 health every 1.5 s within 2 m.
  Leaving the territory ends the chase.
- The sampler, on the left mouse button, stuns the aimed animal or predator for
  5 s, then recharges for 8 s. A stun never harms the creature.
- The HUD, bottom left: health, oxygen, the outside temperature with its verdict,
  and the sampler's recharge.
- Engine: `survival.ts`, `sampler.ts`, `predators.ts`, `lander.ts`, and `gait.ts`
  (the slope-limited step, now shared by herds and predators). Render: the
  predators and their territory marks in `life.ts` and `lifeMeshes.ts`, and the
  landed craft in `lander.ts`. Page: `hud.ts`, `sound.ts` and `dom.ts`.
- No new dependencies. The warning call uses the browser's Web Audio API.

How to check by hand:

1. `npm ci`, then `npm run dev`, and open http://localhost:5173/?level=ember-m.
   Click **Start exploring**. The HUD shows Health 100 of 100, Oxygen 100%, a
   temperature of about 310.7 K · sheltered, and Sampler ready. You start at the
   lander.
2. Walk out of the lander's 6 m circle: Oxygen falls about 0.1% per second.
   Hold Shift to run: it falls three times as fast. Walk back into the circle:
   Oxygen refills at 25% per second and Health recovers.
3. Open http://localhost:5173/?level=verdant-g: the Oxygen line reads
   **breathable air** and never falls.
4. Open http://localhost:5173/?level=boulder-k: the temperature is 319.0 K ·
   too hot outside the lander, and Health falls about 0.6 per second there.
5. Look for ground marked with bones and claw scratches: a predator's territory.
   Walk within 16 m of its den. A low call sounds, the hint says it warns you,
   and it raises its head. Stand still for more than 4 s: it charges, and each
   strike costs 20 health. Walk out of its territory to end the chase.
6. Aim at a predator: the hint reads "Right-click to scan animal, left-click to
   stun". Left-click: "Stunned … for 5 s", and it stops moving. The Sampler line
   reads "recharging, 8 of 8 s" and then "ready". A shot during the recharge says
   "Sampler recharging".
7. Let predators bring Health to zero: the page says "You woke at the lander",
   with Health and Oxygen full. The Tab survey log still lists the species.
8. `npm test` passes all tests, including the oxygen drain, the temperature
   limit, the territory check and the stun cooldown. `npm run typecheck`,
   `npm run lint` and `npm run build` report no errors.

## Milestone 6: Objectives, worlds from anywhere, assets

What changed:

- Objectives. A world's `objectives` drive the game: `scan-species` (log a count
  of species, 1 to 7), `reach-landmark` (walk to a named landmark) and
  `return-to-lander` (go more than 60 m away, then come back). Each objective is
  listed in the briefing and, during play, in a panel at the top left with a tick
  when it is done.
- Landmarks. Each `reach-landmark` objective places a generated rock feature (a
  spire, an arch or a pillar) 120 to 300 m from the lander, from the level's seed.
  Walking within 12 m reaches it.
- Survey report. When every objective is done, the report opens: the planet's
  facts, the objectives and the species logged. R opens and closes it.
- Progress is saved per world in the browser's `localStorage`: the species
  logged, the landmarks reached and the return. The survey log now survives a
  reload.
- Title screen. With no `?level=`, the page lists the worlds from
  `levels/index.json`, with each world's progress, and has a field for a level
  URL or file name.
- Assets. A level's optional `assets` can give the lander (`lander`) or named
  plants, animals and predators (`species`) a glTF model, a texture, or both, by
  path (relative to the level file) or URL. If a requested asset cannot be loaded,
  the generated version is used and the briefing and objectives panel say so.
- Level validation covers objectives and assets: unknown kinds, out-of-range
  counts, missing names, unknown asset names and empty assets are reported by path.
- `LEVELS.md`: the level format, every field and its range, the objective kinds,
  the assets, the star classes, and how to publish a world at a URL (including
  the CORS header that a cross-origin host needs).
- Engine: `objectives.ts`, `progress.ts`, `landmarks.ts`, `assets.ts`, `report.ts`.
  Render: `landmarks.ts`, `assets.ts`, with optional models in `lander.ts` and
  `life.ts`. Page: `pages.ts`, `objectivesHud.ts`, `progressStore.ts`. No new
  runtime dependency: the glTF loader is part of Three.js.

How to check by hand:

1. `npm ci`, then `npm run dev`, and open http://localhost:5173/. The title
   screen lists Verdant, Ember and Boulder, each marked "not started". Type
   `verdant-g.json` into the URL field and press Open world: the Verdant
   briefing opens.
2. The Verdant briefing lists "Scan 5 species (0 of 5)" and "Reach the tall
   spire", each with ○. Click **Start exploring**. The objectives panel appears
   at the top left.
3. Right-click five different plants or animals (scan the same one twice: the
   log keeps one entry). The scan objective ticks at five. The survey report
   does not open yet: the spire is still to reach.
4. Find the tall spire, a tall rock feature 120 to 300 m from the lander, and
   walk within 12 m of it: the hint says "You reached the tall spire", that
   objective ticks, and the survey report opens by itself with the planet's facts
   and the species. Press R to close it and R again to open it.
5. Reload the page, then open http://localhost:5173/?level=verdant-g. The
   briefing shows both objectives done and the five species logged, and the
   survey log (Tab) still lists the species.
6. The return objective: no shipped world has one. Copy a world in `levels/`
   (for example to `levels/return-test.json`), add `{ "kind": "return-to-lander" }`
   to its objectives and an entry in `levels/index.json`. Open it, leave the
   lander more than 60 m away, then walk back into its circle: the objective
   ticks. Reload the title screen and the world's row says "returned to the
   lander". Delete the test copy and its index entry afterwards.
7. Open http://localhost:5173/?level=no-such-world: the page says the level cannot
   be loaded, with a link back to the worlds. Open
   http://localhost:5173/?level=/tests/fixtures/bad-level.json: the errors are
   listed by path.
8. Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. The
   test suite loads and validates every world in `levels/index.json`.

## Milestone 7: Feel and speed

- Terrain and life stream over multiple frames using a shared build budget. Distant
  chunks use a coarser mesh and omit life; static life groups and Three.js meshes
  are culled outside the camera view. Pixel ratio is capped at 1.5.
- Procedural Web Audio adds atmosphere-dependent wind, nearby animal calls,
  predator warnings, scanner and sampler sounds, and footsteps. M toggles mute.
  Footsteps and head bob respond to gravity and movement.
- A settings panel on the title and briefing screens saves draw distance, mouse
  sensitivity and volume in `localStorage`. P pauses; Esc also pauses while the
  pointer is released.
- Added tests for settings, sound rules, footing, streaming, detail, culling and
  pause; the frame-time test checks chunk and plant generation against the limit
  recorded in `DECISIONS.md`.

How to check by hand:

1. Run `npm ci`, then `npm run dev` and open http://localhost:5173/. Change the
   three settings; reload and confirm the values remain.
2. Open Verdant, click **Start exploring**, and walk or run. Listen for wind and
   footfalls and watch the head bob. Compare with Boulder for stronger gravity.
3. Press P and wait: the sky clock and survival stop. Press P again to continue.
   Press M to mute and M again to restore sound. Press Esc to pause and change
   settings, then click **Continue exploring**.
4. Walk toward distant terrain and turn around; terrain and life stream in while
   distant chunks are simpler. Right-click life to hear the scanner chirp.
5. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.


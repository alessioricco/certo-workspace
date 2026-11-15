# Decisions

## Stack and dependencies

- **Three.js and simplex-noise are runtime dependencies** from milestone 2.
  Three.js draws the world, simplex-noise makes the terrain. Both are MIT and
  listed in `THIRD_PARTY_NOTICES.md`. Nothing else is added at runtime.
- **`@types/three`** is a dev dependency, pinned to the same version as `three`.
  Three.js 0.187 does not ship TypeScript declarations, so the types come from
  DefinitelyTyped.
- **Vite 6, Vitest 3, ESLint 9** are the lines whose published engines accept
  Node 18, the minimum the README promises. Vite 7 and newer drop Node 18.
- **`globals` and `@types/node`** are needed by ESLint and by the Node-side
  tests and `vite.config.ts`. They are not part of the game.
- **Audit.** `npm audit --omit=dev` reports no vulnerabilities. The full
  `npm audit` reports advisories in development tools (vitest's `tinypool`,
  `minimatch` under ESLint). Their fixes are major-version upgrades that drop
  Node 18, so they are not applied here without a decision on the Node floor.

## Engine

- **Units** follow the README: SI inside the engine, with two exceptions the
  spec fixes: escape velocity is in km/s, and the level file uses Earth units
  and AU.
- **Validation ranges outside the spec.** The spec fixes mass, radius,
  pressure and oxygen. Orbit (0.01 to 100 AU), albedo (0 to 1), day length
  (0.1 to 10000 hours) and seed (0 to 2^32 − 1) are chosen to reject
  nonsense without limiting real worlds.
- **Air verdict.** Breathable is 0.16 to 0.5 atm of oxygen partial pressure,
  as in the spec; below is "too thin", above is "toxic".
- **Level loading is injectable.** `loadLevel` and `loadLevelIndex` take the
  fetch function as a parameter, defaulting to the global `fetch`. This lets
  the tests load real level files from disk without a server, and keeps the
  engine free of DOM and browser APIs.
- **Level sources.** A string is an id listed in `levels/index.json`, a file
  name in `levels/`, or a URL or path starting with `/`, `./` or `../`.

## Terrain

- **Same seed, same world.** `terrainHeight(x, z, seed)` seeds simplex-noise
  with `mulberry32(seed)`, so no `Math.random` is involved. The noise generator
  for the last seed is cached, because building a chunk asks for about 300
  heights in a row.
- **Three octaves** of simplex noise, all with the same generator at different
  offsets: hills with a 220 m wavelength and 26 m amplitude, hummocks at 60 m
  and 7 m, detail at 16 m and 1.2 m. The sum stays within about ±34 m. On the
  seeds tried, about 97% of the ground is under the 45° walking limit, so the
  player can roam without being walled in.
- **Chunks** are 64 m squares of 16 × 16 cells, sampled on a shared grid, so
  neighbouring chunks meet without seams (a test checks the shared edge).
- **Ground classes** decide the colour: rock where the slope is 30° or more,
  highland above 12 m, lowland otherwise. The colours are a placeholder palette;
  per-world palettes are not built yet.

## Chunk streaming

- **Plan, then build.** `planChunks` lists chunks nearest first. Terrain and life
  share a 4 ms per-frame build budget; the first build can exceed the budget so
  loading cannot stall indefinitely. Individual builds are not preemptible.
- **Adjustable load radius 2–6 chunks, default 4; keep margin 2.** Chunks beyond
  the keep radius are dropped; the margin prevents flickering at chunk boundaries.
  Detailed terrain and life extend two chunks from the player; beyond that,
  terrain uses an 8-by-8 grid instead of 16-by-16 and life is omitted. Skirts
  cover transitions. Three.js frustum-culls meshes; static life is additionally
  culled as a chunk group, including custom plant models.
- **Timing check.** After 10 warm-up chunks, the median time to generate detailed
  terrain geometry and generated plant geometry for 15 Verdant chunks must be
  under 4 ms in `tests/render/frameTime.test.ts`. This is a CPU regression check,
  not a guarantee that every frame or custom asset finishes in 4 ms or that every
  device achieves 60 fps.

## Walking and jumping

- **Jump height** is `3.13² / (2 g)`: the take-off speed is fixed, so gravity alone
  changes the jump. A jump is 0.50 m under Earth gravity and about 0.22 m on
  `boulder-k`.
- **Walking speed** is 4 m/s, running 8 m/s, both per second of real time.
  Each frame's time step is capped at 0.1 s, so a stalled tab cannot throw the
  player through the ground.
- **Slope limit.** Walking up a slope steeper than 45° is refused. The move is
  tried along each axis, so the player slides along a wall rather than stopping
  dead. Going downhill is never refused.
- **Following the ground.** The player snaps to the ground when the drop below
  the feet is at most 0.5 m, so walking downhill does not bounce. A larger drop
  or a jump lets gravity act.
- **Eye height** is 1.7 m above the ground.

## Rendering

- **Flat shading from explicit normals.** Each triangle gets its face normal as
  a vertex attribute. Three.js's `flatShading` option instead derives normals
  from screen-space derivatives, and in headless Chrome that left black patches
  where the derivatives were degenerate. The explicit normals render the same
  shape without them.
- **Lighting** is one hemisphere light and one directional sun, aimed along the
  star. Both follow the sky state each frame: the sun's colour is the star's
  blackbody colour, and its strength is the daylight. No shadows.
- **Fog** is exponential, with density set by the atmosphere's pressure (see
  Sky). Its colour is the horizon colour of the sky.
- **The page** keeps the milestone 1 facts as a side panel. Pointer lock starts
  the game and hides the panel; Esc releases the mouse, pauses the simulation and
  shows it again. P pauses independently without releasing pointer lock.
- **Pixel ratio** is capped at 1.5 to limit GPU fill cost on high-density screens.

## Sky

- **Star altitude** is `asin(sin(2πt / day))`, as the spec gives. The star's
  path is `(0, sin a, −cos a)` with `a = 2πt / day`: it rises on the horizon
  ahead (−z), peaks overhead at a quarter of the day and sets behind. Its height
  is exactly the spec's altitude, and the path has no sideways drift.
- **Time.** An hour of world time is 10 real seconds (`REAL_SECONDS_PER_HOUR`),
  so a day lasts 10 × its length in hours. Sunrise is hour 0. The game starts
  at an eighth of the day unless `?hour=` gives another start.
- **Day phases.** Within 8° of the horizon the phase is dawn while the star
  rises and dusk while it sets. Above 8° it is day, below −8° night. Daylight
  ramps from 0 to 1 across the same band.
- **Colours.** Star light is Tanner Helland's blackbody colour. The sky is that
  light weighted by Rayleigh scattering (`(550 / λ)⁴`), scaled so the largest
  channel is 255. The zenith and horizon blend from a dark night colour to the
  day colour by daylight. The horizon takes 35% of the star's colour, so dusk
  is warm. Ambient light takes 50% of the star's colour: pure Rayleigh blue
  left low-sun ground almost black at dawn.
- **Stars.** 1200 stars in the upper sky, from the seed. They are not sorted,
  so the first `visibleStarFraction × 1200` show. Stars fade in as the daylight
  falls.
- **Fog density** is `0.005 + 0.007 × pressure` per metre. The base keeps a
  faint haze even in a vacuum, which softens the edge of the loaded ground.
- **Moons.** Zero, one or two, chosen from the seed with equal chances. Each has
  its own period (0.3 to 2 world days), phase, tilt, size and colour. Seed 7
  (Ember) has one; seed 42 (Verdant) has none.
- **Drawing.** The dome is a gradient shader, centred on the camera and drawn
  first. The sun, its halo and the moons sit 950 m away and ignore fog. The
  camera's far plane is 1200 m, beyond the 1000 m dome.

## Build

- **Levels are copied to `dist/levels/`** by a small Vite plugin in
  `vite.config.ts`, because Vite only bundles `src/` and `public/`, while the
  page loads levels by URL at runtime.
- **Bundle size warning raised to 600 kB.** Three.js alone is about 500 kB
  minified, so the default 500 kB warning would fire on every build.

## Life and surveying

- Each seed generates three plant and two grazer species, names and part
  dimensions. Chunk-local mulberry32 streams keep placement independent of
  chunk loading order. No new dependency is used.
- Plant hue is black/violet below 3500 K, red below 5000 K, green below 6500 K,
  and blue above. Habitat falls off on slopes above 15 degrees (zero at 30),
  above 12 m (zero at 24 m), and outside 268–318 K (zero 10 K farther out).
  Low ground is treated as moist, water-filled soil for density; there is no
  visible water surface or swimming in this milestone.
- Animal scale is clamped `sqrt(9.81 / gravity)`. Legs grow with an additional
  square root of the scale, producing squat heavy-world and slender light-world
  proportions. Herds stay near their chunk-local home, graze, wander and flee.
  Distant unloaded herds regenerate at their seeded starting state on return.
- The scanner targets the centre-most life point within a 5-degree cone and
  40 m. The survey log is in memory for the current page session only; it is not
  persisted. Terrain does not occlude scanner targets in this milestone.
- Rendered life uses heights interpolated from the terrain mesh's triangles;
  habitat uses the underlying noise. Player physics retains its previous
  continuous terrain height. Life simulation is advanced in capped time steps.

## Survival

- **Oxygen only where the air is thin or toxic.** The spec says oxygen is not
  needed where the air is breathable, so the verdict decides per world: on
  breathable worlds the tank stays full. Verdant and Boulder never drain; Ember
  does. Pockets of breathable air within a world are not modelled.
- **Numbers.** The tank and health run from 0 to 100. Oxygen drains 0.1 per
  second resting or walking, and 0.3 running: about 17 minutes of walking from a
  full tank, about 5½ minutes of running. The lander refills 25 per second.
  These values are chosen for play, not taken from the spec.
- **Empty tank.** The spec does not say what an empty tank does. It costs 2
  health per second, so a player who stays in thin air dies.
- **Comfort band 273.15 K to 313.15 K** (0 to 40 °C), a human tolerance. Damage
  is 0.1 health per second for each kelvin beyond the band. The temperature is
  the planet's surface temperature adjusted for height with the lapse rate that
  plants use. The terrain's ±34 m changes it by well under a kelvin, so the
  world's value governs the whole world.
- **The lander shelters.** Within 6 m of the landing point there is no
  temperature damage, health recovers 4 per second, and oxygen refills. Death
  returns the player there with full health and oxygen. The survey log is
  session state, so it survives.
- **Predators are animal species** with `predator: true`, generated from a
  separate seeded stream after the grazers, so plants and grazers keep the values
  they had in milestone 4. Two per world. A predator den appears in at most one
  chunk, in up to 15% of chunks, on the same grassy ground the herds use. Its 16 m
  territory sits inside a 20 m margin, so the chunk owns the whole territory.
  Dens are at least 40 m from the lander, which keeps territories clear of it.
- **Predator states.** Patrol inside the territory, away from the den. A player
  who enters triggers warn: a 4 s call and raised head, sounded once per entry.
  If the player is still there at the end, attack begins: the predator charges
  at 6.5 m/s on Earth scale (scaled like the other animals, so about 7.5 m/s on
  Verdant), striking for 20 health every 1.5 s within 2 m. A predator that loses
  the player at the territory's edge goes back to patrolling; it never chases
  out of its territory.
- **Sampler.** A left click stuns the aimed animal or predator for 5 s and then
  recharges for 8 s. Plants cannot be stunned. A shot with no creature aimed
  does not use the cooldown. A stun never harms the creature, as the spec asks.
- **Shared step.** The slope-limited ground step moved from the herd code into
  `gait.ts`, so herds and predators stop on the same slopes.
- **Warning sound.** A short Web Audio oscillator call, so no audio files are
  added. It is first created during play, after the player's click, so browsers
  allow it.

## Objectives, progress and assets

- **Landmarks come from objectives, not from a fixed list.** The shipped worlds
  already name their landmarks freely ("the red crater rim", "the balanced
  stone"), so each `reach-landmark` objective places one landmark, in list
  order, from the seed and its position. The shape (spire, arch, pillar) is
  chosen by the seed, not by the name. Distance 120 to 300 m from the lander:
  near enough to head for, far enough to need a walk.
- **Return needs a trek.** "Return to the lander" would be met at the start if
  standing at the lander counted, so the player must first go more than 60 m
  away. That trip is a session flag; the completed return is saved.
- **Progress is saved per world in `localStorage`**, under
  `alien-trekking:progress:<id>`. It holds the species logged, the landmarks
  reached and the return. This replaces milestone 4's session-only survey log,
  which is why the log now survives a reload. A corrupt or foreign record is
  read as a new world rather than an error, since it is browser state, not a
  level file.
- **Objective counts are checked against the world.** A world always has seven
  species (three plants, two grazers, two predators), so `scan-species` counts
  1 to 7. The species constants are exported from the ecosystem so that the
  validator and the generator cannot drift apart.
- **Assets may supply a model, a texture, or both.** Texture-only assets use
  generated shapes; missing UVs are projected onto the geometry. Assets load
  before the briefing, and failed models or textures use the generated fallback
  and are noted on screen.
- **Animals with a model or texture lose the head animation.** The generated head
  normally pivots for grazing and warning. Customized animals are shown whole;
  their movement remains. Plant models stream with their chunk while other plants
  remain merged.
- **Asset paths resolve against the level file**, so a world in a folder ships
  with its models next to it, and a world at a URL works with its own files.
- **Cross-origin worlds need CORS.** They are fetched with `fetch`, so a host
  other than the game's must send `Access-Control-Allow-Origin`. The documentation
  in `LEVELS.md` says so.
- **Bundle size.** Adding the glTF loader takes the bundle to about 680 kB, so the
  Vite warning limit moves from 600 to 750 kB rather than splitting the bundle.
- **Title screen replaces the first-world default.** With no `?level=`, the page
  lists the worlds and offers the URL field; the milestone 1–5 addresses still
  open a world directly.


## Feel, sound and settings

- Footfall cadence scales with the square root of gravity, and bob amplitude is
  inversely proportional to gravity with a 12 cm cap. Grounded movement drives
  both; standing or jumping produces no footsteps.
- Web Audio uses seeded noise, filtered by atmospheric pressure, for wind and
  synthesized tones for calls and scanner feedback. Ambient calls use a separate
  seeded stream, are audible within 60 m, and vary in pitch with animal size.
- Draw distance, mouse sensitivity and volume are saved globally in browser
  `localStorage`; mute is a session toggle. Defaults and ranges are in the README.

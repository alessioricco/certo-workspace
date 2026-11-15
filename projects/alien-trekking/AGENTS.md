# Repository notes

- This is a Node 18+ TypeScript/Vite game. Run `npm ci`, then `npm run dev`;
  verify with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Keep Three.js and DOM code outside `src/engine/`. Levels are runtime JSON in
  `levels/`, copied into the build by `vite.config.ts`.
- Terrain noise is continuous; nearby rendered terrain is a 16-by-16 grid per
  64 m chunk, with coarser 8-by-8 terrain beyond the detail radius. Use
  `terrainSurfaceHeight` to place rendered life on detailed terrain.
- Terrain and life share a 4 ms streaming budget. User settings are stored under
  `alien-trekking:settings`; P or lost pointer lock pauses the simulation.
- Life placement and species use independently seeded mulberry32 streams. Herds
  are regenerated when their unloaded chunk is loaded again. Progress (survey log,
  landmarks reached, return to the lander) is saved per world in `localStorage`
  by `progressStore.ts`; the rules are in `engine/progress.ts` and `objectives.ts`.
- Landmarks are planned from the level's `reach-landmark` objectives
  (`engine/landmarks.ts`). Level assets are resolved against the level file and
  loaded in `render/assets.ts`, falling back to the generated version on failure.
  Page DOM for the title, briefing and report lives in `pages.ts`.
- Predators are animal species with `predator: true`, placed per chunk like
  herds (`predatorsInChunk`), and kept 40 m from the lander. Survival numbers
  live in `src/engine/survival.ts`; the stun and its cooldown in `sampler.ts`.
- `.certo/` is tool state; leave it untouched. Clean up temporary browser scripts
  and profiles after smoke tests, since root JavaScript files are linted.

# Project context

- Dependency-free plain HTML/CSS/JavaScript; open `index.html` directly with `file://`. No server or build. Node >=18 is only needed for tests; use `npm test` (`node --test`).
- Milestone 2 implemented: 20 solid wireframe cube/pyramid obstacles, infinite-distance mountain ring and crescent moon, following ground grid, and driving. Do not add later-milestone shells, enemies, combat, or scoring without a request.
- Keep every rule and 3D helper in `engine.js`, with no browser APIs. Preserve both plain-script globals and the guarded CommonJS export. `main.js` is input, rendering, and loop only.
- Coordinate convention: +x right, +y up, +z forward, positive heading turns right. `toCamera` does not subtract eye height. `projectLine` does, clips at 0.1, then nudges exact-boundary z for `project`, which rejects z <= 0.1.
- Driving analytically integrates arcs, so simultaneous driving and turning is frame-rate independent. Keep the literal worked-example tests and 1e-9 coordinate tolerances.
- Browser smoke verification used actual native WebKit against the local file, including keyboard, pause/resume, reset, blur, resizing, canvas pixels, and narrow-screen pointer controls. Temporary verification files were removed.
- Collision: `moveTank` accepts optional `{ x, z, r }` obstacles, sweeps the straight/circular path, stops translation at first contact, and retains steering. Tank radius is 2 m; obstacle radius is half its ground diagonal. Preserve tangent escape and long-frame tests.
- Sky: `projectSkyLine` ignores camera x/z and eye height, applying heading only to `createWorld().mountains` and `.moon`. Mountain peak indices wrap to close the seam.
- `.certo/` is managed run state: ignore it and never modify it.

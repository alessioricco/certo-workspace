# Repository notes

- Plain browser JavaScript, HTML and CSS; no npm dependencies or build step. Keep direct `file://` startup working and avoid external assets.
- `npm test` runs `node --test` (Node >=18). No installation is needed.
- `game.js` is the pure rules layer, loaded as a classic browser script and CommonJS. Do not add DOM/canvas/input APIs or import/export syntax there.
- `Game.update(seconds)` consumes elapsed seconds chronologically; preserve deterministic frame partitioning and exact power expiry. `ghostStep` uses squared Euclidean distance and up/left/down/right tie order.
- The shipped 21x21 maze is fully connected; keep the ghost-house exit at column 10, row 11 open so ghosts can chase the player below it.
- `main.js` owns the renderer, initial input readiness, and input. CSS controls canvas size; ResizeObserver updates its high-DPI backing buffer.
- `.certo/` is managed by the harness: never read, edit, move or delete it.

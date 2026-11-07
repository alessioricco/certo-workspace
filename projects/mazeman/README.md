# Mazeman

A browser maze chase in plain JavaScript, HTML, and CSS. No packages, build step, server, or internet connection required.

## Play

Open `index.html` directly in a modern browser (Chrome, Edge, Firefox, or Safari). Double-click the file, or run one of these commands from this directory:

```sh
# macOS
open index.html

# Linux
xdg-open index.html

# Windows (Command Prompt)
start index.html
```

The game waits for your first direction input before starting the chase.

- **Arrow keys / WASD:** move. Movement continues until a wall; you can queue a turn before a junction.
- **P:** pause or resume. You can also use the pause button above the maze.
- **Enter:** start a new game after game over. The on-screen button works too.
- **Touch:** use the directional buttons below the maze, or swipe on the canvas.
- **How to play:** open the in-game guide. It pauses the game and preserves your previous pause state when closed.

Eat dots for **10 points** and power pellets for **50**. A power pellet makes ghosts flee for **6 seconds**; catching one then earns **200 points** and returns it to the middle. Each unpowered collision costs one of your **3 lives** and resets everyone's positions, without replacing eaten dots. Clear every dot and pellet to start the same maze again with faster ghosts.

The canvas scales to the window and high-DPI screens. Switching to another tab automatically pauses; press **P** to resume when you return.

## Tests

Tests need **Node.js 18 or newer**. There is nothing to install: do **not** run `npm install`.

From this directory:

```sh
npm test
```

Or run Node's built-in test runner directly:

```sh
node --test
```

The tests cover all supplied helper examples, maze reachability, walls, buffered movement, scoring, ghost chase/flee decisions, power timing, collisions, last-life game over, restart, pause, level progression, and frame-rate independence.

## Files

- `game.js` — DOM-free game rules, the 21 × 21 string-array maze, and a deterministic `Game` class. Loads as a browser script or through Node's `require`.
- `main.js` — canvas drawing, responsive/high-DPI resizing, keyboard/touch input, and the animation loop.
- `index.html` / `style.css` — the page, scoreboard, controls, and visual presentation.
- `game.test.js` — tests using only `node:test` and `node:assert`.
- `package.json` — the dependency-free test command.

For Node usage:

```js
const { Game } = require("./game.js");
const game = new Game();
game.setDirection("left");
game.update(0.12); // elapsed time in seconds
console.log(game.player, game.score);
```

`ghostStep` compares squared straight-line distance; ties are resolved in **up, left, down, right** order. Simulation events are processed chronologically, independently of rendering frequency. All game rules remain in `game.js`; it has no browser dependencies.

<!-- certo:models -->
*Generated with [Certo](https://github.com/alessioricco/certo), using `openai/gpt-6.1-sol`.*
<!-- /certo:models -->

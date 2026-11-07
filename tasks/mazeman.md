# Mazeman in the browser

Needs Node 18 or newer, for the tests. No npm packages: there is nothing to
install.

Build a browser maze game in plain JavaScript, HTML and CSS: the player
eats the dots in a maze while ghosts chase them.

## Game

- The maze is a grid of tiles, written in `game.js` as an array of
  strings: `#` a wall, `.` a dot, `o` a power pellet, a space an empty
  tile. Draw your own maze, at least 19 tiles wide and 15 tall.
- The player moves one tile at a time with the arrow keys (or WASD) and
  can't walk into a wall. A dot scores 10 points, a power pellet 50.
- Three ghosts start in the middle. Each step a ghost moves to the open
  neighbouring tile closest to the player (see `ghostStep` below).
- A ghost reaching the player's tile costs a life, and the player and the
  ghosts go back to their starting tiles. The player has 3 lives. At 0 the
  game is over, and Enter starts a new game.
- After a power pellet, for 6 seconds the ghosts are drawn in another
  colour and move away from the player instead. Catching one then scores
  200 points and sends it back to the middle.
- When every dot and pellet is eaten, the next level starts with the same
  maze, faster ghosts.
- P pauses and resumes. Score, lives and level are always on screen.
- Draw on a canvas that fits the window and follows resizes. Movement uses
  the time between frames, so the speed doesn't depend on the frame rate.

## Files

- `game.js`: every rule above (moves, walls, dots, ghosts, lives,
  levels) as plain functions or classes, with no canvas, DOM or keyboard
  code. It must load both as a plain `<script>` in the browser (no
  `import`/`export`) and with `require` in Node, so it ends with
  `if (typeof module !== "undefined") module.exports = { ... };`.
  A maze is an array of strings, and `maze[y][x]` is the tile at column
  `x`, row `y`. It includes at least these functions, used by the game and
  the tests, where `SMALL` is this maze:

  ```js
  const SMALL = ["#####", "#...#", "#.#.#", "#...#", "#####"];
  ```

  | Function | Examples |
  | --- | --- |
  | `isOpen(maze, x, y)`: not a wall and inside the maze | `isOpen(SMALL, 1, 1)` → `true`; `isOpen(SMALL, 2, 2)` → `false`; `isOpen(SMALL, -1, 1)` → `false` |
  | `pointsFor(tile)` | `"."` → 10; `"o"` → 50; `" "` → 0 |
  | `countDots(maze)`: dots and pellets left | `countDots(SMALL)` → `8` |
  | `ghostStep(maze, ghost, player)` returns the open tile next to `ghost` (up, left, down or right) closest to `player` in a straight line; on a tie, the first in the order up, left, down, right | `ghostStep(SMALL, { x: 3, y: 1 }, { x: 1, y: 1 })` → `{ x: 2, y: 1 }`; `ghostStep(SMALL, { x: 1, y: 1 }, { x: 3, y: 3 })` → `{ x: 1, y: 2 }` |
- `main.js`: drawing, keyboard input and the game loop, using `game.js`.
- `index.html`: the canvas plus `<script src="game.js">` and
  `<script src="main.js">`. Opening the file in a browser starts the game,
  with no server.
- `game.test.js`: tests with Node's built-in test runner (`node:test` and
  `node:assert`) with every example in the table above, copied as written
  (they are worked out already, don't change them), plus a test that the
  game is over when the last life is lost.
- `package.json`: no dependencies, and `"scripts": { "test": "node --test" }`.
- `README.md`: how to open the game and how to run the tests.

## Done when

- `npm test` passes.
- Opening `index.html` shows the game.

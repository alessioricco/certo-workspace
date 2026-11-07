# Invaders in the browser

Needs Node 18 or newer, for the tests. No npm packages: there is nothing to
install.

Build a browser game in plain JavaScript, HTML and CSS: the player's
cannon at the bottom shoots a fleet of aliens marching down the screen.

## Game

- The fleet is 5 rows of 11 aliens. It marches sideways; when the next
  step would take it past an edge, it moves down instead and turns
  around (see `marchStep` below). It marches faster as fewer aliens are
  left.
- The cannon moves left and right with the arrow keys (or A/D) and shoots
  with Space. Only one of its shots flies at a time.
- A shot that hits an alien removes both. The top row scores 30 points,
  the two middle rows 20, the two bottom rows 10.
- Aliens drop bombs now and then, from the bottom alien of a column. A
  bomb hitting the cannon costs a life. The player has 3 lives. At 0, or
  when the fleet reaches the cannon's row, the game is over, and Enter
  starts a new game.
- When every alien is gone, a new wave starts one step lower.
- P pauses and resumes. Score, lives and wave are always on screen.
- Draw on a canvas that fits the window and follows resizes. Movement uses
  the time between frames, so the speed doesn't depend on the frame rate.

## Files

- `game.js`: every rule above (marching, shots, bombs, collisions,
  scoring, lives, waves) as plain functions or classes, with no canvas,
  DOM or keyboard code. It must load both as a plain `<script>` in the
  browser (no `import`/`export`) and with `require` in Node, so it ends
  with `if (typeof module !== "undefined") module.exports = { ... };`.
  It includes at least these functions, used by the game and the tests:

  | Function | Examples |
  | --- | --- |
  | `marchStep(fleet, width)`: for a fleet `{ left, right, y, dir }` (`dir` is 1 for right, -1 for left), it moves 10 sideways, or, when that would put `left` below 0 or `right` past `width`, 20 down and turns around | `marchStep({ left: 100, right: 300, y: 50, dir: 1 }, 800)` → `{ left: 110, right: 310, y: 50, dir: 1 }`; `marchStep({ left: 700, right: 795, y: 50, dir: 1 }, 800)` → `{ left: 700, right: 795, y: 70, dir: -1 }`; `marchStep({ left: 5, right: 200, y: 70, dir: -1 }, 800)` → `{ left: 5, right: 200, y: 90, dir: 1 }` |
  | `pointsForRow(row)`, row 0 at the top | `0` → 30; `1` → 20; `2` → 20; `3` → 10; `4` → 10 |
  | `rectsOverlap(a, b)` for two `{ x, y, w, h }`; touching edges don't overlap | `({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })` → `true`; `({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })` → `false` |
  | `marchInterval(left, total)`: milliseconds between steps, `800 * left / total`, never below 50 | `(55, 55)` → `800`; `(11, 55)` → `160`; `(1, 55)` → `50` |
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

# Iron Horizon

A first-person 3D tank game that runs in the browser. The view is drawn with
glowing wireframe lines on black, using a small 3D projection written by hand
on a plain 2D canvas. There are no npm packages and no 3D library.

The game is complete: the 3D view, the plain, the obstacles, the tank's
movement, the mountain ring and crescent moon on the horizon, collisions with
obstacles, shells, enemy tanks, a radar, waves, scoring, a saved high score,
lives, pause and game over are all in place.

## Requirements

- A modern browser (Chrome, Firefox, Safari or Edge) to play.
- Node.js 18 or newer to run the tests. There is nothing to install: the
  project has no dependencies.

## Playing the game

No server is needed. Open `index.html` directly in a browser:

- macOS: `open index.html`
- Linux: `xdg-open index.html`
- Windows: `start index.html`

Or drag `index.html` into an open browser window.

### Controls

| Key | Action |
| --- | --- |
| Up arrow or W | Drive forwards |
| Down arrow or S | Drive backwards |
| Right arrow or D | Turn right |
| Left arrow or A | Turn left |
| Space | Fire a shell straight ahead (one shell per key press) |
| P | Pause and resume |
| Enter | Start a new game (after game over) |

The canvas fills the window and adjusts when the window is resized.

### The world

- The tank cannot drive through obstacles. It has a radius of 1.5 m, and it
  stops against the face of a cube or pyramid. If it hits a wall at an angle,
  it slides along the wall.
- Mountains form a jagged ring on the horizon. They stay at a fixed distance
  and move sideways in the view as the tank turns, so they never get closer.
- A crescent moon hangs above the mountains.
- Only one of your shells can fly at a time. A shell stops at the first
  obstacle it meets, or after 200 m.
- One enemy tank is on the plain at a time, 200 to 240 m away. It turns to face
  you, drives until it is 80 m away, then fires when you are almost straight
  ahead of it. Its shells also stop at obstacles.
- A hit on the enemy scores 1000 and the next enemy appears straight away.
- Enemies come in waves of 5. Every 5 enemies destroyed, the next enemies move
  faster and fire sooner, down to a minimum reload of 0.8 s.
- You have 3 lives. Each enemy shell that reaches you costs one life and
  cracks the screen for a moment. When the last life is gone the game shows
  GAME OVER; press Enter to start a new game.
- The high score is saved in the browser's `localStorage` under the key
  `iron-horizon.high-score`, so it survives reloads and new games.
- Press P to pause. The world stops until you press P again.

### The radar and the HUD

- A round radar sits at the top of the screen. The tank is at its centre, and
  its top is the direction the tank faces, so the radar turns with the tank.
  The enemy is a red dot. The green sweep line goes round once every 4 seconds.
  An enemy beyond the radar's 260 m range is shown at the rim.
- Under the radar, a message says when the enemy is on your right, on your
  left, or behind you. Nothing is shown while the enemy is ahead.
- The top left shows the score, the high score, the lives and the wave.

## Running the tests

From the project root:

```bash
npm test
```

This runs `node --test` on `engine.test.js` with Node's built-in test runner.
The tests check the 3D maths (`toCamera`, `project`, `clipToNear`,
`wrapAngle`), driving, collisions (`circlesHit`, `obstacleHitsCircle`,
`driveTankWithCollisions`), the ground grid, the obstacle models, the mountain
ring and moon, `turnTowards`, shell flight and hits, enemy turning, driving,
firing and damage, scoring, lives and game over, the enemy tank model and
cracked-glass pattern, waves (`waveIndex`, `enemyTuning`), the high score,
pausing (`togglePause`), the radar position (`radarPosition`) and the
behind/side warning (`enemyWarning`).

## Project layout

- `engine.js`: the 3D maths and the game rules (driving, collisions, world
  layout, obstacle models, horizon, projection). It has no DOM, canvas or
  keyboard code, and it loads both as a plain `<script>` and with `require`
  in Node.
- `main.js`: drawing on the canvas, keyboard input and the game loop.
- `index.html`: loads `engine.js` and then `main.js`.
- `engine.test.js`: the tests, using `node:test` and `node:assert`.
- `package.json`: the `test` script (`node --test`).

<!-- certo:models -->
*Generated with [Certo](https://github.com/alessioricco/certo), using `anthropic/claude-haiku-5-5`.*
<!-- /certo:models -->

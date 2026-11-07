"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAZE, PLAYER_START, GHOST_STARTS, PLAYER_INTERVAL, POWER_SECONDS,
  isOpen, pointsFor, countDots, ghostStep, Game,
} = require("./game.js");

const SMALL = ["#####", "#...#", "#.#.#", "#...#", "#####"];

function gameOn(maze = SMALL, playerStart = { x: 1, y: 1 }, ghostStarts = []) {
  return new Game({ maze, playerStart, ghostStarts });
}

test("isOpen: all supplied examples", () => {
  assert.equal(isOpen(SMALL, 1, 1), true);
  assert.equal(isOpen(SMALL, 2, 2), false);
  assert.equal(isOpen(SMALL, -1, 1), false);
});

test("pointsFor: all supplied examples", () => {
  assert.equal(pointsFor("."), 10);
  assert.equal(pointsFor("o"), 50);
  assert.equal(pointsFor(" "), 0);
});

test("countDots: the supplied example", () => {
  assert.equal(countDots(SMALL), 8);
});

test("ghostStep: both supplied examples, including tie order", () => {
  assert.deepEqual(ghostStep(SMALL, { x: 3, y: 1 }, { x: 1, y: 1 }), { x: 2, y: 1 });
  assert.deepEqual(ghostStep(SMALL, { x: 1, y: 1 }, { x: 3, y: 3 }), { x: 1, y: 2 });
});

test("maze has a connected playable grid of at least 19 by 15 tiles", () => {
  assert.ok(MAZE.length >= 15);
  assert.ok(MAZE.every(row => row.length === MAZE[0].length && row.length >= 19));
  assert.equal(GHOST_STARTS.length, 3);
  assert.ok(GHOST_STARTS.every(start => isOpen(MAZE, start.x, start.y)));
  const queue = [PLAYER_START];
  const reached = new Set([`${PLAYER_START.x},${PLAYER_START.y}`]);
  for (const { x, y } of queue) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (isOpen(MAZE, nx, ny) && !reached.has(key)) {
        reached.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  MAZE.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile !== "#") assert.ok(reached.has(`${x},${y}`), `unreachable tile ${x},${y}`);
  }));
});

test("outside coordinates and walls are closed; empty tiles are open", () => {
  for (const [x, y] of [[5, 1], [1, -1], [1, 5], [1.5, 1], [NaN, 1]]) {
    assert.equal(isOpen(SMALL, x, y), false);
  }
  assert.equal(isOpen(["# #"], 1, 0), true);
  assert.equal(pointsFor("#"), 0);
  assert.equal(countDots(["#.o #"]), 2);
});

test("ghosts choose Euclidean distance, not Manhattan distance", () => {
  const open = Array(8).fill("        ");
  assert.deepEqual(ghostStep(open, { x: 2, y: 2 }, { x: 5, y: 4 }), { x: 3, y: 2 });
});

test("ghost tie priority is up, left, down, right", () => {
  const open = ["   ", "   ", "   "];
  assert.deepEqual(ghostStep(open, { x: 1, y: 1 }, { x: 1, y: 1 }), { x: 1, y: 0 });
  assert.deepEqual(ghostStep(["###", "   ", "   "], { x: 1, y: 1 }, { x: 1, y: 1 }), { x: 0, y: 1 });
});

test("trapped ghosts stay put and frightened ghosts choose the farthest tile", () => {
  assert.deepEqual(ghostStep(["###", "# #", "###"], { x: 1, y: 1 }, { x: 0, y: 0 }), { x: 1, y: 1 });
  assert.deepEqual(ghostStep(SMALL, { x: 3, y: 1 }, { x: 1, y: 1 }, true), { x: 3, y: 2 });
});

test("player moves one tile per interval and cannot enter walls", () => {
  const game = gameOn();
  game.setDirection("up");
  game.update(PLAYER_INTERVAL);
  assert.deepEqual(game.player, { x: 1, y: 1 });
  game.setDirection("right");
  game.update(PLAYER_INTERVAL / 2);
  assert.deepEqual(game.player, { x: 1, y: 1 });
  game.update(PLAYER_INTERVAL / 2);
  assert.deepEqual(game.player, { x: 2, y: 1 });
  assert.equal(game.score, 10);
});

test("a buffered turn waits for the next open junction", () => {
  const game = gameOn();
  game.setDirection("right");
  game.movePlayer();
  game.setDirection("down");
  game.movePlayer();
  assert.deepEqual(game.player, { x: 3, y: 1 });
  game.movePlayer();
  assert.deepEqual(game.player, { x: 3, y: 2 });
});

test("dots and pellets score once without modifying the original maze", () => {
  const maze = ["#######", "# .o .#", "#######"];
  const game = gameOn(maze);
  game.setDirection("right");
  game.movePlayer();
  assert.equal(game.score, 10);
  game.movePlayer();
  assert.equal(game.score, 60);
  assert.equal(game.powerRemaining, POWER_SECONDS);
  game.movePlayer();
  assert.equal(game.score, 60);
  game.setDirection("left");
  game.movePlayer();
  assert.equal(game.score, 60);
  assert.equal(maze[1], "# .o .#");
  assert.equal(game.remainingDots, 1);
});

test("ghosts move on their timed steps toward the stationary player", () => {
  const game = gameOn(SMALL, { x: 1, y: 1 }, [{ x: 3, y: 1 }]);
  game.update(game.ghostInterval - 0.001);
  assert.deepEqual(game.ghosts[0], { x: 3, y: 1 });
  game.update(0.001);
  assert.deepEqual(game.ghosts[0], { x: 2, y: 1 });
  game.update(game.ghostInterval);
  assert.equal(game.lives, 2);
  assert.deepEqual(game.player, { x: 1, y: 1 });
  assert.deepEqual(game.ghosts[0], { x: 3, y: 1 });
});

test("player entering a ghost loses one life, even with overlapping ghosts", () => {
  const game = gameOn(SMALL, { x: 1, y: 1 }, [{ x: 3, y: 1 }, { x: 3, y: 3 }]);
  game.ghosts.forEach(ghost => Object.assign(ghost, { x: 2, y: 1 }));
  game.setDirection("right");
  game.movePlayer();
  assert.equal(game.lives, 2);
  assert.equal(game.score, 10);
  assert.equal(game.maze[1][2], " ");
  assert.deepEqual(game.player, { x: 1, y: 1 });
  assert.deepEqual(game.ghosts, [{ x: 3, y: 1 }, { x: 3, y: 3 }]);
});

test("game is over when the last life is lost in a ghost collision", () => {
  const game = gameOn(SMALL, { x: 1, y: 1 }, [{ x: 3, y: 1 }]);
  for (let life = 3; life > 0; life -= 1) {
    Object.assign(game.ghosts[0], game.player);
    game.resolveCollisions();
    assert.equal(game.lives, life - 1);
    assert.equal(game.gameOver, life === 1);
  }
  const snapshot = JSON.stringify(game);
  game.update(100);
  game.setDirection("right");
  game.movePlayer();
  game.moveGhosts();
  game.loseLife();
  assert.equal(JSON.stringify(game), snapshot);
});

test("power pellet protects immediately; a caught ghost scores 200 and returns home", () => {
  const game = gameOn(["#######", "# o ..#", "#######"], { x: 1, y: 1 }, [{ x: 4, y: 1 }]);
  game.ghosts[0].x = 2;
  game.setDirection("right");
  game.movePlayer();
  assert.equal(game.lives, 3);
  assert.equal(game.score, 250);
  assert.equal(game.frightened, true);
  assert.deepEqual(game.ghosts[0], { x: 4, y: 1 });
});

test("power lasts exactly six seconds, refreshes, and freezes while paused", () => {
  const game = gameOn(["#########", "# oo .. #", "#########"]);
  game.setDirection("right");
  game.movePlayer();
  game.direction = null;
  game.nextDirection = null;
  game.update(2);
  assert.ok(Math.abs(game.powerRemaining - 4) < 1e-8);
  game.setDirection("right");
  game.movePlayer();
  assert.equal(game.powerRemaining, 6);
  game.direction = null;
  game.nextDirection = null;
  game.togglePause();
  game.update(20);
  assert.equal(game.powerRemaining, 6);
  game.togglePause();
  game.update(5.999);
  assert.equal(game.frightened, true);
  game.update(0.001);
  assert.equal(game.frightened, false);
});

test("frightened ghosts actually flee during timed movement", () => {
  const game = gameOn(SMALL, { x: 1, y: 1 }, [{ x: 3, y: 1 }]);
  game.powerRemaining = 6;
  game.update(game.ghostInterval);
  assert.deepEqual(game.ghosts[0], { x: 3, y: 2 });
});

test("a collision at the exact instant power expires costs a life", () => {
  const game = gameOn(SMALL, { x: 1, y: 1 }, [{ x: 2, y: 1 }]);
  game.powerRemaining = game.ghostInterval;
  game.update(game.ghostInterval);
  assert.equal(game.lives, 2);
});

test("clearing the last dot or pellet restores the maze with faster ghosts", () => {
  for (const tile of [".", "o"]) {
    const game = gameOn(["#####", `# ${tile} #`, "#####"]);
    const speed = game.ghostInterval;
    game.setDirection("right");
    game.update(PLAYER_INTERVAL);
    assert.equal(game.level, 2);
    assert.equal(game.score, pointsFor(tile));
    assert.equal(game.lives, 3);
    assert.equal(game.remainingDots, 1);
    assert.equal(game.maze[1][2], tile);
    assert.deepEqual(game.player, { x: 1, y: 1 });
    assert.ok(game.ghostInterval < speed);
    assert.equal(game.powerRemaining, 0);
  }
});

test("pausing freezes the whole simulation; restart restores a new game", () => {
  const game = new Game();
  game.setDirection("left");
  game.update(0.5);
  game.togglePause();
  const snapshot = JSON.stringify(game);
  game.update(100);
  assert.equal(JSON.stringify(game), snapshot);
  game.lives = 1;
  game.loseLife();
  game.restart();
  assert.equal(game.lives, 3);
  assert.equal(game.score, 0);
  assert.equal(game.level, 1);
  assert.equal(game.paused, false);
  assert.equal(game.gameOver, false);
  assert.deepEqual(game.maze, MAZE);
  assert.deepEqual(game.player, PLAYER_START);
});

test("elapsed time gives the same result for large and small frames", () => {
  for (const powered of [false, true]) {
    const a = new Game();
    const b = new Game();
    a.setDirection("left");
    b.setDirection("left");
    if (powered) a.powerRemaining = b.powerRemaining = 1;
    a.update(2.4);
    for (let frame = 0; frame < 240; frame += 1) b.update(0.01);
    for (const key of ["player", "ghosts", "maze", "score", "lives", "level", "remainingDots"]) {
      assert.deepEqual(a[key], b[key], key);
    }
    assert.ok(Math.abs(a.powerRemaining - b.powerRemaining) < 1e-8);
    assert.ok(Math.abs(a.playerClock - b.playerClock) < 1e-8);
    assert.ok(Math.abs(a.ghostClock - b.ghostClock) < 1e-8);
  }
});

test("invalid time and unknown directions do not affect the game", () => {
  const game = new Game();
  const snapshot = JSON.stringify(game);
  for (const seconds of [NaN, Infinity, -1, 0]) game.update(seconds);
  for (const direction of ["diagonal", "toString", "__proto__"]) game.setDirection(direction);
  assert.equal(JSON.stringify(game), snapshot);
});

test("invalid mazes and closed starting tiles are rejected", () => {
  assert.throws(() => gameOn([]), /rectangular/);
  assert.throws(() => gameOn(["###", "# #", "##"]), /rectangular/);
  assert.throws(() => gameOn(["###", "#x#", "###"]), /rectangular/);
  assert.throws(() => gameOn(SMALL, { x: 0, y: 0 }), /starting tiles/);
});

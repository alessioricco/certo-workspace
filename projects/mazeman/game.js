"use strict";

const MAZE = [
  "#####################",
  "#o........#........o#",
  "#.##.####.#.####.##.#",
  "#...................#",
  "#.##.#.#######.#.##.#",
  "#....#....#....#....#",
  "####.#### # ####.####",
  "#....#         #....#",
  "#.##.# ### ### #.##.#",
  "#......#     #......#",
  "###.##.#     #.##.###",
  "#...##.### ###.##...#",
  "#.#...............#.#",
  "#.####.###.###.####.#",
  "#......#.....#......#",
  "#.####.#.###.#.####.#",
  "#....#...   ...#....#",
  "#.##.###.#.#.###.##.#",
  "#o.......#.#.......o#",
  "#...................#",
  "#####################",
];

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
};
const PLAYER_START = { x: 10, y: 16 };
const GHOST_STARTS = [{ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }];
const PLAYER_INTERVAL = 0.12;
const POWER_SECONDS = 6;
const EPSILON = 1e-9;

function isOpen(maze, x, y) {
  return Number.isInteger(x) && Number.isInteger(y)
    && y >= 0 && y < maze.length && x >= 0 && x < maze[y].length
    && maze[y][x] !== "#";
}

function pointsFor(tile) {
  return tile === "." ? 10 : tile === "o" ? 50 : 0;
}

function countDots(maze) {
  return maze.reduce((total, row) => total + [...row].filter(tile => tile === "." || tile === "o").length, 0);
}

function ghostStep(maze, ghost, player, frightened = false) {
  let best = { x: ghost.x, y: ghost.y };
  let bestDistance = frightened ? -Infinity : Infinity;
  for (const direction of Object.values(DIRECTIONS)) {
    const x = ghost.x + direction.x;
    const y = ghost.y + direction.y;
    if (!isOpen(maze, x, y)) continue;
    const distance = (x - player.x) ** 2 + (y - player.y) ** 2;
    if (frightened ? distance > bestDistance : distance < bestDistance) {
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

class Game {
  constructor({ maze = MAZE, playerStart = PLAYER_START, ghostStarts = GHOST_STARTS } = {}) {
    if (!maze.length || !maze[0].length || maze.some(row => row.length !== maze[0].length || /[^#.o ]/.test(row))) {
      throw new Error("The maze must be a rectangular grid of #, ., o and spaces.");
    }
    if (![playerStart, ...ghostStarts].every(start => isOpen(maze, start.x, start.y))) {
      throw new Error("All starting tiles must be open.");
    }
    this.initialMaze = maze.slice();
    this.playerStart = { ...playerStart };
    this.ghostStarts = ghostStarts.map(start => ({ ...start }));
    this.restart();
  }

  get ghostInterval() {
    return Math.max(0.135, 0.3 * 0.88 ** (this.level - 1));
  }

  get frightened() {
    return this.powerRemaining > 0;
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.maze = this.initialMaze.slice();
    this.remainingDots = countDots(this.maze);
    this.resetActors();
  }

  resetActors() {
    this.player = { ...this.playerStart };
    this.ghosts = this.ghostStarts.map(start => ({ ...start }));
    this.direction = null;
    this.nextDirection = null;
    this.powerRemaining = 0;
    this.playerClock = 0;
    this.ghostClock = 0;
  }

  setDirection(direction) {
    if (Object.hasOwn(DIRECTIONS, direction) && !this.gameOver) {
      this.nextDirection = direction;
    }
  }

  togglePause() {
    if (!this.gameOver) this.paused = !this.paused;
  }

  loseLife() {
    if (this.gameOver) return;
    this.lives -= 1;
    this.resetActors();
    if (this.lives === 0) {
      this.gameOver = true;
      this.paused = false;
    }
  }

  resolveCollisions() {
    for (const ghost of this.ghosts) {
      if (ghost.x !== this.player.x || ghost.y !== this.player.y) continue;
      if (!this.frightened) {
        this.loseLife();
        return true;
      }
      this.score += 200;
      const start = this.ghostStarts[this.ghosts.indexOf(ghost)];
      ghost.x = start.x;
      ghost.y = start.y;
    }
    return false;
  }

  nextLevel() {
    this.level += 1;
    this.maze = this.initialMaze.slice();
    this.remainingDots = countDots(this.maze);
    this.resetActors();
  }

  movePlayer() {
    if (this.gameOver || this.paused) return;
    const canMove = name => {
      const delta = DIRECTIONS[name];
      return delta && isOpen(this.maze, this.player.x + delta.x, this.player.y + delta.y);
    };
    if (canMove(this.nextDirection)) this.direction = this.nextDirection;
    let ate = false;
    if (canMove(this.direction)) {
      const delta = DIRECTIONS[this.direction];
      this.player.x += delta.x;
      this.player.y += delta.y;
      const { x, y } = this.player;
      const tile = this.maze[y][x];
      const points = pointsFor(tile);
      if (points) {
        this.score += points;
        this.remainingDots -= 1;
        this.maze[y] = this.maze[y].slice(0, x) + " " + this.maze[y].slice(x + 1);
        if (tile === "o") this.powerRemaining = POWER_SECONDS;
        ate = true;
      }
    }
    const died = this.resolveCollisions();
    if (ate && this.remainingDots === 0 && !this.gameOver) this.nextLevel();
    return died;
  }

  moveGhosts() {
    if (this.gameOver || this.paused) return;
    for (const ghost of this.ghosts) {
      Object.assign(ghost, ghostStep(this.maze, ghost, this.player, this.frightened));
      if (this.resolveCollisions()) return;
    }
  }

  update(seconds) {
    if (this.paused || this.gameOver || !Number.isFinite(seconds) || seconds <= 0) return;
    let remaining = seconds;
    // Process events chronologically, including power expiry, regardless of frame size.
    while (remaining > EPSILON && !this.gameOver) {
      const step = Math.min(
        remaining,
        PLAYER_INTERVAL - this.playerClock,
        this.ghostInterval - this.ghostClock,
        this.frightened ? this.powerRemaining : Infinity,
      );
      this.playerClock += step;
      this.ghostClock += step;
      this.powerRemaining = Math.max(0, this.powerRemaining - step);
      if (this.powerRemaining < EPSILON) this.powerRemaining = 0;
      remaining -= step;
      if (this.playerClock >= PLAYER_INTERVAL - EPSILON) {
        this.playerClock = 0;
        this.movePlayer();
      }
      if (this.ghostClock >= this.ghostInterval - EPSILON && !this.gameOver) {
        this.ghostClock = 0;
        this.moveGhosts();
      }
    }
  }
}

if (typeof module !== "undefined") module.exports = {
  MAZE, DIRECTIONS, PLAYER_START, GHOST_STARTS, PLAYER_INTERVAL, POWER_SECONDS,
  isOpen, pointsFor, countDots, ghostStep, Game,
};

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { wrap, splitRock, pointsFor, circlesCollide, Game } = require("./game.js");

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
const rock = (overrides = {}) => ({
  x: 40, y: 40, vx: 0, vy: 0, radius: 14, size: "small", angle: 0, spin: 0, ...overrides,
});
function quietGame() {
  const game = new Game(800, 600, () => 0.5);
  game.rocks = [rock()];
  return game;
}

test("wrap(-5, 10, 800, 600) → { x: 795, y: 10 }", () => {
  assert.deepEqual(wrap(-5, 10, 800, 600), { x: 795, y: 10 });
});
test("wrap(805, 610, 800, 600) → { x: 5, y: 10 }", () => {
  assert.deepEqual(wrap(805, 610, 800, 600), { x: 5, y: 10 });
});
test("a large rock → two medium", () => {
  const original = { x: 12, y: 34, size: "large" };
  const pieces = splitRock(original);
  assert.deepEqual(pieces.map(({ x, y, size }) => ({ x, y, size })), [
    { x: 12, y: 34, size: "medium" }, { x: 12, y: 34, size: "medium" },
  ]);
  assert.deepEqual(original, { x: 12, y: 34, size: "large" });
});
test("a medium rock → two small", () => {
  assert.deepEqual(splitRock({ x: 1, y: 2, size: "medium" }).map(piece => piece.size), ["small", "small"]);
});
test("a small rock → []", () => {
  assert.deepEqual(splitRock({ x: 1, y: 2, size: "small" }), []);
});
test("large → 20; medium → 50; small → 100", () => {
  assert.equal(pointsFor("large"), 20);
  assert.equal(pointsFor("medium"), 50);
  assert.equal(pointsFor("small"), 100);
});
test("({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 6 }) → true", () => {
  assert.equal(circlesCollide({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 6 }), true);
});
test("({ x: 0, y: 0, radius: 10 }, { x: 20, y: 0, radius: 5 }) → false", () => {
  assert.equal(circlesCollide({ x: 0, y: 0, radius: 10 }, { x: 20, y: 0, radius: 5 }), false);
});
test("wrapping handles multiple crossings and exact boundaries", () => {
  assert.deepEqual(wrap(-1605, 1810, 800, 600), { x: 795, y: 10 });
  assert.deepEqual(wrap(800, 600, 800, 600), { x: 0, y: 0 });
  assert.deepEqual(wrap(0, 0, 800, 600), { x: 0, y: 0 });
});
test("touching circles collide", () => {
  assert.equal(circlesCollide({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 5 }), true);
});
test("split pieces diverge with finite velocities, without mutating the parent", () => {
  const parent = rock({ size: "large", radius: 46, vx: 32, vy: -12 });
  const copy = { ...parent };
  const pieces = splitRock(parent);
  assert.notEqual(pieces[0].vx, pieces[1].vx);
  assert.notEqual(pieces[0].vy, pieces[1].vy);
  assert.ok(pieces.every(piece => Number.isFinite(piece.vx) && Number.isFinite(piece.vy) && piece.radius < parent.radius));
  assert.deepEqual(parent, copy);
});
test("new game has three lives, zero points, and four large rocks with varied speeds", () => {
  let seed = 9;
  const game = new Game(800, 600, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  assert.equal(game.lives, 3);
  assert.equal(game.score, 0);
  assert.equal(game.wave, 1);
  assert.equal(game.gameOver, false);
  assert.equal(game.rocks.length, 4);
  assert.ok(game.rocks.every(item => item.size === "large"));
  assert.ok(new Set(game.rocks.map(item => Math.hypot(item.vx, item.vy))).size > 1);
});
test("turning and thrust move the ship; friction slows it", () => {
  const game = quietGame();
  game.update(0.25, { right: true, thrust: true });
  assert.ok(game.ship.angle > -Math.PI / 2);
  assert.ok(game.ship.y < 300);
  assert.ok(game.ship.x > 400);
  const speed = Math.hypot(game.ship.vx, game.ship.vy);
  game.update(0.5);
  assert.ok(Math.hypot(game.ship.vx, game.ship.vy) < speed);
  const angle = game.ship.angle;
  game.update(0.1, { left: true });
  assert.ok(game.ship.angle < angle);
});
test("ship, bullets, and rocks wrap across screen edges", () => {
  const game = quietGame();
  game.ship.x = 799;
  game.ship.vx = 240;
  game.ship.y = 300;
  game.rocks = [rock({ x: 799, vx: 240 })];
  game.bullets = [{ x: 799, y: 200, vx: 500, vy: 0, radius: 2, life: 1 }];
  game.update(1 / 60);
  assert.ok(game.ship.x < 10);
  assert.ok(game.rocks[0].x < 10);
  assert.ok(game.bullets[0].x < 10);
});
test("holding fire never exceeds five bullets and bullets expire", () => {
  const game = quietGame();
  game.update(0.85, { shoot: true });
  assert.equal(game.bullets.length, 5);
  assert.equal(game.shoot(), false);
  game.update(1.2);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.shoot(), true);
});
test("shots originate ahead of the ship and inherit its velocity", () => {
  const game = quietGame();
  game.ship.vx = 20;
  assert.equal(game.shoot(), true);
  const bullet = game.bullets[0];
  close(bullet.x, game.ship.x);
  assert.ok(bullet.y < game.ship.y);
  close(bullet.vx, 20);
  assert.ok(bullet.vy < 0);
  assert.equal(game.shoot(), false);
});
for (const [size, points, children] of [["large", 20, 2], ["medium", 50, 2], ["small", 100, 0]]) {
  test(`a bullet hitting a ${size} rock is consumed, scores ${points}, and produces ${children} pieces`, () => {
    const game = quietGame();
    game.rocks.push(rock({ x: 200, y: 200, size }));
    game.bullets = [{ x: 200, y: 200, vx: 0, vy: 0, radius: 2, life: 1 }];
    game.update(1 / 120);
    assert.equal(game.score, points);
    assert.equal(game.bullets.length, 0);
    assert.equal(game.rocks.length, 1 + children);
    if (children) assert.ok(game.rocks.slice(1).every(item => item.size === (size === "large" ? "medium" : "small")));
  });
}
test("a bullet cannot destroy two overlapping rocks", () => {
  const game = quietGame();
  game.rocks.push(rock({ x: 200, y: 200 }), rock({ x: 200, y: 200 }));
  game.bullets = [{ x: 200, y: 200, vx: 0, vy: 0, radius: 2, life: 1 }];
  game.update(1 / 120);
  assert.equal(game.score, 100);
  assert.equal(game.rocks.length, 2);
});
test("collisions also work across the wrapping seam", () => {
  const game = quietGame();
  game.rocks.push(rock({ x: 798, y: 200 }));
  game.bullets = [{ x: 2, y: 200, vx: 0, vy: 0, radius: 2, life: 1 }];
  game.update(1 / 120);
  assert.equal(game.score, 100);
});
test("a ship collision costs one life and respawns with temporary protection", () => {
  const game = quietGame();
  game.invulnerable = 0;
  game.rocks = [rock({ x: game.ship.x, y: game.ship.y })];
  game.update(1 / 120);
  assert.equal(game.lives, 2);
  assert.ok(game.invulnerable > 0);
  game.update(0.2);
  assert.equal(game.lives, 2);
  game.rocks = [rock()];
  game.update(2.5);
  close(game.invulnerable, 0);
});
test("the game is over when the last life is lost; the simulation then freezes", () => {
  const game = quietGame();
  game.lives = 1;
  game.invulnerable = 0;
  game.rocks = [rock({ x: game.ship.x, y: game.ship.y })];
  game.update(1 / 120);
  assert.equal(game.lives, 0);
  assert.equal(game.gameOver, true);
  const snapshot = JSON.stringify(game);
  game.update(1, { thrust: true, shoot: true });
  assert.equal(JSON.stringify(game), snapshot);
  assert.equal(game.shoot(), false);
});
test("clearing the last rock starts a new wave with one more large rock", () => {
  const game = quietGame();
  game.rocks = [rock({ x: 200, y: 200 })];
  game.bullets = [{ x: 200, y: 200, vx: 0, vy: 0, radius: 2, life: 1 }];
  game.update(1 / 120);
  assert.equal(game.score, 100);
  assert.equal(game.wave, 2);
  assert.equal(game.rocks.length, 5);
  assert.ok(game.rocks.every(item => item.size === "large"));
  game.rocks = [];
  game.update(1 / 120);
  assert.equal(game.wave, 3);
  assert.equal(game.rocks.length, 6);
});
test("pause freezes all rules and resume continues", () => {
  const game = quietGame();
  game.togglePause();
  const snapshot = JSON.stringify(game);
  game.update(5, { right: true, thrust: true, shoot: true });
  assert.equal(JSON.stringify(game), snapshot);
  assert.equal(game.shoot(), false);
  game.togglePause();
  game.update(0.1, { thrust: true });
  assert.ok(game.ship.y < 300);
});
test("restart resets score, lives, wave, bullets, and game-over/pause state", () => {
  const game = quietGame();
  game.score = 500;
  game.wave = 3;
  game.lives = 0;
  game.gameOver = true;
  game.paused = true;
  game.restart();
  assert.equal(game.score, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.wave, 1);
  assert.equal(game.gameOver, false);
  assert.equal(game.paused, false);
  assert.equal(game.bullets.length, 0);
  assert.equal(game.rocks.length, 4);
});
test("movement and firing are independent of rendering frame rate", () => {
  const games = [quietGame(), quietGame(), quietGame()];
  const controls = { thrust: true, right: true, shoot: true };
  games[0].update(1, controls);
  for (let i = 0; i < 60; i++) games[1].update(1 / 60, controls);
  for (let i = 0; i < 144; i++) games[2].update(1 / 144, controls);
  for (const game of games.slice(1)) {
    for (const key of ["x", "y", "vx", "vy", "angle"]) close(game.ship[key], games[0].ship[key]);
    assert.equal(game.bullets.length, games[0].bullets.length);
    game.bullets.forEach((bullet, i) => {
      close(bullet.x, games[0].bullets[i].x);
      close(bullet.y, games[0].bullets[i].y);
      close(bullet.life, games[0].bullets[i].life);
    });
  }
});
test("resize keeps every object on screen and preserves relative positions", () => {
  const game = quietGame();
  game.shoot();
  game.resize(400, 300);
  close(game.ship.x, 200);
  close(game.ship.y, 150);
  close(game.rocks[0].x, 20);
  for (const item of [game.ship, ...game.rocks, ...game.bullets]) {
    assert.ok(item.x >= 0 && item.x < 400 && item.y >= 0 && item.y < 300);
  }
});
test("invalid time is ignored and invalid dimensions are rejected", () => {
  const game = quietGame();
  const snapshot = JSON.stringify(game);
  for (const delta of [-1, NaN, Infinity, 0]) game.update(delta);
  assert.equal(JSON.stringify(game), snapshot);
  assert.throws(() => game.resize(0, 600), RangeError);
  assert.throws(() => new Game(NaN, 600), RangeError);
});
test("game.js also loads as a plain browser script without module or DOM globals", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve("./game.js"), "utf8"), context);
  assert.equal(vm.runInContext("new Game(800, 600).lives", context), 3);
  assert.equal(vm.runInContext("wrap(-5, 10, 800, 600).x", context), 795);
});

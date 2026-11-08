const { test } = require("node:test");
const assert = require("node:assert");
const {
  EYE_HEIGHT,
  MOVE_SPEED,
  TURN_RATE,
  wrapAngle,
  toCamera,
  project,
  clipToNear,
  focalLength,
  segmentToScreen,
  driveTank,
  gridSegments,
  createObstacles,
  obstacleSegments,
  TANK_RADIUS,
  HORIZON_RADIUS,
  circlesHit,
  obstacleHitsCircle,
  driveTankWithCollisions,
  mountainSegments,
  moonSegments,
  turnTowards,
  tankModelSegments,
  shellSegments,
  crackPattern,
  advanceShell,
  obstacleBlocksShell,
  createGame,
  stepGame,
  SHELL_SPEED,
  SHELL_RANGE,
  SHELL_HEIGHT,
  ENEMY_RADIUS,
  ENEMY_SPEED,
  ENEMY_STANDOFF,
  ENEMY_RELOAD,
  ENEMY_SPAWN_MIN,
  ENEMY_SPAWN_MAX,
  FIRE_CONE,
  ENEMY_SCORE,
  START_LIVES,
  CRACK_SECONDS,
  WAVE_SIZE,
  WAVE_MIN_RELOAD,
  RADAR_RANGE,
  enemyTuning,
  waveIndex,
  togglePause,
  radarPosition,
  enemyWarning,
} = require("./engine.js");

const TOLERANCE = 1e-9;
const FRAME = 1 / 60;
const TAU = Math.PI * 2;

function assertNear(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) <= TOLERANCE,
    `expected ${expected}, got ${actual}`
  );
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

const NO_INPUT = { throttle: 0, steer: 0, fire: false };
const FIRE = { throttle: 0, steer: 0, fire: true };

function assertClose(actual, expected) {
  for (const key of Object.keys(expected)) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= TOLERANCE,
      `${key}: expected ${expected[key]}, got ${actual[key]}`
    );
  }
}

test("toCamera moves the point by the camera position and turns it by the heading", () => {
  assert.deepStrictEqual(
    toCamera({ x: 5, y: 0, z: 10 }, { x: 1, z: 2, heading: 0 }),
    { x: 4, y: 0, z: 8 }
  );
});

test("toCamera turns a quarter turn to the right", () => {
  assertClose(
    toCamera({ x: 5, y: 1, z: 0 }, { x: 0, z: 0, heading: Math.PI / 2 }),
    { x: 0, y: 1, z: 5 }
  );
});

test("toCamera turns a point straight ahead onto the side after a quarter turn", () => {
  assertClose(
    toCamera({ x: 0, y: 0, z: 5 }, { x: 0, z: 0, heading: Math.PI / 2 }),
    { x: -5, y: 0, z: 0 }
  );
});

test("project maps a camera-space point onto the screen", () => {
  assert.deepStrictEqual(project({ x: 2, y: 1, z: 4 }, 200, 640, 480), { x: 420, y: 190 });
});

test("project maps points below and left of the centre", () => {
  assert.deepStrictEqual(project({ x: -3, y: -2, z: 10 }, 300, 800, 600), { x: 310, y: 360 });
});

test("project returns null at or behind the near plane", () => {
  assert.strictEqual(project({ x: 0, y: 0, z: 0 }, 200, 640, 480), null);
});

test("clipToNear keeps a segment that crosses the near plane, cut at the plane", () => {
  assert.deepStrictEqual(
    clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 3 }, 1),
    [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 3 }]
  );
});

test("clipToNear cuts the end that is behind the near plane", () => {
  assert.deepStrictEqual(
    clipToNear({ x: 4, y: 2, z: 5 }, { x: 0, y: 0, z: -3 }, 1),
    [{ x: 4, y: 2, z: 5 }, { x: 2, y: 1, z: 1 }]
  );
});

test("clipToNear drops a segment that is entirely behind the near plane", () => {
  assert.strictEqual(clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0.5 }, 1), null);
});

test("wrapAngle wraps 3π/2 to -π/2", () => {
  assert.strictEqual(wrapAngle(3 * Math.PI / 2), -Math.PI / 2);
});

test("wrapAngle wraps -3π/2 to π/2", () => {
  assert.strictEqual(wrapAngle(-3 * Math.PI / 2), Math.PI / 2);
});

test("wrapAngle keeps π as π", () => {
  assert.strictEqual(wrapAngle(Math.PI), Math.PI);
});

test("wrapAngle maps -π to π", () => {
  assert.strictEqual(wrapAngle(-Math.PI), Math.PI);
});

test("wrapAngle keeps an angle already in range", () => {
  assert.strictEqual(wrapAngle(0.5), 0.5);
});

test("wrapAngle wraps 5π to π", () => {
  assert.strictEqual(wrapAngle(5 * Math.PI), Math.PI);
});

test("focalLength gives 1 for a 90 degree field of view at height 2", () => {
  assert.ok(Math.abs(focalLength(2, 90) - 1) <= TOLERANCE);
});

test("segmentToScreen puts a level segment at eye height below the horizon", () => {
  const line = segmentToScreen(
    { x: -1, y: 0, z: 10 },
    { x: 1, y: 0, z: 10 },
    { x: 0, z: 0, heading: 0 },
    200,
    640,
    480
  );
  assert.strictEqual(line.from.x, 320 - 20);
  assert.strictEqual(line.to.x, 320 + 20);
  assert.ok(Math.abs(line.from.y - (240 + (EYE_HEIGHT * 200) / 10)) <= TOLERANCE);
});

test("segmentToScreen returns null for a segment entirely behind the camera", () => {
  const line = segmentToScreen(
    { x: 0, y: 0, z: -5 },
    { x: 1, y: 0, z: -6 },
    { x: 0, z: 0, heading: 0 },
    200,
    640,
    480
  );
  assert.strictEqual(line, null);
});

test("driveTank moves forward along the heading in proportion to the time step", () => {
  const next = driveTank({ x: 0, z: 0, heading: 0 }, { throttle: 1, steer: 0 }, 0.5);
  assertClose(next, { x: 0, z: MOVE_SPEED * 0.5, heading: 0 });
});

test("driveTank moves backwards with negative throttle", () => {
  const next = driveTank({ x: 0, z: 0, heading: 0 }, { throttle: -1, steer: 0 }, 1);
  assertClose(next, { x: 0, z: -MOVE_SPEED, heading: 0 });
});

test("driveTank turns right when steering right, increasing the heading", () => {
  const next = driveTank({ x: 3, z: 4, heading: 0.2 }, { throttle: 0, steer: 1 }, 0.25);
  assertClose(next, { x: 3, z: 4, heading: 0.2 + TURN_RATE * 0.25 });
});

test("driveTank moves towards +x when facing a quarter turn to the right", () => {
  const next = driveTank({ x: 0, z: 0, heading: Math.PI / 2 }, { throttle: 1, steer: 0 }, 1);
  assertClose(next, { x: MOVE_SPEED, z: 0, heading: Math.PI / 2 });
});

test("driveTank wraps the heading into the -π to π range", () => {
  const next = driveTank({ x: 0, z: 0, heading: Math.PI - 0.01 }, { throttle: 0, steer: 1 }, 0.1);
  assert.ok(next.heading < 0 && next.heading > -Math.PI, `heading ${next.heading}`);
});

test("driveTank leaves the camera still with no input", () => {
  const camera = { x: 2, z: -7, heading: 1 };
  assert.deepStrictEqual(driveTank(camera, { throttle: 0, steer: 0 }, 0.3), camera);
});

test("gridSegments lays lines on multiples of the grid spacing at ground level", () => {
  const segments = gridSegments({ x: 3, z: 14, heading: 0 });
  assert.ok(segments.length > 0);
  for (const [a, b] of segments) {
    assert.strictEqual(a.y, 0);
    assert.strictEqual(b.y, 0);
    const fixed = a.x === b.x ? a.x : a.z;
    assert.ok(Number.isInteger(fixed / 10), `line at ${fixed} is off the grid`);
  }
});

test("createObstacles returns the requested number of cubes and pyramids clear of the start", () => {
  const obstacles = createObstacles(24, 1337, 12, 110);
  assert.strictEqual(obstacles.length, 24);
  for (const o of obstacles) {
    assert.ok(Math.hypot(o.x, o.z) >= 12, `too close to start: ${Math.hypot(o.x, o.z)}`);
    assert.ok(o.kind === "cube" || o.kind === "pyramid");
  }
  assert.ok(obstacles.some((o) => o.kind === "cube"));
  assert.ok(obstacles.some((o) => o.kind === "pyramid"));
});

test("createObstacles is repeatable for the same seed", () => {
  assert.deepStrictEqual(createObstacles(5, 42, 0, 50), createObstacles(5, 42, 0, 50));
});

test("obstacleSegments draws a cube as its 12 edges", () => {
  const edges = obstacleSegments({ kind: "cube", x: 0, z: 0, size: 4 });
  assert.strictEqual(edges.length, 12);
  const top = edges.flat().map((p) => p.y);
  assert.strictEqual(Math.min(...top), 0);
  assert.strictEqual(Math.max(...top), 4);
});

test("obstacleSegments draws a pyramid with a base and four sloping edges to the apex", () => {
  const edges = obstacleSegments({ kind: "pyramid", x: 0, z: 0, size: 4 });
  assert.strictEqual(edges.length, 8);
  const apexEdges = edges.filter(([a, b]) => a.y > 0 || b.y > 0);
  assert.strictEqual(apexEdges.length, 4);
  assert.strictEqual(Math.max(...edges.flat().map((p) => p.y)), 6);
});

test("circlesHit reports circles that touch or overlap", () => {
  assert.strictEqual(circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 4 }), true);
});

test("circlesHit reports circles that are apart", () => {
  assert.strictEqual(circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 3.9 }), false);
});

test("obstacleHitsCircle reports a circle whose centre is inside the footprint", () => {
  const cube = { kind: "cube", x: 0, z: 0, size: 4 };
  assert.strictEqual(obstacleHitsCircle(cube, { x: 1, z: -1, r: 0.5 }), true);
});

test("obstacleHitsCircle reports a circle clear of the footprint as free", () => {
  const cube = { kind: "cube", x: 0, z: 0, size: 4 };
  assert.strictEqual(obstacleHitsCircle(cube, { x: 4, z: 0, r: 1.5 }), false);
});

test("obstacleHitsCircle measures to the nearest corner, not the centre", () => {
  const cube = { kind: "cube", x: 0, z: 0, size: 4 };
  assert.strictEqual(obstacleHitsCircle(cube, { x: 2.5, z: 2.5, r: 1 }), true);
  assert.strictEqual(obstacleHitsCircle(cube, { x: 3, z: 3, r: 1 }), false);
});

test("driveTankWithCollisions with no obstacles drives exactly as driveTank does", () => {
  const camera = { x: 1, z: 2, heading: 0.4 };
  const controls = { throttle: 1, steer: -1 };
  assertClose(
    driveTankWithCollisions(camera, controls, 0.2, []),
    driveTank(camera, controls, 0.2)
  );
});

test("driveTankWithCollisions stops the tank against the face of a cube", () => {
  const cube = { kind: "cube", x: 0, z: 10, size: 4 };
  let camera = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < 300; i++) {
    camera = driveTankWithCollisions(camera, { throttle: 1, steer: 0 }, FRAME, [cube]);
  }
  const stop = 10 - 2 - TANK_RADIUS;
  assert.ok(camera.z <= stop + TOLERANCE, `drove into the cube: z ${camera.z}`);
  assert.ok(camera.z > stop - MOVE_SPEED * FRAME, `stopped short: z ${camera.z}`);
  assert.strictEqual(camera.x, 0);
});

test("driveTankWithCollisions lets the tank slide along a wall it meets at an angle", () => {
  const wall = { kind: "cube", x: 0, z: 30, size: 40 };
  let camera = { x: -5, z: 0, heading: Math.PI / 4 };
  for (let i = 0; i < 120; i++) {
    camera = driveTankWithCollisions(camera, { throttle: 1, steer: 0 }, FRAME, [wall]);
  }
  assert.ok(camera.z <= 10 - TANK_RADIUS + TOLERANCE, `went through the wall: z ${camera.z}`);
  assert.ok(camera.z > 10 - TANK_RADIUS - MOVE_SPEED * FRAME, `stopped short: z ${camera.z}`);
  assert.ok(camera.x > 5, `did not slide along the wall: x ${camera.x}`);
});

test("driveTankWithCollisions lets the tank turn while touching an obstacle", () => {
  const cube = { kind: "cube", x: 0, z: 10, size: 4 };
  const next = driveTankWithCollisions({ x: 0, z: 8.4, heading: 0 }, { throttle: 0, steer: 1 }, 0.5, [cube]);
  assert.ok(Math.abs(next.heading - TURN_RATE * 0.5) <= TOLERANCE);
  assert.strictEqual(next.z, 8.4);
});

function horizonValues(segments, axis) {
  return segments.flat().map((p) => p[axis]);
}

test("mountainSegments stay the same distance from the tank as it drives", () => {
  for (const camera of [{ x: 0, z: 0, heading: 0 }, { x: 40, z: -30, heading: 0.7 }]) {
    for (const [a, b] of mountainSegments(camera)) {
      for (const p of [a, b]) {
        const distance = Math.hypot(p.x - camera.x, p.z - camera.z);
        assert.ok(Math.abs(distance - HORIZON_RADIUS) <= TOLERANCE, `distance ${distance}`);
      }
    }
  }
});

test("mountainSegments move sideways in the view when the tank turns", () => {
  const ridge = mountainSegments({ x: 0, z: 0, heading: 0 })[0][0];
  const before = toCamera(ridge, { x: 0, z: 0, heading: 0 });
  const after = toCamera(ridge, { x: 0, z: 0, heading: 0.2 });
  assert.ok(Math.abs(before.x - after.x) > 1, "the ridge did not shift when turning");
});

test("mountainSegments form a closed jagged ridge at varying heights", () => {
  const segments = mountainSegments({ x: 0, z: 0, heading: 0 });
  assert.deepStrictEqual(segments[segments.length - 1][1], segments[0][0]);
  const heights = new Set(horizonValues(segments, "y"));
  assert.ok(heights.size > 10, `only ${heights.size} distinct heights`);
});

test("moonSegments hang above the mountain ridge", () => {
  const camera = { x: 0, z: 0, heading: 0 };
  const moonLowest = Math.min(...horizonValues(moonSegments(camera), "y"));
  const ridgeHighest = Math.max(...horizonValues(mountainSegments(camera), "y"));
  assert.ok(moonLowest > ridgeHighest, `moon ${moonLowest} is not above ridge ${ridgeHighest}`);
});

test("moonSegments keep the same height when the tank drives", () => {
  const near = horizonValues(moonSegments({ x: 0, z: 0, heading: 0 }), "y");
  const far = horizonValues(moonSegments({ x: 90, z: -60, heading: 0 }), "y");
  assert.deepStrictEqual(far, near);
});

test("turnTowards turns by at most maxTurn towards a target on the right", () => {
  assertNear(turnTowards(0, { x: 0, z: 0 }, { x: 10, z: 0 }, 0.5), 0.5);
});

test("turnTowards turns left towards a target on the left", () => {
  assertNear(turnTowards(0, { x: 0, z: 0 }, { x: -10, z: 0 }, 0.5), -0.5);
});

test("turnTowards reaches the bearing of the target when maxTurn is large enough", () => {
  assertNear(turnTowards(0, { x: 0, z: 0 }, { x: 10, z: 0 }, 2), Math.PI / 2);
});

test("turnTowards keeps the heading when the tank already faces the target", () => {
  const to = { x: 1 + Math.sin(0.3) * 5, z: 2 + Math.cos(0.3) * 5 };
  assertNear(turnTowards(0.3, { x: 1, z: 2 }, to, 0.1), 0.3);
});

test("turnTowards crosses the ±π boundary by the short way and wraps the result", () => {
  const to = { x: Math.sin(-3.1) * 10, z: Math.cos(-3.1) * 10 };
  assertNear(turnTowards(3.1, { x: 0, z: 0 }, to, 0.05), 3.15 - TAU);
});

test("advanceShell flies straight ahead at the shell speed", () => {
  const start = { x: 0, y: SHELL_HEIGHT, z: 0, heading: 0, travelled: 0 };
  const result = advanceShell(start, 0.5, [], null);
  assert.strictEqual(result.hit, null);
  assertNear(result.shell.z, SHELL_SPEED * 0.5);
  assertNear(result.shell.x, 0);
  assertNear(result.shell.travelled, SHELL_SPEED * 0.5);
});

test("advanceShell stops the shell at 200 metres, so a target beyond that is not hit", () => {
  const start = { x: 0, y: SHELL_HEIGHT, z: 0, heading: 0, travelled: 0 };
  const result = advanceShell(start, 5, [], { x: 0, z: 210, r: 1.5 });
  assert.strictEqual(result.hit, "range");
  assert.strictEqual(result.shell, null);
});

test("advanceShell stops against the face of a cube", () => {
  const start = { x: 0, y: SHELL_HEIGHT, z: 0, heading: 0, travelled: 0 };
  const cube = { kind: "cube", x: 0, z: 20, size: 4 };
  const result = advanceShell(start, 0.5, [cube], null);
  assert.strictEqual(result.hit, "obstacle");
  assert.strictEqual(result.shell, null);
});

test("obstacleBlocksShell passes a shell over a pyramid's narrow top but not its base", () => {
  const pyramid = { kind: "pyramid", x: 0, z: 0, size: 3 };
  assert.strictEqual(obstacleBlocksShell(pyramid, { x: 0.5, y: SHELL_HEIGHT, z: 0 }), true);
  assert.strictEqual(obstacleBlocksShell(pyramid, { x: 1.5, y: SHELL_HEIGHT, z: 0 }), false);
  assert.strictEqual(obstacleBlocksShell(pyramid, { x: 0, y: 5, z: 0 }), false);
});

test("advanceShell stops the shell on a target it reaches", () => {
  const start = { x: 0, y: SHELL_HEIGHT, z: 0, heading: 0, travelled: 0 };
  const result = advanceShell(start, 1, [], { x: 0, z: 30, r: 1.5 });
  assert.strictEqual(result.hit, "target");
  assert.strictEqual(result.shell, null);
});

test("createGame starts with no shell, full lives, no score and one enemy at a distance", () => {
  const game = createGame([], 99);
  assert.strictEqual(game.shell, null);
  assert.strictEqual(game.score, 0);
  assert.strictEqual(game.lives, START_LIVES);
  assert.strictEqual(game.over, false);
  const distance = distanceBetween(game.tank, game.enemy);
  assert.ok(distance >= ENEMY_SPAWN_MIN && distance <= ENEMY_SPAWN_MAX, `distance ${distance}`);
});

test("stepGame ignores a second fire press while a shell is still flying", () => {
  const game = createGame([], 3);
  const first = stepGame(game, FIRE, 0.01);
  const second = stepGame(first, FIRE, 0.01);
  assertNear(second.shell.travelled, SHELL_SPEED * 0.02);
});

test("stepGame scores 1000 when a shell hits the enemy and then spawns the next enemy", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 20, heading: Math.PI, reload: 0, shell: null } };
  const next = stepGame(game, FIRE, 0.125);
  assert.strictEqual(next.score, ENEMY_SCORE);
  assert.strictEqual(next.shell, null);
  assert.strictEqual(next.lives, START_LIVES);
  const distance = distanceBetween(next.tank, next.enemy);
  assert.ok(distance >= ENEMY_SPAWN_MIN && distance <= ENEMY_SPAWN_MAX, `distance ${distance}`);
});

test("stepGame turns an enemy towards the player by at most its turn rate", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 30, heading: 0, reload: ENEMY_RELOAD, shell: null } };
  const next = stepGame(game, NO_INPUT, 0.1);
  assertNear(next.enemy.heading, 0.09);
  assert.strictEqual(next.enemy.shell, null);
});

test("stepGame drives an enemy closer until it reaches its standoff distance, then holds", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 200, heading: Math.PI, reload: ENEMY_RELOAD, shell: null } };
  const closer = stepGame(game, NO_INPUT, 1);
  assertNear(closer.enemy.z, 200 - ENEMY_SPEED);
  const arrived = stepGame(closer, NO_INPUT, 100);
  assertNear(arrived.enemy.z, ENEMY_STANDOFF);
  const held = stepGame(arrived, NO_INPUT, 1);
  assertNear(held.enemy.z, ENEMY_STANDOFF);
});

test("stepGame fires an enemy shell when the player is straight ahead of it", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 30, heading: Math.PI, reload: 0, shell: null } };
  const next = stepGame(game, NO_INPUT, 0.01);
  assert.ok(next.enemy.shell, "expected a shell");
  assert.strictEqual(next.enemy.reload, ENEMY_RELOAD);
});

test("stepGame does not fire an enemy shell while the player is off to the side", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 30, heading: 0, reload: 0, shell: null } };
  const next = stepGame(game, NO_INPUT, 0.01);
  assert.strictEqual(next.enemy.shell, null);
});

test("an enemy shell that reaches the player costs one life and cracks the screen", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 30, heading: Math.PI, reload: 0, shell: null } };
  const fired = stepGame(game, NO_INPUT, 0.01);
  const hit = stepGame(fired, NO_INPUT, 0.2);
  assert.strictEqual(hit.lives, START_LIVES - 1);
  assert.strictEqual(hit.crack, CRACK_SECONDS);
  assert.strictEqual(hit.enemy.shell, null);
  assert.strictEqual(hit.over, false);
});

test("the cracked-glass effect fades with time", () => {
  const game = { ...createGame([], 1), crack: CRACK_SECONDS };
  assertNear(stepGame(game, NO_INPUT, 0.5).crack, CRACK_SECONDS - 0.5);
});

test("the game is over after the last life is lost and then stops changing", () => {
  const game = {
    ...createGame([], 1),
    lives: 1,
    enemy: { x: 0, z: 30, heading: Math.PI, reload: 0, shell: null },
  };
  const fired = stepGame(game, NO_INPUT, 0.01);
  const over = stepGame(fired, NO_INPUT, 0.2);
  assert.strictEqual(over.lives, 0);
  assert.strictEqual(over.over, true);
  assert.strictEqual(stepGame(over, FIRE, 0.5), over);
});

test("tankModelSegments draws a tank from 49 wireframe edges, with the barrel 5 metres forward", () => {
  const segments = tankModelSegments({ x: 0, z: 0, heading: 0 });
  assert.strictEqual(segments.length, 49);
  assertNear(Math.max(...segments.flat().map((p) => p.z)), 5);
});

test("tankModelSegments turns with the tank's heading", () => {
  const segments = tankModelSegments({ x: 0, z: 0, heading: Math.PI / 2 });
  assertNear(Math.max(...segments.flat().map((p) => p.x)), 5);
});

test("shellSegments draws a short trail behind the shell", () => {
  const segments = shellSegments({ x: 0, y: 1.5, z: 10, heading: 0, travelled: 0 });
  assert.strictEqual(segments.length, 1);
  assertClose(segments[0][0], { x: 0, y: 1.5, z: 7 });
  assertClose(segments[0][1], { x: 0, y: 1.5, z: 10 });
});

test("crackPattern is the same for the same seed and keeps its lines inside the screen", () => {
  const lines = crackPattern(5, 12);
  assert.deepStrictEqual(crackPattern(5, 12), lines);
  assert.strictEqual(lines.length, 12);
  for (const line of lines) {
    assert.ok(line.length >= 2);
    for (const p of line) {
      assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1, `point outside screen: ${p.x}, ${p.y}`);
    }
  }
});

function shotThatKillsEnemy(destroyed) {
  return {
    ...createGame([], 1),
    destroyed,
    shell: { x: 0, y: SHELL_HEIGHT, z: 8.6, heading: 0, travelled: 0 },
    enemy: { x: 0, z: 10, heading: 0, reload: ENEMY_RELOAD, shell: null },
  };
}

test("the game is over only when the last of three lives is lost", () => {
  let game = createGame([], 1);
  for (let hit = 1; hit <= START_LIVES; hit++) {
    game = { ...game, enemy: { x: 0, z: 30, heading: Math.PI, reload: 0, shell: null } };
    game = stepGame(stepGame(game, NO_INPUT, 0.01), NO_INPUT, 0.2);
    assert.strictEqual(game.lives, START_LIVES - hit);
    assert.strictEqual(game.over, hit === START_LIVES);
  }
  assert.strictEqual(stepGame(game, FIRE, 0.5), game);
});

test("waveIndex moves on after every five enemies destroyed", () => {
  assert.strictEqual(waveIndex({ destroyed: 0 }), 0);
  assert.strictEqual(waveIndex({ destroyed: WAVE_SIZE - 1 }), 0);
  assert.strictEqual(waveIndex({ destroyed: WAVE_SIZE }), 1);
  assert.strictEqual(waveIndex({ destroyed: 2 * WAVE_SIZE }), 2);
});

test("enemyTuning is the base enemy in the first wave and gets faster and quicker to fire after", () => {
  assert.strictEqual(enemyTuning(0).speed, ENEMY_SPEED);
  assert.strictEqual(enemyTuning(0).reload, ENEMY_RELOAD);
  assert.ok(enemyTuning(1).speed > enemyTuning(0).speed);
  assert.ok(enemyTuning(1).reload < enemyTuning(0).reload);
  assert.ok(enemyTuning(2).speed > enemyTuning(1).speed);
  assert.ok(enemyTuning(2).reload < enemyTuning(1).reload);
});

test("enemyTuning never lets the reload fall below its minimum", () => {
  assert.strictEqual(enemyTuning(50).reload, WAVE_MIN_RELOAD);
});

test("the fifth kill starts the next wave, so the enemy after it is spawned with the faster reload", () => {
  const fourth = stepGame(shotThatKillsEnemy(WAVE_SIZE - 2), NO_INPUT, 0.001);
  assert.strictEqual(fourth.destroyed, WAVE_SIZE - 1);
  assertNear(fourth.enemy.reload, ENEMY_RELOAD - 0.001);
  const fifth = stepGame(shotThatKillsEnemy(WAVE_SIZE - 1), NO_INPUT, 0.001);
  assert.strictEqual(fifth.destroyed, WAVE_SIZE);
  assertNear(fifth.enemy.reload, enemyTuning(1).reload - 0.001);
});

test("in a later wave the enemy closes in at the faster speed", () => {
  const game = {
    ...createGame([], 1),
    destroyed: WAVE_SIZE,
    enemy: { x: 0, z: 200, heading: Math.PI, reload: ENEMY_RELOAD, shell: null },
  };
  const moved = stepGame(game, NO_INPUT, 0.5);
  assertNear(moved.enemy.z, 200 - enemyTuning(1).speed * 0.5);
});

test("a kill raises the high score, and it never drops when the score is lower", () => {
  const killed = stepGame(shotThatKillsEnemy(0), NO_INPUT, 0.001);
  assert.strictEqual(killed.highScore, ENEMY_SCORE);
  const lower = { ...shotThatKillsEnemy(0), highScore: 5000 };
  assert.strictEqual(stepGame(lower, NO_INPUT, 0.001).highScore, 5000);
});

test("a new game keeps the high score it was given and starts with a score of zero", () => {
  const next = createGame([], 2, 4000);
  assert.strictEqual(next.highScore, 4000);
  assert.strictEqual(next.score, 0);
  assert.strictEqual(createGame([], 2).highScore, 0);
});

test("togglePause pauses the game, so stepGame changes nothing until it is resumed", () => {
  const paused = togglePause(createGame([], 1));
  assert.strictEqual(paused.paused, true);
  assert.strictEqual(stepGame(paused, { throttle: 1, steer: 0, fire: true }, 1), paused);
  const resumed = togglePause(paused);
  assert.strictEqual(resumed.paused, false);
  assert.ok(stepGame(resumed, { throttle: 1, steer: 0, fire: false }, 1).tank.z > 0);
});

test("togglePause does nothing once the game is over", () => {
  const over = { ...createGame([], 1), over: true };
  assert.strictEqual(togglePause(over), over);
});

test("radarPosition puts an enemy straight ahead at the top of the radar, scaled by the radar range", () => {
  const at = radarPosition({ x: 0, z: 0, heading: 0 }, { x: 0, z: 100 });
  assertNear(at.x, 0);
  assertNear(at.y, 100 / RADAR_RANGE);
});

test("radarPosition turns with the player's heading", () => {
  const at = radarPosition({ x: 0, z: 0, heading: Math.PI / 2 }, { x: 100, z: 0 });
  assertNear(at.x, 0);
  assertNear(at.y, 100 / RADAR_RANGE);
});

test("radarPosition puts an enemy on the right at positive x", () => {
  const at = radarPosition({ x: 0, z: 0, heading: 0 }, { x: 100, z: 0 });
  assertNear(at.x, 100 / RADAR_RANGE);
  assertNear(at.y, 0);
});

test("radarPosition pins an enemy beyond the radar range to the rim", () => {
  const at = radarPosition({ x: 0, z: 0, heading: 0 }, { x: 0, z: -1000 });
  assertNear(at.x, 0);
  assertNear(at.y, -1);
});

test("enemyWarning is silent while the enemy is ahead", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: 100, heading: 0, reload: 0, shell: null } };
  assert.strictEqual(enemyWarning(game), null);
});

test("enemyWarning says the enemy is behind when it is directly behind the player", () => {
  const game = { ...createGame([], 1), enemy: { x: 0, z: -100, heading: 0, reload: 0, shell: null } };
  assert.strictEqual(enemyWarning(game), "ENEMY BEHIND YOU");
});

test("enemyWarning says which side the enemy is on when it is to the side", () => {
  const right = { ...createGame([], 1), enemy: { x: 100, z: 0, heading: 0, reload: 0, shell: null } };
  const left = { ...createGame([], 1), enemy: { x: -100, z: 0, heading: 0, reload: 0, shell: null } };
  assert.strictEqual(enemyWarning(right), "ENEMY ON YOUR RIGHT");
  assert.strictEqual(enemyWarning(left), "ENEMY ON YOUR LEFT");
});

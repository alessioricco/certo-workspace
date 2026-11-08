const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const {
  toCamera, project, clipToNear, wrapAngle, moveTank,
  createWorld, groundLines, modelLines, projectLine,
  DRIVE_SPEED, REVERSE_SPEED, TURN_SPEED, NEAR, TANK_RADIUS,
  circlesHit, projectSkyLine, turnTowards, createShell, moveShell,
  spawnEnemy, updateEnemy, createGame, updateGame, tankLines,
  SHELL_SPEED, SHELL_RANGE, ENEMY_SPEED, ENEMY_TURN_SPEED,
  ENEMY_FIRE_ANGLE, ENEMY_COOLDOWN, COMBAT_STEP, DAMAGE_DURATION,
  waveDifficulty, radarContact, isGameOver, RADAR_RANGE, RADAR_PERIOD,
} = require('./engine.js');

function close(actual, expected) {
  for (const key of Object.keys(expected)) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= 1e-9,
      `${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
}

test('toCamera({ x: 5, y: 0, z: 10 }, { x: 1, z: 2, heading: 0 }) → { x: 4, y: 0, z: 8 }', () => {
  assert.deepEqual(toCamera({ x: 5, y: 0, z: 10 }, { x: 1, z: 2, heading: 0 }), { x: 4, y: 0, z: 8 });
});

test('toCamera({ x: 5, y: 1, z: 0 }, { x: 0, z: 0, heading: Math.PI / 2 }) → { x: 0, y: 1, z: 5 } within 1e-9', () => {
  close(toCamera({ x: 5, y: 1, z: 0 }, { x: 0, z: 0, heading: Math.PI / 2 }), { x: 0, y: 1, z: 5 });
});

test('toCamera({ x: 0, y: 0, z: 5 }, { x: 0, z: 0, heading: Math.PI / 2 }) → { x: -5, y: 0, z: 0 } within 1e-9', () => {
  close(toCamera({ x: 0, y: 0, z: 5 }, { x: 0, z: 0, heading: Math.PI / 2 }), { x: -5, y: 0, z: 0 });
});

test('project({ x: 2, y: 1, z: 4 }, 200, 640, 480) → { x: 420, y: 190 }', () => {
  assert.deepEqual(project({ x: 2, y: 1, z: 4 }, 200, 640, 480), { x: 420, y: 190 });
});

test('project({ x: -3, y: -2, z: 10 }, 300, 800, 600) → { x: 310, y: 360 }', () => {
  assert.deepEqual(project({ x: -3, y: -2, z: 10 }, 300, 800, 600), { x: 310, y: 360 });
});

test('project({ x: 0, y: 0, z: 0 }, 200, 640, 480) → null', () => {
  assert.equal(project({ x: 0, y: 0, z: 0 }, 200, 640, 480), null);
});

test('clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 3 }, 1) → [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 3 }]', () => {
  assert.deepEqual(clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 3 }, 1), [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 3 }]);
});

test('clipToNear({ x: 4, y: 2, z: 5 }, { x: 0, y: 0, z: -3 }, 1) → [{ x: 4, y: 2, z: 5 }, { x: 2, y: 1, z: 1 }]', () => {
  assert.deepEqual(clipToNear({ x: 4, y: 2, z: 5 }, { x: 0, y: 0, z: -3 }, 1), [{ x: 4, y: 2, z: 5 }, { x: 2, y: 1, z: 1 }]);
});

test('clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0.5 }, 1) → null', () => {
  assert.equal(clipToNear({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 0.5 }, 1), null);
});

test('wrapAngle(3 * Math.PI / 2) → -Math.PI / 2', () => {
  assert.equal(wrapAngle(3 * Math.PI / 2), -Math.PI / 2);
});

test('wrapAngle(-3 * Math.PI / 2) → Math.PI / 2', () => {
  assert.equal(wrapAngle(-3 * Math.PI / 2), Math.PI / 2);
});

test('wrapAngle(Math.PI) → Math.PI', () => {
  assert.equal(wrapAngle(Math.PI), Math.PI);
});

test('wrapAngle(-Math.PI) → Math.PI', () => {
  assert.equal(wrapAngle(-Math.PI), Math.PI);
});

test('wrapAngle(0.5) → 0.5', () => {
  assert.equal(wrapAngle(0.5), 0.5);
});

test('wrapAngle(5 * Math.PI) → Math.PI', () => {
  assert.equal(wrapAngle(5 * Math.PI), Math.PI);
});

test('projection rejects the near plane and all points behind it', () => {
  for (const z of [-10, 0, 0.05, 0.1]) {
    assert.equal(project({ x: 1, y: 1, z }, 200, 640, 480), null);
  }
  assert.notEqual(project({ x: 0, y: 0, z: 0.100001 }, 200, 640, 480), null);
});

test('clipping preserves visible segments, boundary points, and endpoint order', () => {
  const a = { x: -2, y: 1, z: 1 };
  const b = { x: 2, y: 3, z: 4 };
  assert.deepEqual(clipToNear(a, b, 1), [a, b]);
  const behind = { x: 0, y: 0, z: -2 };
  assert.deepEqual(clipToNear(a, behind, 1), [a, a]);
  assert.deepEqual(clipToNear(behind, a, 1), [a, a]);
  assert.deepEqual(a, { x: -2, y: 1, z: 1 });
});

test('clipping a parallel segment behind the plane returns null', () => {
  assert.equal(clipToNear({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, NEAR), null);
});

test('wrapped angles stay in (-π, π] through many full turns', () => {
  for (let n = -100; n <= 100; n++) {
    const angle = wrapAngle(n * 0.47);
    assert.ok(angle > -Math.PI && angle <= Math.PI);
    assert.ok(Math.abs(Math.sin(angle) - Math.sin(n * 0.47)) < 1e-9);
    assert.ok(Math.abs(Math.cos(angle) - Math.cos(n * 0.47)) < 1e-9);
  }
});

test('driving forward and backward uses elapsed seconds without mutating the camera', () => {
  const camera = { x: 1, z: 2, heading: 0 };
  close(moveTank(camera, { throttle: 1 }, 2), { x: 1, z: 2 + DRIVE_SPEED * 2, heading: 0 });
  close(moveTank(camera, { throttle: -1 }, 2), { x: 1, z: 2 - REVERSE_SPEED * 2, heading: 0 });
  assert.deepEqual(camera, { x: 1, z: 2, heading: 0 });
});

test('heading zero goes +z and a right angle goes +x', () => {
  close(moveTank({ x: 0, z: 0, heading: Math.PI / 2 }, { throttle: 1 }, 1), {
    x: DRIVE_SPEED, z: 0, heading: Math.PI / 2,
  });
});

test('left and right steering turn and wrap the tank without translating', () => {
  close(moveTank({ x: 4, z: -2, heading: 0 }, { steer: 1 }, 1), { x: 4, z: -2, heading: TURN_SPEED });
  close(moveTank({ x: 4, z: -2, heading: 0 }, { steer: -1 }, 1), { x: 4, z: -2, heading: -TURN_SPEED });
  assert.ok(moveTank({ x: 0, z: 0, heading: Math.PI }, { steer: 1 }, 1).heading < 0);
});

test('simultaneous driving and turning follows the same path at 30, 60, and 144 fps', () => {
  const origin = { x: 0, z: 0, heading: 0.3 };
  for (const throttle of [-1, 1]) {
    const input = { throttle, steer: 1 };
    const expected = moveTank(origin, input, 2);
    for (const fps of [30, 60, 144]) {
      let camera = origin;
      for (let n = 0; n < fps * 2; n++) camera = moveTank(camera, input, 1 / fps);
      close(camera, expected);
    }
  }
});

test('zero/invalid time is inert and controls default to idle or clamp to their range', () => {
  const camera = { x: 0, z: 0, heading: 0 };
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(moveTank(camera, { throttle: 1 }, dt), camera);
  assert.deepEqual(moveTank(camera, {}, 1), camera);
  assert.deepEqual(moveTank(camera, { throttle: 3, steer: -5 }, 1), moveTank(camera, { throttle: 1, steer: -1 }, 1));
});

test('world contains at least ten deterministic cubes and pyramids plus mountain lines', () => {
  const world = createWorld();
  assert.deepEqual(createWorld(), world);
  assert.ok(world.obstacles.length >= 10);
  assert.ok(world.obstacles.some(o => o.type === 'cube'));
  assert.ok(world.obstacles.some(o => o.type === 'pyramid'));
  assert.ok(world.mountains.length >= 24);
  for (const obstacle of world.obstacles) {
    const lines = modelLines(obstacle);
    assert.equal(lines.length, obstacle.type === 'cube' ? 12 : 8);
    for (const line of lines) for (const p of line) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
      assert.ok(p.y >= 0);
    }
  }
});

test('ground grid stays on y = 0 and follows the camera across cells', () => {
  const camera = { x: 257, z: -193, heading: 0 };
  const lines = groundLines(camera);
  assert.ok(lines.length > 20);
  for (const [a, b] of lines) {
    assert.equal(a.y, 0);
    assert.equal(b.y, 0);
    assert.ok(a.x === b.x || a.z === b.z);
  }
  const points = lines.flat();
  assert.ok(Math.min(...points.map(p => p.x)) < camera.x);
  assert.ok(Math.max(...points.map(p => p.x)) > camera.x);
  assert.ok(Math.min(...points.map(p => p.z)) < camera.z);
  assert.ok(Math.max(...points.map(p => p.z)) > camera.z);
});

test('segments exactly on the near plane remain finite in the drawing pipeline', () => {
  const line = projectLine([{ x: -1, y: 0, z: NEAR }, { x: 1, y: 0, z: NEAR }],
    { x: 0, z: 0, heading: 0 }, 200, 640, 480, 0);
  assert.ok(line);
  for (const p of line) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('engine loads as a plain script with neither Node module nor browser APIs', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(join(__dirname, 'engine.js'), 'utf8'), context);
  const point = vm.runInContext('toCamera({ x: 5, y: 0, z: 10 }, { x: 1, z: 2, heading: 0 })', context);
  close(point, { x: 4, y: 0, z: 8 });
  assert.ok(vm.runInContext('createWorld().obstacles.length >= 10', context));
  assert.equal(vm.runInContext('typeof module', context), 'undefined');
});

test('world-line pipeline clips crossing segments without losing near-plane endpoints', () => {
  const camera = { x: 0, z: 0, heading: 0 };
  const line = projectLine([{ x: -1, y: 0, z: -2 }, { x: 1, y: 2, z: 4 }], camera, 200, 640, 480, 1.8);
  assert.ok(line);
  for (const p of line) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.deepEqual(line[1], { x: 370, y: 230 });
  assert.equal(projectLine([{ x: 0, y: 0, z: -2 }, { x: 1, y: 0, z: 0 }], camera, 200, 640, 480, 1.8), null);
});

test('world-line pipeline adjusts for eye height without altering toCamera semantics', () => {
  const line = projectLine([{ x: 0, y: 0, z: 10 }, { x: 1, y: 0, z: 10 }],
    { x: 0, z: 0, heading: 0 }, 200, 640, 480, 2);
  assert.deepEqual(line, [{ x: 320, y: 280 }, { x: 340, y: 280 }]);
});

test('circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 4 }) → true', () => {
  assert.equal(circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 4 }), true);
});

test('circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 3.9 }) → false', () => {
  assert.equal(circlesHit({ x: 0, z: 0, r: 1 }, { x: 3, z: 4, r: 3.9 }), false);
});

test('circle contact is symmetric and includes overlap, containment, and zero-radius points', () => {
  for (const [a, b, expected] of [
    [{ x: -3, z: -4, r: 1 }, { x: -3, z: -4, r: 2 }, true],
    [{ x: -3, z: -4, r: 0 }, { x: -3, z: -4, r: 0 }, true],
    [{ x: -3, z: -4, r: 0 }, { x: -3, z: -3, r: 0 }, false],
    [{ x: -3, z: -4, r: 2 }, { x: -3, z: 0, r: 2 }, true],
  ]) {
    assert.equal(circlesHit(a, b), expected);
    assert.equal(circlesHit(b, a), expected);
  }
});

test('forward movement stops at the first obstacle, even when a long frame ends beyond it', () => {
  const camera = { x: 0, z: 0, heading: 0 };
  const obstacles = [{ x: 0, z: 10, r: 3 }, { x: 0, z: 20, r: 3 }];
  const expected = { x: 0, z: 10 - 3 - TANK_RADIUS, heading: 0 };
  close(moveTank(camera, { throttle: 1 }, 10, obstacles), expected);
  close(moveTank(camera, { throttle: 1 }, 10, [...obstacles].reverse()), expected);
  assert.deepEqual(camera, { x: 0, z: 0, heading: 0 });
  assert.deepEqual(obstacles[0], { x: 0, z: 10, r: 3 });
});

test('straight-line collision has the same contact at 30, 60, and 144 fps', () => {
  const obstacles = [{ x: 0, z: 10, r: 3 }];
  for (const fps of [30, 60, 144]) {
    let camera = { x: 0, z: 0, heading: 0 };
    for (let i = 0; i < fps * 2; i++) camera = moveTank(camera, { throttle: 1 }, 1 / fps, obstacles);
    close(camera, { x: 0, z: 10 - 3 - TANK_RADIUS, heading: 0 });
  }
});

test('reverse motion collides, a glancing pass stays clear, and tangent contact is included', () => {
  const camera = { x: 0, z: 0, heading: 0 };
  close(moveTank(camera, { throttle: -1 }, 5, [{ x: 0, z: -10, r: 3 }]),
    { x: 0, z: -10 + 3 + TANK_RADIUS, heading: 0 });
  const obstacle = { x: TANK_RADIUS + 3 + 0.01, z: 10, r: 3 };
  close(moveTank(camera, { throttle: 1 }, 2, [obstacle]), moveTank(camera, { throttle: 1 }, 2));
  close(moveTank(camera, { throttle: 1 }, 2, [{ ...obstacle, x: TANK_RADIUS + 3 }]),
    { x: 0, z: 10, heading: 0 });
});

test('contact blocks pushing, but permits reversing away, turning in place, and tangential escape', () => {
  const obstacles = [{ x: 0, z: 10, r: 3 }];
  const camera = { x: 0, z: 10 - 3 - TANK_RADIUS, heading: 0 };
  close(moveTank(camera, { throttle: 1 }, 2, obstacles), camera);
  close(moveTank(camera, { throttle: -1 }, 0.5, obstacles), moveTank(camera, { throttle: -1 }, 0.5));
  close(moveTank(camera, { steer: 1 }, 0.5, obstacles), moveTank(camera, { steer: 1 }, 0.5));
  const tangent = { ...camera, heading: Math.PI / 2 };
  close(moveTank(tangent, { throttle: 1 }, 0.5, obstacles), moveTank(tangent, { throttle: 1 }, 0.5));
});

test('swept collision catches obstacles on the driving arc rather than only its chord', () => {
  const origin = { x: 0, z: 0, heading: 0 };
  for (const throttle of [-1, 1]) for (const steer of [-1, 1]) {
    const controls = { throttle, steer };
    const speed = throttle > 0 ? DRIVE_SPEED : REVERSE_SPEED;
    const radius = speed / TURN_SPEED;
    const midAngle = 0.9;
    const combinedRadius = 0.5 + TANK_RADIUS;
    const contactAngle = midAngle - 2 * Math.asin(combinedRadius / (2 * radius));
    const obstacle = {
      x: steer * throttle * radius * (1 - Math.cos(midAngle)),
      z: throttle * radius * Math.sin(midAngle), r: 0.5,
    };
    const result = moveTank(origin, controls, 2 * midAngle / TURN_SPEED, [obstacle]);
    const contact = moveTank(origin, controls, contactAngle / TURN_SPEED);
    close(result, { x: contact.x, z: contact.z, heading: steer * 2 * midAngle });
    assert.ok(Math.hypot(result.x - obstacle.x, result.z - obstacle.z) >= combinedRadius - 1e-9);
    const fullTurn = moveTank(origin, controls, Math.PI * 4 / TURN_SPEED, [obstacle]);
    close(fullTurn, { x: contact.x, z: contact.z, heading: 0 });
  }
});

test('an arc that bends inward from tangential contact cannot enter an obstacle', () => {
  const camera = { x: 0, z: 0, heading: 0 };
  const controls = { throttle: 1, steer: 1 };
  const result = moveTank(camera, controls, 0.5, [{ x: 20, z: 0, r: 20 - TANK_RADIUS }]);
  close(result, { x: 0, z: 0, heading: TURN_SPEED * 0.5 });
});

test('irrelevant obstacles preserve the exact free-driving arc and invalid-time behavior', () => {
  const camera = { x: 0, z: 0, heading: 0.3 };
  const controls = { throttle: 1, steer: 1 };
  const obstacles = [{ x: 500, z: -500, r: 3 }];
  assert.deepEqual(moveTank(camera, controls, 2, obstacles), moveTank(camera, controls, 2));
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(moveTank(camera, controls, dt, obstacles), camera);
});

test('all world obstacles have circular bounds enclosing their rotated footprint and leave spawn clear', () => {
  const tank = { x: 0, z: 0, r: TANK_RADIUS };
  assert.ok(TANK_RADIUS > 0);
  for (const obstacle of createWorld().obstacles) {
    assert.ok(Number.isFinite(obstacle.r) && obstacle.r > 0);
    assert.equal(circlesHit(tank, obstacle), false);
    for (const p of modelLines(obstacle).flat().filter(p => p.y === 0)) {
      assert.ok(Math.hypot(p.x - obstacle.x, p.z - obstacle.z) <= obstacle.r + 1e-9);
    }
    const start = { x: obstacle.x, z: obstacle.z - obstacle.r - TANK_RADIUS - 10, heading: 0 };
    close(moveTank(start, { throttle: 1 }, 5, [obstacle]), {
      x: start.x, z: obstacle.z - obstacle.r - TANK_RADIUS, heading: 0,
    });
  }
});

test('mountain skyline forms a closed, jagged ring with no seam', () => {
  const ridges = createWorld().mountains.filter(([a, b]) => a.y > 0 && b.y > 0);
  assert.ok(ridges.length >= 24);
  assert.ok(new Set(ridges.map(([a]) => a.y)).size > 12);
  for (let i = 0; i < ridges.length; i++) {
    close(ridges[i][1], ridges[(i + 1) % ridges.length][0]);
  }
});

test('mountains and crescent keep exactly the same projected size and position after driving', () => {
  const world = createWorld();
  assert.ok(world.moon.length >= 24);
  const origin = { x: 0, z: 0, heading: 0 };
  const distant = { x: 100000, z: -100000, heading: 0 };
  for (const line of [...world.mountains, ...world.moon]) {
    assert.deepEqual(projectSkyLine(line, origin, 400, 800, 600), projectSkyLine(line, distant, 400, 800, 600));
  }
});

test('turning right moves sky landmarks left and projects them out of view behind the tank', () => {
  const line = [{ x: 0, y: 100, z: 950 }, { x: 10, y: 110, z: 950 }];
  const forward = projectSkyLine(line, { x: 0, z: 0, heading: 0 }, 400, 800, 600);
  const right = projectSkyLine(line, { x: 0, z: 0, heading: 0.2 }, 400, 800, 600);
  assert.ok(right[0].x < forward[0].x);
  assert.equal(projectSkyLine(line, { x: 0, z: 0, heading: Math.PI }, 400, 800, 600), null);
  assert.deepEqual(projectSkyLine(line, { x: 5, z: 7, heading: 0 }, 400, 800, 600),
    projectLine(line, { x: 0, z: 0, heading: 0 }, 400, 800, 600, 0));
});

test('crescent is a closed two-arc outline above the mountains and scales with the viewport', () => {
  const { moon, mountains } = createWorld();
  const maximumPeak = Math.max(...mountains.flat().map(p => p.y));
  const camera = { x: 0, z: 0, heading: 0 };
  const projections = moon.map(line => projectSkyLine(line, camera, 400, 800, 600));
  for (let i = 0; i < moon.length; i++) {
    close(moon[i][1], moon[(i + 1) % moon.length][0]);
    for (const p of moon[i]) assert.ok(p.y > maximumPeak);
    for (const p of projections[i]) {
      assert.ok(p.x > 0 && p.x < 800 && p.y > 0 && p.y < 300);
    }
    const larger = projectSkyLine(moon[i], camera, 800, 1600, 1200);
    larger.forEach((p, j) => close(p, { x: projections[i][j].x * 2, y: projections[i][j].y * 2 }));
  }
  const points = projections.flat();
  const spanX = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
  const spanY = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  assert.ok(spanX < spanY / 1.5, 'outline should be a slim crescent, not a full disc');
});

test('seeded swept paths never penetrate or miss sampled intersections across headings and frame lengths', () => {
  let seed = 713;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let n = 0; n < 4000; n++) {
    const camera = { x: random() * 40 - 20, z: random() * 40 - 20, heading: random() * Math.PI * 2 };
    const obstacle = { x: random() * 50 - 25, z: random() * 50 - 25, r: random() * 8 + 0.1 };
    const radius = obstacle.r + TANK_RADIUS;
    if (Math.hypot(camera.x - obstacle.x, camera.z - obstacle.z) <= radius) continue;
    const controls = { throttle: random() < 0.5 ? -1 : 1, steer: [-1, 0, 1][Math.floor(random() * 3)] };
    const dt = random() * 25 + 0.01;
    const result = moveTank(camera, controls, dt, [obstacle]);
    const distance = Math.hypot(result.x - obstacle.x, result.z - obstacle.z);
    assert.ok(distance >= radius - 1e-8, `penetration in case ${n}: ${distance - radius}`);
    let sampledCollision = false;
    for (let i = 1; i <= 300; i++) {
      const p = moveTank(camera, controls, dt * i / 300);
      if (Math.hypot(p.x - obstacle.x, p.z - obstacle.z) < radius - 1e-6) sampledCollision = true;
    }
    const free = moveTank(camera, controls, dt);
    if (sampledCollision) {
      assert.ok(Math.hypot(result.x - free.x, result.z - free.z) > 1e-9, `missed sweep in case ${n}`);
    }
  }
});


test('turnTowards uses the +x/right convention, limits both directions, and never overshoots', () => {
  const from = { x: 0, z: 0 };
  close({ heading: turnTowards(0, from, { x: 10, z: 0 }, 0.25) }, { heading: 0.25 });
  close({ heading: turnTowards(0, from, { x: -10, z: 0 }, 0.25) }, { heading: -0.25 });
  close({ heading: turnTowards(0, from, { x: 10, z: 0 }, 2) }, { heading: Math.PI / 2 });
  close({ heading: turnTowards(1, from, { x: 0, z: 10 }, 2) }, { heading: 0 });
});

test('turnTowards takes the shortest path across the angle seam and resolves opposite headings', () => {
  const from = { x: 3, z: -8 };
  const to = { x: 3 + Math.sin(-3), z: -8 + Math.cos(-3) };
  close({ heading: turnTowards(3, from, to, 0.1) }, { heading: 3.1 });
  close({ heading: turnTowards(3, from, to, 1) }, { heading: -3 });
  close({ heading: turnTowards(0, from, { x: 3, z: -9 }, 0.2) }, { heading: 0.2 });
  assert.equal(turnTowards(8, from, from, 1), wrapAngle(8));
  assert.equal(turnTowards(1, from, to, 0), 1);
  assert.equal(turnTowards(1, from, to, -1), 1);
});

test('shells travel straight along the firing heading using elapsed seconds, without mutation', () => {
  for (const heading of [0, Math.PI / 2, -0.7]) {
    const shell = createShell({ x: 5, z: -4, heading }, 'player');
    const before = structuredClone(shell);
    const result = moveShell(shell, 0.5);
    close(result.shell, { x: 5 + Math.sin(heading) * SHELL_SPEED / 2,
      z: -4 + Math.cos(heading) * SHELL_SPEED / 2, distance: SHELL_SPEED / 2, heading });
    assert.equal(result.hit, null);
    assert.deepEqual(shell, before);
  }
});

test('shells expire at exactly 200 metres and cannot hit anything beyond their range', () => {
  assert.equal(SHELL_RANGE, 200);
  const shell = createShell({ x: 0, z: 0, heading: 0 }, 'player');
  assert.equal(moveShell(shell, 200 / SHELL_SPEED).shell, null);
  assert.equal(moveShell(shell, 100, [], [{ id: 'far', x: 0, z: 203, r: 2 }]).hit, null);
  assert.equal(moveShell(shell, 100, [], [{ id: 'edge', x: 0, z: 202, r: 2 }]).hit.target.id, 'edge');
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(moveShell(shell, dt), { shell, hit: null });
  assert.deepEqual(moveShell(null, 1), { shell: null, hit: null });
});

test('swept shells stop at the nearest obstacle or tank even across a long frame', () => {
  const shell = createShell({ x: 0, z: 0, heading: 0 }, 'player');
  const cover = { id: 'cover', x: 0, z: 20, r: 3 };
  const target = { id: 'enemy', x: 0, z: 40, r: 2 };
  let result = moveShell(shell, 5, [cover], [target]);
  assert.equal(result.shell, null);
  assert.equal(result.hit.type, 'obstacle');
  assert.equal(result.hit.target.id, 'cover');
  result = moveShell(shell, 5, [{ ...cover, z: 80 }], [target]);
  assert.equal(result.hit.type, 'tank');
  assert.equal(result.hit.target.id, 'enemy');
  assert.equal(moveShell(shell, 5, [cover, { ...cover, id: 'near', z: 10 }]).hit.target.id, 'near');
  assert.equal(moveShell(shell, 5, [cover], [{ ...target, z: 19, r: 2 }]).hit.type, 'obstacle');
});

test('shell collision includes tangents, initial overlap, and rotated fire, but not near misses', () => {
  const shell = createShell({ x: 0, z: 0, heading: 0 }, 'player');
  assert.equal(moveShell(shell, 1, [{ x: 3, z: 10, r: 3 }]).hit.type, 'obstacle');
  assert.equal(moveShell(shell, 1, [{ x: 3.001, z: 10, r: 3 }]).hit, null);
  assert.equal(moveShell(shell, 1, [{ x: 0, z: 0, r: 3 }]).hit.type, 'obstacle');
  assert.equal(moveShell({ ...shell, heading: Math.PI / 2 }, 1, [], [{ id: 'east', x: 20, z: 0, r: 2 }]).hit.target.id, 'east');
});

test('shell displacement and expiry are identical at 30, 60, and 144 fps', () => {
  for (const fps of [30, 60, 144]) {
    let shell = createShell({ x: 3, z: -9, heading: 0.6 }, 'player');
    for (let n = 0; n < fps; n++) shell = moveShell(shell, 1 / fps).shell;
    close(shell, { x: 3 + Math.sin(0.6) * SHELL_SPEED, z: -9 + Math.cos(0.6) * SHELL_SPEED, distance: SHELL_SPEED });
    for (let n = 0; n < fps * 3; n++) shell = moveShell(shell, 1 / fps).shell;
    assert.equal(shell, null);
  }
});

test('enemy spawns are deterministic, distant, clear of structures, and follow the player', () => {
  const obstacles = createWorld().obstacles;
  for (const player of [{ x: 0, z: 0, heading: 0 }, { x: 350, z: -900, heading: 1.7 }]) {
    for (let n = 0; n < 12; n++) {
      const enemy = spawnEnemy(player, obstacles, n);
      assert.deepEqual(spawnEnemy(player, obstacles, n), enemy);
      assert.ok(Math.hypot(enemy.x - player.x, enemy.z - player.z) >= 100);
      for (const o of obstacles) assert.equal(circlesHit({ ...enemy, r: TANK_RADIUS }, o), false);
    }
  }
  const blocked = [{ x: 0, z: 110, r: 20 }];
  const enemy = spawnEnemy({ x: 0, z: 0, heading: 0 }, blocked);
  assert.equal(circlesHit({ ...enemy, r: TANK_RADIUS }, blocked[0]), false);
});

test('enemy turns towards the player at a bounded rate and approaches when aligned', () => {
  const player = { x: 0, z: 0, heading: 0 };
  const enemy = { x: 0, z: 100, heading: Math.PI / 2, cooldown: 10 };
  const turned = updateEnemy(enemy, player, 0.1);
  close({ heading: turned.heading }, { heading: Math.PI / 2 + ENEMY_TURN_SPEED * 0.1 });
  const aligned = { ...enemy, heading: Math.PI };
  close(updateEnemy(aligned, player, 1), { x: 0, z: 100 - ENEMY_SPEED, heading: Math.PI, cooldown: 9 });
  assert.deepEqual(enemy, { x: 0, z: 100, heading: Math.PI / 2, cooldown: 10 });
  close(updateEnemy({ ...aligned, z: 32 }, player, 1), { x: 0, z: 32 });
  const blocked = updateEnemy(aligned, player, 10, [{ x: 0, z: 80, r: 3 }]);
  assert.ok(blocked.z >= 85 - 1e-9);
});

function combatScene(overrides = {}) {
  const game = createGame({ obstacles: [] });
  return { ...game, enemy: { ...game.enemy, x: 0, z: 100, heading: Math.PI, cooldown: 100 }, ...overrides };
}

test('new games start with zero score, three lives, one enemy, and no active shells', () => {
  const world = createWorld();
  const game = createGame(world);
  assert.equal(game.score, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.enemyNumber, 1);
  assert.equal(game.playerShell, null);
  assert.equal(game.enemyShell, null);
  assert.deepEqual(game.player, { x: 0, z: 0, heading: 0 });
  assert.deepEqual(createGame(world), game);
});

test('holding fire cannot replace or create a second player shell in flight', () => {
  let game = combatScene();
  game = updateGame(game, { fire: true }, 0.1, []);
  assert.ok(game.playerShell);
  const distance = game.playerShell.distance;
  game = updateGame(game, { fire: true }, 0.1, []);
  close({ distance: game.playerShell.distance }, { distance: distance + SHELL_SPEED * 0.1 });
  game = updateGame(game, { fire: true }, 0.1, [{ x: 0, z: 17, r: 1 }]);
  assert.ok(game.playerShell.distance < 7, 'a fresh shell becomes available after cover stops the old one');
});

test('enemy fires only when nearly facing the player, within range, and off cooldown', () => {
  const base = combatScene();
  const ready = { ...base.enemy, z: 70, cooldown: 0 };
  assert.ok(updateGame({ ...base, enemy: ready }, {}, COMBAT_STEP, []).enemyShell);
  assert.equal(updateGame({ ...base, enemy: { ...ready, heading: 0 } }, {}, COMBAT_STEP, []).enemyShell, null);
  assert.equal(updateGame({ ...base, enemy: { ...ready, heading: Math.PI - ENEMY_FIRE_ANGLE * 3 } }, {}, COMBAT_STEP, []).enemyShell, null);
  assert.equal(updateGame({ ...base, enemy: { ...ready, z: 250 } }, {}, COMBAT_STEP, []).enemyShell, null);
  assert.equal(updateGame({ ...base, enemy: { ...ready, cooldown: ENEMY_COOLDOWN } }, {}, COMBAT_STEP, []).enemyShell, null);
  assert.equal(updateGame({ ...base, enemy: ready }, {}, COMBAT_STEP, [{ x: 0, z: 40, r: 4 }]).enemyShell, null);
});

test('a player hit destroys exactly one enemy, scores 1000, consumes the shell, and spawns the next', () => {
  const base = combatScene();
  const snapshot = structuredClone(base);
  const game = updateGame(base, { fire: true }, 0.1, []);
  const hit = updateGame(game, {}, 2, []);
  assert.equal(hit.score, 1000);
  assert.equal(hit.enemyNumber, 2);
  assert.equal(hit.playerShell, null);
  assert.ok(Math.hypot(hit.enemy.x - hit.player.x, hit.enemy.z - hit.player.z) > 90);
  assert.deepEqual(base, snapshot);
  assert.equal(updateGame(hit, {}, 0.1, []).score, 1000);
});

test('cover absorbs both sides of fire without scoring or taking a life', () => {
  const base = combatScene();
  const enemyShell = createShell(base.enemy, 'enemy');
  const game = updateGame({ ...base, enemyShell }, { fire: true }, 2, [{ x: 0, z: 50, r: 5 }]);
  assert.equal(game.score, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.enemyShell, null);
});

test('each enemy shell hit costs one life and starts the cracked-glass timer', () => {
  let game = combatScene();
  for (let lives = 2; lives >= 0; lives--) {
    const shell = createShell({ x: 0, z: 2.5, heading: Math.PI }, 'enemy');
    game = updateGame({ ...game, enemyShell: shell }, {}, COMBAT_STEP, []);
    assert.equal(game.lives, lives);
    assert.equal(game.enemyShell, null);
    close({ damageTime: game.damageTime }, { damageTime: DAMAGE_DURATION });
  }
  assert.deepEqual(updateGame(game, { throttle: 1, fire: true }, 5, []), game);
  assert.equal(createGame({ obstacles: [] }).lives, 3);
});

test('damage timer fades with simulation time and invalid time leaves the game unchanged', () => {
  const game = combatScene({ damageTime: DAMAGE_DURATION });
  close({ damageTime: updateGame(game, {}, 0.5, []).damageTime }, { damageTime: DAMAGE_DURATION - 0.5 });
  assert.equal(updateGame(game, {}, 2, []).damageTime, 0);
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(updateGame(game, { fire: true }, dt, []), game);
});

test('combat movement, aim, firing and score match at 30, 60, and 144 fps', () => {
  const simulate = fps => {
    let game = combatScene();
    for (let n = 0; n < fps * 4; n++) game = updateGame(game, { fire: true, throttle: 0.4, steer: 0.1 }, 1 / fps, []);
    return game;
  };
  const expected = simulate(120);
  for (const fps of [30, 60, 144]) {
    const game = simulate(fps);
    close(game.player, expected.player);
    close(game.enemy, expected.enemy);
    assert.equal(game.score, expected.score);
    assert.equal(game.lives, expected.lives);
    if (expected.playerShell) {
      const { owner, ...coordinates } = expected.playerShell;
      assert.equal(game.playerShell.owner, owner);
      close(game.playerShell, coordinates);
    } else assert.equal(game.playerShell, null);
  }
});

test('enemy model has separate tracks, hull, turret and a forward barrel that rotates with heading', () => {
  const lines = tankLines({ x: 0, z: 0, heading: 0 });
  assert.ok(lines.length >= 40);
  assert.ok(lines.flat().some(p => p.y >= 2));
  assert.ok(Math.max(...lines.flat().map(p => p.z)) > 3);
  const rotated = tankLines({ x: 5, z: -7, heading: Math.PI / 2 });
  lines.forEach((line, i) => line.forEach((p, j) => close(rotated[i][j], { x: 5 + p.z, y: p.y, z: -7 - p.x })));
});

test('combat engine is available as a plain browser script without browser globals', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(join(__dirname, 'engine.js'), 'utf8'), context);
  assert.equal(vm.runInContext('updateGame(createGame({ obstacles: [] }), { fire: true }, 0.1, []).playerShell.owner', context), 'player');
});

test('waves advance after every five destroyed enemies with faster movement and earlier fire', () => {
  assert.deepEqual(waveDifficulty(0), { wave: 1, speed: 6, cooldown: 3, initialCooldown: 2.4 });
  assert.deepEqual(waveDifficulty(4), waveDifficulty(0));
  close(waveDifficulty(5), { wave: 2, speed: 7.5, cooldown: 2.4, initialCooldown: 1.92 });
  for (const kills of [10, 15, 100]) {
    const current = waveDifficulty(kills);
    const previous = waveDifficulty(kills - 5);
    assert.equal(current.wave, kills / 5 + 1);
    assert.ok(current.speed > previous.speed);
    assert.ok(current.speed < DRIVE_SPEED, 'later enemies remain escapable');
    assert.ok(current.cooldown < previous.cooldown);
    assert.ok(current.initialCooldown < previous.initialCooldown);
    assert.ok(current.cooldown > 1, 'later waves retain a reaction window');
  }
});

test('the fifth kill upgrades the replacement, not the first four enemies', () => {
  let game = combatScene();
  for (let kills = 1; kills <= 11; kills++) {
    const enemy = { x: 0, z: 50, heading: Math.PI, cooldown: 100 };
    const shell = createShell({ x: 0, z: 47.5, heading: 0 }, 'player');
    game = updateGame({ ...game, enemy, playerShell: shell }, {}, COMBAT_STEP);
    assert.equal(game.score, kills * 1000);
    assert.equal(game.enemyNumber, kills + 1);
    assert.equal(waveDifficulty(game.enemyNumber - 1).wave, Math.floor(kills / 5) + 1);
    close(game.enemy, { cooldown: waveDifficulty(kills).initialCooldown });
  }
});

test('higher-wave enemies really move faster and reload sooner in combat', () => {
  const base = combatScene();
  const first = updateGame(base, {}, 1);
  const later = updateGame({ ...base, enemyNumber: 6, score: 5000 }, {}, 1);
  assert.ok(later.enemy.z < first.enemy.z);
  close(later.enemy, { z: 100 - waveDifficulty(5).speed });
  const ready = { ...base.enemy, z: 70, cooldown: 0 };
  for (const kills of [0, 5, 10]) {
    const game = updateGame({ ...base, enemyNumber: kills + 1, enemy: ready }, {}, COMBAT_STEP);
    assert.ok(game.enemyShell);
    close(game.enemy, { cooldown: waveDifficulty(kills).cooldown });
  }
  const blocked = updateEnemy({ ...base.enemy, z: 100 }, base.player, 10,
    [{ x: 0, z: 80, r: 3 }], waveDifficulty(10));
  assert.ok(blocked.z >= 85 - 1e-9, 'faster enemies still obey swept cover collisions');
});

test('radar projects enemies relative to translated and rotated player headings', () => {
  const player = { x: 10, z: -20, heading: 0 };
  assert.equal(RADAR_RANGE, 160);
  const enemy = { x: 90, z: -20 };
  const right = radarContact(enemy, player);
  close(right, { x: 0.5, y: 0, distance: 80 });
  assert.equal(right.direction, 'RIGHT');
  assert.equal(right.inRange, true);
  const ahead = radarContact(enemy, { ...player, heading: Math.PI / 2 });
  close(ahead, { x: 0, y: -0.5 });
  assert.equal(ahead.direction, 'AHEAD');
  const behind = radarContact(enemy, { ...player, heading: -Math.PI / 2 });
  close(behind, { x: 0, y: 0.5 });
  assert.equal(behind.direction, 'BEHIND');
  assert.equal(radarContact({ x: -70, z: -20 }, player).direction, 'LEFT');
  assert.deepEqual(enemy, { x: 90, z: -20 });
});

test('radar handles range boundaries, rear quarters, and turning across the angle seam', () => {
  const player = { x: 0, z: 0, heading: 0 };
  assert.equal(radarContact({ x: 0, z: RADAR_RANGE }, player).inRange, true);
  assert.equal(radarContact({ x: 0, z: RADAR_RANGE + 0.01 }, player).inRange, false);
  assert.equal(radarContact({ x: 0, z: 0 }, player).direction, 'AHEAD');
  assert.equal(radarContact({ x: 30, z: -100 }, player).direction, 'BEHIND');
  assert.equal(radarContact({ x: 100, z: 30 }, player).direction, 'RIGHT');
  assert.equal(radarContact({ x: -100, z: 30 }, player).direction, 'LEFT');
  for (const heading of [Math.PI - 0.01, -Math.PI + 0.01]) {
    assert.equal(radarContact({ x: 0, z: -100 }, { ...player, heading }).direction, 'AHEAD');
  }
});

test('radar sweep follows simulation time, wraps, and is identical across refresh rates', () => {
  const expected = Math.PI * 2 * 3 / RADAR_PERIOD;
  for (const fps of [30, 60, 144]) {
    let game = combatScene();
    assert.equal(game.radarAngle, 0);
    for (let i = 0; i < fps * 3; i++) game = updateGame(game, {}, 1 / fps);
    close(game, { radarAngle: expected });
  }
  const game = updateGame(combatScene(), {}, RADAR_PERIOD + 3);
  close(game, { radarAngle: expected });
});

test('game is over when the last life is lost and all simulation freezes until a fresh game', () => {
  const shell = createShell({ x: 0, z: 2.5, heading: Math.PI }, 'enemy');
  const before = combatScene({ lives: 1, enemyShell: shell });
  assert.equal(isGameOver(before), false);
  const game = updateGame(before, {}, COMBAT_STEP * 5);
  assert.equal(game.lives, 0);
  assert.equal(isGameOver(game), true);
  assert.equal(isGameOver({ lives: -1 }), true);
  assert.equal(game.remainder, 0);
  assert.strictEqual(updateGame(game, { throttle: 1, steer: 1, fire: true }, 30), game);
  assert.equal(before.lives, 1);
  const fresh = createGame({ obstacles: [] });
  assert.equal(isGameOver(fresh), false);
  assert.equal(fresh.lives, 3);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.enemyNumber, 1);
  assert.equal(fresh.radarAngle, 0);
});

const TAU = Math.PI * 2;
const NEAR_PLANE = 0.1;
const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 8;
const TURN_RATE = 1.6;
const GRID_SPACING = 10;
const GRID_EXTENT = 200;
const TANK_RADIUS = 1.5;
const HORIZON_RADIUS = 320;
const MOUNTAIN_COUNT = 90;
const MOUNTAIN_SEED = 7;
const MOUNTAIN_MIN_HEIGHT = 4;
const MOUNTAIN_MAX_HEIGHT = 60;
const MOON_BEARING = 0.6;
const MOON_ELEVATION = 0.3;
const MOON_DISTANCE = 500;
const MOON_RADIUS = 30;
const CRESCENT_STEPS = 16;
const CRESCENT_OFFSET = 0.5;
const PYRAMID_HEIGHT_RATIO = 1.5;
const MUZZLE_DISTANCE = 5;
const SHELL_SPEED = 120;
const SHELL_RANGE = 200;
const SHELL_HEIGHT = 1.5;
const SHELL_STEP = 0.5;
const SHELL_TRAIL = 3;
const ENEMY_RADIUS = 1.5;
const ENEMY_SPEED = 8;
const ENEMY_TURN_RATE = 0.9;
const ENEMY_STANDOFF = 80;
const ENEMY_RELOAD = 2.5;
const ENEMY_SPAWN_MIN = 200;
const ENEMY_SPAWN_MAX = 240;
const FIRE_CONE = 0.05;
const ENEMY_SCORE = 1000;
const START_LIVES = 3;
const CRACK_SECONDS = 1.5;
const WAVE_SIZE = 5;
const WAVE_SPEED_STEP = 0.15;
const WAVE_RELOAD_STEP = 0.3;
const WAVE_MIN_RELOAD = 0.8;
const RADAR_RANGE = 260;
const WARNING_FRONT_ARC = Math.PI / 4;
const WARNING_REAR_ARC = (3 * Math.PI) / 4;

function wrapAngle(a) {
  const r = a % TAU;
  if (r > Math.PI) return r - TAU;
  if (r <= -Math.PI) return r + TAU;
  return r;
}

function toCamera(point, camera) {
  const dx = point.x - camera.x;
  const dz = point.z - camera.z;
  const c = Math.cos(camera.heading);
  const s = Math.sin(camera.heading);
  return {
    x: dx * c - dz * s,
    y: point.y,
    z: dx * s + dz * c,
  };
}

function project(point, focal, width, height) {
  if (point.z <= NEAR_PLANE) return null;
  return {
    x: width / 2 + (point.x * focal) / point.z,
    y: height / 2 - (point.y * focal) / point.z,
  };
}

function clipToNear(a, b, near) {
  const aBehind = a.z < near;
  const bBehind = b.z < near;
  if (aBehind && bBehind) return null;
  if (!aBehind && !bBehind) return [a, b];
  const t = (near - a.z) / (b.z - a.z);
  const crossing = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
    z: near,
  };
  return aBehind ? [crossing, b] : [a, crossing];
}

function focalLength(height, fovDegrees) {
  return height / (2 * Math.tan((fovDegrees * Math.PI) / 360));
}

function segmentToScreen(a, b, camera, focal, width, height) {
  const ca = toCamera({ x: a.x, y: a.y - EYE_HEIGHT, z: a.z }, camera);
  const cb = toCamera({ x: b.x, y: b.y - EYE_HEIGHT, z: b.z }, camera);
  const clipped = clipToNear(ca, cb, NEAR_PLANE);
  if (!clipped) return null;
  const from = project(clipped[0], focal, width, height);
  const to = project(clipped[1], focal, width, height);
  if (!from || !to) return null;
  return { from, to, depth: (clipped[0].z + clipped[1].z) / 2 };
}

function driveTank(camera, controls, dt) {
  const heading = wrapAngle(camera.heading + controls.steer * TURN_RATE * dt);
  const distance = controls.throttle * MOVE_SPEED * dt;
  return {
    x: camera.x + Math.sin(heading) * distance,
    z: camera.z + Math.cos(heading) * distance,
    heading,
  };
}

function gridSegments(camera) {
  const segments = [];
  const first = Math.floor((camera.x - GRID_EXTENT) / GRID_SPACING);
  const last = Math.ceil((camera.x + GRID_EXTENT) / GRID_SPACING);
  for (let i = first; i <= last; i++) {
    const x = i * GRID_SPACING;
    segments.push([
      { x, y: 0, z: camera.z - GRID_EXTENT },
      { x, y: 0, z: camera.z + GRID_EXTENT },
    ]);
  }
  const firstZ = Math.floor((camera.z - GRID_EXTENT) / GRID_SPACING);
  const lastZ = Math.ceil((camera.z + GRID_EXTENT) / GRID_SPACING);
  for (let i = firstZ; i <= lastZ; i++) {
    const z = i * GRID_SPACING;
    segments.push([
      { x: camera.x - GRID_EXTENT, y: 0, z },
      { x: camera.x + GRID_EXTENT, y: 0, z },
    ]);
  }
  return segments;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createObstacles(count, seed, minDistance, spread) {
  const random = seededRandom(seed);
  const obstacles = [];
  while (obstacles.length < count) {
    const x = (random() * 2 - 1) * spread;
    const z = (random() * 2 - 1) * spread;
    if (Math.hypot(x, z) < minDistance) continue;
    obstacles.push({
      kind: random() < 0.5 ? "cube" : "pyramid",
      x,
      z,
      size: 3 + random() * 5,
    });
  }
  return obstacles;
}

function obstacleSegments(obstacle) {
  const { x, z, size } = obstacle;
  const h = size / 2;
  if (obstacle.kind === "cube") {
    const corners = [
      { x: x - h, y: 0, z: z - h },
      { x: x + h, y: 0, z: z - h },
      { x: x + h, y: 0, z: z + h },
      { x: x - h, y: 0, z: z + h },
      { x: x - h, y: size, z: z - h },
      { x: x + h, y: size, z: z - h },
      { x: x + h, y: size, z: z + h },
      { x: x - h, y: size, z: z + h },
    ];
    return [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ].map(([i, j]) => [corners[i], corners[j]]);
  }
  const apex = { x, y: size * PYRAMID_HEIGHT_RATIO, z };
  const base = [
    { x: x - h, y: 0, z: z - h },
    { x: x + h, y: 0, z: z - h },
    { x: x + h, y: 0, z: z + h },
    { x: x - h, y: 0, z: z + h },
  ];
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push([base[i], base[(i + 1) % 4]]);
    segments.push([base[i], apex]);
  }
  return segments;
}

function circlesHit(a, b) {
  const reach = a.r + b.r;
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= reach * reach;
}

function obstacleHitsCircle(obstacle, circle) {
  const half = obstacle.size / 2;
  const nearestX = Math.min(Math.max(circle.x, obstacle.x - half), obstacle.x + half);
  const nearestZ = Math.min(Math.max(circle.z, obstacle.z - half), obstacle.z + half);
  return (circle.x - nearestX) ** 2 + (circle.z - nearestZ) ** 2 <= circle.r * circle.r;
}

function isTankFree(x, z, obstacles) {
  const body = { x, z, r: TANK_RADIUS };
  return !obstacles.some((obstacle) => obstacleHitsCircle(obstacle, body));
}

function slideToFreeSpot(from, moved, obstacles) {
  const x = isTankFree(moved.x, from.z, obstacles) ? moved.x : from.x;
  const z = isTankFree(x, moved.z, obstacles) ? moved.z : from.z;
  return { x, z };
}

function driveTankWithCollisions(camera, controls, dt, obstacles) {
  const moved = driveTank(camera, controls, dt);
  return { ...slideToFreeSpot(camera, moved, obstacles), heading: moved.heading };
}

function polylineSegments(points) {
  return points.slice(1).map((p, i) => [points[i], p]);
}

function horizonPoint(camera, bearing, distance, height) {
  return {
    x: camera.x + Math.sin(bearing) * distance,
    y: height,
    z: camera.z + Math.cos(bearing) * distance,
  };
}

function mountainSegments(camera) {
  const random = seededRandom(MOUNTAIN_SEED);
  const ridge = [];
  for (let i = 0; i < MOUNTAIN_COUNT; i++) {
    const bearing = (i / MOUNTAIN_COUNT) * TAU;
    const height = MOUNTAIN_MIN_HEIGHT + random() * (MOUNTAIN_MAX_HEIGHT - MOUNTAIN_MIN_HEIGHT);
    ridge.push(horizonPoint(camera, bearing, HORIZON_RADIUS, height));
  }
  return polylineSegments([...ridge, ridge[0]]);
}

function crescentOutline(radius, steps) {
  const offset = CRESCENT_OFFSET * radius;
  const horn = Math.sqrt(radius * radius - (offset / 2) ** 2);
  const outerFrom = Math.atan2(horn, offset / 2);
  const innerFrom = Math.atan2(horn, -offset / 2);
  const points = [];
  for (let k = 0; k <= steps; k++) {
    const t = outerFrom + ((TAU - 2 * outerFrom) * k) / steps;
    points.push({ x: radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  for (let k = 0; k <= steps; k++) {
    const t = TAU - innerFrom - ((TAU - 2 * innerFrom) * k) / steps;
    points.push({ x: offset + radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}

function moonSegments(camera) {
  const cosE = Math.cos(MOON_ELEVATION);
  const sinE = Math.sin(MOON_ELEVATION);
  const sinB = Math.sin(MOON_BEARING);
  const cosB = Math.cos(MOON_BEARING);
  const centre = {
    x: camera.x + sinB * cosE * MOON_DISTANCE,
    y: sinE * MOON_DISTANCE,
    z: camera.z + cosB * cosE * MOON_DISTANCE,
  };
  const right = { x: cosB, y: 0, z: -sinB };
  const up = { x: -sinE * sinB, y: cosE, z: -sinE * cosB };
  const points = crescentOutline(MOON_RADIUS, CRESCENT_STEPS).map((p) => ({
    x: centre.x + p.x * right.x + p.y * up.x,
    y: centre.y + p.x * right.y + p.y * up.y,
    z: centre.z + p.x * right.z + p.y * up.z,
  }));
  return polylineSegments(points);
}

function pointAhead(point, heading, distance) {
  return {
    x: point.x + Math.sin(heading) * distance,
    z: point.z + Math.cos(heading) * distance,
  };
}

function bearingTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

function aimError(from, heading, to) {
  return wrapAngle(bearingTo(from, to) - heading);
}

function turnTowards(heading, from, to, maxTurn) {
  const error = aimError(from, heading, to);
  return wrapAngle(heading + Math.max(-maxTurn, Math.min(maxTurn, error)));
}

function localToWorld(tank, right, up, forward) {
  const s = Math.sin(tank.heading);
  const c = Math.cos(tank.heading);
  return {
    x: tank.x + right * c + forward * s,
    y: up,
    z: tank.z - right * s + forward * c,
  };
}

function boxSegments(tank, lo, hi) {
  const corners = [];
  for (const up of [lo.up, hi.up]) {
    for (const forward of [lo.forward, hi.forward]) {
      for (const right of [lo.right, hi.right]) {
        corners.push(localToWorld(tank, right, up, forward));
      }
    }
  }
  const segments = [];
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      if (!(i & bit)) segments.push([corners[i], corners[i | bit]]);
    }
  }
  return segments;
}

function tankModelSegments(tank) {
  return [
    ...boxSegments(tank, { right: -1.6, up: 0.4, forward: -3 }, { right: 1.6, up: 1.4, forward: 3 }),
    ...boxSegments(tank, { right: -1, up: 1.4, forward: -1 }, { right: 1, up: 2.3, forward: 1.2 }),
    ...boxSegments(tank, { right: -2.2, up: 0, forward: -3.4 }, { right: -1.6, up: 0.6, forward: 3.4 }),
    ...boxSegments(tank, { right: 1.6, up: 0, forward: -3.4 }, { right: 2.2, up: 0.6, forward: 3.4 }),
    [localToWorld(tank, 0, 1.9, 1.2), localToWorld(tank, 0, 1.9, 5)],
  ];
}

function newShell(from, heading) {
  const muzzle = pointAhead(from, heading, MUZZLE_DISTANCE);
  return { x: muzzle.x, y: SHELL_HEIGHT, z: muzzle.z, heading, travelled: 0 };
}

function shellSegments(shell) {
  const tail = pointAhead(shell, shell.heading, -SHELL_TRAIL);
  return [[
    { x: tail.x, y: shell.y, z: tail.z },
    { x: shell.x, y: shell.y, z: shell.z },
  ]];
}

function obstacleHalfWidthAt(obstacle, y) {
  const half = obstacle.size / 2;
  if (obstacle.kind === "cube") return y <= obstacle.size ? half : null;
  const apex = obstacle.size * PYRAMID_HEIGHT_RATIO;
  return y <= apex ? half * (1 - y / apex) : null;
}

function obstacleBlocksShell(obstacle, shell) {
  const half = obstacleHalfWidthAt(obstacle, shell.y);
  return (
    half !== null &&
    Math.abs(shell.x - obstacle.x) <= half &&
    Math.abs(shell.z - obstacle.z) <= half
  );
}

function advanceShell(shell, dt, obstacles, target) {
  let distance = SHELL_SPEED * dt;
  let current = shell;
  while (distance > 0) {
    const step = Math.min(SHELL_STEP, distance, SHELL_RANGE - current.travelled);
    distance -= step;
    const ahead = pointAhead(current, current.heading, step);
    current = { ...current, x: ahead.x, z: ahead.z, travelled: current.travelled + step };
    if (current.travelled >= SHELL_RANGE) return { shell: null, hit: "range" };
    if (obstacles.some((obstacle) => obstacleBlocksShell(obstacle, current))) {
      return { shell: null, hit: "obstacle" };
    }
    if (target && circlesHit({ x: current.x, z: current.z, r: 0 }, target)) {
      return { shell: null, hit: "target" };
    }
  }
  return { shell: current, hit: null };
}

function crackPattern(seed, rays) {
  const random = seededRandom(seed);
  const origin = { x: (random() * 2 - 1) * 0.2, y: (random() * 2 - 1) * 0.2 };
  const lines = [];
  for (let i = 0; i < rays; i++) {
    let angle = (i / rays) * TAU + random() * 0.4;
    let point = origin;
    const line = [point];
    for (let k = 0; k < 4; k++) {
      angle += (random() * 2 - 1) * 0.25;
      const length = 0.15 + random() * 0.2;
      const next = { x: point.x + Math.cos(angle) * length, y: point.y + Math.sin(angle) * length };
      if (Math.abs(next.x) > 1 || Math.abs(next.y) > 1) break;
      line.push(next);
      point = next;
    }
    if (line.length > 1) lines.push(line);
  }
  return lines;
}

function waveIndex(game) {
  return Math.floor(game.destroyed / WAVE_SIZE);
}

function enemyTuning(wave) {
  return {
    speed: ENEMY_SPEED * (1 + WAVE_SPEED_STEP * wave),
    reload: Math.max(WAVE_MIN_RELOAD, ENEMY_RELOAD - WAVE_RELOAD_STEP * wave),
  };
}

function spawnEnemy(game) {
  const random = game.random;
  const bearing = random() * TAU;
  const distance = ENEMY_SPAWN_MIN + random() * (ENEMY_SPAWN_MAX - ENEMY_SPAWN_MIN);
  const at = pointAhead(game.tank, bearing, distance);
  return {
    x: at.x,
    z: at.z,
    heading: wrapAngle(random() * TAU),
    reload: enemyTuning(waveIndex(game)).reload,
    shell: null,
  };
}

function createGame(obstacles, seed, highScore = 0) {
  const game = {
    tank: { x: 0, z: 0, heading: 0 },
    obstacles,
    random: seededRandom(seed),
    shell: null,
    enemy: null,
    score: 0,
    highScore,
    destroyed: 0,
    lives: START_LIVES,
    crack: 0,
    over: false,
    paused: false,
  };
  return { ...game, enemy: spawnEnemy(game) };
}

function togglePause(game) {
  if (game.over) return game;
  return { ...game, paused: !game.paused };
}

function damagePlayer(game) {
  const lives = game.lives - 1;
  return { ...game, lives, crack: CRACK_SECONDS, over: lives === 0 };
}

function updatePlayerShell(game, fire, dt) {
  const shell = game.shell || (fire ? newShell(game.tank, game.tank.heading) : null);
  if (!shell) return game;
  const enemy = { x: game.enemy.x, z: game.enemy.z, r: ENEMY_RADIUS };
  const result = advanceShell(shell, dt, game.obstacles, enemy);
  if (result.hit === "target") return recordKill(game);
  return { ...game, shell: result.shell };
}

function recordKill(game) {
  const score = game.score + ENEMY_SCORE;
  const next = {
    ...game,
    shell: null,
    score,
    highScore: Math.max(game.highScore, score),
    destroyed: game.destroyed + 1,
  };
  return { ...next, enemy: spawnEnemy(next) };
}

function updateEnemy(game, dt) {
  const { tank, obstacles, enemy } = game;
  const tuning = enemyTuning(waveIndex(game));
  const heading = turnTowards(enemy.heading, enemy, tank, ENEMY_TURN_RATE * dt);
  const gap = Math.hypot(tank.x - enemy.x, tank.z - enemy.z) - ENEMY_STANDOFF;
  const step = Math.max(0, Math.min(tuning.speed * dt, gap));
  const spot = slideToFreeSpot(enemy, pointAhead(enemy, heading, step), obstacles);
  const moved = { ...enemy, ...spot, heading, reload: Math.max(0, enemy.reload - dt) };

  const playerBody = { x: tank.x, z: tank.z, r: TANK_RADIUS };
  const shot = enemy.shell
    ? advanceShell(enemy.shell, dt, obstacles, playerBody)
    : { shell: null, hit: null };
  const fires =
    !enemy.shell && moved.reload <= 0 && Math.abs(aimError(moved, heading, tank)) <= FIRE_CONE;

  let next = { ...game, enemy: { ...moved, shell: shot.shell } };
  if (shot.hit === "target") next = damagePlayer(next);
  if (fires) {
    next.enemy = { ...next.enemy, shell: newShell(moved, heading), reload: tuning.reload };
  }
  return next;
}

function radarPosition(camera, target) {
  const relative = toCamera({ x: target.x, y: 0, z: target.z }, camera);
  const distance = Math.hypot(relative.x, relative.z);
  const scale = Math.min(1, RADAR_RANGE / distance) / RADAR_RANGE;
  return { x: relative.x * scale, y: relative.z * scale };
}

function enemyWarning(game) {
  const error = aimError(game.tank, game.tank.heading, game.enemy);
  const side = Math.abs(error);
  if (side <= WARNING_FRONT_ARC) return null;
  if (side >= WARNING_REAR_ARC) return "ENEMY BEHIND YOU";
  return error > 0 ? "ENEMY ON YOUR RIGHT" : "ENEMY ON YOUR LEFT";
}

function stepGame(game, controls, dt) {
  if (game.over || game.paused) return game;
  const tank = driveTankWithCollisions(game.tank, controls, dt, game.obstacles);
  const moved = { ...game, tank, crack: Math.max(0, game.crack - dt) };
  return updateEnemy(updatePlayerShell(moved, controls.fire, dt), dt);
}

if (typeof module !== "undefined") {
  module.exports = {
    NEAR_PLANE,
    EYE_HEIGHT,
    MOVE_SPEED,
    TURN_RATE,
    TANK_RADIUS,
    HORIZON_RADIUS,
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
    turnTowards,
    tankModelSegments,
    shellSegments,
    crackPattern,
    advanceShell,
    obstacleBlocksShell,
    createGame,
    stepGame,
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
    circlesHit,
    obstacleHitsCircle,
    driveTankWithCollisions,
    mountainSegments,
    moonSegments,
  };
}

'use strict';

const NEAR = 0.1;
const DRIVE_SPEED = 14;
const REVERSE_SPEED = 9;
const TURN_SPEED = 0.8;
const EYE_HEIGHT = 2.6;
const TANK_RADIUS = 2;

function toCamera(point, camera) {
  const dx = point.x - camera.x;
  const dz = point.z - camera.z;
  const cos = Math.cos(camera.heading);
  const sin = Math.sin(camera.heading);
  return { x: dx * cos - dz * sin, y: point.y, z: dx * sin + dz * cos };
}

function project(point, focal, width, height) {
  if (point.z <= NEAR) return null;
  return { x: width / 2 + point.x * focal / point.z, y: height / 2 - point.y * focal / point.z };
}

function clipToNear(a, b, near) {
  if (a.z < near && b.z < near) return null;
  if (a.z >= near && b.z >= near) return [a, b];
  const t = (near - a.z) / (b.z - a.z);
  const intersection = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: near };
  return a.z < near ? [intersection, b] : [a, intersection];
}

function wrapAngle(a) {
  const turn = Math.PI * 2;
  const wrapped = ((a + Math.PI) % turn + turn) % turn - Math.PI;
  return wrapped <= -Math.PI ? Math.PI : wrapped;
}

function circlesHit(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z) <= a.r + b.r;
}

function firstImpactTime(camera, speed, omega, dt, obstacle) {
  const dx = camera.x - obstacle.x;
  const dz = camera.z - obstacle.z;
  const radius = TANK_RADIUS + obstacle.r;
  const vx = speed * Math.sin(camera.heading);
  const vz = speed * Math.cos(camera.heading);
  const approach = dx * vx + dz * vz;
  const gap = dx * dx + dz * dz - radius * radius;
  const curvature = speed * speed + speed * omega * (dx * Math.cos(camera.heading) - dz * Math.sin(camera.heading));
  // At contact, allow outward motion but not motion curving into the obstacle.
  if (gap <= 1e-9 && (approach < -1e-9 || (Math.abs(approach) <= 1e-9 && curvature < -1e-9))) return 0;

  if (Math.abs(omega) < 1e-9) {
    const discriminant = approach * approach - speed * speed * gap;
    if (approach >= -1e-9 || discriminant < 0) return dt;
    return Math.min(dt, Math.max(0, (-approach - Math.sqrt(discriminant)) / (speed * speed)));
  }

  // The swept path is a circle; intersect it with the expanded obstacle circle.
  const signedRadius = speed / omega;
  const pathRadius = Math.abs(signedRadius);
  const cx = camera.x + signedRadius * Math.cos(camera.heading);
  const cz = camera.z - signedRadius * Math.sin(camera.heading);
  const ox = obstacle.x - cx;
  const oz = obstacle.z - cz;
  const distance = Math.hypot(ox, oz);
  if (distance === 0 || distance > pathRadius + radius || distance < Math.abs(pathRadius - radius)) return dt;
  const along = (pathRadius * pathRadius - radius * radius + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, pathRadius * pathRadius - along * along));
  let impact = dt;
  for (const side of [-1, 1]) {
    const x = (along * ox - side * across * oz) / distance;
    const z = (along * oz + side * across * ox) / distance;
    const angle = Math.atan2(z / signedRadius, -x / signedRadius);
    const turn = Math.PI * 2;
    const delta = ((Math.sign(omega) * (angle - camera.heading)) % turn + turn) % turn;
    const time = delta / Math.abs(omega);
    if (time > 1e-9) impact = Math.min(impact, time);
  }
  return impact;
}

function moveTank(camera, controls, dt, obstacles = []) {
  if (!Number.isFinite(dt) || dt <= 0) return { ...camera };
  const throttle = Math.max(-1, Math.min(1, controls.throttle || 0));
  const steer = Math.max(-1, Math.min(1, controls.steer || 0));
  const speed = throttle * (throttle < 0 ? REVERSE_SPEED : DRIVE_SPEED);
  const omega = steer * TURN_SPEED;
  const endHeading = camera.heading + omega * dt;
  let travelTime = dt;
  if (speed !== 0) {
    for (const obstacle of obstacles) travelTime = Math.min(travelTime, firstImpactTime(camera, speed, omega, dt, obstacle));
  }
  const travelHeading = camera.heading + omega * travelTime;
  let dx;
  let dz;
  if (Math.abs(omega) < 1e-9) {
    dx = Math.sin(camera.heading) * speed * travelTime;
    dz = Math.cos(camera.heading) * speed * travelTime;
  } else {
    // Integrate the circular arc so driving while turning is frame-rate independent.
    dx = speed * (Math.cos(camera.heading) - Math.cos(travelHeading)) / omega;
    dz = speed * (Math.sin(travelHeading) - Math.sin(camera.heading)) / omega;
  }
  return { x: camera.x + dx, z: camera.z + dz, heading: wrapAngle(endHeading) };
}

function projectLine(line, camera, focal, width, height, eyeHeight = EYE_HEIGHT) {
  const a = toCamera(line[0], camera);
  const b = toCamera(line[1], camera);
  a.y -= eyeHeight;
  b.y -= eyeHeight;
  const clipped = clipToNear(a, b, NEAR);
  if (!clipped) return null;
  // Clipping includes z = NEAR; project deliberately excludes that exact boundary.
  return clipped.map(p => project({ ...p, z: Math.max(p.z, NEAR + Number.EPSILON) }, focal, width, height));
}

function projectSkyLine(line, camera, focal, width, height) {
  return projectLine(line, { x: 0, z: 0, heading: camera.heading }, focal, width, height, 0);
}

function groundLines(camera, spacing = 12, cells = 22) {
  const x = Math.floor(camera.x / spacing) * spacing;
  const z = Math.floor(camera.z / spacing) * spacing;
  const radius = spacing * cells;
  const lines = [];
  for (let i = -cells; i <= cells; i++) {
    const offset = i * spacing;
    lines.push([{ x: x + offset, y: 0, z: z - radius }, { x: x + offset, y: 0, z: z + radius }]);
    lines.push([{ x: x - radius, y: 0, z: z + offset }, { x: x + radius, y: 0, z: z + offset }]);
  }
  return lines;
}

function modelLines(obstacle) {
  const { x, z, width, height, depth, heading = 0 } = obstacle;
  const w = width / 2;
  const d = depth / 2;
  const vertices = [
    { x: -w, y: 0, z: -d }, { x: w, y: 0, z: -d },
    { x: w, y: 0, z: d }, { x: -w, y: 0, z: d },
  ];
  let edges;
  if (obstacle.type === 'pyramid') {
    vertices.push({ x: 0, y: height, z: 0 });
    edges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4], [2, 4], [3, 4]];
  } else {
    vertices.push(...vertices.map(p => ({ ...p, y: height })));
    edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  }
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const world = vertices.map(p => ({ x: x + p.x * cos + p.z * sin, y: p.y, z: z - p.x * sin + p.z * cos }));
  return edges.map(([a, b]) => [world[a], world[b]]);
}

function crescentLines() {
  const bearing = 0.38;
  const distance = 950;
  const radius = 24;
  const vertices = [];
  for (const inner of [false, true]) {
    for (let i = 0; i < 32; i++) {
      const angle = (inner ? Math.PI / 2 : -Math.PI / 2) + (inner ? -1 : 1) * i / 32 * Math.PI;
      const offset = -Math.cos(angle) * radius * (inner ? 0.3 : 1);
      vertices.push({
        x: Math.sin(bearing) * distance + Math.cos(bearing) * offset,
        y: 210 + Math.sin(angle) * radius,
        z: Math.cos(bearing) * distance - Math.sin(bearing) * offset,
      });
    }
  }
  return vertices.map((p, i) => [p, vertices[(i + 1) % vertices.length]]);
}

function createWorld() {
  const placements = [
    ['cube', -17, 40, 7, 6, 7, 0.18],
    ['pyramid', 22, 58, 12, 10, 12, 0.15],
    ['cube', 7, 96, 8, 8, 8, -0.2],
    ['pyramid', -30, 100, 15, 13, 15, 0],
    ['cube', 47, 124, 10, 6, 10, 0.3],
    ['cube', -57, 72, 9, 10, 9, -0.15],
    ['pyramid', 2, 169, 18, 17, 18, 0.2],
    ['cube', -33, 173, 12, 9, 12, 0],
    ['pyramid', 74, 185, 16, 12, 16, -0.1],
    ['cube', -90, 201, 13, 13, 13, 0.35],
    ['pyramid', -58, -24, 11, 10, 11, 0],
    ['cube', 27, -48, 10, 8, 10, 0.2],
    ['cube', -20, -75, 8, 9, 8, -0.2],
    ['pyramid', 69, -87, 15, 12, 15, 0.15],
    ['pyramid', -96, -114, 17, 14, 17, 0],
    ['cube', 100, 22, 10, 7, 10, 0.3],
    ['cube', -121, 9, 14, 11, 14, -0.3],
    ['pyramid', 136, 96, 16, 15, 16, 0],
    ['cube', 55, 244, 11, 12, 11, 0.15],
    ['pyramid', -64, 282, 20, 17, 20, 0],
  ];
  const obstacles = placements.map(([type, x, z, width, height, depth, heading], i) => ({
    id: `R-${String(i + 1).padStart(2, '0')}`, type, x, z, width, height, depth, heading,
    r: Math.hypot(width, depth) / 2,
  }));
  const mountains = [];
  const count = 64;
  const peaks = Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    return {
      x: Math.sin(angle) * 950,
      y: 30 + (Math.sin(i * 4.7) + 1) * 24 + (i % 5) * 9,
      z: Math.cos(angle) * 950,
    };
  });
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    const peak = peaks[i];
    const adjacent = peaks[(i + 1) % count];
    const foot = { x: Math.sin(angle - 0.035) * 880, y: 0, z: Math.cos(angle - 0.035) * 880 };
    mountains.push([peak, adjacent], [peak, foot], [foot, adjacent]);
  }
  return { obstacles, mountains, moon: crescentLines() };
}

const SHELL_SPEED = 70;
const SHELL_RANGE = 200;
const ENEMY_SPEED = 6;
const ENEMY_TURN_SPEED = 0.6;
const ENEMY_FIRE_ANGLE = 0.045;
const ENEMY_COOLDOWN = 3;
const COMBAT_STEP = 1 / 120;
const DAMAGE_DURATION = 1.6;
const RADAR_RANGE = 160;
const RADAR_PERIOD = 4;

function waveDifficulty(kills) {
  const tier = Math.floor(Math.max(0, kills) / 5);
  // Approach safe limits without flattening progression in later waves.
  const speed = ENEMY_SPEED + 6 * tier / (tier + 3);
  const cooldown = 1.2 + 1.8 / (1 + tier / 2);
  return { wave: tier + 1, speed, cooldown, initialCooldown: 2.4 * (cooldown / ENEMY_COOLDOWN) };
}

function isGameOver(state) {
  return state.lives <= 0;
}

function radarContact(enemy, player) {
  const local = toCamera({ ...enemy, y: 0 }, player);
  const distance = Math.hypot(local.x, local.z);
  const angle = Math.atan2(local.x, local.z);
  const direction = Math.abs(angle) <= Math.PI / 4 ? 'AHEAD'
    : Math.abs(angle) >= Math.PI * 3 / 4 ? 'BEHIND' : angle > 0 ? 'RIGHT' : 'LEFT';
  return { x: local.x / RADAR_RANGE, y: -local.z / RADAR_RANGE,
    distance, inRange: distance <= RADAR_RANGE + 1e-9, direction };
}

function turnTowards(heading, from, to, maxTurn) {
  if (from.x === to.x && from.z === to.z) return wrapAngle(heading);
  const target = Math.atan2(to.x - from.x, to.z - from.z);
  const delta = wrapAngle(target - heading);
  const limit = Math.max(0, maxTurn || 0);
  return wrapAngle(heading + Math.max(-limit, Math.min(limit, delta)));
}

function createShell(tank, owner) {
  return { x: tank.x, z: tank.z, heading: tank.heading, distance: 0, owner };
}

function rayCircleDistance(origin, heading, distance, circle) {
  const dx = origin.x - circle.x;
  const dz = origin.z - circle.z;
  const gap = dx * dx + dz * dz - circle.r * circle.r;
  if (gap <= 0) return 0;
  const along = dx * Math.sin(heading) + dz * Math.cos(heading);
  const discriminant = along * along - gap;
  if (along >= 0 || discriminant < -1e-9) return null;
  const contact = -along - Math.sqrt(Math.max(0, discriminant));
  return contact <= distance + 1e-9 ? Math.min(distance, Math.max(0, contact)) : null;
}

function moveShell(shell, dt, obstacles = [], targets = []) {
  if (!shell || !Number.isFinite(dt) || dt <= 0) return { shell, hit: null };
  const distance = Math.min(SHELL_SPEED * dt, Math.max(0, SHELL_RANGE - shell.distance));
  let nearest = distance;
  let hit = null;
  // Cover wins a tie with a tank on its boundary.
  for (const [type, objects] of [['obstacle', obstacles], ['tank', targets]]) {
    for (const target of objects) {
      const contact = rayCircleDistance(shell, shell.heading, distance, target);
      if (contact !== null && (!hit || contact < nearest - 1e-9)) {
        nearest = contact;
        hit = { type, target };
      }
    }
  }
  if (hit) return { shell: null, hit };
  const travelled = shell.distance + distance;
  return {
    shell: travelled >= SHELL_RANGE - 1e-9 ? null : {
      ...shell, x: shell.x + Math.sin(shell.heading) * distance,
      z: shell.z + Math.cos(shell.heading) * distance, distance: travelled,
    },
    hit: null,
  };
}

function spawnEnemy(player, obstacles = [], sequence = 0) {
  let fallback = null;
  const outside = obstacles.reduce((r, o) => Math.max(r,
    Math.hypot(o.x - player.x, o.z - player.z) + o.r + TANK_RADIUS + 10), 200);
  for (const distance of [110 + sequence % 3 * 10, 150, outside]) {
    for (let i = 0; i < 32; i++) {
      const bearing = player.heading + (sequence % 5) * 0.55 + i * Math.PI / 16;
      const enemy = {
        x: player.x + Math.sin(bearing) * distance,
        z: player.z + Math.cos(bearing) * distance,
        heading: wrapAngle(bearing + Math.PI + 0.7), cooldown: waveDifficulty(sequence).initialCooldown,
      };
      if (obstacles.some(o => circlesHit({ ...enemy, r: TANK_RADIUS + 1 }, o))) continue;
      if (!fallback) fallback = enemy;
      if (obstacles.every(o => rayCircleDistance(player, bearing, distance, o) === null)) return enemy;
    }
  }
  return fallback;
}

function updateEnemy(enemy, player, dt, obstacles = [], difficulty = waveDifficulty(0)) {
  if (!Number.isFinite(dt) || dt <= 0) return { ...enemy };
  const heading = turnTowards(enemy.heading, enemy, player, ENEMY_TURN_SPEED * dt);
  const target = Math.atan2(player.x - enemy.x, player.z - enemy.z);
  const distance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  const aligned = Math.abs(wrapAngle(target - heading)) < 0.35;
  const travel = aligned ? Math.min(difficulty.speed * dt, Math.max(0, distance - 32)) : 0;
  const moved = moveTank({ ...enemy, heading }, { throttle: difficulty.speed / DRIVE_SPEED },
    travel / difficulty.speed, [...obstacles, { ...player, r: TANK_RADIUS }]);
  return { ...enemy, ...moved, cooldown: Math.max(0, enemy.cooldown - dt) };
}

function createGame(world = createWorld()) {
  const player = { x: 0, z: 0, heading: 0 };
  return {
    player, enemy: spawnEnemy(player, world.obstacles), enemyNumber: 1,
    playerShell: null, enemyShell: null, score: 0, lives: 3, damageTime: 0, remainder: 0, radarAngle: 0,
  };
}

function combatStep(state, controls, obstacles) {
  const dt = COMBAT_STEP;
  const difficulty = waveDifficulty(state.enemyNumber - 1);
  const player = moveTank(state.player, controls, dt, [...obstacles, { ...state.enemy, r: TANK_RADIUS }]);
  let enemy = updateEnemy(state.enemy, player, dt, obstacles, difficulty);
  let playerShell = state.playerShell;
  let enemyShell = state.enemyShell;
  if (controls.fire && !playerShell) playerShell = createShell(player, 'player');
  const distance = Math.hypot(player.x - enemy.x, player.z - enemy.z);
  const aim = Math.atan2(player.x - enemy.x, player.z - enemy.z);
  if (!enemyShell && enemy.cooldown <= 1e-9 && distance <= 180 &&
      Math.abs(wrapAngle(aim - enemy.heading)) <= ENEMY_FIRE_ANGLE &&
      obstacles.every(o => rayCircleDistance(enemy, enemy.heading, distance, o) === null)) {
    enemyShell = createShell(enemy, 'enemy');
    enemy = { ...enemy, cooldown: difficulty.cooldown };
  }
  const outgoing = moveShell(playerShell, dt, obstacles, [{ ...enemy, r: TANK_RADIUS }]);
  const incoming = moveShell(enemyShell, dt, obstacles, [{ ...player, r: TANK_RADIUS }]);
  const killed = outgoing.hit?.type === 'tank';
  const damaged = incoming.hit?.type === 'tank';
  const enemyNumber = state.enemyNumber + Number(killed);
  return {
    ...state, player, enemy: killed ? spawnEnemy(player, obstacles, enemyNumber - 1) : enemy,
    enemyNumber, playerShell: outgoing.shell, enemyShell: incoming.shell,
    score: state.score + (killed ? 1000 : 0), lives: state.lives - Number(damaged),
    radarAngle: (state.radarAngle + Math.PI * 2 * dt / RADAR_PERIOD) % (Math.PI * 2),
    damageTime: damaged ? DAMAGE_DURATION : Math.max(0, state.damageTime - dt),
  };
}

function updateGame(state, controls, dt, obstacles = []) {
  if (!Number.isFinite(dt) || dt <= 0 || isGameOver(state)) return state;
  let next = state;
  let remaining = state.remainder + dt;
  // Carry fractional ticks so all refresh rates run the same combat simulation.
  while (remaining >= COMBAT_STEP - 1e-12 && !isGameOver(next)) {
    next = combatStep(next, controls, obstacles);
    remaining = Math.max(0, remaining - COMBAT_STEP);
  }
  return { ...next, remainder: isGameOver(next) ? 0 : remaining };
}

function tankLines(tank) {
  const parts = [
    { x: -1.45, z: 0, width: 0.65, depth: 3.6, height: 0.85, y: 0.1 },
    { x: 1.45, z: 0, width: 0.65, depth: 3.6, height: 0.85, y: 0.1 },
    { x: 0, z: 0, width: 2.8, depth: 3.1, height: 0.9, y: 0.55 },
    { x: 0, z: 0, width: 1.7, depth: 1.7, height: 0.9, y: 1.45 },
    { x: 0, z: 2.1, width: 0.22, depth: 2.5, height: 0.22, y: 2 },
  ];
  const cos = Math.cos(tank.heading);
  const sin = Math.sin(tank.heading);
  return parts.flatMap(part => modelLines(part).map(line => line.map(p => ({
    x: tank.x + p.x * cos + p.z * sin, y: p.y + part.y,
    z: tank.z - p.x * sin + p.z * cos,
  }))));
}

function shellLines(shell) {
  const y = 2.1;
  const tail = Math.min(2.8, shell.distance);
  return [
    [{ x: shell.x, y, z: shell.z },
      { x: shell.x - Math.sin(shell.heading) * tail, y, z: shell.z - Math.cos(shell.heading) * tail }],
    [{ x: shell.x - 0.12, y, z: shell.z }, { x: shell.x + 0.12, y, z: shell.z }],
    [{ x: shell.x, y: y - 0.12, z: shell.z }, { x: shell.x, y: y + 0.12, z: shell.z }],
  ];
}

if (typeof module !== "undefined") module.exports = {
  toCamera, project, clipToNear, wrapAngle, moveTank,
  createWorld, groundLines, modelLines, projectLine, projectSkyLine, circlesHit,
  NEAR, DRIVE_SPEED, REVERSE_SPEED, TURN_SPEED, EYE_HEIGHT, TANK_RADIUS,
  turnTowards, createShell, moveShell, spawnEnemy, updateEnemy, createGame, updateGame, tankLines, shellLines,
  SHELL_SPEED, SHELL_RANGE, ENEMY_SPEED, ENEMY_TURN_SPEED,
  ENEMY_FIRE_ANGLE, ENEMY_COOLDOWN, COMBAT_STEP, DAMAGE_DURATION,
  waveDifficulty, radarContact, isGameOver, RADAR_RANGE, RADAR_PERIOD,
};

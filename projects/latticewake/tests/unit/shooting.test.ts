import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../../src/engine/loop';
import { BulletPool } from '../../src/game/bullets';
import { FiringRange } from '../../src/game/range';
import { Player } from '../../src/game/player';
import { PLAYER_RADIUS, PLAYER_Y, SHOT_INTERVAL, BULLET_CAPACITY } from '../../src/game/tuning';
import type { Actions } from '../../src/input/actions';

const IDLE: Readonly<Actions> = { moveX: 0, fire: false, capture: false };
const FIRE: Readonly<Actions> = { moveX: 0, fire: true, capture: false };

function snapshot(range: FiringRange): unknown {
  return {
    seed: range.seed, ticks: range.ticks, cooldown: range.cooldown,
    player: { x: range.player.x, previousX: range.player.previousX, velocityX: range.player.velocityX },
    shots: range.shotsFired, blocked: range.bullets.deniedVolleys,
    bullets: range.bullets.slots.filter(bullet => bullet.active).map(bullet => ({
      id: bullet.id, x: bullet.x, y: bullet.y, previousX: bullet.previousX, previousY: bullet.previousY,
      velocityX: bullet.velocityX,
    })),
  };
}

describe('Needle movement', () => {
  it('accelerates toward 250 units/s and decelerates without overshoot', () => {
    const player = new Player();
    expect(player.x).toBe(180);
    expect(player.y).toBe(PLAYER_Y);
    player.step(1);
    expect(player.previousX).toBe(180);
    expect(player.velocityX).toBeCloseTo(1600 / 60, 3);
    expect(player.x).toBeCloseTo(180 + 1600 / 3600, 3);
    for (let tick = 1; tick < 10; tick++) player.step(1);
    expect(player.velocityX).toBe(250);
    const movingX = player.x;
    player.step(0);
    expect(player.velocityX).toBeGreaterThan(0);
    expect(player.velocityX).toBeLessThan(250);
    expect(player.x).toBeGreaterThan(movingX);
    for (let tick = 0; tick < 10; tick++) player.step(0);
    expect(player.velocityX).toBe(0);
    const stoppedX = player.x;
    player.step(0);
    expect(player.x).toBe(stoppedX);
  });

  it('reverses smoothly, clamps by hit radius and can leave either wall', () => {
    const player = new Player();
    for (const direction of [1, -1]) {
      for (let tick = 0; tick < 600; tick++) {
        player.step(direction);
        expect(player.x).toBeGreaterThanOrEqual(PLAYER_RADIUS);
        expect(player.x).toBeLessThanOrEqual(360 - PLAYER_RADIUS);
        expect(player.x * 1024).toBe(Math.round(player.x * 1024));
        expect(player.velocityX * 1024).toBe(Math.round(player.velocityX * 1024));
        expect(player.y).toBe(PLAYER_Y);
      }
      expect(player.x).toBe(direction === 1 ? 360 - PLAYER_RADIUS : PLAYER_RADIUS);
      expect(player.velocityX).toBe(0);
      player.step(-direction);
      expect(player.velocityX * direction).toBeLessThan(0);
    }
    player.reset();
    for (let tick = 0; tick < 10; tick++) player.step(1);
    player.step(-1);
    expect(player.velocityX).toBeGreaterThan(0);
    for (let tick = 0; tick < 20; tick++) player.step(-1);
    expect(player.velocityX).toBe(-250);
  });

  it('supports bounded analog magnitude and synchronizes spawn/reset poses', () => {
    const player = new Player();
    for (let tick = 0; tick < 10; tick++) player.step(0.5);
    expect(player.velocityX).toBe(125);
    player.step(99);
    expect(player.velocityX).toBeLessThanOrEqual(250);
    player.step(-99);
    expect(player.velocityX).toBeGreaterThanOrEqual(-250);
    player.reset();
    expect(player.x).toBe(180);
    expect(player.previousX).toBe(180);
    expect(player.velocityX).toBe(0);
  });
});

describe('bounded bullet pool', () => {
  it('preallocates 128 slots, spawns synchronized poses and moves 540 units/s', () => {
    const pool = new BulletPool();
    expect(pool.slots).toHaveLength(128);
    expect(pool.count).toBe(0);
    expect(pool.spawnVolley(180, 560, [0])).toBe(true);
    const bullet = pool.slots[0];
    expect(bullet).toMatchObject({ active: true, id: 1, generation: 1, x: 180, y: 560, previousX: 180, previousY: 560 });
    pool.step();
    expect(bullet).toMatchObject({ y: 551, previousY: 560 });
    expect(pool.peak).toBe(1);
  });

  it('rejects a whole volley without changing any slot when capacity is insufficient', () => {
    const pool = new BulletPool();
    expect(pool.spawnVolley(180, 560, Array.from({ length: 127 }, () => 0))).toBe(true);
    const before = JSON.stringify(pool.slots);
    expect(pool.spawnVolley(180, 560, [-90, 0, 90])).toBe(false);
    expect(pool.count).toBe(127);
    expect(JSON.stringify(pool.slots)).toBe(before);
    expect(pool.deniedVolleys).toBe(1);
    expect(pool.spawnVolley(180, 560, [0])).toBe(true);
    expect(pool.count).toBe(BULLET_CAPACITY);
    expect(pool.spawnVolley(180, 560, [0])).toBe(false);
    expect(pool.count).toBe(BULLET_CAPACITY);
  });

  it('recycles in stable slot order with fresh IDs and rejects stale/double releases', () => {
    const pool = new BulletPool();
    pool.spawnVolley(180, 560, [-90, 90]);
    const first = pool.slots[0];
    if (!first) throw new Error('Missing preallocated bullet');
    const generation = first.generation;
    expect(pool.release(0, generation)).toBe(true);
    expect(pool.release(0, generation)).toBe(false);
    expect(pool.release(-1, generation)).toBe(false);
    expect(pool.spawnVolley(10, 100, [0])).toBe(true);
    expect(pool.slots[0]).toBe(first);
    expect(first).toMatchObject({ id: 3, generation: generation + 1, x: 10, previousX: 10, y: 100, previousY: 100 });
    expect(pool.release(0, generation)).toBe(false);
    expect(pool.count).toBe(2);
    pool.reset();
    pool.spawnVolley(180, 560, [0]);
    expect(pool.release(0, generation + 1)).toBe(false);
    expect(pool.count).toBe(1);
    expect(pool.slots[0]?.id).toBe(1);
  });

  it('expires fully offscreen bullets including outward edge volleys and resets metrics', () => {
    const pool = new BulletPool();
    pool.spawnVolley(180, 0, [0]);
    pool.spawnVolley(0, 100, [-540]);
    pool.spawnVolley(360, 100, [540]);
    pool.step();
    expect(pool.count).toBe(0);
    expect(pool.slots.every(bullet => !bullet.active)).toBe(true);
    pool.spawnVolley(180, 560, [90]);
    pool.step();
    expect(pool.slots[0]?.x).toBe(181.5);
    const slots = [...pool.slots];
    pool.reset();
    expect(pool.count).toBe(0);
    expect(pool.peak).toBe(0);
    expect(pool.deniedVolleys).toBe(0);
    expect(pool.slots).toEqual(slots);
    expect(pool.slots.every((bullet, index) => bullet === slots[index])).toBe(true);
  });
});

describe('firing range', () => {
  it('fires immediately then every 9 ticks while held and not on capture', () => {
    const range = new FiringRange();
    const firedAt: number[] = [];
    for (let tick = 1; tick <= 60; tick++) {
      const before = range.shotsFired;
      range.step(FIRE);
      if (range.shotsFired !== before) firedAt.push(tick);
    }
    expect(firedAt).toEqual([1, 10, 19, 28, 37, 46, 55]);
    expect(range.cooldown).toBe(4);
    for (let tick = 0; tick < 20; tick++) range.step({ ...IDLE, capture: true });
    expect(range.shotsFired).toBe(7);
    range.step(FIRE);
    expect(range.shotsFired).toBe(8);
    expect(range.cooldown).toBe(SHOT_INTERVAL);
  });

  it('does not reset the shot interval on release and fires from the current ship position', () => {
    const range = new FiringRange();
    range.step({ ...FIRE, moveX: 1 });
    expect(range.bullets.slots[0]?.x).toBe(range.player.x);
    range.step(IDLE);
    for (let tick = 0; tick < 7; tick++) range.step(FIRE);
    expect(range.shotsFired).toBe(1);
    range.step(FIRE);
    expect(range.shotsFired).toBe(2);
  });

  it('does not consume cooldown or shot count on overflow and retries once a slot frees', () => {
    const range = new FiringRange();
    range.bullets.spawnVolley(180, 560, Array.from({ length: BULLET_CAPACITY }, () => 0));
    range.step(FIRE);
    expect(range.cooldown).toBe(0);
    expect(range.shotsFired).toBe(0);
    expect(range.bullets.deniedVolleys).toBe(1);
    const first = range.bullets.slots[0];
    if (!first) throw new Error('Missing bullet');
    range.bullets.release(0, first.generation);
    range.step(FIRE);
    expect(range.cooldown).toBe(SHOT_INTERVAL);
    expect(range.shotsFired).toBe(1);
    expect(range.bullets.count).toBe(BULLET_CAPACITY);
    expect(first.previousY).toBe(first.y);
  });

  it('runs two minutes of fire with bounded occupancy, expiry and zero new entity objects', () => {
    const range = new FiringRange();
    const slots = [...range.bullets.slots];
    for (let tick = 0; tick < 7200; tick++) range.step({ ...FIRE, moveX: tick % 240 < 120 ? 1 : -1 });
    expect(range.ticks).toBe(7200);
    expect(range.shotsFired).toBe(800);
    expect(range.bullets.peak).toBe(7);
    expect(range.bullets.deniedVolleys).toBe(0);
    expect(range.bullets.count).toBeLessThanOrEqual(7);
    expect(range.bullets.slots.every((bullet, index) => bullet === slots[index])).toBe(true);
    for (let tick = 0; tick < 120; tick++) range.step(IDLE);
    expect(range.bullets.count).toBe(0);
  });

  it('resets every run value, preserving preallocated storage and invalidating old handles', () => {
    const range = new FiringRange();
    range.reset(42);
    for (let tick = 0; tick < 120; tick++) range.step({ ...FIRE, moveX: 1 });
    const pool = range.bullets;
    const player = range.player;
    range.reset(42);
    expect(range.bullets).toBe(pool);
    expect(range.player).toBe(player);
    const fresh = new FiringRange();
    fresh.reset(42);
    expect(snapshot(range)).toEqual(snapshot(fresh));
    range.step(FIRE);
    fresh.step(FIRE);
    expect(snapshot(range)).toEqual(snapshot(fresh));
    expect(() => range.reset(-1)).toThrow(RangeError);
  });

  it('repeats a tick-indexed action tape independently of render cadence', () => {
    const run = (hz: number): unknown => {
      const range = new FiringRange();
      range.reset(42);
      const actions = { ...IDLE };
      const loop = new FixedLoop(() => {
        actions.moveX = range.ticks % 180 < 90 ? 1 : -1;
        actions.fire = range.ticks % 100 < 80;
        range.step(actions);
      }, () => {});
      for (let frame = 0; frame <= hz * 10; frame++) loop.frame(frame * 1000 / hz);
      expect(loop.droppedMs).toBe(0);
      expect(range.ticks).toBe(600);
      return snapshot(range);
    };
    const reference = run(60);
    for (const hz of [30, 90, 120, 144]) expect(run(hz)).toEqual(reference);
    expect(reference).toMatchObject({ seed: 42, ticks: 600, shots: 54, blocked: 0 });
    expect(createHash('sha256').update(JSON.stringify(reference)).digest('hex'))
      .toBe('59e4f81639a13ae7cb9bcae5d53066acf272d764ef09574caac7849fd7ea9b58');
  });
});

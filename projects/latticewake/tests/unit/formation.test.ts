import { at } from '../../src/math/indexed';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HitEvents, EVENT_CAPACITY } from '../../src/game/events';
import { FixedLoop } from '../../src/engine/loop';
import { BulletPool } from '../../src/game/bullets';
import { EnemyPool, type EnemyKind } from '../../src/game/enemies';
import { Formation } from '../../src/game/formation';
import { FormationSession } from '../../src/game/session';
import { ParticlePool } from '../../src/game/particles';
import { CollisionLayer, collides, CollisionSystem, SweptGrid } from '../../src/game/collisions';
import { sampleBezier, ENTRY_LEFT, ENTRY_RIGHT, ENTRY_TICKS, swayX } from '../../src/math/paths';
import { sweptCircleTime } from '../../src/math/collision';

const IDLE = { moveX: 0, fire: false, capture: false };
const KINDS: readonly EnemyKind[] = ['shardlet', 'spindle', 'bellframe'];

function settle(formation: Formation): void {
  const bullets = new BulletPool();
  for (let tick = 1; tick <= 400; tick++) formation.step(bullets, tick);
}

function saturatedPool(): EnemyPool {
  const pool = new EnemyPool();
  for (let index = 0; index < 48; index++) pool.spawn(at(KINDS, index % 3), index, 0, 0, 30, 30);
  for (const enemy of pool.slots) enemy.state = 'formation';
  return pool;
}

function snapshot(session: FormationSession): unknown {
  const range = session.range;
  return {
    ticks: range.ticks, seed: range.seed, player: range.player.x, velocity: range.player.velocityX,
    cooldown: range.cooldown, shots: range.shotsFired, score: session.formation.score,
    kills: session.formation.kills, cleared: session.formation.cleared,
    slots: session.formation.slots.map(slot => ({ x: slot.x, y: slot.y, owner: slot.owner, state: slot.state })),
    enemies: session.formation.enemies.slots.map(enemy => ({
      active: enemy.active, id: enemy.id, kind: enemy.kind, hp: enemy.hp, state: enemy.state,
      x: enemy.x, y: enemy.y, previousX: enemy.previousX, previousY: enemy.previousY,
    })),
    bullets: range.bullets.slots.filter(bullet => bullet.active).map(bullet => ({
      id: bullet.id, x: bullet.x, y: bullet.y, previousX: bullet.previousX, previousY: bullet.previousY,
    })),
  };
}

describe('checked preallocated storage', () => {
  it('rejects invalid indices instead of silently inventing state', () => {
    expect(at([42], 0)).toBe(42);
    for (const index of [-1, 1, 0.5]) expect(() => at([42], index)).toThrow(RangeError);
  });
});

describe('authored quantized paths and bounded sway', () => {
  it('samples cubic endpoints, midpoint and quantization once', () => {
    expect(Array.from(sampleBezier([0, 0, 0, 100, 100, 100, 100, 0], 4)))
      .toEqual([0, 0, 15.625, 56.25, 50, 75, 84.375, 56.25, 100, 0]);
    expect(ENTRY_LEFT.length).toBe((ENTRY_TICKS + 1) * 2);
    for (const entry of [ENTRY_LEFT, ENTRY_RIGHT]) {
      expect(Array.from(entry.slice(-2))).toEqual([0, 0]);
      expect(Array.from(entry).every(value => value * 1024 === Math.round(value * 1024))).toBe(true);
    }
    expect(() => sampleBezier([0, 0], 4)).toThrow(RangeError);
    expect(() => sampleBezier([0, 0, 0, 0, 0, 0, 0, Infinity], 4)).toThrow(RangeError);
    for (const ticks of [0, -1, 2.5]) expect(() => sampleBezier([0, 0, 0, 0, 0, 0, 0, 0], ticks)).toThrow(RangeError);
  });

  it('uses a periodic fixed lookup, not gameplay transcendental functions', () => {
    for (let tick = 0; tick < 1024; tick++) {
      expect(Math.abs(swayX(tick))).toBeLessThanOrEqual(12);
      expect(swayX(tick)).toBe(swayX(tick + 256));
      expect(swayX(tick) * 1024).toBe(Math.round(swayX(tick) * 1024));
    }
    expect(swayX(0)).toBe(0);
    expect(swayX(64)).toBe(12);
  });
});

describe('relative swept collision layers', () => {
  it('includes tangency, initial overlap and stationary contacts but excludes misses', () => {
    expect(sweptCircleTime(0, 0, 100, 0, 50, 10, 50, 10, 10)).toBe(0.5);
    expect(sweptCircleTime(0, 0, 0, 0, 0, 0, 0, 0, 1)).toBe(0);
    expect(sweptCircleTime(0, 0, 0, 0, 20, 0, 20, 0, 1)).toBe(Infinity);
    expect(sweptCircleTime(0, 0, 100, 0, 50, 11, 50, 11, 10)).toBe(Infinity);
    expect(sweptCircleTime(0, 0, -100, 0, 50, 0, 50, 0, 10)).toBe(Infinity);
    expect(sweptCircleTime(0, 0, 100, 0, 100, 0, 0, 0, 10)).toBeCloseTo(0.45);
    expect(sweptCircleTime(0, 0, 10, 0, 20, 0, 20, 0, 10)).toBe(1);
  });

  it('allows only declared opposing layers; cosmetics and friendly fire never collide', () => {
    expect(collides(CollisionLayer.PlayerShot, CollisionLayer.Enemy)).toBe(true);
    expect(collides(CollisionLayer.Enemy, CollisionLayer.PlayerShot)).toBe(true);
    expect(collides(CollisionLayer.Player, CollisionLayer.HostileShot)).toBe(true);
    expect(collides(CollisionLayer.Player, CollisionLayer.Enemy)).toBe(true);
    for (const layer of [CollisionLayer.Player, CollisionLayer.PlayerShot, CollisionLayer.Enemy, CollisionLayer.HostileShot, CollisionLayer.Cosmetic]) {
      expect(collides(layer, layer)).toBe(false);
      expect(collides(layer, CollisionLayer.Cosmetic)).toBe(false);
    }
    expect(collides(CollisionLayer.PlayerShot, CollisionLayer.HostileShot)).toBe(false);
  });
});

describe('enemy pool and independent formation ownership', () => {
  it('preallocates 48 reusable typed enemies and rejects saturation/stale handles', () => {
    const pool = saturatedPool();
    const identities = [...pool.slots];
    expect(pool.count).toBe(48);
    expect(pool.spawn('shardlet', 0, 0, 0, 0, 0)).toBe(-1);
    const first = at(pool.slots, 0);
    const generation = first.generation;
    expect(pool.release(0, generation)).toBe(true);
    expect(pool.release(0, generation)).toBe(false);
    expect(pool.release(-1, generation)).toBe(false);
    expect(pool.spawn('shardlet', 0, 0, 0, 20, 30)).toBe(0);
    expect(first).toMatchObject({ x: 20, y: 30, previousX: 20, previousY: 30, hp: 1 });
    expect(pool.release(0, generation)).toBe(false);
    const newer = first.generation;
    pool.reset();
    pool.spawn('shardlet', 0, 0, 0, 40, 50);
    expect(pool.release(0, newer)).toBe(false);
    expect(pool.slots.every((enemy, index) => enemy === identities[index])).toBe(true);
  });

  it('reserves slots, staggers entries, and holds three types in a bounded 6×4 grid', () => {
    const formation = new Formation();
    formation.reset(42);
    expect(formation.enemies.count).toBe(24);
    expect(formation.slots.every(slot => slot.state === 'reserved')).toBe(true);
    expect(formation.reserve(0, 'shardlet', 0, 0)).toBe(false);
    expect(formation.reserve(-1, 'shardlet', 0, 0)).toBe(false);
    const bullets = new BulletPool();
    formation.step(bullets, 1);
    expect(formation.enemies.slots.filter(enemy => enemy.active && enemy.state === 'entry')).toHaveLength(1);
    const first = at(formation.enemies.slots, 0);
    expect(first.previousX).toBe(first.x);
    expect(first.previousY).toBe(first.y);
    settle(formation);
    expect(formation.slots.every(slot => slot.state === 'occupied')).toBe(true);
    for (const kind of KINDS) expect(formation.enemies.slots.filter(enemy => enemy.active && enemy.kind === kind)).toHaveLength(8);
    for (let tick = 401; tick < 1000; tick++) {
      formation.step(bullets, tick);
      for (const enemy of formation.enemies.slots) {
        if (!enemy.active) continue;
        expect(enemy.state).toBe('formation');
        expect(enemy.x).toBeGreaterThanOrEqual(43);
        expect(enemy.x).toBeLessThanOrEqual(317);
        expect(enemy.y).toBeGreaterThanOrEqual(94);
        expect(enemy.y).toBeLessThanOrEqual(248);
        expect(enemy.x * 1024).toBe(Math.round(enemy.x * 1024));
      }
    }
  });

  it('lands continuously on a moving slot, rejects queued/stale damage and never reuses destroyed slots', () => {
    const formation = new Formation();
    formation.reset(0);
    const bullets = new BulletPool();
    const first = at(formation.enemies.slots, 0);
    expect(formation.hit(0, first.generation)).toBe(false);
    formation.step(bullets, ENTRY_TICKS);
    const before = first.x;
    formation.step(bullets, 1 + ENTRY_TICKS);
    expect(first.state).toBe('formation');
    expect(Math.abs(first.x - before)).toBeLessThan(1);
    expect(formation.hit(-1, 0)).toBe(false);
    expect(formation.hit(0, first.generation - 1)).toBe(false);
    expect(formation.hit(0, first.generation)).toBe(true);
    expect(formation.hit(0, first.generation)).toBe(false);
    expect(formation.slots[0]?.state).toBe('destroyed');
    expect(formation.reserve(0, 'shardlet', 0, 0)).toBe(false);
    expect(formation.score).toBe(100);
  });

  it('cannot replace an owned slot or clobber a newer reservation through a stale entity', () => {
    const formation = new Formation();
    for (let index = 0; index < 16; index++) formation.enemies.spawn('shardlet', index, 0, 0, 0, 0);
    expect(formation.reserve(0, 'shardlet', 0, 0)).toBe(false);
    expect(formation.slots[0]).toMatchObject({ state: 'empty', owner: -1 });
    formation.reset(42);
    const slot = at(formation.slots, 0);
    slot.generation++;
    const enemy = at(formation.enemies.slots, slot.owner);
    formation.step(new BulletPool(), 500);
    expect(enemy.state).toBe('queued');
    enemy.state = 'formation';
    expect(formation.hit(slot.owner, enemy.generation)).toBe(false);
    expect(formation.score).toBe(0);
  });

  it('requires 1/2/3 hits, shows damage and awards each ID exactly once', () => {
    const formation = new Formation();
    formation.reset(42);
    settle(formation);
    for (let index = 0; index < formation.enemies.slots.length; index++) {
      const enemy = at(formation.enemies.slots, index);
      if (!enemy.active) continue;
      const before = formation.score;
      for (let hit = 1; hit <= enemy.maxHP; hit++) {
        expect(formation.hit(index, enemy.generation)).toBe(true);
        if (hit < enemy.maxHP) {
          expect(formation.score).toBe(before);
          expect(enemy.hitTicks).toBeGreaterThan(0);
          expect(enemy.hp).toBe(enemy.maxHP - hit);
          expect(formation.damaged).toBe(1);
        }
      }
      expect(formation.score).toBe(before + enemy.points);
      expect(formation.hit(index, enemy.generation)).toBe(false);
    }
    expect(formation.score).toBe(4640);
    expect(formation.hits).toBe(48);
    expect(formation.damaged).toBe(0);
    expect(formation.kills).toBe(24);
    expect(formation.cleared).toBe(true);
    expect(formation.enemies.count).toBe(0);
    expect(formation.events.count).toBe(48);
    formation.reset(42);
    expect(formation.score).toBe(0);
    expect(formation.events.count).toBe(0);
    expect(formation.kills).toBe(0);
    expect(formation.cleared).toBe(false);
  });
});

describe('fixed swept broad phase and contact ordering', () => {
  it('indexes swept bounds, deduplicates queries and loses no candidates in a saturated cell', () => {
    const pool = saturatedPool();
    const grid = new SweptGrid();
    grid.rebuild(pool);
    expect(grid.peakCell).toBe(48);
    expect(grid.query(0, 0, 100, 100)).toBe(48);
    expect(new Set(grid.results.slice(0, 48)).size).toBe(48);
    expect(grid.query(-200, -200, -100, -100)).toBe(0);
    expect(grid.query(500, 800, 600, 900)).toBe(0);
    const first = at(pool.slots, 0);
    first.previousX = -100; first.previousY = 300; first.x = 500; first.y = 300;
    grid.rebuild(pool);
    expect(grid.query(175, 280, 185, 320)).toBe(1);
  });

  it('orders all 128×48 contacts without overflow and consumes each shot at most once', () => {
    const pool = saturatedPool();
    const bullets = new BulletPool();
    bullets.spawnVolley(30, 30, Array.from({ length: 128 }, () => 0));
    const hits: number[] = [];
    const collision = new CollisionSystem();
    collision.resolve(bullets, pool, { hit(index, generation) { hits.push(at(pool.slots, index).id); return pool.release(index, generation); } });
    expect(collision.count).toBe(6144);
    expect(hits).toEqual(Array.from({ length: 48 }, (_, index) => index + 1));
    expect(pool.count).toBe(0);
    expect(bullets.count).toBe(80);
    expect(collision.grid.peakCell).toBe(48);
  });

  it('resolves a high-relative-speed offscreen sweep before recycling the bullet', () => {
    const pool = new EnemyPool();
    pool.spawn('shardlet', 0, 0, 0, 0, 200);
    const enemy = at(pool.slots, 0);
    enemy.state = 'formation';
    enemy.previousX = 360;
    const bullets = new BulletPool();
    bullets.spawnVolley(0, 200, [24000]);
    bullets.step(false);
    expect(bullets.count).toBe(1);
    expect(at(bullets.slots, 0).x).toBe(400);
    const collision = new CollisionSystem();
    collision.resolve(bullets, pool, { hit: (index, generation) => pool.release(index, generation) });
    expect(collision.count).toBe(1);
    expect(pool.count).toBe(0);
    expect(bullets.count).toBe(0);
    bullets.expireOffscreen();
    expect(bullets.count).toBe(0);
  });

  it('chooses earliest impacts before IDs, falls through destroyed targets, and excludes misses', () => {
    const pool = new EnemyPool();
    pool.spawn('shardlet', 0, 0, 0, 100, 100);
    pool.spawn('spindle', 1, 0, 0, 100, 200);
    for (const enemy of pool.slots) if (enemy.active) enemy.state = 'formation';
    const bullets = new BulletPool();
    bullets.spawnVolley(100, 300, [0, 0, 0]);
    for (const bullet of bullets.slots) if (bullet.active) bullet.y = 0;
    const hits: number[] = [];
    new CollisionSystem().resolve(bullets, pool, { hit(index, generation) { hits.push(at(pool.slots, index).id); return pool.release(index, generation); } });
    expect(hits).toEqual([2, 1]);
    expect(bullets.count).toBe(1);
    const missPool = new EnemyPool();
    missPool.spawn('shardlet', 0, 0, 0, 200, 200);
    at(missPool.slots, 0).state = 'formation';
    const collision = new CollisionSystem();
    collision.resolve(bullets, missPool, { hit: () => { throw new Error('Miss cannot damage'); } });
    expect(collision.count).toBe(0);
  });
});

describe('bounded cosmetic explosions', () => {
  it('bounds events, preserves stable storage/order and exposes overflow without affecting rules', () => {
    const events = new HitEvents();
    const slots = [...events.slots];
    for (let id = 1; id <= EVENT_CAPACITY + 1; id++) events.push('hit', 42, id, 10, 20);
    expect(events.count).toBe(EVENT_CAPACITY);
    expect(events.dropped).toBe(1);
    expect(events.slots[0]).toEqual({ kind: 'hit', tick: 42, id: 1, x: 10, y: 20 });
    events.begin();
    expect(events.count).toBe(0);
    expect(events.dropped).toBe(1);
    events.push('destroy', 43, 5, 30, 40);
    expect(events.slots[0]).toEqual({ kind: 'destroy', tick: 43, id: 5, x: 30, y: 40 });
    events.reset();
    expect(events.dropped).toBe(0);
    expect(events.slots.every((event, index) => event === slots[index])).toBe(true);
  });
  it('reuses 512 slots, reports dropped cosmetics, expires and resets', () => {
    const particles = new ParticlePool();
    const slots = [...particles.slots];
    for (let burst = 0; burst < 50; burst++) particles.burst(180, 200);
    expect(particles.count).toBe(512);
    expect(particles.peak).toBe(512);
    expect(particles.dropped).toBe(88);
    particles.step();
    expect(particles.slots[0]?.previousX).toBe(180);
    expect(particles.slots[0]?.x).not.toBe(180);
    for (let tick = 0; tick < 60; tick++) particles.step();
    expect(particles.count).toBe(0);
    particles.burst(10, 20);
    expect(particles.slots[0]).toMatchObject({ x: 10, y: 20, previousX: 10, previousY: 20 });
    particles.reset();
    expect(particles.count).toBe(0);
    expect(particles.dropped).toBe(0);
    expect(particles.slots.every((particle, index) => particle === slots[index])).toBe(true);
  });
});

describe('real formation session', () => {
  it('keeps seven-shot occupancy when expiry is deferred for collisions during a stationary two-minute soak', () => {
    const session = new FormationSession();
    session.reset(42);
    const slots = [...session.range.bullets.slots];
    for (let tick = 0; tick < 7200; tick++) session.step({ ...IDLE, fire: true });
    expect(session.formation.cleared).toBe(false);
    expect(session.range.shotsFired).toBe(800);
    expect(session.range.bullets.peak).toBe(7);
    expect(session.range.bullets.deniedVolleys).toBe(0);
    expect(session.range.bullets.slots.every((bullet, index) => bullet === slots[index])).toBe(true);
    for (let tick = 0; tick < 120; tick++) session.step(IDLE);
    expect(session.range.bullets.count).toBe(0);
  });
  it('clears through ordinary movement/fire and repeats with no stale state', () => {
    const session = new FormationSession();
    session.reset(42);
    expect(session.complete).toBe(false);
    for (let tick = 0; tick < 18000 && !session.formation.cleared; tick++) {
      session.step({ ...IDLE, fire: true, moveX: tick % 240 < 120 ? 1 : -1 });
    }
    expect(session.formation.cleared).toBe(true);
    expect(session.formation.score).toBe(4640);
    expect(session.formation.kills).toBe(24);
    expect(session.formation.events.dropped).toBe(0);
    expect(session.complete).toBe(false);
    const shotsAtClear = session.range.shotsFired;
    for (let tick = 0; tick < 120; tick++) session.step({ ...IDLE, fire: true });
    expect(session.complete).toBe(true);
    expect(session.range.shotsFired).toBe(shotsAtClear);
    expect(session.formation.score).toBe(4640);
    const identities = [...session.formation.enemies.slots];
    const generation = at(session.formation.enemies.slots, 0).generation;
    session.reset(42);
    expect(session.range.ticks).toBe(0);
    expect(session.range.bullets.count).toBe(0);
    expect(session.particles.count).toBe(0);
    expect(session.formation.score).toBe(0);
    expect(session.formation.enemies.count).toBe(24);
    expect(session.formation.hit(0, generation)).toBe(false);
    expect(session.formation.enemies.slots.every((enemy, index) => enemy === identities[index])).toBe(true);
    const fresh = new FormationSession();
    fresh.reset(42);
    expect(snapshot(session)).toEqual(snapshot(fresh));
  });

  it('has the same whole-game checksum across render cadences and cosmetic pool pressure', () => {
    const run = (hz: number, suppressParticles = false): unknown => {
      const session = new FormationSession();
      session.reset(42);
      const actions = { ...IDLE, fire: true };
      const loop = new FixedLoop(() => {
        actions.moveX = session.range.ticks % 240 < 120 ? 1 : -1;
        if (suppressParticles) for (let burst = 0; burst < 43; burst++) session.particles.burst(0, 0);
        session.step(actions);
      }, () => {});
      for (let frame = 0; frame <= hz * 40; frame++) loop.frame(frame * 1000 / hz);
      expect(session.range.ticks).toBe(2400);
      expect(loop.droppedMs).toBe(0);
      return snapshot(session);
    };
    const reference = run(60);
    expect(reference).toMatchObject({ score: 4640, kills: 24, cleared: true });
    for (const hz of [30, 90, 120, 144]) expect(run(hz)).toEqual(reference);
    expect(run(60, true)).toEqual(reference);
    expect(createHash('sha256').update(JSON.stringify(reference)).digest('hex')).toBe('817e80140a97c739f613e428e7efe119c6b8f156dc5b7d017ee8cbaca4bfe7b8');
  });
});

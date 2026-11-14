import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../../src/engine/loop';
import { AttackDirector } from '../../src/game/attacks';
import { BulletPool } from '../../src/game/bullets';
import { Formation } from '../../src/game/formation';
import { HostilePool } from '../../src/game/hostiles';
import { RunSession } from '../../src/game/run';
import { createStage, difficulty, validateStage, type StageConfig } from '../../src/game/stages';
import { Vitals } from '../../src/game/vitals';
import { at } from '../../src/math/indexed';
import { RULES_VERSION } from '../../src/math/random';

const IDLE = { moveX: 0, fire: false, capture: false };

function sweep(run: RunSession): void {
  run.step({ ...IDLE, fire: true, moveX: run.range.ticks % 160 < 80 ? 1 : -1 });
}

function advance(formation: Formation, attacks: AttackDirector, pool: HostilePool, config: StageConfig, from: number, to: number): void {
  for (let tick = from; tick <= to; tick++) {
    formation.advance(tick);
    pool.step();
    attacks.step(formation, tick, 140, config, 3, true);
    pool.expire();
    attacks.fire(formation, pool, config, true);
  }
}

describe('validated bounded stage data', () => {
  it('introduces attack types progressively, with nonlethal twenty-target bonus stages and bounded endless difficulty', () => {
    expect(createStage(1).attackKinds).toEqual(['shardlet']);
    expect(createStage(2).attackKinds).toEqual(['shardlet', 'spindle']);
    expect(createStage(3).attackKinds).toEqual(['shardlet', 'spindle', 'bellframe']);
    for (let stage = 1; stage <= 120; stage++) {
      const config = createStage(stage);
      expect(() => validateStage(config)).not.toThrow();
      expect(config.maxDivers).toBeLessThanOrEqual(6);
      expect(config.hostileCap).toBeLessThanOrEqual(128);
      expect(config.warningTicks).toBeGreaterThanOrEqual(24);
      expect(config.shotInterval).toBeGreaterThanOrEqual(30);
      if (stage % 5 === 0) expect(config).toMatchObject({ kind: 'boss', layout: [], maxDivers: 0 });
      else if (stage % 4 === 0) expect(config).toMatchObject({ kind: 'bonus', duration: 1200, maxDivers: 0, hostileCap: 0, attackKinds: [] });
    }
    expect(difficulty(1)).toBe(1);
    expect(difficulty(1000)).toBe(2.2);
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => createStage(value)).toThrow(RangeError);
  });

  it('rejects malformed layouts, path IDs, timing, capacities, malformed drops and lethal bonus configs', () => {
    const good = createStage(1);
    const bad: unknown[] = [null, { kind: 'boss' }, { seedOffset: -1 }, { layout: [] }, { layout: null },
      { layout: Array(25).fill('spindle') }, { layout: Array(17).fill('bellframe') }, { layout: ['unknown'] },
      { pathIds: [2, 0] }, { pathIds: null }, { pathIds: [0] }, { entryTicks: 1 }, { entrySpacing: 0 },
      { warningTicks: 23 }, { diveCadence: 0 }, { maxDivers: 7 }, { maxDivers: 0 }, { hostileCap: 129 },
      { hostileCap: 0 }, { shotInterval: 29 }, { shotSpeed: 500 }, { attackKinds: ['boss'] }, { attackKinds: null },
      { duration: 1 }, { drops: ['ward'] }, { drops: null }];
    for (const patch of bad) {
      const value = patch === null ? null : { ...good, ...patch as object };
      expect(() => validateStage(value as StageConfig)).toThrow(RangeError);
    }
    const bonus = createStage(4);
    for (const patch of [{ layout: good.layout }, { maxDivers: 1 }, { hostileCap: 1 }, { attackKinds: ['shardlet'] }, { duration: 599 }]) {
      expect(() => validateStage({ ...bonus, ...patch } as StageConfig)).toThrow(RangeError);
    }
  });
});

describe('separate hostile pool', () => {
  it('preallocates 128, respects per-stage caps, defers overflow, preserves generations and synchronizes reuse', () => {
    const pool = new HostilePool();
    const identities = [...pool.slots];
    expect(pool.spawn(100, 100, 0, 150, 1, 1)).toBe(true);
    expect(pool.spawn(100, 100, 0, 150, 2, 1)).toBe(false);
    for (let i = 1; i < 128; i++) expect(pool.spawn(i, 100, 10, 150, i)).toBe(true);
    expect(pool.spawn(0, 0, 0, 150, 0)).toBe(false);
    expect(pool).toMatchObject({ count: 128, peak: 128, deferred: 2, fired: 128 });
    const generation = at(pool.slots, 0).generation;
    expect(pool.release(0, generation - 1)).toBe(false);
    expect(pool.release(-1, generation)).toBe(false);
    expect(pool.release(0, generation)).toBe(true);
    expect(pool.release(0, generation)).toBe(false);
    expect(pool.spawn(30, 40, 0, 150, 42)).toBe(true);
    expect(pool.slots[0]).toMatchObject({ previousX: 30, previousY: 40, owner: 42 });
    const newer = at(pool.slots, 0).generation;
    pool.reset();
    pool.spawn(20, 30, 0, 150, 7);
    expect(pool.release(0, newer)).toBe(false);
    expect(pool.slots.every((shot, index) => shot === identities[index])).toBe(true);
    expect(pool).toMatchObject({ count: 1, peak: 1, deferred: 0, fired: 1 });
  });

  it('moves downward without touching player bullets, expires all four boundaries after sweeps, clears only nearby hazards', () => {
    const pool = new HostilePool();
    pool.spawn(180, 570, 0, 150, 1);
    pool.spawn(300, 100, 0, 150, 2);
    pool.step();
    expect(pool.slots[0]).toMatchObject({ y: 572.5, previousY: 570 });
    pool.clearNear(180, 580, 96);
    expect(pool.count).toBe(1);
    for (const [x, y] of [[-5, 20], [365, 20], [20, -5], [20, 645]]) pool.spawn(x ?? 0, y ?? 0, 0, 0, 3);
    pool.expire();
    expect(pool.count).toBe(1);
    pool.clear();
    expect(pool.count).toBe(0);
    expect(new BulletPool().count).toBe(0);
  });
});

describe('telegraphed owned dives and ordinary shots', () => {
  it.each(['shardlet', 'spindle', 'bellframe'] as const)('warns for 36 ticks before %s launches, then returns or exits/re-enters without changing its owner', kind => {
    const formation = new Formation(); formation.reset(42);
    const director = new AttackDirector(); director.reset(0);
    const pool = new HostilePool();
    const config = { ...createStage(3), attackKinds: [kind], maxDivers: 1, diveCadence: 600 };
    advance(formation, director, pool, config, 1, 360);
    const enemy = formation.enemies.slots.find(value => value.state === 'warning');
    if (!enemy) throw new Error('Expected warning');
    const slot = at(formation.slots, enemy.slot);
    const owner = slot.owner;
    const generation = slot.generation;
    expect(pool.fired).toBe(0);
    advance(formation, director, pool, config, 361, 395);
    expect(enemy.state).toBe('warning');
    advance(formation, director, pool, config, 396, 396);
    expect(enemy.state).toBe('diving');
    expect(pool.fired).toBe(1);
    expect(enemy.targetX).toBe(kind === 'bellframe' ? 220 : 140);
    expect(at(pool.slots, 0).velocityY).toBeGreaterThan(0);
    expect(at(pool.slots, 0).marked).toBe(kind === 'bellframe');
    if (kind === 'spindle') {
      const shot = at(pool.slots, 0);
      expect(shot.velocityX / shot.velocityY).toBeCloseTo((140 - enemy.x) / (580 - enemy.y), 3);
    } else expect(at(pool.slots, 0).velocityX).toBe(0);
    advance(formation, director, pool, config, 397, 850);
    expect(enemy.state).toBe('formation');
    expect(slot).toMatchObject({ owner, generation, state: 'occupied' });
    expect(formation.reserve(enemy.slot, kind, 900, 0)).toBe(false);
    expect(director.peak).toBe(1);
    expect(formation.enemies.count).toBe(24);
    expect(formation.enemies.slots.every(value => value.x * 1024 === Math.round(value.x * 1024))).toBe(true);
  });

  it('defers enemy fire at capacity without consuming cooldown, never tracks the player after launch, cancels warnings when disabled', () => {
    const formation = new Formation(); formation.reset(42);
    const director = new AttackDirector(); director.reset(0);
    const pool = new HostilePool();
    const config = { ...createStage(3), attackKinds: ['spindle'] as const, hostileCap: 1 };
    pool.spawn(20, 20, 0, 0, 999);
    advance(formation, director, pool, config, 1, 396);
    const enemy = formation.enemies.slots.find(value => value.state === 'diving');
    if (!enemy) throw new Error('Expected diver');
    expect(enemy.attackCooldown).toBe(0);
    expect(enemy.shotPending).toBe(true);
    expect(pool.deferred).toBe(1);
    pool.clear();
    director.step(formation, 397, 350, config, 3, true);
    director.fire(formation, pool, config, true);
    expect(enemy.targetX).toBe(140);
    expect(enemy.attackCooldown).toBe(config.shotInterval);
    director.fire(formation, pool, config, true);
    expect(pool.fired).toBe(2);
    expect(pool.count).toBe(1);
    enemy.state = 'warning'; enemy.attackTick = 397;
    director.step(formation, 398, 0, config, 3, false);
    director.fire(formation, pool, config, false);
    expect(enemy.state).toBe('formation');
  });

  it('scores a diver once at 180/300/500; warnings still use formation points', () => {
    for (const [kind, points] of [['shardlet', 180], ['spindle', 300], ['bellframe', 500]] as const) {
      const formation = new Formation(); formation.reset(42);
      formation.advance(300);
      const index = formation.enemies.slots.findIndex(enemy => enemy.active && enemy.kind === kind);
      const enemy = at(formation.enemies.slots, index); enemy.state = 'diving';
      for (let i = 0; i < enemy.maxHP; i++) expect(formation.hit(index, enemy.generation)).toBe(true);
      expect(formation.score).toBe(points);
      expect(formation.hit(index, enemy.generation)).toBe(false);
    }
  });
});

describe('lives, threshold awards and exact timers', () => {
  it('starts at three, consumes capped threshold awards and handles multiple crossings', () => {
    const vitals = new Vitals();
    vitals.award(19999); expect(vitals.lives).toBe(3);
    vitals.award(1); expect(vitals.lives).toBe(4);
    vitals.award(50000); expect(vitals.lives).toBe(5);
    vitals.award(100000); expect(vitals.lives).toBe(5); expect(vitals.nextLife).toBe(220000);
    vitals.hit(); expect(vitals.lives).toBe(4);
    vitals.award(49999); expect(vitals.lives).toBe(4);
    vitals.award(1); expect(vitals.lives).toBe(5);
    for (const points of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER]) expect(() => vitals.award(points)).toThrow(RangeError);
    vitals.reset(); expect(vitals).toMatchObject({ score: 0, lives: 3, nextLife: 20000, deaths: 0 });
  });

  it('applies one hit, waits 90 ticks, protects for 120 ticks, and rejects nonlethal/dead hits', () => {
    const vitals = new Vitals();
    expect(vitals.hit(true)).toBe(false);
    for (let death = 1; death <= 3; death++) {
      expect(vitals.hit()).toBe(true);
      expect(vitals.hit()).toBe(false);
      expect(vitals.lives).toBe(3 - death);
      if (death === 3) break;
      for (let tick = 1; tick < 90; tick++) expect(vitals.step()).toBe(false);
      expect(vitals.respawn).toBe(1);
      expect(vitals.step()).toBe(true);
      expect(vitals.invulnerable).toBe(120);
      for (let tick = 1; tick < 120; tick++) { vitals.step(); expect(vitals.hit()).toBe(false); }
      vitals.step(); expect(vitals.invulnerable).toBe(0);
    }
    expect(vitals.deaths).toBe(3);
    expect(vitals.step()).toBe(false);
  });
});

describe('real staged run', () => {
  it('resolves a fast offscreen hostile crossing, simultaneous bullets/contact only once, and clears nearby shots on safe respawn', () => {
    const run = new RunSession(); run.reset(42);
    run.hostiles.spawn(180, 530, 0, 9000, 1);
    run.hostiles.spawn(180, 580, 0, 0, 2);
    const enemy = at(run.formation.enemies.slots, 0);
    enemy.state = 'exiting'; enemy.x = enemy.previousX = 180; enemy.y = enemy.previousY = 575;
    run.step({ ...IDLE, fire: true });
    expect(run.lives).toBe(2); expect(run.vitals.deaths).toBe(1);
    expect(run.range.shotsFired).toBe(0);
    const shots = run.hostiles.fired;
    for (let tick = 0; tick < 89; tick++) run.step({ ...IDLE, moveX: 1, fire: true });
    expect(run.vitals.respawn).toBe(1); expect(run.range.shotsFired).toBe(0);
    run.hostiles.spawn(180, 580, 0, 0, 3);
    run.hostiles.spawn(300, 200, 0, 0, 4);
    run.step(IDLE);
    expect(run.vitals.invulnerable).toBe(120);
    expect(run.range.player.x).toBe(180);
    expect(run.hostiles.slots.some(shot => shot.active && shot.owner === 3)).toBe(false);
    expect(run.hostiles.slots.some(shot => shot.active && shot.owner === 4)).toBe(true);
    expect(run.hostiles.fired).toBe(shots + 2);
    run.hostiles.spawn(180, 580, 0, 0, 5);
    for (let tick = 0; tick < 119; tick++) run.step(IDLE);
    expect(run.lives).toBe(2);
    run.step(IDLE);
    expect(run.lives).toBe(1);
  });

  it('reaches stages one through four with plain movement/fire, carries score/lives and safely drains each transition', () => {
    const run = new RunSession(); run.reset(42);
    const stages = new Set<number>();
    for (let tick = 0; tick < 24000 && run.stage < 5 && !run.complete; tick++) {
      stages.add(run.stage);
      sweep(run);
      if (run.tally > 0) { expect(run.hostiles.count).toBe(0); expect(run.range.bullets.count).toBe(0); }
    }
    expect([...stages]).toEqual([1, 2, 3, 4]);
    expect(run.stage).toBe(5);
    expect(run.score).toBeGreaterThan(13920);
    expect(run.lastTally).toContain('Bonus');
    expect(run.lives).toBeGreaterThan(0);
    expect(run.hostiles.peak).toBeLessThanOrEqual(128);
    expect(run.range.bullets.peak).toBe(11);
  });

  it('expires an unfinished bonus after 1,200 ticks without damage and awards perfect-clear points only once', () => {
    const run = new RunSession(); run.reset(42);
    while (run.stage < 4 && !run.complete) sweep(run);
    expect(run.stage).toBe(4);
    const lives = run.lives;
    const score = run.score;
    for (let tick = 0; tick < 1199; tick++) run.step(IDLE);
    expect(run.tally).toBe(0);
    expect(run.lives).toBe(lives);
    expect(run.hostiles.count).toBe(0);
    expect(run.attacks.launches).toBe(0);
    run.step(IDLE);
    expect(run.tally).toBe(150);
    expect(run.lastTally).toBe('Bonus 0 / 20 · No lives lost');
    expect(run.score).toBe(score);
    expect(run.formation.enemies.count).toBe(0);
    for (let tick = 0; tick < 150; tick++) run.step(IDLE);
    expect(run.stage).toBe(5);
    expect(run.score).toBe(score);

    run.reset(42);
    while (run.stage < 4 && !run.complete) sweep(run);
    const before = run.score;
    while (run.tally === 0) sweep(run);
    expect(run.stageTick).toBe(1200);
    expect(run.score - before).toBe(6000);
    expect(run.lastTally).toBe('Bonus 20 / 20 · Perfect +3,000');
    for (let tick = 0; tick < 150; tick++) sweep(run);
    expect(run.score - before).toBe(6000);
  });

  it('resolves hostile damage before a last enemy kill, then safely clears a later completed objective', () => {
    const run = new RunSession(); run.reset(42);
    run.formation.advance(300);
    const survivor = run.formation.enemies.slots.find(enemy => enemy.active && enemy.kind === 'shardlet');
    if (!survivor) throw new Error('Expected target');
    for (let index = 0; index < run.formation.enemies.slots.length; index++) {
      const enemy = at(run.formation.enemies.slots, index);
      if (enemy === survivor || !enemy.active) continue;
      while (enemy.active) run.formation.hit(index, enemy.generation);
    }
    run.stageTick = 300;
    run.range.bullets.spawnVolley(survivor.x, survivor.y + 9, [0]);
    run.hostiles.spawn(180, 580, 0, 0, 1);
    run.step(IDLE);
    expect(run.tally).toBe(0);
    expect(run.lives).toBe(2);
    expect(run.formation.kills).toBe(23);
    expect(run.score).toBe(4540);
    expect(survivor.active).toBe(true);
    for (let tick = 0; tick < 90; tick++) run.step(IDLE);
    run.range.bullets.spawnVolley(survivor.x, survivor.y + 9, [0]);
    run.step(IDLE);
    expect(run.tally).toBe(150);
    expect(run.lives).toBe(2);
    expect(run.score).toBe(4640);
    expect(run.hostiles.count).toBe(0);
    expect(run.range.bullets.count).toBe(0);
    expect(run.lastTally).toBe('Stage 1 cleared · 4640 points');
    for (let tick = 0; tick < 149; tick++) run.step({ ...IDLE, fire: true });
    expect(run.stage).toBe(1); expect(run.score).toBe(4640);
    run.step(IDLE);
    expect(run.stage).toBe(2); expect(run.score).toBe(4640);
  });

  it('bounds late-stage diver and projectile pressure over two minutes without allocating pool slots', () => {
    const formation = new Formation(); formation.reset(42);
    const director = new AttackDirector(); director.reset(42);
    const pool = new HostilePool();
    const identities = [...pool.slots];
    const config = createStage(99);
    for (let tick = 1; tick <= 7200; tick++) {
      formation.advance(tick);
      pool.step();
      director.step(formation, tick, tick % 360, config, 99, true);
      pool.expire(); director.fire(formation, pool, config, true);
      expect(director.active).toBeLessThanOrEqual(6);
      expect(pool.count).toBeLessThanOrEqual(128);
    }
    expect(director.launches).toBeGreaterThan(20);
    expect(pool.fired).toBeGreaterThan(20);
    expect(pool.slots.every((shot, index) => shot === identities[index])).toBe(true);
  });

  it('ends on the third real attack death, freezes rules and resets every run-owned timer/counter/pool without stale handles', () => {
    const run = new RunSession(); run.reset(42);
    const identities = [...run.hostiles.slots];
    for (let tick = 0; tick < 12000 && !run.complete; tick++) run.step(IDLE);
    expect(run.complete).toBe(true); expect(run.lives).toBe(0);
    expect(run.vitals.deaths).toBe(3);
    const ticks = run.range.ticks;
    run.step({ ...IDLE, fire: true }); expect(run.range.ticks).toBe(ticks);
    const generation = at(run.formation.enemies.slots, 0).generation;
    run.reset(42);
    expect(run).toMatchObject({ stage: 1, stageTick: 0, tally: 0, lastTally: '', score: 0, lives: 3, complete: false });
    expect(run.vitals).toMatchObject({ respawn: 0, invulnerable: 0, nextLife: 20000, deaths: 0 });
    expect(run.hostiles).toMatchObject({ count: 0, peak: 0, fired: 0, deferred: 0 });
    expect(run.range).toMatchObject({ ticks: 0, shotsFired: 0, cooldown: 0 });
    expect(run.formation.hit(0, generation)).toBe(false);
    expect(run.hostiles.slots.every((shot, index) => shot === identities[index])).toBe(true);
    expect(run.formation.enemies.count).toBe(24); expect(run.particles.count).toBe(0);
  });

  it('keeps identical versioned whole-run rule snapshots at 30/60/90/120/144 Hz and under cosmetic saturation', () => {
    function play(hz: number, cosmetics = false): unknown {
      const run = new RunSession(); run.reset(42);
      const loop = new FixedLoop(() => {
        if (cosmetics) for (let burst = 0; burst < 43; burst++) run.particles.burst(0, 0);
        sweep(run);
      }, () => {});
      for (let frame = 0; frame <= hz * 180; frame++) loop.frame(frame * 1000 / hz);
      return { rules: RULES_VERSION, ticks: run.range.ticks, stage: run.stage, stageTick: run.stageTick,
        vitals: run.vitals, tally: run.tally, kills: run.formation.kills, hits: run.formation.hits,
        shots: run.range.shotsFired, launches: run.attacks.launches, hostilesFired: run.hostiles.fired,
        player: run.range.player, enemies: run.formation.enemies.slots,
        bullets: run.range.bullets.slots, hostiles: run.hostiles.slots };
    }
    const reference = play(60);
    expect(reference).toMatchObject({ ticks: 5811 });
    for (const hz of [30, 90, 120, 144]) expect(play(hz)).toEqual(reference);
    expect(play(60, true)).toEqual(reference);
    expect(createHash('sha256').update(JSON.stringify(reference)).digest('hex')).toBe('bf65b25930fb3753ce47125e1b46ad2740f0f3d6bdacea31433607ee0d358a86');
  }, 30000);
});

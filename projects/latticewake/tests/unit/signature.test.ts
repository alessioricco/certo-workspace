import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../../src/engine/loop';
import { MeridianEngine } from '../../src/game/boss';
import { BulletPool } from '../../src/game/bullets';
import { EchoLattice } from '../../src/game/echo';
import { HostilePool } from '../../src/game/hostiles';
import { Player } from '../../src/game/player';
import { DropPool, PowerUps, POWER_KINDS, POWER_TICKS } from '../../src/game/powerups';
import { RunSession } from '../../src/game/run';
import { createStage, validateStage, type StageConfig } from '../../src/game/stages';
import { at } from '../../src/math/indexed';
import { RULES_VERSION } from '../../src/math/random';

const IDLE = { moveX: 0, fire: false, capture: false };
function enter(run: RunSession, stage: number): void {
  run.stage = stage - 1; run.tally = 1; run.step(IDLE);
  expect(run.stage).toBe(stage);
}
function pulse(pool: HostilePool, x = 180, y = 550): void { pool.spawn(x, y, 0, 0, 42, 128, true); }
function damageBoss(boss: MeridianEngine, pool: HostilePool, bullets: BulletPool): void {
  while (boss.active) {
    if (boss.warning > 0) { boss.step(); continue; }
    const part = boss.parts.find(value => boss.vulnerable(value));
    if (!part) throw new Error('Expected exposed part');
    bullets.spawnVolley(part.x, part.y, [0]); boss.resolve(bullets, pool);
  }
}

// These are deterministic input policies, not rules overrides or simulated human playtests.
function pilot(run: RunSession, capture: boolean): typeof IDLE {
  let desired = run.range.ticks % 160 < 80 ? 352 : 8;
  if (run.boss.active) {
    const target = run.boss.parts.find(part => run.boss.phase === 1 ? part.id < 2 && part.hp > 0 : part.id === 2);
    desired = target?.x ?? 180;
    for (const shot of run.hostiles.slots) {
      if (!shot.active || shot.y < 455 || shot.y > 600
        || (capture && shot.marked && (run.echo.cooldown === 0 || run.echo.field > 0))) continue;
      const impactX = shot.x + shot.velocityX * Math.max(0, (580 - shot.y) / shot.velocityY);
      if (Math.abs(impactX - run.range.player.x) < 26) desired = impactX + (impactX < 180 ? 55 : -55);
    }
  }
  if (capture && run.echo.cooldown === 0 && run.echo.count < 2) {
    for (const shot of run.hostiles.slots) if (shot.active && shot.marked && shot.y > 400 && shot.y < 575) {
      desired = shot.x + shot.velocityX * Math.max(0, (565 - shot.y) / shot.velocityY);
    }
  }
  let intercept = false;
  for (const shot of run.hostiles.slots) if (shot.active && shot.marked
    && Math.abs(shot.x - run.range.player.x) < 30 && shot.y > 536 && shot.y < 610) intercept = true;
  return { moveX: Math.abs(desired - run.range.player.x) < 5 ? 0 : desired > run.range.player.x ? 1 : -1,
    fire: true, capture: capture && intercept && run.echo.cooldown === 0 };
}

describe('Echo Lattice windows, swept marked contacts and capacity', () => {
  it('opens for exactly 24 ticks, recharges for 240, freezes disabled timers and closes after one capture', () => {
    const echo = new EchoLattice(); const pool = new HostilePool(); const player = new Player();
    echo.step(true, false); expect(echo.field).toBe(0);
    echo.step(true, true); expect(echo).toMatchObject({ field: 24, cooldown: 240, activations: 1 });
    for (let tick = 0; tick < 23; tick++) echo.step(false, true);
    expect(echo.field).toBe(1); echo.step(false, true); expect(echo.field).toBe(0);
    pulse(pool); expect(echo.intercept(pool, player)).toBe(false);
    for (let tick = 24; tick < 240; tick++) echo.step(false, true);
    echo.step(true, true); expect(echo.field).toBe(24);
    pulse(pool); expect(echo.intercept(pool, player)).toBe(true);
    expect(echo).toMatchObject({ field: 0, captures: 1, drones: [360, 0] });
    expect(pool.count).toBe(1); expect(echo.intercept(pool, player)).toBe(false);
    echo.step(false, false); expect(echo.drones).toEqual([360, 0]);
  });

  it('sorts capture candidates by impact time then stable ID, ignoring ordinary bullets and distant pulses', () => {
    const echo = new EchoLattice(); const pool = new HostilePool(); const player = new Player();
    pool.spawn(180, 580, 0, 0, 1); pulse(pool, 30); pulse(pool, 180, 500); pulse(pool);
    pool.step(); at(pool.slots, 2).y = 630;
    echo.step(true, true); expect(echo.intercept(pool, player)).toBe(true);
    expect(at(pool.slots, 3).active).toBe(false); expect(at(pool.slots, 2).active).toBe(true);
    expect(at(pool.slots, 0).active).toBe(true);
    echo.reset(); pool.clear(); pulse(pool); pulse(pool);
    echo.step(true, true); echo.intercept(pool, player);
    expect(at(pool.slots, 0).active).toBe(false); expect(at(pool.slots, 1).active).toBe(true);
    echo.reset(); pool.clear(); pulse(pool, 180, 400); pool.step(); at(pool.slots, 0).y = 700;
    echo.step(true, true); expect(echo.intercept(pool, player)).toBe(true);
  });

  it('tracks two independent 360-tick expiries and disables activation at capacity without consuming pulses or cooldown', () => {
    const echo = new EchoLattice(); const pool = new HostilePool(); const player = new Player();
    echo.step(true, true); pulse(pool); echo.intercept(pool, player);
    for (let tick = 0; tick < 240; tick++) echo.step(false, true);
    echo.step(true, true); pulse(pool); echo.intercept(pool, player);
    expect(echo.drones).toEqual([119, 360]); expect(echo.count).toBe(2);
    echo.cooldown = 0; pulse(pool); echo.step(true, true);
    expect(echo.cooldown).toBe(0); expect(echo.field).toBe(0); expect(pool.count).toBe(1);
    for (let tick = 0; tick < 118; tick++) echo.step(false, true);
    expect(echo.drones).toEqual([0, 241]); expect(echo.count).toBe(1);
    for (let tick = 0; tick < 241; tick++) echo.step(false, true);
    expect(echo.count).toBe(0); echo.reset(); expect(echo.activations).toBe(0);
  });

  it('captures before ordinary damage, awards no points, clears drones/powers on death and disallows respawn activation', () => {
    const run = new RunSession(); run.reset(42);
    pulse(run.hostiles, 180, 580);
    run.step({ ...IDLE, capture: true });
    expect(run.echo.count).toBe(1); expect(run.lives).toBe(3); expect(run.score).toBe(0);
    run.echo.cooldown = 0; pulse(run.hostiles, 180, 580);
    run.hostiles.spawn(180, 580, 0, 0, 5);
    run.powers.collect('fan'); run.step({ ...IDLE, capture: true, fire: true });
    expect(run.echo.captures).toBe(2); expect(run.echo.count).toBe(0);
    expect(run.lives).toBe(2); expect(run.score).toBe(0); expect(run.powers.fan).toBe(0);
    const cooldown = run.echo.cooldown;
    run.step({ ...IDLE, capture: true }); expect(run.echo.field).toBe(0); expect(run.echo.cooldown).toBe(cooldown);
  });

  it('leaves ordinary shots and enemy contact dangerous while the field is open', () => {
    for (const contact of [false, true]) {
      const run = new RunSession(); run.reset(42);
      if (contact) { const enemy = at(run.formation.enemies.slots, 0); enemy.state = 'exiting'; enemy.x = 180; enemy.y = 575; }
      else run.hostiles.spawn(180, 580, 0, 0, 1);
      run.step({ ...IDLE, capture: true }); expect(run.lives).toBe(2); expect(run.echo.captures).toBe(0);
    }
  });
});

describe('authored drops and combined power-ups', () => {
  it.each(POWER_KINDS)('refreshes %s rather than stacking and expires at its exact tick boundary', kind => {
    const powers = new PowerUps(); powers.collect(kind);
    expect(powers[kind]).toBe(POWER_TICKS[kind]); powers.step(); powers.collect(kind);
    for (let tick = 1; tick < POWER_TICKS[kind]; tick++) powers.step();
    expect(powers[kind]).toBe(1); powers.step(); expect(powers[kind]).toBe(0);
  });

  it('emits every drone/fan combination atomically, with side origins and no pool growth', () => {
    const pool = new BulletPool(); const player = new Player(); const echo = new EchoLattice(); const powers = new PowerUps();
    for (let fan = 0; fan <= 1; fan++) for (let drones = 0; drones <= 2; drones++) {
      pool.reset(); powers.clear(); echo.clear();
      if (fan) powers.collect('fan'); for (let index = 0; index < drones; index++) echo.drones[index] = 360;
      const count = (fan ? 3 : 1) + drones;
      expect(powers.volley(pool, player, echo)).toBe(true); expect(pool.count).toBe(count);
      if (drones) expect(pool.slots.some(shot => shot.active && shot.x === 156 && shot.velocityX === 0)).toBe(true);
      if (drones === 2) expect(pool.slots.some(shot => shot.active && shot.x === 204)).toBe(true);
      pool.reset(); while (pool.count < 128 - count + 1) pool.spawnVolley(0, 0, [0]);
      const before = JSON.stringify(pool.slots);
      expect(powers.volley(pool, player, echo)).toBe(false); expect(JSON.stringify(pool.slots)).toBe(before);
    }
  });

  it('uses a six-tick overclock rhythm with fan/drones and never consumes cooldown for a denied volley', () => {
    const run = new RunSession(); run.reset(42);
    run.powers.collect('overclock'); run.powers.collect('fan'); run.echo.drones.fill(360);
    for (let tick = 0; tick < 61; tick++) run.step({ ...IDLE, fire: true });
    expect(run.range.shotsFired).toBe(11); expect(run.range.bullets.peak).toBeLessThanOrEqual(55);
    run.range.bullets.clear(); run.range.cooldown = 0;
    while (run.range.bullets.count < 125) run.range.bullets.spawnVolley(1, 620, [0]);
    run.step({ ...IDLE, fire: true }); expect(run.range.cooldown).toBe(0);
    expect(run.range.shotsFired).toBe(11); expect(run.range.bullets.deniedVolleys).toBe(1);
    run.reset(42); expect(run.powers).toMatchObject({ fan: 0, ward: 0, overclock: 0, absorbed: 0 }); expect(run.echo.count).toBe(0);
  });

  it('runs all eight power combinations with zero, one or two independently timed drones', () => {
    for (let mask = 0; mask < 8; mask++) for (let drones = 0; drones <= 2; drones++) {
      const run = new RunSession(); run.reset(42);
      for (let index = 0; index < POWER_KINDS.length; index++) if (mask & (1 << index)) run.powers.collect(at(POWER_KINDS, index));
      for (let index = 0; index < drones; index++) run.echo.drones[index] = 360;
      for (let tick = 0; tick < 61; tick++) run.step({ ...IDLE, fire: true });
      expect(run.range.shotsFired).toBe(mask & 4 ? 11 : 7);
      expect(run.powers.ward).toBe(mask & 1 ? 839 : 0);
      expect(run.powers.fan).toBe(mask & 2 ? 419 : 0);
      expect(run.powers.overclock).toBe(mask & 4 ? 299 : 0);
      expect(run.echo.count).toBe(drones); expect(run.range.bullets.deniedVolleys).toBe(0);
      expect(run.range.bullets.peak).toBeLessThanOrEqual((mask & 4 ? 11 : 7) * ((mask & 2 ? 3 : 1) + drones));
    }
  });

  it('absorbs exactly one ordinary projectile or contact but not a marked pulse; refresh is not a second charge', () => {
    const run = new RunSession(); run.reset(42); run.powers.collect('ward'); run.powers.collect('ward');
    run.hostiles.spawn(180, 580, 0, 0, 1); run.hostiles.spawn(180, 580, 0, 0, 2);
    run.step(IDLE); expect(run.lives).toBe(3); expect(run.powers.ward).toBe(0); expect(run.powers.absorbed).toBe(1);
    run.step(IDLE); expect(run.lives).toBe(2);
    run.reset(42); run.powers.collect('ward'); pulse(run.hostiles, 180, 580); run.step(IDLE); expect(run.lives).toBe(2);
    run.reset(42); run.powers.collect('ward');
    const enemy = at(run.formation.enemies.slots, 0); enemy.state = 'exiting'; enemy.x = 180; enemy.y = 575;
    run.step(IDLE); expect(run.lives).toBe(3); expect(run.powers.absorbed).toBe(1);
  });

  it('preallocates twelve drops, expires after 480 ticks, sweeps generous pickups and resets counters without replacing slots', () => {
    const drops = new DropPool(); const powers = new PowerUps(); const player = new Player(); const slots = [...drops.slots];
    for (let index = 0; index < 12; index++) expect(drops.spawn('ward', 40, 50)).toBe(true);
    expect(drops.spawn('fan', 180, 580)).toBe(false); expect(drops.denied).toBe(1);
    for (let tick = 0; tick < 479; tick++) { drops.step(); drops.resolve(player, powers, true); }
    expect(drops.count).toBe(12); drops.step(); drops.resolve(player, powers, true); expect(drops.count).toBe(0);
    drops.spawn('fan', 180, 580); drops.resolve(player, powers, false); expect(drops.count).toBe(1);
    drops.resolve(player, powers, true); expect(powers.fan).toBe(480); expect(drops.collected).toBe(1);
    drops.spawn('ward', 180, 530); at(drops.slots, 0).y = 650; drops.resolve(player, powers, true); expect(powers.ward).toBe(900);
    drops.spawn('overclock', 0, 657); drops.resolve(player, powers, true); expect(drops.count).toBe(0);
    drops.reset(); expect(drops).toMatchObject({ count: 0, denied: 0, collected: 0 }); expect(drops.slots.every((slot, index) => slot === slots[index])).toBe(true);
  });

  it('spawns configured drops once from real destruction and validates unknown, duplicate, oversized and forbidden drops', () => {
    const run = new RunSession(); run.reset(42); run.stageTick = 300; run.formation.advance(300);
    const enemy = run.formation.enemies.slots.find(value => value.active && value.slot === 2);
    if (!enemy) throw new Error('Expected authored drop target');
    while (enemy.hp > 1) run.formation.hit(run.formation.enemies.slots.indexOf(enemy), enemy.generation);
    run.range.bullets.spawnVolley(enemy.x, enemy.y + 9, [0]); run.step(IDLE);
    expect(run.drops.count).toBe(1); expect(at(run.drops.slots, 0).kind).toBe('ward'); run.step(IDLE); expect(run.drops.count).toBe(1);
    for (const drops of [[{ slot: 24, kind: 'ward' }], [{ slot: 2, kind: 'bad' }], [{ slot: 2, kind: 'ward' }, { slot: 2, kind: 'fan' }], [null], Array(13).fill({ slot: 1, kind: 'ward' })]) {
      expect(() => validateStage({ ...createStage(1), drops } as StageConfig)).toThrow(RangeError);
    }
    expect(() => validateStage({ ...createStage(4), drops: [{ slot: 0, kind: 'ward' }] })).toThrow(RangeError);
  });
});

describe('Meridian Engine and numbered-stage precedence', () => {
  it('warns for sixty ticks, has breakable emitters and a shielded gate, and clears only phase-owned hazards', () => {
    const boss = new MeridianEngine(); const pool = new HostilePool(); const bullets = new BulletPool(); boss.reset(5);
    for (let tick = 0; tick < 59; tick++) { boss.step(); boss.fire(pool, 32, true); }
    expect(pool.count).toBe(0); boss.step(); boss.fire(pool, 32, false); expect(pool.count).toBe(0);
    boss.fire(pool, 32, true); expect(pool.count).toBe(2); expect(pool.slots.some(shot => shot.active && shot.marked)).toBe(true);
    expect(boss.count).toBe(3);
    const gate = at(boss.parts, 2); bullets.spawnVolley(gate.x, gate.y, [0]); boss.resolve(bullets, pool); expect(gate.hp).toBe(16);
    bullets.clear(); pool.spawn(50, 500, 0, 0, 42);
    for (const part of boss.parts) if (part.id < 2) while (part.hp > 0) { bullets.spawnVolley(part.x, part.y, [0]); boss.resolve(bullets, pool); }
    expect(boss.count).toBe(1); expect(boss.phase).toBe(2); expect(boss.warning).toBe(60); expect(pool.count).toBe(1); expect(at(pool.slots, 2).owner).toBe(42);
    bullets.spawnVolley(gate.x, gate.y, [0]); boss.resolve(bullets, pool); expect(gate.hp).toBe(16);
    bullets.clear(); damageBoss(boss, pool, bullets);
    expect(boss).toMatchObject({ phase: 3, defeated: true, active: false, hits: 52, points: 5500 });
    expect(boss.count).toBe(0); expect(pool.count).toBe(1); const hits = boss.hits; boss.resolve(bullets, pool); expect(boss.hits).toBe(hits);
    boss.reset(1000); expect(at(boss.parts, 0).hp).toBe(32); expect(at(boss.parts, 2).hp).toBe(64);
  });

  it('defers a full boss volley without a partial spawn or spent cooldown and alternates the final sweep', () => {
    const boss = new MeridianEngine(); boss.reset(5); const pool = new HostilePool();
    for (let tick = 0; tick < 60; tick++) boss.step();
    for (let index = 0; index < 31; index++) pool.spawn(1, 1, 0, 0, 1);
    boss.fire(pool, 32, true); expect(pool.count).toBe(31); expect(boss.volleys).toBe(0); expect(pool.deferred).toBe(1);
    pool.clear(); boss.fire(pool, 32, true); expect(boss.volleys).toBe(1);
    boss.phase = 3; boss.warning = 0; for (let tick = 0; tick < 90; tick++) boss.step();
    pool.clear(); boss.fire(pool, 32, true); expect(at(pool.slots, 1).velocityX).toBe(35);
    for (let tick = 0; tick < 54; tick++) boss.step(); pool.clear(); boss.fire(pool, 32, true); expect(at(pool.slots, 1).velocityX).toBe(-35);
  });

  it('sorts swept boss hits, consumes each nonpiercing shot once and holds transitions invulnerable', () => {
    const boss = new MeridianEngine(); boss.reset(5); const pool = new HostilePool(); const bullets = new BulletPool();
    for (let tick = 0; tick < 60; tick++) boss.step();
    const left = at(boss.parts, 0); const right = at(boss.parts, 1);
    left.hp = right.hp = 1; right.x = right.previousX = left.x;
    bullets.spawnVolley(left.x, 220, [0, 0, 0]);
    for (const bullet of bullets.slots) if (bullet.active) { bullet.previousY = 220; bullet.y = 80; }
    boss.resolve(bullets, pool); expect(boss.phase).toBe(2); expect(boss.hits).toBe(2); expect(bullets.count).toBe(1);
    const gate = at(boss.parts, 2); expect(gate.hp).toBe(16);
  });

  it.each([20, 40])('runs boss %i before its deferred nonlethal bonus, then advances once with one boss award', stage => {
    const run = new RunSession(); run.reset(42); enter(run, stage);
    expect(run.config.kind).toBe('boss'); expect(run.formation.enemies.count).toBe(0);
    expect(() => createStage(5, true)).toThrow(RangeError);
    const bossPoints = run.boss.points;
    for (let tick = 0; tick < 2000 && run.tally === 0; tick++) {
      const part = run.boss.parts.find(value => run.boss.vulnerable(value));
      if (part) run.range.bullets.spawnVolley(part.x, part.y, [0]);
      run.step(IDLE);
    }
    expect(run.score).toBe(bossPoints); expect(run.tally).toBe(150);
    for (let tick = 0; tick < 150; tick++) run.step(IDLE);
    expect(run.stage).toBe(stage); expect(run.bonusInterlude).toBe(true); expect(run.config.kind).toBe('bonus');
    expect(run.hostiles.count).toBe(0); const lives = run.lives;
    for (let tick = 0; tick < 1350; tick++) run.step(IDLE);
    expect(run.stage).toBe(stage + 1); expect(run.config.kind).toBe('combat'); expect(run.lives).toBe(lives); expect(run.score).toBe(bossPoints);
    run.reset(42); expect(run.bonusInterlude).toBe(false); expect(run.boss.active).toBe(false);
  });

  it('clears the stage-five boss with plain steering/fire and measures optional captures on the same fixed seeds', () => {
    const evidence: unknown[] = [];
    for (const seed of [7, 42, 2026]) for (const capture of [false, true]) {
      const run = new RunSession(); run.reset(seed); enter(run, 5);
      while (run.tally === 0 && !run.complete && run.stageTick < 12000) run.step(pilot(run, capture));
      evidence.push({ seed, capture, ticks: run.stageTick, deaths: run.vitals.deaths, captures: run.echo.captures, activations: run.echo.activations, score: run.score });
      expect(run.complete, JSON.stringify(evidence)).toBe(false); expect(run.tally, JSON.stringify(evidence)).toBe(150); expect(run.score).toBe(5500);
      expect(run.stageTick).toBe(capture ? 1025 : 1196);
      expect(run.vitals.deaths).toBe(0);
      expect(run.echo.captures).toBe(capture ? 2 : 0);
      expect(run.echo.activations).toBe(capture ? 2 : 0);
      expect(run.range.bullets.peak).toBeLessThanOrEqual(128); expect(run.hostiles.peak).toBeLessThanOrEqual(32);
    }
    console.info('M5 boss tuning', JSON.stringify(evidence));
  });

  it('records a basic sweep policy as a non-human novice-proxy tuning baseline', () => {
    const run = new RunSession(); run.reset(42); enter(run, 5);
    while (run.tally === 0 && !run.complete && run.stageTick < 12000) run.step({ ...IDLE, fire: true, moveX: run.range.ticks % 160 < 80 ? 1 : -1 });
    console.info('M5 basic sweep tuning', JSON.stringify({ ticks: run.stageTick, lives: run.lives, cleared: run.tally > 0, phase: run.boss.phase }));
    expect(run.stageTick).toBe(2313); expect(run.lives).toBe(0); expect(run.boss.phase).toBe(3);
  });

  it('replays a recorded M5 action tape at five render cadences and under cosmetic saturation', () => {
    const source = new RunSession(); source.reset(42); enter(source, 5); const tape: (typeof IDLE)[] = [];
    for (let tick = 0; tick < 3600; tick++) { const action = pilot(source, true); tape.push(action); source.step(action); }
    function play(hz: number, cosmetics = false): unknown {
      const run = new RunSession(); run.reset(42); enter(run, 5); let tick = 0;
      const loop = new FixedLoop(() => {
        if (cosmetics) for (let index = 0; index < 43; index++) run.particles.burst(0, 0);
        run.step(at(tape, tick++));
      }, () => {});
      for (let frame = 0; frame <= hz * 60; frame++) loop.frame(frame * 1000 / hz);
      return { rules: RULES_VERSION, ticks: run.range.ticks, stage: run.stage, stageTick: run.stageTick,
        vitals: run.vitals, tally: run.tally, echo: run.echo, powers: run.powers, drops: run.drops,
        boss: run.boss, bullets: run.range.bullets, hostiles: run.hostiles, enemies: run.formation.enemies };
    }
    const reference = play(60);
    for (const hz of [30, 90, 120, 144]) expect(play(hz)).toEqual(reference);
    expect(play(60, true)).toEqual(reference);
    expect(createHash('sha256').update(JSON.stringify(reference)).digest('hex')).toBe('a7ecd372325f6359f0ff6b0baca16337d332aba7c77eb0b95577ca25ca8707a5');
  }, 30000);
});

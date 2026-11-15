import { describe, expect, it } from 'vitest';
import { terrainHeight } from '../../src/engine/terrain';
import {
  createPlayer,
  IDLE_INTENT,
  moveDirection,
  RUN_SPEED_MS,
  WALK_SPEED_MS,
  stepPlayer,
  type Ground,
  type PlayerBody,
  type PlayerIntent,
} from '../../src/engine/player';
import { jumpHeight } from '../../src/engine/physics';
import { expectClose } from './helpers';

const flat = (gravityMS2: number): Ground => ({ gravityMS2, heightAt: () => 0 });
const ramp = (slope: number): Ground => ({ gravityMS2: 9.81, heightAt: (x) => slope * x });
const FRAME = 1 / 60;

function run(
  start: PlayerBody,
  intent: PlayerIntent,
  ground: Ground,
  seconds: number,
  dt = FRAME,
): PlayerBody {
  let body = start;
  for (let t = 0; t < seconds - 1e-9; t += dt) body = stepPlayer(body, intent, dt, ground);
  return body;
}

function apex(ground: Ground): number {
  const dt = 1 / 600;
  let body = stepPlayer(createPlayer(0, 0, ground), { ...IDLE_INTENT, jump: true }, dt, ground);
  let highest = body.y;
  for (let i = 0; i < 600 * 3; i++) {
    body = stepPlayer(body, IDLE_INTENT, dt, ground);
    highest = Math.max(highest, body.y);
  }
  return highest;
}

describe('moveDirection', () => {
  it('looks along -z at heading zero, with right on +x', () => {
    const forward = moveDirection(1, 0, 0);
    expectClose(forward.dx, 0);
    expectClose(forward.dz, -1);
    const right = moveDirection(0, 1, 0);
    expectClose(right.dx, 1);
    expectClose(right.dz, 0);
  });

  it('turns with the heading and keeps diagonal speed at one', () => {
    const turned = moveDirection(1, 0, Math.PI / 2);
    expectClose(turned.dx, -1);
    expectClose(turned.dz, 0);
    const diagonal = moveDirection(1, 1, 0.3);
    expectClose(Math.hypot(diagonal.dx, diagonal.dz), 1);
  });
});

describe('jumping', () => {
  it('reaches the jump height for the planet gravity', () => {
    expectClose(apex(flat(9.81)), jumpHeight(9.81));
    expectClose(apex(flat(21.8)), jumpHeight(21.8));
    expectClose(apex(flat(2.4525)), jumpHeight(2.4525));
  });

  it('lands back on the ground', () => {
    const ground = flat(21.8);
    const takeOff = stepPlayer(createPlayer(0, 0, ground), { ...IDLE_INTENT, jump: true }, FRAME, ground);
    const landed = run(takeOff, IDLE_INTENT, ground, 2);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(0);
  });

  it('falls from height under gravity and lands', () => {
    const ground = flat(9.81);
    const start = { x: 0, y: 10, z: 0, verticalSpeed: 0, grounded: false };
    const landed = run(start, IDLE_INTENT, ground, 5);
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(0);
  });
});

describe('walking', () => {
  it('covers the walking and running speed per second', () => {
    const ground = flat(9.81);
    const walk = run(createPlayer(0, 0, ground), { ...IDLE_INTENT, forward: 1 }, ground, 1);
    expectClose(-walk.z, WALK_SPEED_MS);
    const sprint = run(
      createPlayer(0, 0, ground),
      { ...IDLE_INTENT, forward: 1, running: true },
      ground,
      1,
    );
    expectClose(-sprint.z, RUN_SPEED_MS);
  });

  it('covers the same distance at any frame rate', () => {
    const ground = flat(9.81);
    const intent = { ...IDLE_INTENT, strafe: 1, yaw: 0.4 };
    const slow = run(createPlayer(0, 0, ground), intent, ground, 2, 1 / 30);
    const fast = run(createPlayer(0, 0, ground), intent, ground, 2, 1 / 240);
    expectClose(slow.x, fast.x);
    expectClose(slow.z, fast.z);
  });

  it('refuses to climb a slope steeper than 45 degrees', () => {
    const eastward = { ...IDLE_INTENT, forward: 1, yaw: -Math.PI / 2 };
    const steep = run(createPlayer(0, 0, ramp(1.2)), eastward, ramp(1.2), 1);
    expect(steep.x).toBeCloseTo(0, 6);
    const gentle = run(createPlayer(0, 0, ramp(0.8)), eastward, ramp(0.8), 1);
    expectClose(gentle.x, WALK_SPEED_MS);
  });

  it('follows downhill ground without falling off it', () => {
    const ground = ramp(-0.8);
    const walked = run(
      createPlayer(0, 0, ground),
      { ...IDLE_INTENT, forward: 1, yaw: -Math.PI / 2 },
      ground,
      1,
    );
    expect(walked.grounded).toBe(true);
    expectClose(walked.y, ground.heightAt(walked.x, walked.z));
  });

  it('stays on real generated terrain while walking in a circle', () => {
    const seed = 42;
    const ground: Ground = {
      gravityMS2: 9.81,
      heightAt: (x, z) => terrainHeight(x, z, seed),
    };
    let body = createPlayer(0, 0, ground);
    for (let frame = 0; frame < 20 * 60; frame++) {
      const intent: PlayerIntent = { ...IDLE_INTENT, forward: 1, strafe: 0.3, yaw: frame / 200 };
      body = stepPlayer(body, intent, FRAME, ground);
      const floor = ground.heightAt(body.x, body.z);
      expect(body.y).toBeGreaterThanOrEqual(floor - 1e-9);
      if (body.grounded) expect(body.y).toBe(floor);
    }
  });
});

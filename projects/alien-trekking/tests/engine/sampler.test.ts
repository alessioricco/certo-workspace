import { describe, expect, it } from 'vitest';
import { planAnimalSpecies, type AnimalSpecies } from '../../src/engine/animals';
import { createHerd, stepHerd, type HeightFn } from '../../src/engine/herds';
import { mulberry32 } from '../../src/engine/random';
import {
  createSampler,
  fireSampler,
  SAMPLER_COOLDOWN_S,
  STUN_SECONDS,
  stepSampler,
  stunCreature,
} from '../../src/engine/sampler';

const FRAME = 1 / 30;
const flat: HeightFn = () => 0;

function grazer(): AnimalSpecies {
  return planAnimalSpecies(mulberry32(3), 9.81, [200, 170, 140], 1, new Set())[0];
}

describe('sampler cooldown', () => {
  it('fires when charged, refuses while recharging, and fires again after 8 s', () => {
    const first = fireSampler(createSampler());
    expect(first.fired).toBe(true);
    expect(first.sampler.cooldownS).toBe(SAMPLER_COOLDOWN_S);

    const refused = fireSampler(stepSampler(first.sampler, 3));
    expect(refused.fired).toBe(false);
    expect(refused.sampler.cooldownS).toBeCloseTo(5, 9);

    const ready = fireSampler(stepSampler(first.sampler, SAMPLER_COOLDOWN_S));
    expect(ready.fired).toBe(true);
  });

  it('is still recharging just before 8 s and ready at 8 s exactly', () => {
    const fired = fireSampler(createSampler()).sampler;
    expect(fireSampler(stepSampler(fired, 7.99)).fired).toBe(false);
    expect(fireSampler(stepSampler(fired, 8)).fired).toBe(true);
  });

  it('never counts the cooldown below zero', () => {
    expect(stepSampler({ cooldownS: 1 }, 10).cooldownS).toBe(0);
  });
});

describe('stun', () => {
  it('freezes an animal for 5 s, even when an observer runs past it', () => {
    const herd = createHerd(grazer(), { x: 0, z: 0 }, 1, mulberry32(11));
    const [animal] = herd.animals;
    animal.x = 6;
    animal.z = 0;
    stunCreature(animal);
    expect(STUN_SECONDS).toBe(5);

    const startle = { x: 4, z: 0, running: true };
    for (let t = 0; t < 4.9; t += FRAME) stepHerd(herd, startle, FRAME, flat);
    expect(animal.mood).toBe('stunned');
    expect(animal.x).toBe(6);
    expect(animal.z).toBe(0);
  });

  it('wears off after 5 s, and the animal moves again', () => {
    const herd = createHerd(grazer(), { x: 0, z: 0 }, 1, mulberry32(11));
    const [animal] = herd.animals;
    stunCreature(animal);
    for (let t = 0; t < 5.1; t += FRAME) stepHerd(herd, { x: 1e6, z: 1e6, running: false }, FRAME, flat);
    expect(animal.mood).not.toBe('stunned');
  });
});

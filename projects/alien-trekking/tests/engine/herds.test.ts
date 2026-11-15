import { describe, expect, it } from 'vitest';
import { planAnimalSpecies, type AnimalSpecies } from '../../src/engine/animals';
import { createHerd, HERD_RANGE_M, stepHerd, type Herd, type HeightFn } from '../../src/engine/herds';
import { mulberry32 } from '../../src/engine/random';

const flat: HeightFn = () => 0;
const FRAME = 1 / 30;
const FAR = { x: 1e6, z: 1e6, running: false };

function species(): AnimalSpecies {
  return planAnimalSpecies(mulberry32(3), 9.81, [200, 170, 140], 1, new Set())[0];
}

function herdAt(count = 4, seed = 11): Herd {
  return createHerd(species(), { x: 0, z: 0 }, count, mulberry32(seed));
}

function simulate(herd: Herd, seconds: number, observer = FAR, heightAt = flat): void {
  for (let t = 0; t < seconds; t += FRAME) stepHerd(herd, observer, FRAME, heightAt);
}

describe('herd behaviour', () => {
  it('starts grazing near its home', () => {
    const herd = herdAt();
    for (const animal of herd.animals) {
      expect(Math.hypot(animal.x, animal.z)).toBeLessThan(5);
      expect(animal.mood).toBe('graze');
    }
  });

  it('keeps wandering within its range of home for a long time', () => {
    const herd = herdAt(6);
    for (let t = 0; t < 300; t += FRAME) {
      stepHerd(herd, FAR, FRAME, flat);
      for (const animal of herd.animals) {
        expect(Math.hypot(animal.x, animal.z)).toBeLessThanOrEqual(HERD_RANGE_M + 1e-6);
      }
    }
  });

  it('wanders: animals move from where they started', () => {
    const herd = herdAt(3);
    const start = herd.animals.map((animal) => [animal.x, animal.z]);
    simulate(herd, 60);
    const moved = herd.animals.some((animal, i) => {
      return Math.hypot(animal.x - start[i][0], animal.z - start[i][1]) > 1;
    });
    expect(moved).toBe(true);
  });

  it('flees from an observer who runs within the flee radius', () => {
    const herd = herdAt(1);
    const [animal] = herd.animals;
    animal.x = 6;
    animal.z = 0;
    const observer = { x: 6 - 8, z: 0, running: true };
    const before = Math.hypot(animal.x - observer.x, animal.z - observer.z);
    stepHerd(herd, observer, FRAME, flat);
    expect(animal.mood).toBe('flee');
    expect(animal.x).toBeGreaterThan(6);
    simulate(herd, 1, observer);
    expect(Math.hypot(animal.x - observer.x, animal.z - observer.z)).toBeGreaterThan(before);
  });

  it('does not flee from an observer who only walks past at the same distance', () => {
    const herd = herdAt(1);
    const [animal] = herd.animals;
    animal.x = 8;
    animal.z = 0;
    const walker = { x: 0, z: 0, running: false };
    simulate(herd, 2, walker);
    expect(animal.mood).not.toBe('flee');
  });

  it('bolts from an observer who gets very close, even walking', () => {
    const herd = herdAt(1);
    const [animal] = herd.animals;
    animal.x = 2;
    animal.z = 0;
    stepHerd(herd, { x: 0, z: 0, running: false }, FRAME, flat);
    expect(animal.mood).toBe('flee');
  });

  it('stops fleeing after a while when the observer is gone', () => {
    const herd = herdAt(1);
    const [animal] = herd.animals;
    animal.x = 4;
    animal.z = 0;
    stepHerd(herd, { x: 0, z: 0, running: true }, FRAME, flat);
    expect(animal.mood).toBe('flee');
    simulate(herd, 10);
    expect(animal.mood).not.toBe('flee');
  });

  it('does not walk up ground steeper than 25 degrees', () => {
    const herd = herdAt(1);
    const [animal] = herd.animals;
    const cliff: HeightFn = (x) => (x > 0.1 ? 100 : 0);
    animal.x = 0.09;
    animal.z = 0;
    animal.mood = 'wander';
    animal.headingRad = Math.PI / 2;
    animal.targetX = 10;
    animal.targetZ = 0;
    animal.timerS = 10;
    stepHerd(herd, FAR, FRAME, cliff);
    expect(animal.x).toBe(0.09);
    expect(animal.mood).toBe('graze');
  });

  it('gives the same movements for the same seed', () => {
    const first = herdAt(4, 99);
    const second = herdAt(4, 99);
    simulate(first, 30);
    simulate(second, 30);
    expect(second.animals).toEqual(first.animals);
  });
});

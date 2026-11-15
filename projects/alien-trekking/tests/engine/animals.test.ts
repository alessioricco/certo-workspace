import { describe, expect, it } from 'vitest';
import { bodyScale, planAnimalSpecies } from '../../src/engine/animals';
import { mulberry32 } from '../../src/engine/random';
import { expectClose } from './helpers';

describe('bodyScale', () => {
  it('matches the worked examples', () => {
    expectClose(bodyScale(9.81), 1);
    expectClose(bodyScale(39.24), 0.5);
    expectClose(bodyScale(2.4525), 2);
    expectClose(bodyScale(100), 0.3132);
    expectClose(bodyScale(0.5), 3);
  });

  it('keeps animals between 0.3 and 3 times Earth size', () => {
    expect(bodyScale(1e6)).toBe(0.3);
    expect(bodyScale(0.01)).toBe(3);
  });
});

describe('planAnimalSpecies', () => {
  const plan = (gravityMS2: number) =>
    planAnimalSpecies(mulberry32(42), gravityMS2, [200, 170, 140], 2, new Set());

  it('makes squat animals on heavy worlds and tall, slender ones on light worlds', () => {
    const [heavy] = plan(39.24);
    const [light] = plan(2.4525);
    const stance = (animal: ReturnType<typeof plan>[number]) => animal.legLengthM / animal.bodyHeightM;
    expect(stance(heavy)).toBeLessThan(stance(light));
    expect(heavy.bodyLengthM).toBeLessThan(light.bodyLengthM);
    expect(heavy.description).toMatch(/^Squat/);
    expect(light.description).toMatch(/^Tall and slender/);
  });

  it('makes animals that are faster on light worlds', () => {
    const [heavy] = plan(39.24);
    const [light] = plan(2.4525);
    expect(light.walkSpeedMS).toBeGreaterThan(heavy.walkSpeedMS);
    expect(light.fleeSpeedMS).toBeGreaterThan(heavy.fleeSpeedMS);
  });

  it('gives herds of three to six', () => {
    for (const animal of plan(9.81)) {
      expect(animal.herdMin).toBe(3);
      expect(animal.herdMax).toBeGreaterThanOrEqual(4);
      expect(animal.herdMax).toBeLessThanOrEqual(6);
    }
  });
});

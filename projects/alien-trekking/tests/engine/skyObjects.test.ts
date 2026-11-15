import { describe, expect, it } from 'vitest';
import { MAX_MOONS, moonView, planMoons } from '../../src/engine/moons';
import { starField } from '../../src/engine/stars';
import type { SkyWorld } from '../../src/engine/sky';
import { expectClose } from './helpers';

const WORLD: SkyWorld = { starClass: 'G', dayLengthHours: 24, pressureAtm: 1 };
const SEED_WITH_MOON = 7;

describe('starField', () => {
  it('places every star on the upper sky, as a unit vector', () => {
    const field = starField(42, 500);
    for (let i = 0; i < 500; i++) {
      const [x, y, z] = [field.directions[i * 3], field.directions[i * 3 + 1], field.directions[i * 3 + 2]];
      expectClose(Math.hypot(x, y, z), 1);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps brightness between 0.3 and 1', () => {
    const field = starField(42, 500);
    for (const value of field.brightness) {
      expect(value).toBeGreaterThanOrEqual(0.3);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is the same for the same seed and different for another seed', () => {
    expect(starField(42, 50)).toEqual(starField(42, 50));
    expect(starField(42, 50).directions).not.toEqual(starField(7, 50).directions);
  });
});

describe('planMoons', () => {
  it('gives no more than the maximum number of moons, the same for the same seed', () => {
    for (let seed = 0; seed < 100; seed++) {
      const moons = planMoons(seed);
      expect(moons.length).toBeLessThanOrEqual(MAX_MOONS);
      expect(planMoons(seed)).toEqual(moons);
    }
  });

  it('gives different moons for different seeds', () => {
    const seen = new Set(Array.from({ length: 50 }, (_, seed) => JSON.stringify(planMoons(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('moonView', () => {
  it('is a unit direction, and comes back to the same place after one orbit', () => {
    const [moon] = planMoons(SEED_WITH_MOON);
    expect(moon).toBeDefined();
    const first = moonView(moon, WORLD, 5);
    const again = moonView(moon, WORLD, 5 + WORLD.dayLengthHours * moon.periodDays);
    expectClose(Math.hypot(...first.direction), 1);
    for (let axis = 0; axis < 3; axis++) {
      expectClose(first.direction[axis], again.direction[axis]);
    }
  });
});

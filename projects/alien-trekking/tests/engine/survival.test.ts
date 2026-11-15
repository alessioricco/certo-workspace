import { describe, expect, it } from 'vitest';
import { atLander, LANDER, LANDER_CLEARANCE_M } from '../../src/engine/lander';
import {
  COMFORT_MAX_K,
  COMFORT_MIN_K,
  freshVitals,
  HEALTH_MAX,
  isDown,
  OXYGEN_MAX,
  stepVitals,
  takeDamage,
  temperatureDamagePerS,
  type Surroundings,
  type Vitals,
} from '../../src/engine/survival';
import { expectClose } from './helpers';

const FRAME = 1 / 60;
const COMFORTABLE_K = 287.8;
const thin: Surroundings = {
  breathable: false,
  sheltered: false,
  running: false,
  temperatureK: COMFORTABLE_K,
};

function run(
  start: Vitals,
  surroundings: Surroundings,
  seconds: number,
  frame = FRAME,
): Vitals {
  let vitals = start;
  for (let t = 0; t < seconds - 1e-9; t += frame) vitals = stepVitals(vitals, surroundings, frame);
  return vitals;
}

describe('oxygen drain', () => {
  it('drains 0.1 per second while walking in thin air: 60 s leaves 94', () => {
    expectClose(run(freshVitals(), thin, 60).oxygen, 94);
  });

  it('drains 0.3 per second while running: 10 s leaves 97', () => {
    expectClose(run(freshVitals(), { ...thin, running: true }, 10).oxygen, 97);
  });

  it('never drains on breathable air, however long or hard the player runs', () => {
    const breathable = { ...thin, breathable: true, running: true };
    expect(run(freshVitals(), breathable, 1000).oxygen).toBe(OXYGEN_MAX);
  });

  it('counts a stalled frame as at most 0.1 s', () => {
    expectClose(stepVitals(freshVitals(), thin, 30).oxygen, 99.99);
  });

  it('refills at the lander, capped at a full tank: 1 s from 40 gives 65 and 2 s from 40 gives 90', () => {
    const start: Vitals = { health: 50, oxygen: 40 };
    const sheltered = { ...thin, sheltered: true };
    expectClose(run(start, sheltered, 1).oxygen, 65);
    expectClose(run(start, sheltered, 2).oxygen, 90);
    expect(run(start, sheltered, 5).oxygen).toBe(OXYGEN_MAX);
  });

  it('suffocates with an empty tank: 2 health per second, and the tank stays at zero', () => {
    const empty = stepVitals({ health: 100, oxygen: 0 }, thin, 0.1);
    expect(empty.oxygen).toBe(0);
    expectClose(empty.health, 99.8);
  });
});

describe('temperature limit', () => {
  it('costs nothing inside the comfort band, 0 °C to 40 °C', () => {
    expect(temperatureDamagePerS(COMFORT_MIN_K)).toBe(0);
    expect(temperatureDamagePerS(COMFORTABLE_K)).toBe(0);
    expect(temperatureDamagePerS(COMFORT_MAX_K)).toBe(0);
  });

  it('costs 0.1 health per second for each kelvin beyond the band: 10 K too hot or too cold costs 1 per second', () => {
    expectClose(temperatureDamagePerS(COMFORT_MAX_K + 10), 1);
    expectClose(temperatureDamagePerS(COMFORT_MIN_K - 10), 1);
  });

  it('wears health down slowly outside: 10 s at 10 K too hot leaves 90 health', () => {
    const hot = { ...thin, breathable: true, temperatureK: COMFORT_MAX_K + 10 };
    expectClose(run(freshVitals(), hot, 10).health, 90);
  });

  it('does not reach the player inside the lander', () => {
    const hot = { ...thin, sheltered: true, temperatureK: COMFORT_MAX_K + 80 };
    expect(run(freshVitals(), hot, 10).health).toBe(HEALTH_MAX);
  });
});

describe('health', () => {
  it('heals inside the lander and never above the maximum', () => {
    const sheltered = { ...thin, sheltered: true };
    expectClose(run({ health: 50, oxygen: OXYGEN_MAX }, sheltered, 2).health, 58);
    expect(run({ health: 99, oxygen: OXYGEN_MAX }, sheltered, 5).health).toBe(HEALTH_MAX);
  });

  it('takes damage and never goes below zero, which counts as down', () => {
    const hurt = takeDamage(freshVitals(), 20);
    expect(hurt.health).toBe(80);
    expect(isDown(hurt)).toBe(false);
    expect(takeDamage(hurt, 500).health).toBe(0);
    expect(isDown(takeDamage(hurt, 80))).toBe(true);
  });
});

describe('the lander', () => {
  it('is a 6 m circle around the landing point', () => {
    expect(atLander(LANDER)).toBe(true);
    expect(atLander({ x: LANDER.radiusM - 0.01, z: 0 })).toBe(true);
    expect(atLander({ x: LANDER.radiusM + 0.01, z: 0 })).toBe(false);
  });

  it('keeps predators at least 40 m away when they are placed', () => {
    expect(LANDER_CLEARANCE_M).toBe(40);
  });
});

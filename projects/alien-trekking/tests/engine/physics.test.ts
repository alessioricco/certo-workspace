import { describe, expect, it } from 'vitest';
import { assessAir, oxygenPartialPressure } from '../../src/engine/atmosphere';
import {
  equilibriumTemperature,
  escapeVelocity,
  jumpHeight,
  habitableZone,
  surfaceGravity,
  surfaceTemperature,
} from '../../src/engine/physics';
import { expectClose } from './helpers';

describe('surfaceGravity', () => {
  it('matches the worked examples', () => {
    expectClose(surfaceGravity(1, 1), 9.81);
    expectClose(surfaceGravity(2, 1), 19.62);
    expectClose(surfaceGravity(1, 2), 2.4525);
    expectClose(surfaceGravity(5, 1.5), 21.8);
  });
});

describe('escapeVelocity', () => {
  it('matches the worked examples', () => {
    expectClose(escapeVelocity(1, 1), 11.186);
    expectClose(escapeVelocity(4, 1), 22.372);
    expectClose(escapeVelocity(5, 1.5), 20.4227);
  });
});

describe('equilibriumTemperature', () => {
  it('matches the worked examples', () => {
    expectClose(equilibriumTemperature(1, 1, 0.3), 254.83);
    expectClose(equilibriumTemperature(0.04, 0.15, 0.3), 294.26);
    expectClose(equilibriumTemperature(2.5, 2, 0.2), 234.27);
    expectClose(equilibriumTemperature(0.35, 0.6, 0.3), 253.04);
  });
});

describe('surfaceTemperature', () => {
  it('matches the worked examples', () => {
    expectClose(surfaceTemperature(1, 1, 0.3, 1), 287.83);
    expectClose(surfaceTemperature(0.35, 0.6, 0.3, 2), 319.04);
    expectClose(surfaceTemperature(2.5, 2, 0.2, 0.1), 237.57);
  });
});

describe('habitableZone', () => {
  it('matches the worked examples', () => {
    const sun = habitableZone(1);
    expectClose(sun.inner, 0.9535);
    expectClose(sun.outer, 1.3736);

    const red = habitableZone(0.04);
    expectClose(red.inner, 0.1907);
    expectClose(red.outer, 0.2747);
  });
});

describe('oxygenPartialPressure and air', () => {
  it('matches the worked examples', () => {
    expectClose(oxygenPartialPressure(1, 0.21), 0.21);
    expectClose(oxygenPartialPressure(0.5, 0.21), 0.105);
    expectClose(oxygenPartialPressure(3, 0.21), 0.63);
  });

  it('classifies the air as breathable, too thin or toxic', () => {
    expect(assessAir(1, 0.21)).toBe('breathable');
    expect(assessAir(0.5, 0.21)).toBe('too thin');
    expect(assessAir(3, 0.21)).toBe('toxic');
  });
});

describe('jumpHeight', () => {
  it('matches the worked examples', () => {
    expectClose(jumpHeight(9.81), 0.4993);
    expectClose(jumpHeight(19.62), 0.2497);
    expectClose(jumpHeight(2.4525), 1.9973);
  });
});

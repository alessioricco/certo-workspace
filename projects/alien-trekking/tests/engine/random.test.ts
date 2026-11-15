import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/random';
import { expectClose } from './helpers';

describe('mulberry32', () => {
  it('three calls of mulberry32(1)', () => {
    const next = mulberry32(1);
    expectClose(next(), 0.6270739406);
    expectClose(next(), 0.0027357212);
    expectClose(next(), 0.52744704);
  });

  it('three calls of mulberry32(42)', () => {
    const next = mulberry32(42);
    expectClose(next(), 0.6011037519);
    expectClose(next(), 0.448290559);
    expectClose(next(), 0.8524657935);
  });

  it('returns numbers in [0, 1) and repeats for the same seed', () => {
    const first = mulberry32(1234);
    const second = mulberry32(1234);
    for (let i = 0; i < 1000; i++) {
      const value = first();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(value).toBe(second());
    }
  });
});

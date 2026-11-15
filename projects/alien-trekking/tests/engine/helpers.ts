import { expect } from 'vitest';

/** Checks that a computed number matches a worked-out example within 0.01. */
export function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01);
}

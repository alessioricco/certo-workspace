import { describe, expect, it } from 'vitest';
import { groundKind, terrainGrid, terrainHeight } from '../../src/engine/terrain';

const SAMPLES = Array.from({ length: 50 }, (_, i) => [i * 13.7 - 300, i * -9.1 + 210] as const);

describe('terrainHeight', () => {
  it('gives the same height for the same point and seed', () => {
    for (const [x, z] of SAMPLES) {
      expect(terrainHeight(x, z, 42)).toBe(terrainHeight(x, z, 42));
    }
  });

  it('gives a different landscape for a different seed', () => {
    const differing = SAMPLES.filter(
      ([x, z]) => Math.abs(terrainHeight(x, z, 42) - terrainHeight(x, z, 7)) > 0.01,
    );
    expect(differing.length).toBeGreaterThan(SAMPLES.length * 0.9);
  });

  it('returns to the first seed after another seed was used', () => {
    const first = SAMPLES.map(([x, z]) => terrainHeight(x, z, 42));
    SAMPLES.forEach(([x, z]) => terrainHeight(x, z, 1000));
    expect(SAMPLES.map(([x, z]) => terrainHeight(x, z, 42))).toEqual(first);
  });

  it('has relief, within the sum of the octave amplitudes', () => {
    const heights = SAMPLES.map(([x, z]) => terrainHeight(x, z, 42));
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
    expect(Math.max(...heights.map(Math.abs))).toBeLessThanOrEqual(34.2);
  });
});

describe('terrainGrid', () => {
  it('samples terrainHeight at every grid corner', () => {
    const grid = terrainGrid(64, -128, 64, 4, 42);
    expect(grid.length).toBe(25);
    expect(grid[0]).toBeCloseTo(terrainHeight(64, -128, 42), 5);
    expect(grid[2 * 5 + 3]).toBeCloseTo(terrainHeight(64 + 3 * 16, -128 + 2 * 16, 42), 5);
    expect(grid[24]).toBeCloseTo(terrainHeight(128, -64, 42), 5);
  });

  it('matches the neighbouring chunk along their shared edge', () => {
    const left = terrainGrid(0, 0, 64, 16, 42);
    const right = terrainGrid(64, 0, 64, 16, 42);
    for (let iz = 0; iz <= 16; iz++) {
      expect(left[iz * 17 + 16]).toBe(right[iz * 17]);
    }
  });
});

describe('groundKind', () => {
  it('is rock on steep ground, highland high up, lowland otherwise', () => {
    expect(groundKind(0, 35)).toBe('rock');
    expect(groundKind(20, 10)).toBe('highland');
    expect(groundKind(2, 10)).toBe('lowland');
  });
});

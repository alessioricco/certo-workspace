import { describe, expect, it } from 'vitest';
import { Starfield, STAR_COUNT, VISUAL_SALT } from '../../src/render/starfield';
import { Xorshift32 } from '../../src/math/random';
import { FiringRange } from '../../src/game/range';

describe('seeded presentation-only parallax', () => {
  it('uses a salted reproducible layout with three bounded layers', () => {
    const first = new Starfield(42);
    expect(first.stars).toHaveLength(STAR_COUNT);
    expect(first.stars).toEqual(new Starfield(42).stars);
    expect(first.stars).not.toEqual(new Starfield(43).stars);
    expect(new Set(first.stars.map(star => star.layer))).toEqual(new Set([0, 1, 2]));
    const random = new Xorshift32((42 ^ VISUAL_SALT) >>> 0);
    expect(first.stars[0]).toEqual({ x: 8 + random.nextUint32() % 344, y: random.nextUint32() % 640, layer: random.nextUint32() % 3 });
    const slots = [...first.stars];
    first.reset(43);
    expect(first.stars).toEqual(new Starfield(43).stars);
    expect(first.stars.every((star, index) => star === slots[index])).toBe(true);
    first.reset(42);
    expect(first.stars).toEqual(new Starfield(42).stars);
    expect(new Starfield(0).stars).not.toEqual(new Starfield(0x6d2b79f5).stars);
  });

  it('scrolls and shifts near layers faster, wraps and supports fractional tick interpolation', () => {
    const field = new Starfield(42);
    for (let layer = 0; layer < 3; layer++) {
      const star = { x: 180, y: 100, layer };
      expect(field.x(star, 180)).toBe(180);
      expect(field.x(star, 280)).toBeCloseTo(180 - 3.5 * (layer + 1));
      expect(field.y(star, 10.5)).toBeCloseTo(100 + 10.5 * 0.18 * (layer + 1));
      expect(field.x({ x: 0, y: 0, layer }, 352)).toBeGreaterThan(340);
      expect(field.x({ x: 359, y: 0, layer }, 8)).toBeLessThan(20);
      expect(field.y({ x: 0, y: 639, layer }, 100)).toBeGreaterThanOrEqual(0);
      expect(field.y({ x: 0, y: 639, layer }, 100)).toBeLessThan(640);
    }
  });

  it('cannot consume gameplay randomness or change tick state when motion is disabled', () => {
    const range = new FiringRange();
    range.reset(42);
    const before = JSON.stringify(range);
    const field = new Starfield(range.seed);
    for (let tick = 0; tick < 300; tick++) {
      for (const star of field.stars) {
        field.x(star, range.player.x);
        field.y(star, tick + 0.5);
        field.y(star, 0);
      }
    }
    expect(JSON.stringify(range)).toBe(before);
  });
});

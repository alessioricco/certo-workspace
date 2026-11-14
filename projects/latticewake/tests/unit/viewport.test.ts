import { describe, expect, it } from 'vitest';
import { calculateViewport } from '../../src/render/viewport';

describe('calculateViewport', () => {
  it('fits the 360 × 640 field into a portrait viewport', () => {
    const viewport = calculateViewport(390, 844, 1);
    expect(viewport.width).toBe(390);
    expect(viewport.height).toBeCloseTo(693.3333333333334);
    expect(viewport.pixelWidth).toBe(390);
    expect(viewport.pixelHeight).toBe(693);
  });

  it('letterboxes wide viewports without stretching', () => {
    expect(calculateViewport(1200, 640, 1)).toEqual({ width: 360, height: 640, pixelWidth: 360, pixelHeight: 640, dpr: 1 });
  });

  it('caps high device pixel ratios and supports fractional DPR', () => {
    expect(calculateViewport(360, 640, 4)).toEqual({ width: 360, height: 640, pixelWidth: 720, pixelHeight: 1280, dpr: 2 });
    expect(calculateViewport(360, 640, 1.25).pixelWidth).toBe(450);
    expect(calculateViewport(360, 640, 0.5).dpr).toBe(1);
  });

  it('keeps a nonzero backing surface for subpixel containers', () => {
    expect(calculateViewport(0.1, 0.1, 1).pixelWidth).toBe(1);
    expect(calculateViewport(0.1, 0.1, 1).pixelHeight).toBe(1);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejects invalid dimensions or DPR: %s', (invalid) => {
    expect(() => calculateViewport(invalid, 640, 1)).toThrow(RangeError);
    expect(() => calculateViewport(360, invalid, 1)).toThrow(RangeError);
    expect(() => calculateViewport(360, 640, invalid)).toThrow(RangeError);
  });

  it('fits many sizes with a consistent logical aspect ratio', () => {
    for (const width of [1, 320, 390, 844, 1920]) {
      for (const height of [1, 200, 640, 900, 1080]) {
        const layout = calculateViewport(width, height, 1.5);
        expect(layout.width).toBeLessThanOrEqual(width);
        expect(layout.height).toBeLessThanOrEqual(height);
        expect(layout.width / layout.height).toBeCloseTo(360 / 640, 12);
        expect(layout.pixelWidth).toBeGreaterThanOrEqual(1);
        expect(layout.pixelHeight).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

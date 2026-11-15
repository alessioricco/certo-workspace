import { describe, expect, it } from 'vitest';
import { blackbodyColor, mixRgb, skyColor } from '../../src/engine/color';

describe('blackbodyColor', () => {
  it('matches the worked examples', () => {
    expect(blackbodyColor(3200)).toEqual([255, 184, 123]);
    expect(blackbodyColor(5778)).toEqual([255, 242, 231]);
    expect(blackbodyColor(6500)).toEqual([255, 254, 250]);
    expect(blackbodyColor(10000)).toEqual([202, 218, 255]);
  });

  it('gives whole channels from 0 to 255 across the star temperatures', () => {
    for (let kelvin = 1000; kelvin <= 40000; kelvin += 250) {
      for (const channel of blackbodyColor(kelvin)) {
        expect(Number.isInteger(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('skyColor', () => {
  it('matches the worked examples', () => {
    expect(skyColor(3200)).toEqual([90, 171, 255]);
    expect(skyColor(5778)).toEqual([48, 120, 255]);
    expect(skyColor(10000)).toEqual([34, 98, 255]);
  });

  it('scatters blue most: the largest channel is blue and reaches 255', () => {
    for (const kelvin of [3200, 4500, 5778, 6500, 9000]) {
      const [red, green, blue] = skyColor(kelvin);
      expect(blue).toBe(255);
      expect(red).toBeLessThan(green);
      expect(green).toBeLessThan(blue);
    }
  });
});

describe('mixRgb', () => {
  it('returns the ends at 0 and 1, and the middle between them', () => {
    expect(mixRgb([0, 100, 200], [200, 100, 0], 0)).toEqual([0, 100, 200]);
    expect(mixRgb([0, 100, 200], [200, 100, 0], 1)).toEqual([200, 100, 0]);
    expect(mixRgb([0, 100, 200], [200, 100, 0], 0.5)).toEqual([100, 100, 100]);
  });
});

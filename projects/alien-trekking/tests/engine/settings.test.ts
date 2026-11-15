import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../../src/engine/settings';

describe('parseSettings', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps saved values that are inside their ranges', () => {
    const saved = { drawDistanceChunks: 5, lookSensitivity: 2, volume: 0.25 };
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it('clamps saved values that are outside their ranges', () => {
    const saved = { drawDistanceChunks: 40, lookSensitivity: 0, volume: 3 };
    expect(parseSettings(JSON.stringify(saved))).toEqual({
      drawDistanceChunks: 6,
      lookSensitivity: 0.25,
      volume: 1,
    });
  });

  it('gives whole chunks for the draw distance', () => {
    expect(parseSettings(JSON.stringify({ drawDistanceChunks: 3.6 })).drawDistanceChunks).toBe(4);
  });

  it('falls back to the default for damaged text or a value that is not a number', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ volume: 'loud', lookSensitivity: 'fast' }))).toEqual(DEFAULT_SETTINGS);
  });
});

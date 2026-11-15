import { describe, expect, it } from 'vitest';
import {
  bobPeakM,
  createFooting,
  footfallsPerS,
  footstepLoudness,
  stepFooting,
  type Footing,
} from '../../src/engine/footing';

const EARTH = 9.81;
const FRAME_S = 1 / 60;

/** Steps the stride for `seconds` at 60 frames a second; returns the footfalls and the last state. */
function walk(
  start: Footing,
  seconds: number,
  moving: boolean,
  gravityMS2: number,
): { footfalls: number; footing: Footing; bobs: number[] } {
  let footing = start;
  let footfalls = 0;
  const bobs: number[] = [];
  const frames = Math.round(seconds / FRAME_S);
  for (let frame = 0; frame < frames; frame++) {
    const step = stepFooting(footing, moving, false, gravityMS2, FRAME_S);
    footing = step.footing;
    if (step.footfall) {
      footfalls++;
      bobs.push(step.bobM);
    }
  }
  return { footfalls, footing, bobs };
}

describe('footfallsPerS', () => {
  it('walks at 2 footfalls a second on Earth, and runs faster', () => {
    expect(footfallsPerS(EARTH, false)).toBeCloseTo(2, 2);
    expect(footfallsPerS(EARTH, true)).toBeCloseTo(2.8, 2);
  });

  it('steps faster in heavier worlds, as a leg swings like a pendulum', () => {
    expect(footfallsPerS(4 * EARTH, false)).toBeCloseTo(4, 2);
  });
});

describe('bobPeakM', () => {
  it('bobs 4 cm on Earth, more in lighter worlds, and is capped', () => {
    expect(bobPeakM(EARTH)).toBeCloseTo(0.04, 3);
    expect(bobPeakM(EARTH / 2)).toBeCloseTo(0.08, 3);
    expect(bobPeakM(1)).toBeCloseTo(0.12, 3);
  });
});

describe('footstepLoudness', () => {
  it('is 1 on Earth, louder in heavy worlds, and bounded', () => {
    expect(footstepLoudness(EARTH)).toBeCloseTo(1, 3);
    expect(footstepLoudness(2 * EARTH)).toBeCloseTo(1.5, 3);
    expect(footstepLoudness(0.5)).toBeCloseTo(0.3, 3);
  });
});

describe('stepFooting', () => {
  it('makes about one footfall per foot-fall rate, counted from the walk', () => {
    const walked = walk(createFooting(), 10, true, EARTH);
    expect(walked.footfalls).toBeGreaterThanOrEqual(19);
    expect(walked.footfalls).toBeLessThanOrEqual(20);
  });

  it('gives more footfalls in a heavier world over the same walk', () => {
    const walked = walk(createFooting(), 10, true, 4 * EARTH);
    expect(walked.footfalls).toBeGreaterThanOrEqual(39);
    expect(walked.footfalls).toBeLessThanOrEqual(40);
  });

  it('dips the head to its lowest as each foot lands', () => {
    const { bobs } = walk(createFooting(), 2, true, EARTH);
    expect(bobs.length).toBeGreaterThan(0);
    for (const bob of bobs) expect(bob).toBeLessThanOrEqual(-0.95 * bobPeakM(EARTH));
  });

  it('makes no footfalls and no bob once the player stands still', () => {
    const walking = walk(createFooting(), 1, true, EARTH);
    const standing = walk(walking.footing, 1, false, EARTH);
    expect(standing.footfalls).toBe(0);
    expect(Math.abs(stepFooting(standing.footing, false, false, EARTH, FRAME_S).bobM)).toBeLessThan(1e-9);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/engine/level';
import {
  LANDMARK_REACH_M,
  landmarksInReach,
  planLandmarks,
  type Landmark,
} from '../../src/engine/landmarks';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function loadShipped(file: string): Level {
  return JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8')) as Level;
}

const verdant = loadShipped('verdant-g.json');
const ember = loadShipped('ember-m.json');
const boulder = loadShipped('boulder-k.json');

describe('planLandmarks', () => {
  it('places one landmark per reach-landmark objective, named as the objective names it', () => {
    const landmarks = planLandmarks(verdant);
    expect(landmarks.map((landmark) => landmark.name)).toEqual(['the tall spire']);
    expect(planLandmarks(ember).map((landmark) => landmark.name)).toEqual(['the red crater rim']);
    expect(planLandmarks(boulder).map((landmark) => landmark.name)).toEqual(['the balanced stone']);
  });

  it('is the same for the same level every time', () => {
    expect(planLandmarks(verdant)).toEqual(planLandmarks(verdant));
  });

  it('places each landmark 120 to 300 m from the lander, with a height in its shape range', () => {
    for (const level of [verdant, ember, boulder]) {
      for (const landmark of planLandmarks(level)) {
        const distance = Math.hypot(landmark.x, landmark.z);
        expect(distance).toBeGreaterThanOrEqual(120);
        expect(distance).toBeLessThanOrEqual(300);
        const range = { spire: [24, 40], arch: [12, 18], pillar: [10, 16] }[landmark.shape];
        expect(landmark.heightM).toBeGreaterThanOrEqual(range[0]);
        expect(landmark.heightM).toBeLessThanOrEqual(range[1]);
      }
    }
  });

  it('places the landmark from the seed, so another seed puts it somewhere else', () => {
    const reseeded = { ...verdant, seed: verdant.seed + 1 };
    const [before] = planLandmarks(verdant);
    const [after] = planLandmarks(reseeded);
    expect(after.x === before.x && after.z === before.z).toBe(false);
  });

  it('gives one landmark per objective, in order, when a world has several', () => {
    const level: Level = {
      ...verdant,
      objectives: [
        { kind: 'reach-landmark', name: 'the first arch' },
        { kind: 'scan-species', count: 2 },
        { kind: 'reach-landmark', name: 'the second pillar' },
      ],
    };
    expect(planLandmarks(level).map((landmark) => landmark.name)).toEqual([
      'the first arch',
      'the second pillar',
    ]);
  });
});

describe('landmarksInReach', () => {
  const landmarks: Landmark[] = [
    { name: 'the near rock', shape: 'pillar', x: 100, z: 100, heightM: 12, yawRad: 0 },
    { name: 'the far rock', shape: 'spire', x: 200, z: 100, heightM: 30, yawRad: 0 },
  ];

  it('names a landmark only when the point stands within reach of it', () => {
    expect(landmarksInReach(landmarks, { x: 100 + LANDMARK_REACH_M, z: 100 })).toEqual(['the near rock']);
    expect(landmarksInReach(landmarks, { x: 100 + LANDMARK_REACH_M + 0.5, z: 100 })).toEqual([]);
    expect(landmarksInReach(landmarks, { x: 200, z: 105 })).toEqual(['the far rock']);
  });
});

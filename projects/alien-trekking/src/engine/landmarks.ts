import type { Level } from './level';
import { LANDER } from './lander';
import { mixSeed, mulberry32, uniform } from './random';

export const LANDMARK_SHAPES = ['spire', 'arch', 'pillar'] as const;
export type LandmarkShape = (typeof LANDMARK_SHAPES)[number];

export interface Landmark {
  name: string;
  shape: LandmarkShape;
  x: number;
  z: number;
  heightM: number;
  yawRad: number;
}

const LANDMARK_SALT = 0x3c6ef372;
const DISTANCE_MIN_M = 120;
const DISTANCE_MAX_M = 300;
/** Standing this close (horizontally) to a landmark reaches it. */
export const LANDMARK_REACH_M = 12;

const HEIGHT_RANGE_M: Record<LandmarkShape, { min: number; max: number }> = {
  spire: { min: 24, max: 40 },
  arch: { min: 12, max: 18 },
  pillar: { min: 10, max: 16 },
};

/**
 * One landmark per "reach-landmark" objective, in objective order. Each one's shape,
 * bearing from the lander and size come from the level's seed and its position in the list.
 */
export function planLandmarks(level: Level): Landmark[] {
  return level.objectives.flatMap((objective, index) => {
    if (objective.kind !== 'reach-landmark') return [];
    const random = mulberry32(mixSeed(level.seed, LANDMARK_SALT, index));
    const shape = LANDMARK_SHAPES[Math.floor(random() * LANDMARK_SHAPES.length)];
    const bearingRad = uniform(random, 0, 2 * Math.PI);
    const distanceM = uniform(random, DISTANCE_MIN_M, DISTANCE_MAX_M);
    const { min, max } = HEIGHT_RANGE_M[shape];
    return [
      {
        name: objective.name,
        shape,
        x: LANDER.x + distanceM * Math.cos(bearingRad),
        z: LANDER.z + distanceM * Math.sin(bearingRad),
        heightM: uniform(random, min, max),
        yawRad: uniform(random, 0, 2 * Math.PI),
      },
    ];
  });
}

/** The names of the landmarks the point stands within reach of. */
export function landmarksInReach(landmarks: readonly Landmark[], point: { x: number; z: number }): string[] {
  return landmarks
    .filter((landmark) => Math.hypot(landmark.x - point.x, landmark.z - point.z) <= LANDMARK_REACH_M)
    .map((landmark) => landmark.name);
}

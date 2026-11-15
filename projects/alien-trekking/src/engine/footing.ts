import { clamp } from './math';
import { EARTH_GRAVITY_MS2 } from './physics';

/** Footfalls per second on Earth. A leg swings like a pendulum, so the rate rises with the square root of gravity. */
const WALK_FOOTFALLS_PER_S = 2;
const RUN_FOOTFALLS_PER_S = 2.8;
/** Head bob peak in metres on Earth. Lighter worlds bob higher, up to a cap. */
const BOB_PEAK_EARTH_M = 0.04;
const MAX_BOB_PEAK_M = 0.12;
const BOB_FADE_PER_S = 6;
const MIN_LOUDNESS = 0.3;
const MAX_LOUDNESS = 1.5;

export interface Footing {
  /** Footfalls so far; each whole number is the moment a foot lands. */
  cycle: number;
  /** 0 when standing still, 1 when walking at full bob. */
  bobWeight: number;
}

export interface FootingStep {
  footing: Footing;
  footfall: boolean;
  /** Vertical offset of the eyes in metres, lowest as a foot lands. */
  bobM: number;
}

export function createFooting(): Footing {
  return { cycle: 0, bobWeight: 0 };
}

export function footfallsPerS(gravityMS2: number, running: boolean): number {
  const onEarth = running ? RUN_FOOTFALLS_PER_S : WALK_FOOTFALLS_PER_S;
  return onEarth * Math.sqrt(gravityMS2 / EARTH_GRAVITY_MS2);
}

export function bobPeakM(gravityMS2: number): number {
  return Math.min(MAX_BOB_PEAK_M, (BOB_PEAK_EARTH_M * EARTH_GRAVITY_MS2) / gravityMS2);
}

/** How loud a footstep is, relative to one on Earth: heavier worlds thud louder. */
export function footstepLoudness(gravityMS2: number): number {
  return clamp(gravityMS2 / EARTH_GRAVITY_MS2, MIN_LOUDNESS, MAX_LOUDNESS);
}

/** Advances the stride by `dtS` seconds. The bob fades in while walking and out when standing. */
export function stepFooting(
  footing: Footing,
  moving: boolean,
  running: boolean,
  gravityMS2: number,
  dtS: number,
): FootingStep {
  const cycle = moving ? footing.cycle + footfallsPerS(gravityMS2, running) * dtS : footing.cycle;
  const fade = moving ? BOB_FADE_PER_S : -BOB_FADE_PER_S;
  const bobWeight = clamp(footing.bobWeight + fade * dtS, 0, 1);
  const bobM = -bobWeight * bobPeakM(gravityMS2) * Math.cos(2 * Math.PI * cycle);
  return {
    footing: { cycle, bobWeight },
    footfall: Math.floor(cycle) > Math.floor(footing.cycle),
    bobM,
  };
}

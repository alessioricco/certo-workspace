import { clamp } from './math';

const WIND_BASE_LEVEL = 0.1;
const WIND_LEVEL_PER_ATM = 0.2;
const MAX_WIND_LEVEL = 0.6;
const WIND_CUTOFF_BASE_HZ = 300;
const WIND_CUTOFF_PER_ATM_HZ = 250;
/** A call's pitch in hertz times the caller's body length in metres: bigger animals call lower. */
const CALL_HZ_TIMES_M = 600;

export const CALL_RANGE_M = 60;
export const CALL_MEAN_INTERVAL_S = 9;

/** Wind loudness, from 0 to 1 of full scale. A thicker atmosphere makes more wind. */
export function windLevel(pressureAtm: number): number {
  return clamp(WIND_BASE_LEVEL + WIND_LEVEL_PER_ATM * pressureAtm, 0, MAX_WIND_LEVEL);
}

/** Low-pass cutoff of the wind, in hertz: thick air roars through a wider band. */
export function windCutoffHz(pressureAtm: number): number {
  return WIND_CUTOFF_BASE_HZ + WIND_CUTOFF_PER_ATM_HZ * pressureAtm;
}

export function callPitchHz(bodyLengthM: number): number {
  return CALL_HZ_TIMES_M / bodyLengthM;
}

/** How loud a call is heard at a distance: full at the caller, silent at the edge of range. */
export function callLevel(distanceM: number): number {
  return clamp(1 - distanceM / CALL_RANGE_M, 0, 1);
}

export interface Caller {
  x: number;
  z: number;
  bodyLengthM: number;
}

/** The nearest creature within calling range of a listener, if any. */
export function nearestCaller(
  callers: readonly Caller[],
  listener: { x: number; z: number },
): { caller: Caller; distanceM: number } | undefined {
  let nearest: { caller: Caller; distanceM: number } | undefined;
  for (const caller of callers) {
    const distanceM = Math.hypot(caller.x - listener.x, caller.z - listener.z);
    if (distanceM < CALL_RANGE_M && (!nearest || distanceM < nearest.distanceM)) {
      nearest = { caller, distanceM };
    }
  }
  return nearest;
}

export interface CallTimer {
  remainingS: number;
}

/** Counts down to the next ambient call. When it comes due, the timer restarts at a random interval. */
export function stepCallTimer(
  timer: CallTimer,
  dtS: number,
  random: () => number,
): { timer: CallTimer; due: boolean } {
  const remainingS = timer.remainingS - dtS;
  if (remainingS > 0) return { timer: { remainingS }, due: false };
  return { timer: { remainingS: callIntervalS(random) }, due: true };
}

/** A random gap between calls, from an exponential distribution with the mean interval. */
export function callIntervalS(random: () => number): number {
  return -Math.log(1 - random()) * CALL_MEAN_INTERVAL_S;
}

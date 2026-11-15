import { clamp } from './math';

/** Plants do not grow on ground steeper than this, in degrees. */
export const PLANT_MAX_SLOPE_DEG = 30;
const SLOPE_FULL_DEG = 15;
const HEIGHT_FULL_M = 12;
const HEIGHT_NONE_M = 24;
const TEMPERATURE_MIN_K = 268;
const TEMPERATURE_MAX_K = 318;
const TEMPERATURE_FADE_K = 10;
const LAPSE_RATE_K_PER_M = 0.0065;
/** Ground at or below the wet height is water-filled; wetness falls to 0 at the dry height. */
const WET_HEIGHT_M = -4;
const DRY_HEIGHT_M = 4;
/** Share of growth on dry ground; wet ground grows the rest. */
const DRY_GROWTH = 0.3;

export interface Site {
  heightM: number;
  slopeDeg: number;
  /** Surface temperature at height zero, in kelvin. */
  baseTemperatureK: number;
}

export function localTemperatureK(baseTemperatureK: number, heightM: number): number {
  return baseTemperatureK - LAPSE_RATE_K_PER_M * heightM;
}

/** 1 on water-filled lowland, 0 on high dry ground. */
export function wetness(heightM: number): number {
  return clamp((DRY_HEIGHT_M - heightM) / (DRY_HEIGHT_M - WET_HEIGHT_M), 0, 1);
}

/** How well plants can live at a site, from 0 (none) to 1 (ideal). */
export function plantSuitability(site: Site): number {
  const slopeFactor = clamp(
    (PLANT_MAX_SLOPE_DEG - site.slopeDeg) / (PLANT_MAX_SLOPE_DEG - SLOPE_FULL_DEG),
    0,
    1,
  );
  const heightFactor = clamp(
    (HEIGHT_NONE_M - site.heightM) / (HEIGHT_NONE_M - HEIGHT_FULL_M),
    0,
    1,
  );
  const temperature = localTemperatureK(site.baseTemperatureK, site.heightM);
  const outsideK = Math.max(TEMPERATURE_MIN_K - temperature, temperature - TEMPERATURE_MAX_K, 0);
  const temperatureFactor = clamp(1 - outsideK / TEMPERATURE_FADE_K, 0, 1);
  return slopeFactor * heightFactor * temperatureFactor;
}

/** Chance that a plant grows at a candidate spot: denser beside water-filled lowlands. */
export function plantDensity(site: Site): number {
  return plantSuitability(site) * (DRY_GROWTH + (1 - DRY_GROWTH) * wetness(site.heightM));
}

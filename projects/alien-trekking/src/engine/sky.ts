import { blackbodyColor, mixRgb, skyColor, type Rgb } from './color';
import { clamp, fraction } from './math';
import { STAR_PROPERTIES, type StarClass } from './star';

export type Vec3 = [number, number, number];
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SkyWorld {
  starClass: StarClass;
  dayLengthHours: number;
  pressureAtm: number;
}

export interface SkyState {
  phase: DayPhase;
  timeOfDayHours: number;
  starElevationDeg: number;
  /** Unit vector towards the star, y up. */
  starDirection: Vec3;
  /** 0 at night, 1 in full day. */
  daylight: number;
  starColour: Rgb;
  zenithColour: Rgb;
  horizonColour: Rgb;
  /** Light from the sky onto the ground: moonlit at night, the sky's own blue by day. */
  ambientColour: Rgb;
  fogDensityPerM: number;
  /** Share of the night's stars that show through this atmosphere. */
  visibleStarFraction: number;
}

/** A game hour lasts this many real seconds: a 24-hour day takes four minutes. */
export const REAL_SECONDS_PER_HOUR = 10;

const TWILIGHT_DEG = 8;
const FOG_PER_M_BASE = 0.005;
const FOG_PER_M_PER_ATM = 0.007;
const NIGHT_ZENITH: Rgb = [6, 8, 20];
const NIGHT_HORIZON: Rgb = [28, 30, 48];
const NIGHT_AMBIENT: Rgb = [150, 170, 220];
const HORIZON_WARMTH = 0.35;
/** Pure Rayleigh blue leaves low-sun ground too dark, so ambient light takes in the star's colour. */
const AMBIENT_SUNLIGHT_SHARE = 0.5;

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Star height above the horizon in degrees, for a time within the day. */
export function starElevation(timeHours: number, dayLengthHours: number): number {
  return toDegrees(Math.asin(Math.sin((2 * Math.PI * timeHours) / dayLengthHours)));
}

/** Share of the night's stars that show: thick air hides them. */
export function visibleStarFraction(pressureAtm: number): number {
  return clamp(1 - pressureAtm / 3, 0, 1);
}

/** 0 at night, 1 in full day, ramping across the twilight around the horizon. */
export function daylight(elevationDeg: number): number {
  return clamp((elevationDeg + TWILIGHT_DEG) / (2 * TWILIGHT_DEG), 0, 1);
}

export function dayPhase(timeHours: number, dayLengthHours: number): DayPhase {
  const elevation = starElevation(timeHours, dayLengthHours);
  if (elevation >= TWILIGHT_DEG) return 'day';
  if (elevation <= -TWILIGHT_DEG) return 'night';
  return Math.cos((2 * Math.PI * timeHours) / dayLengthHours) > 0 ? 'dawn' : 'dusk';
}

/**
 * Unit direction of a body on its path. The path starts on the horizon ahead (-z),
 * peaks overhead and sets behind. `angleRad` runs once around the path; a non-zero
 * inclination tilts the path to one side.
 */
export function skyDirection(angleRad: number, inclinationRad: number): Vec3 {
  const sin = Math.sin(angleRad);
  return [sin * Math.sin(inclinationRad), sin * Math.cos(inclinationRad), -Math.cos(angleRad)];
}

/** Fog density per metre; a thicker atmosphere gives denser fog. */
export function fogDensityPerM(pressureAtm: number): number {
  return FOG_PER_M_BASE + FOG_PER_M_PER_ATM * pressureAtm;
}

/** World hours since sunrise, `startHours` plus the real time elapsed. */
export function worldHours(startHours: number, elapsedSeconds: number): number {
  return startHours + elapsedSeconds / REAL_SECONDS_PER_HOUR;
}

export function skyState(world: SkyWorld, absoluteHours: number): SkyState {
  const { dayLengthHours, pressureAtm } = world;
  const timeOfDayHours = fraction(absoluteHours / dayLengthHours) * dayLengthHours;
  const star = STAR_PROPERTIES[world.starClass];
  const elevation = starElevation(timeOfDayHours, dayLengthHours);
  const light = daylight(elevation);
  const sun = blackbodyColor(star.temperatureK);
  const scattered = skyColor(star.temperatureK);
  return {
    phase: dayPhase(timeOfDayHours, dayLengthHours),
    timeOfDayHours,
    starElevationDeg: elevation,
    starDirection: skyDirection((2 * Math.PI * timeOfDayHours) / dayLengthHours, 0),
    daylight: light,
    starColour: sun,
    zenithColour: mixRgb(NIGHT_ZENITH, scattered, light),
    horizonColour: mixRgb(NIGHT_HORIZON, mixRgb(scattered, sun, HORIZON_WARMTH), light),
    ambientColour: mixRgb(NIGHT_AMBIENT, mixRgb(scattered, sun, AMBIENT_SUNLIGHT_SHARE), light),
    fogDensityPerM: fogDensityPerM(pressureAtm),
    visibleStarFraction: visibleStarFraction(pressureAtm),
  };
}

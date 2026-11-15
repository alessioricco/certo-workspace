import { blackbodyColor, type Rgb } from './color';
import { mulberry32 } from './random';
import { skyDirection, type SkyWorld, type Vec3 } from './sky';

const MOON_SEED_SALT = 0x6d6f6f6e;
export const MAX_MOONS = 2;

export interface Moon {
  /** Days of the world to cross the sky once. */
  periodDays: number;
  phaseRad: number;
  inclinationRad: number;
  angularRadiusDeg: number;
  colour: Rgb;
}

export interface MoonView {
  direction: Vec3;
  angularRadiusDeg: number;
  colour: Rgb;
}

/** Zero, one or two small moons, from the seed. */
export function planMoons(seed: number): Moon[] {
  const random = mulberry32(seed ^ MOON_SEED_SALT);
  const count = Math.floor(random() * (MAX_MOONS + 1));
  const moons: Moon[] = [];
  for (let i = 0; i < count; i++) {
    moons.push({
      periodDays: 0.3 + random() * 1.7,
      phaseRad: random() * 2 * Math.PI,
      inclinationRad: 0.2 + random() * 0.9,
      angularRadiusDeg: 0.6 + random() * 0.6,
      colour: blackbodyColor(3500 + random() * 3000),
    });
  }
  return moons;
}

export function moonView(moon: Moon, world: SkyWorld, absoluteHours: number): MoonView {
  const angle = (2 * Math.PI * absoluteHours) / (world.dayLengthHours * moon.periodDays) + moon.phaseRad;
  return {
    direction: skyDirection(angle, moon.inclinationRad),
    angularRadiusDeg: moon.angularRadiusDeg,
    colour: moon.colour,
  };
}

import { mixRgb, type Rgb } from './color';
import { clamp } from './math';
import { ANIMAL_ENDINGS, makeName } from './names';
import { EARTH_GRAVITY_MS2 } from './physics';
import { uniform } from './random';
import type { SpeciesInfo } from './species';

const MIN_BODY_SCALE = 0.3;
const MAX_BODY_SCALE = 3;
const WALK_MS_ON_EARTH = 1.2;
const FLEE_MS_ON_EARTH = 5;
const CHARGE_MS_ON_EARTH = 6.5;
const SAND: Rgb = [214, 186, 150];
const DARK: Rgb = [40, 28, 36];
const HERD_MIN = 3;
const HERD_MAX_CHOICES = 3;
const PREDATOR_SCALE = 1.35;

export type AnimalRole = 'grazer' | 'predator';

/** How big animals grow compared with Earth: heavier worlds give smaller animals. */
export function bodyScale(gravityMS2: number): number {
  return clamp(Math.sqrt(EARTH_GRAVITY_MS2 / gravityMS2), MIN_BODY_SCALE, MAX_BODY_SCALE);
}

export interface AnimalSpecies extends SpeciesInfo {
  kind: 'animal';
  predator: boolean;
  colour: Rgb;
  bodyLengthM: number;
  bodyWidthM: number;
  bodyHeightM: number;
  legLengthM: number;
  legRadiusM: number;
  headRadiusM: number;
  walkSpeedMS: number;
  fleeSpeedMS: number;
  herdMin: number;
  herdMax: number;
}

function describeAnimal(scale: number, bodyLengthM: number, herdMin: number, herdMax: number): string {
  const stance = scale < 0.8 ? 'Squat' : scale > 1.25 ? 'Tall and slender' : 'Sturdy';
  return `${stance} grazer on four legs, about ${bodyLengthM.toFixed(1)} m long. Moves in herds of ${herdMin} to ${herdMax}.`;
}

function describePredator(bodyLengthM: number): string {
  return `Solitary predator on four legs, about ${bodyLengthM.toFixed(1)} m long. It guards its territory: it warns intruders, then attacks those who stay.`;
}

/**
 * Animal species for a world. Sizes follow gravity; legs grow faster than the body
 * (with the square root of the scale), so heavy worlds give squat animals and light
 * worlds give tall, slender ones. Predators are larger, darker and solitary; their
 * fast speed is the charge they make at intruders.
 */
export function planAnimalSpecies(
  random: () => number,
  gravityMS2: number,
  base: Rgb,
  count: number,
  taken: Set<string>,
  role: AnimalRole = 'grazer',
): AnimalSpecies[] {
  const predator = role === 'predator';
  const scale = bodyScale(gravityMS2) * (predator ? PREDATOR_SCALE : 1);
  const legGrowth = Math.sqrt(scale);
  const species: AnimalSpecies[] = [];
  for (let index = 0; index < count; index++) {
    const bodyLengthM = uniform(random, 1.2, 2) * scale;
    const herdMax = predator ? 1 : HERD_MIN + 1 + Math.floor(random() * HERD_MAX_CHOICES);
    species.push({
      id: `${predator ? 'predator' : 'animal'}-${index}`,
      kind: 'animal',
      predator,
      name: makeName(random, ANIMAL_ENDINGS, taken),
      description: predator
        ? describePredator(bodyLengthM)
        : describeAnimal(scale, bodyLengthM, HERD_MIN, herdMax),
      colour: predator
        ? mixRgb(base, DARK, uniform(random, 0.5, 0.7))
        : mixRgb(base, SAND, uniform(random, 0.4, 0.6)),
      bodyLengthM,
      bodyWidthM: uniform(random, 0.5, 0.8) * scale,
      bodyHeightM: uniform(random, 0.6, 0.9) * scale,
      legLengthM: uniform(random, 0.5, 0.9) * scale * legGrowth,
      legRadiusM: 0.05 * scale,
      headRadiusM: uniform(random, 0.25, 0.4) * scale,
      walkSpeedMS: WALK_MS_ON_EARTH * Math.sqrt(scale),
      fleeSpeedMS: (predator ? CHARGE_MS_ON_EARTH : FLEE_MS_ON_EARTH) * Math.sqrt(scale),
      herdMin: predator ? 1 : HERD_MIN,
      herdMax,
    });
  }
  return species;
}

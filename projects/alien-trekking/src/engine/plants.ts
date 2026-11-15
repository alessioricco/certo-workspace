import { mixRgb, type Rgb } from './color';
import { makeName, PLANT_ENDINGS } from './names';
import { uniform } from './random';
import type { SpeciesInfo } from './species';
import type { Vec3 } from './sky';

export type PlantHue = 'black' | 'red' | 'green' | 'blue';
export type PlantShape = 'spire' | 'mushroom' | 'rosette';

/** A cap is this many times as tall as it is wide. */
export const CAP_FLATNESS = 0.5;

/** Colour of a plant under each hue of star. Black hue is nearly black: it absorbs the dim light of a red dwarf. */
export const HUE_PALETTE: Record<PlantHue, Rgb> = {
  black: [34, 16, 46],
  red: [176, 74, 40],
  green: [88, 150, 74],
  blue: [64, 120, 196],
};

const HUE_NAMES: Record<PlantHue, string> = {
  black: 'deep violet',
  red: 'rust-red',
  green: 'leaf-green',
  blue: 'sky-blue',
};

const SHAPE_PHRASES: Record<PlantShape, string> = {
  spire: 'A slender stalk crowned with fronds',
  mushroom: 'A stalk topped with a broad, flat cap',
  rosette: 'A low rosette of long fronds',
};

const SHAPES: readonly PlantShape[] = ['spire', 'mushroom', 'rosette'];
const PALE: Rgb = [236, 224, 196];
const MAX_TINT = 0.15;

/**
 * The hue of plant that a star's light allows: a red dwarf gives black plants,
 * a K star red ones, a G star green ones and hotter stars blue ones.
 */
export function plantHue(kelvin: number): PlantHue {
  if (kelvin < 3500) return 'black';
  if (kelvin < 5000) return 'red';
  if (kelvin < 6500) return 'green';
  return 'blue';
}

export type PlantPart =
  | { kind: 'stalk'; base: Vec3; direction: Vec3; lengthM: number; radiusM: number }
  | { kind: 'frond'; base: Vec3; direction: Vec3; lengthM: number; widthM: number }
  | { kind: 'cap'; base: Vec3; radiusM: number };

export interface PlantSpecies extends SpeciesInfo {
  kind: 'plant';
  shape: PlantShape;
  hue: PlantHue;
  colour: Rgb;
  heightM: number;
  parts: PlantPart[];
}

/** Unit direction of a frond: `yaw` turns it around the stalk, `pitch` lifts it from the ground. */
function frondDirection(yaw: number, pitch: number): Vec3 {
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

function frond(random: () => number, base: Vec3, yaw: number, pitch: number): PlantPart {
  return {
    kind: 'frond',
    base,
    direction: frondDirection(yaw, pitch),
    lengthM: uniform(random, 1, 2),
    widthM: uniform(random, 0.25, 0.45),
  };
}

function spireParts(random: () => number): PlantPart[] {
  const length = uniform(random, 3, 6);
  const tilt = uniform(random, -0.1, 0.1);
  const stalk: PlantPart = {
    kind: 'stalk',
    base: [0, 0, 0],
    direction: [Math.sin(tilt), Math.cos(tilt), 0],
    lengthM: length,
    radiusM: uniform(random, 0.06, 0.12),
  };
  const top: Vec3 = [Math.sin(tilt) * length * 0.85, length * 0.85, 0];
  const count = 4 + Math.floor(random() * 3);
  const firstYaw = uniform(random, 0, 2 * Math.PI);
  const parts: PlantPart[] = [stalk];
  for (let i = 0; i < count; i++) {
    const yaw = firstYaw + (i * 2 * Math.PI) / count;
    parts.push(frond(random, top, yaw, uniform(random, 0.3, 0.8)));
  }
  return parts;
}

function mushroomParts(random: () => number): PlantPart[] {
  const length = uniform(random, 1.2, 2.4);
  return [
    {
      kind: 'stalk',
      base: [0, 0, 0],
      direction: [0, 1, 0],
      lengthM: length,
      radiusM: uniform(random, 0.1, 0.2),
    },
    { kind: 'cap', base: [0, length, 0], radiusM: uniform(random, 0.6, 1.1) },
  ];
}

function rosetteParts(random: () => number): PlantPart[] {
  const base: Vec3 = [0, 0.05, 0];
  const count = 5 + Math.floor(random() * 3);
  const firstYaw = uniform(random, 0, 2 * Math.PI);
  const parts: PlantPart[] = [
    { kind: 'stalk', base, direction: [0, 1, 0], lengthM: 0.4, radiusM: 0.06 },
  ];
  for (let i = 0; i < count; i++) {
    const yaw = firstYaw + (i * 2 * Math.PI) / count;
    parts.push(frond(random, base, yaw, uniform(random, 0.25, 0.6)));
  }
  return parts;
}

const RECIPES: Record<PlantShape, (random: () => number) => PlantPart[]> = {
  spire: spireParts,
  mushroom: mushroomParts,
  rosette: rosetteParts,
};

/** Height of the highest point of a plant, in metres. */
export function plantHeight(parts: readonly PlantPart[]): number {
  return Math.max(
    ...parts.map((part) => {
      if (part.kind === 'cap') return part.base[1] + part.radiusM * CAP_FLATNESS;
      return part.base[1] + part.direction[1] * part.lengthM;
    }),
  );
}

function describePlant(shape: PlantShape, hue: PlantHue, heightM: number): string {
  return `${SHAPE_PHRASES[shape]}, ${HUE_NAMES[hue]}, about ${heightM.toFixed(1)} m tall.`;
}

/** Plant species for a world, one per shape, in the colour of its star. */
export function planPlantSpecies(
  random: () => number,
  hue: PlantHue,
  count: number,
  taken: Set<string>,
): PlantSpecies[] {
  const species: PlantSpecies[] = [];
  for (let index = 0; index < count; index++) {
    const shape = SHAPES[index % SHAPES.length];
    const parts = RECIPES[shape](random);
    const heightM = plantHeight(parts);
    species.push({
      id: `plant-${index}`,
      kind: 'plant',
      name: makeName(random, PLANT_ENDINGS, taken),
      description: describePlant(shape, hue, heightM),
      shape,
      hue,
      colour: mixRgb(HUE_PALETTE[hue], PALE, uniform(random, 0, MAX_TINT)),
      heightM,
      parts,
    });
  }
  return species;
}

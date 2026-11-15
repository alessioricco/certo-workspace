import { planAnimalSpecies, type AnimalSpecies } from './animals';
import { CHUNK_SIZE_M, chunkOrigin, type ChunkCoord } from './chunks';
import { HERD_RANGE_M, createHerd, type Herd } from './herds';
import { LANDER, LANDER_CLEARANCE_M } from './lander';
import { plantDensity, plantSuitability, type Site } from './habitat';
import { HUE_PALETTE, plantHue, planPlantSpecies, type PlantSpecies } from './plants';
import { createPredator, TERRITORY_RADIUS_M, type Predator } from './predators';
import { mixSeed, mulberry32, uniform } from './random';
import type { Level } from './level';
import type { Vec3 } from './sky';
import { STAR_PROPERTIES } from './star';
import { slopeDegAt, terrainHeight } from './terrain';
import { computeWorldFacts } from './worldFacts';

const ECOSYSTEM_SALT = 0x4c1f3e21;
const PLANT_SALT = 0x2b7e1516;
const HERD_SALT = 0x6a09e667;
const PREDATOR_SPECIES_SALT = 0x1f83d9ab;
const PREDATOR_SALT = 0x5be0cd19;
export const PLANT_SPECIES_COUNT = 3;
export const ANIMAL_SPECIES_COUNT = 2;
export const PREDATOR_SPECIES_COUNT = 2;
const PREDATOR_CHANCE = 0.15;
/** A predator's territory stays inside the chunk its den is in, like a herd's range. */
const PREDATOR_HOME_MARGIN_M = TERRITORY_RADIUS_M + 4;
/** Candidate plant spots along each side of a chunk; each spot may or may not get a plant. */
const SPOT_CELLS = 10;
const PLANT_SCALE_MIN = 0.8;
const PLANT_SCALE_MAX = 1.2;
const HERD_CHANCE = 0.3;
const HERD_SITE_SUITABILITY = 0.6;
const HERD_SITE_TRIES = 8;
/** Herds keep their range inside the chunk they start in, so a chunk never loses an animal at its edge. */
const HERD_HOME_MARGIN_M = HERD_RANGE_M + 4;

export interface Ecosystem {
  seed: number;
  baseTemperatureK: number;
  plants: PlantSpecies[];
  animals: AnimalSpecies[];
  predators: AnimalSpecies[];
}

export interface PlantSpot {
  speciesId: string;
  /** Base of the plant on the ground. */
  position: Vec3;
  yawRad: number;
  scale: number;
  /** Middle of the plant, where a scan aims. */
  scanPoint: Vec3;
}

/** The plants and animals of a world, generated from its seed and physical description. */
export function createEcosystem(level: Level): Ecosystem {
  const facts = computeWorldFacts(level);
  const hue = plantHue(STAR_PROPERTIES[level.star.class].temperatureK);
  const random = mulberry32(mixSeed(level.seed, ECOSYSTEM_SALT));
  const taken = new Set<string>();
  const plants = planPlantSpecies(random, hue, PLANT_SPECIES_COUNT, taken);
  const animals = planAnimalSpecies(
    random,
    facts.gravityMS2,
    HUE_PALETTE[hue],
    ANIMAL_SPECIES_COUNT,
    taken,
  );
  const predatorRandom = mulberry32(mixSeed(level.seed, PREDATOR_SPECIES_SALT));
  const predators = planAnimalSpecies(
    predatorRandom,
    facts.gravityMS2,
    HUE_PALETTE[hue],
    PREDATOR_SPECIES_COUNT,
    taken,
    'predator',
  );
  return {
    seed: level.seed,
    baseTemperatureK: facts.surfaceTemperatureK,
    plants,
    animals,
    predators,
  };
}

export function speciesById(
  ecosystem: Ecosystem,
  id: string,
): PlantSpecies | AnimalSpecies | undefined {
  return (
    ecosystem.plants.find((species) => species.id === id) ??
    ecosystem.animals.find((species) => species.id === id) ??
    ecosystem.predators.find((species) => species.id === id)
  );
}

function siteAt(ecosystem: Ecosystem, x: number, z: number): Site {
  return {
    heightM: terrainHeight(x, z, ecosystem.seed),
    slopeDeg: slopeDegAt(x, z, ecosystem.seed),
    baseTemperatureK: ecosystem.baseTemperatureK,
  };
}

/** The plants growing in a chunk. The same chunk of the same world always has the same plants. */
export function plantsInChunk(ecosystem: Ecosystem, coord: ChunkCoord): PlantSpot[] {
  const random = mulberry32(mixSeed(ecosystem.seed, coord.cx, coord.cz, PLANT_SALT));
  const origin = chunkOrigin(coord, CHUNK_SIZE_M);
  const cell = CHUNK_SIZE_M / SPOT_CELLS;
  const spots: PlantSpot[] = [];
  for (let iz = 0; iz < SPOT_CELLS; iz++) {
    for (let ix = 0; ix < SPOT_CELLS; ix++) {
      const x = origin.x + (ix + random()) * cell;
      const z = origin.z + (iz + random()) * cell;
      const yawRad = random() * 2 * Math.PI;
      const scale = uniform(random, PLANT_SCALE_MIN, PLANT_SCALE_MAX);
      const species = ecosystem.plants[Math.floor(random() * ecosystem.plants.length)];
      const roll = random();
      const site = siteAt(ecosystem, x, z);
      if (roll >= plantDensity(site)) continue;
      spots.push({
        speciesId: species.id,
        position: [x, site.heightM, z],
        yawRad,
        scale,
        scanPoint: [x, site.heightM + (species.heightM * scale) / 2, z],
      });
    }
  }
  return spots;
}

/** The herd that lives in a chunk, if any: animals start around a grassy home inside the chunk. */
export function herdsInChunk(ecosystem: Ecosystem, coord: ChunkCoord): Herd[] {
  const random = mulberry32(mixSeed(ecosystem.seed, coord.cx, coord.cz, HERD_SALT));
  if (random() >= HERD_CHANCE) return [];
  const origin = chunkOrigin(coord, CHUNK_SIZE_M);
  const span = CHUNK_SIZE_M - 2 * HERD_HOME_MARGIN_M;
  for (let attempt = 0; attempt < HERD_SITE_TRIES; attempt++) {
    const home = {
      x: origin.x + HERD_HOME_MARGIN_M + random() * span,
      z: origin.z + HERD_HOME_MARGIN_M + random() * span,
    };
    if (plantSuitability(siteAt(ecosystem, home.x, home.z)) < HERD_SITE_SUITABILITY) continue;
    const species = ecosystem.animals[Math.floor(random() * ecosystem.animals.length)];
    const count = species.herdMin + Math.floor(random() * (species.herdMax - species.herdMin + 1));
    return [createHerd(species, home, count, random)];
  }
  return [];
}

/** The predator that lives in a chunk, if any: its den is on grassy ground, away from the lander. */
export function predatorsInChunk(ecosystem: Ecosystem, coord: ChunkCoord): Predator[] {
  const random = mulberry32(mixSeed(ecosystem.seed, coord.cx, coord.cz, PREDATOR_SALT));
  if (random() >= PREDATOR_CHANCE) return [];
  const origin = chunkOrigin(coord, CHUNK_SIZE_M);
  const span = CHUNK_SIZE_M - 2 * PREDATOR_HOME_MARGIN_M;
  for (let attempt = 0; attempt < HERD_SITE_TRIES; attempt++) {
    const home = {
      x: origin.x + PREDATOR_HOME_MARGIN_M + random() * span,
      z: origin.z + PREDATOR_HOME_MARGIN_M + random() * span,
    };
    if (plantSuitability(siteAt(ecosystem, home.x, home.z)) < HERD_SITE_SUITABILITY) continue;
    if (Math.hypot(home.x - LANDER.x, home.z - LANDER.z) < LANDER_CLEARANCE_M) continue;
    const species = ecosystem.predators[Math.floor(random() * ecosystem.predators.length)];
    return [createPredator(species, home, random)];
  }
  return [];
}

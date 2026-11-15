import type { AnimalSpecies } from './animals';
import { stepAlong, type HeightFn } from './gait';
import { uniform } from './random';
import type { Vec3 } from './sky';

export type { HeightFn };

/** Animals bolt when the observer runs this close. */
export const FLEE_RADIUS_M = 14;
/** Animals bolt even when the observer walks this close. */
export const STARTLE_RADIUS_M = 3;
/** A herd stays within this distance of its home. */
export const HERD_RANGE_M = 14;
const SPAWN_RADIUS_M = 4;
const FLEE_SECONDS = 6;
const GRAZE_SECONDS: readonly [number, number] = [3, 8];
const WANDER_SECONDS: readonly [number, number] = [4, 10];
const ARRIVE_M = 0.5;
const MAX_SLOPE_DEG = 25;
const MAX_STEP_S = 0.1;

export type Mood = 'graze' | 'wander' | 'flee' | 'stunned';

export interface Animal {
  x: number;
  z: number;
  /** Direction of travel: 0 is +z, and the heading turns towards +x. */
  headingRad: number;
  mood: Mood;
  timerS: number;
  targetX: number;
  targetZ: number;
}

export interface Herd {
  speciesId: string;
  homeX: number;
  homeZ: number;
  walkSpeedMS: number;
  fleeSpeedMS: number;
  animals: Animal[];
  random: () => number;
}

export interface Observer {
  x: number;
  z: number;
  running: boolean;
}

export function createHerd(
  species: AnimalSpecies,
  home: { x: number; z: number },
  count: number,
  random: () => number,
): Herd {
  const herd: Herd = {
    speciesId: species.id,
    homeX: home.x,
    homeZ: home.z,
    walkSpeedMS: species.walkSpeedMS,
    fleeSpeedMS: species.fleeSpeedMS,
    animals: [],
    random,
  };
  for (let i = 0; i < count; i++) {
    const angle = random() * 2 * Math.PI;
    const radius = SPAWN_RADIUS_M * Math.sqrt(random());
    const x = home.x + radius * Math.cos(angle);
    const z = home.z + radius * Math.sin(angle);
    herd.animals.push({
      x,
      z,
      headingRad: random() * 2 * Math.PI,
      mood: 'graze',
      timerS: uniform(random, GRAZE_SECONDS[0], GRAZE_SECONDS[1]),
      targetX: x,
      targetZ: z,
    });
  }
  return herd;
}

/** The point a scan aims at: the middle of an animal's body, on ground at `groundM`. */
export function animalScanPoint(
  animal: { x: number; z: number },
  species: AnimalSpecies,
  groundM: number,
): Vec3 {
  return [animal.x, groundM + species.legLengthM + species.bodyHeightM / 2, animal.z];
}

/** Moves the herd on by `dtS` seconds: animals graze, wander, and flee from a running observer. */
export function stepHerd(herd: Herd, observer: Observer, dtS: number, heightAt: HeightFn): void {
  const dt = Math.min(dtS, MAX_STEP_S);
  for (const animal of herd.animals) stepAnimal(herd, animal, observer, dt, heightAt);
}

function stepAnimal(
  herd: Herd,
  animal: Animal,
  observer: Observer,
  dt: number,
  heightAt: HeightFn,
): void {
  if (animal.mood === 'stunned') {
    animal.timerS -= dt;
    if (animal.timerS <= 0) startGrazing(herd, animal);
    return;
  }
  const dx = animal.x - observer.x;
  const dz = animal.z - observer.z;
  const distance = Math.hypot(dx, dz);
  if (distance < STARTLE_RADIUS_M || (observer.running && distance < FLEE_RADIUS_M)) {
    animal.mood = 'flee';
    animal.timerS = FLEE_SECONDS;
    animal.headingRad = Math.atan2(dx, dz);
  } else {
    animal.timerS -= dt;
  }

  if (animal.timerS <= 0) {
    if (animal.mood === 'graze') startWandering(herd, animal);
    else startGrazing(herd, animal);
  }

  if (animal.mood === 'flee') {
    stepAlong(animal, animal.headingRad, herd.fleeSpeedMS * dt, heightAt, MAX_SLOPE_DEG);
    keepInRange(herd, animal);
  } else if (animal.mood === 'wander') {
    wander(herd, animal, dt, heightAt);
  }
}

function wander(herd: Herd, animal: Animal, dt: number, heightAt: HeightFn): void {
  const toX = animal.targetX - animal.x;
  const toZ = animal.targetZ - animal.z;
  if (Math.hypot(toX, toZ) < ARRIVE_M) {
    startGrazing(herd, animal);
    return;
  }
  animal.headingRad = Math.atan2(toX, toZ);
  if (!stepAlong(animal, animal.headingRad, herd.walkSpeedMS * dt, heightAt, MAX_SLOPE_DEG)) {
    startGrazing(herd, animal);
  }
}

function keepInRange(herd: Herd, animal: Animal): void {
  const dx = animal.x - herd.homeX;
  const dz = animal.z - herd.homeZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= HERD_RANGE_M) return;
  animal.x = herd.homeX + (dx * HERD_RANGE_M) / distance;
  animal.z = herd.homeZ + (dz * HERD_RANGE_M) / distance;
}

function startWandering(herd: Herd, animal: Animal): void {
  const angle = herd.random() * 2 * Math.PI;
  const radius = HERD_RANGE_M * Math.sqrt(herd.random());
  animal.targetX = herd.homeX + radius * Math.cos(angle);
  animal.targetZ = herd.homeZ + radius * Math.sin(angle);
  animal.mood = 'wander';
  animal.timerS = uniform(herd.random, WANDER_SECONDS[0], WANDER_SECONDS[1]);
}

function startGrazing(herd: Herd, animal: Animal): void {
  animal.mood = 'graze';
  animal.timerS = uniform(herd.random, GRAZE_SECONDS[0], GRAZE_SECONDS[1]);
}

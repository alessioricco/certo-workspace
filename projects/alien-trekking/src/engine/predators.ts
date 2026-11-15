import type { AnimalSpecies } from './animals';
import { stepAlong, type HeightFn } from './gait';
import { uniform } from './random';

/** A predator defends the ground within this distance of its den. */
export const TERRITORY_RADIUS_M = 16;
/** Seconds a predator warns an intruder before it attacks one who stays. */
export const WARN_SECONDS = 4;
export const STRIKE_DAMAGE = 20;
export const STRIKE_INTERVAL_S = 1.5;
/** Distance at which a charging predator can strike. */
export const STRIKE_REACH_M = 2;
const PATROL_RADIUS_SHARE = 0.8;
const MARK_COUNT = 6;
const MARK_SPREAD_SHARE = 0.9;
const ARRIVE_M = 0.5;
const MAX_SLOPE_DEG = 25;
const MAX_STEP_S = 0.1;

export type PredatorMood = 'patrol' | 'warn' | 'attack' | 'stunned';

/** Bones and claw marks on the ground, which show a territory without a fence. */
export interface TerritoryMark {
  kind: 'bone' | 'scratch';
  x: number;
  z: number;
  yawRad: number;
}

export interface Predator {
  speciesId: string;
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  /** Direction the predator faces: 0 is +z, turning towards +x. */
  headingRad: number;
  mood: PredatorMood;
  timerS: number;
  strikeTimerS: number;
  targetX: number;
  targetZ: number;
  patrolSpeedMS: number;
  chargeSpeedMS: number;
  marks: TerritoryMark[];
  random: () => number;
}

export type PredatorEvent =
  | { kind: 'warn'; speciesId: string }
  | { kind: 'strike'; speciesId: string; damage: number };

export interface Spot {
  x: number;
  z: number;
}

export function createPredator(species: AnimalSpecies, home: Spot, random: () => number): Predator {
  const predator: Predator = {
    speciesId: species.id,
    homeX: home.x,
    homeZ: home.z,
    x: home.x,
    z: home.z,
    headingRad: random() * 2 * Math.PI,
    mood: 'patrol',
    timerS: 0,
    strikeTimerS: 0,
    targetX: home.x,
    targetZ: home.z,
    patrolSpeedMS: species.walkSpeedMS,
    chargeSpeedMS: species.fleeSpeedMS,
    marks: territoryMarks(home, random),
    random,
  };
  pickPatrolTarget(predator);
  return predator;
}

export function inTerritory(predator: { homeX: number; homeZ: number }, point: Spot): boolean {
  return Math.hypot(point.x - predator.homeX, point.z - predator.homeZ) <= TERRITORY_RADIUS_M;
}

/**
 * Moves the predators on by `dtS` seconds. A predator that sees the player enter its
 * territory warns; if the player stays past the warning it charges and strikes.
 * Returns the warnings and strikes of this step.
 */
export function stepPredators(
  predators: readonly Predator[],
  player: Spot,
  dtS: number,
  heightAt: HeightFn,
): PredatorEvent[] {
  const dt = Math.min(dtS, MAX_STEP_S);
  const events: PredatorEvent[] = [];
  for (const predator of predators) stepPredator(predator, player, dt, heightAt, events);
  return events;
}

function stepPredator(
  predator: Predator,
  player: Spot,
  dt: number,
  heightAt: HeightFn,
  events: PredatorEvent[],
): void {
  if (predator.mood === 'stunned') {
    predator.timerS -= dt;
    if (predator.timerS <= 0) predator.mood = 'patrol';
    return;
  }
  if (!inTerritory(predator, player)) {
    predator.mood = 'patrol';
    patrol(predator, dt, heightAt);
    return;
  }
  if (predator.mood === 'patrol') {
    predator.mood = 'warn';
    predator.timerS = WARN_SECONDS;
    events.push({ kind: 'warn', speciesId: predator.speciesId });
  }
  faceTowards(predator, player);
  if (predator.mood === 'warn') {
    predator.timerS -= dt;
    if (predator.timerS <= 0) {
      predator.mood = 'attack';
      predator.strikeTimerS = 0;
    }
    return;
  }
  charge(predator, player, dt, heightAt, events);
}

function charge(
  predator: Predator,
  player: Spot,
  dt: number,
  heightAt: HeightFn,
  events: PredatorEvent[],
): void {
  const distance = Math.hypot(player.x - predator.x, player.z - predator.z);
  const step = Math.min(predator.chargeSpeedMS * dt, Math.max(0, distance - STRIKE_REACH_M));
  stepAlong(predator, predator.headingRad, step, heightAt, MAX_SLOPE_DEG);
  predator.strikeTimerS -= dt;
  const reach = Math.hypot(player.x - predator.x, player.z - predator.z);
  if (reach <= STRIKE_REACH_M && predator.strikeTimerS <= 0) {
    events.push({ kind: 'strike', speciesId: predator.speciesId, damage: STRIKE_DAMAGE });
    predator.strikeTimerS = STRIKE_INTERVAL_S;
  }
}

function faceTowards(predator: Predator, point: Spot): void {
  predator.headingRad = Math.atan2(point.x - predator.x, point.z - predator.z);
}

function patrol(predator: Predator, dt: number, heightAt: HeightFn): void {
  const toX = predator.targetX - predator.x;
  const toZ = predator.targetZ - predator.z;
  if (Math.hypot(toX, toZ) < ARRIVE_M) {
    pickPatrolTarget(predator);
    return;
  }
  predator.headingRad = Math.atan2(toX, toZ);
  if (!stepAlong(predator, predator.headingRad, predator.patrolSpeedMS * dt, heightAt, MAX_SLOPE_DEG)) {
    pickPatrolTarget(predator);
  }
}

function pickPatrolTarget(predator: Predator): void {
  const angle = predator.random() * 2 * Math.PI;
  const radius = TERRITORY_RADIUS_M * PATROL_RADIUS_SHARE * Math.sqrt(predator.random());
  predator.targetX = predator.homeX + radius * Math.cos(angle);
  predator.targetZ = predator.homeZ + radius * Math.sin(angle);
}

function territoryMarks(home: Spot, random: () => number): TerritoryMark[] {
  const marks: TerritoryMark[] = [];
  for (let i = 0; i < MARK_COUNT; i++) {
    const angle = random() * 2 * Math.PI;
    const radius = TERRITORY_RADIUS_M * MARK_SPREAD_SHARE * Math.sqrt(random());
    marks.push({
      kind: random() < 0.5 ? 'bone' : 'scratch',
      x: home.x + radius * Math.cos(angle),
      z: home.z + radius * Math.sin(angle),
      yawRad: uniform(random, 0, 2 * Math.PI),
    });
  }
  return marks;
}

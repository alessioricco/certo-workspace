import { MAX_STEP_S } from './player';

export const HEALTH_MAX = 100;
export const OXYGEN_MAX = 100;
/** Oxygen used per second while resting or walking, and while running. */
export const OXYGEN_DRAIN_PER_S = 0.1;
export const OXYGEN_RUN_DRAIN_PER_S = 0.3;
export const LANDER_OXYGEN_REFILL_PER_S = 25;
export const LANDER_HEAL_PER_S = 4;
/** Health lost per second with an empty tank in air that is not breathable. */
export const SUFFOCATION_DAMAGE_PER_S = 2;
/** Outside this band the suit cannot hold the body's temperature: 0 °C to 40 °C. */
export const COMFORT_MIN_K = 273.15;
export const COMFORT_MAX_K = 313.15;
/** Health lost per second for each kelvin beyond the comfort band. */
export const TEMPERATURE_DAMAGE_PER_S_PER_K = 0.1;

export interface Vitals {
  health: number;
  oxygen: number;
}

export interface Surroundings {
  breathable: boolean;
  sheltered: boolean;
  running: boolean;
  temperatureK: number;
}

export function freshVitals(): Vitals {
  return { health: HEALTH_MAX, oxygen: OXYGEN_MAX };
}

export function temperatureDamagePerS(temperatureK: number): number {
  const beyondK = Math.max(COMFORT_MIN_K - temperatureK, temperatureK - COMFORT_MAX_K, 0);
  return beyondK * TEMPERATURE_DAMAGE_PER_S_PER_K;
}

/**
 * Advances oxygen and health by `dtS` seconds. Breathable air needs no oxygen; elsewhere
 * the tank drains, faster when running, and an empty tank suffocates. The lander shelters:
 * oxygen refills and health recovers there, and the outside temperature does not reach.
 */
export function stepVitals(vitals: Vitals, surroundings: Surroundings, dtS: number): Vitals {
  const dt = Math.min(dtS, MAX_STEP_S);
  if (surroundings.sheltered) {
    return {
      health: Math.min(HEALTH_MAX, vitals.health + LANDER_HEAL_PER_S * dt),
      oxygen: Math.min(OXYGEN_MAX, vitals.oxygen + LANDER_OXYGEN_REFILL_PER_S * dt),
    };
  }
  if (surroundings.breathable) {
    const damage = temperatureDamagePerS(surroundings.temperatureK);
    return { health: Math.max(0, vitals.health - damage * dt), oxygen: OXYGEN_MAX };
  }
  const drain = surroundings.running ? OXYGEN_RUN_DRAIN_PER_S : OXYGEN_DRAIN_PER_S;
  const oxygen = Math.max(0, vitals.oxygen - drain * dt);
  const suffocation = oxygen === 0 ? SUFFOCATION_DAMAGE_PER_S : 0;
  const damage = temperatureDamagePerS(surroundings.temperatureK) + suffocation;
  return { health: Math.max(0, vitals.health - damage * dt), oxygen };
}

export function takeDamage(vitals: Vitals, amount: number): Vitals {
  return { ...vitals, health: Math.max(0, vitals.health - amount) };
}

export function isDown(vitals: Vitals): boolean {
  return vitals.health <= 0;
}

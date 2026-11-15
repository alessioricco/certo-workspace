import type { Animal } from './herds';
import type { Predator } from './predators';

/** Seconds the sampling tool takes to recharge after a shot. */
export const SAMPLER_COOLDOWN_S = 8;
/** Seconds a creature stays stunned after a shot. A stun never harms the creature. */
export const STUN_SECONDS = 5;

export interface Sampler {
  cooldownS: number;
}

export interface ShotOutcome {
  sampler: Sampler;
  fired: boolean;
}

export function createSampler(): Sampler {
  return { cooldownS: 0 };
}

export function stepSampler(sampler: Sampler, dtS: number): Sampler {
  return { cooldownS: Math.max(0, sampler.cooldownS - dtS) };
}

/** Fires the sampler if it has recharged; a shot while recharging does nothing. */
export function fireSampler(sampler: Sampler): ShotOutcome {
  if (sampler.cooldownS > 0) return { sampler: { ...sampler }, fired: false };
  return { sampler: { cooldownS: SAMPLER_COOLDOWN_S }, fired: true };
}

export function stunCreature(creature: Animal | Predator): void {
  creature.mood = 'stunned';
  creature.timerS = STUN_SECONDS;
}

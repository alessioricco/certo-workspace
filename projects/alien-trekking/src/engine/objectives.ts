import { ANIMAL_SPECIES_COUNT, PLANT_SPECIES_COUNT, PREDATOR_SPECIES_COUNT } from './ecosystem';
import { LANDER } from './lander';
import type { Progress } from './progress';

export const OBJECTIVE_KINDS = ['scan-species', 'reach-landmark', 'return-to-lander'] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

export type Objective =
  | { kind: 'scan-species'; count: number }
  | { kind: 'reach-landmark'; name: string }
  | { kind: 'return-to-lander' };

export interface ObjectiveStatus {
  objective: Objective;
  label: string;
  done: boolean;
}

/** Every world has this many species to log: each plant, animal and predator. */
export const MAX_SCAN_COUNT = PLANT_SPECIES_COUNT + ANIMAL_SPECIES_COUNT + PREDATOR_SPECIES_COUNT;

/** The return objective needs a trek: the player must first go this far from the lander. */
export const TRIP_AWAY_M = 60;

export function isObjectiveKind(value: unknown): value is ObjectiveKind {
  return typeof value === 'string' && (OBJECTIVE_KINDS as readonly string[]).includes(value);
}

export function isAwayFromLander(point: { x: number; z: number }): boolean {
  return Math.hypot(point.x - LANDER.x, point.z - LANDER.z) > TRIP_AWAY_M;
}

export function evaluateObjectives(objectives: readonly Objective[], progress: Progress): ObjectiveStatus[] {
  return objectives.map((objective) => {
    switch (objective.kind) {
      case 'scan-species': {
        const logged = progress.species.length;
        return {
          objective,
          label: `Scan ${objective.count} species (${Math.min(logged, objective.count)} of ${objective.count})`,
          done: logged >= objective.count,
        };
      }
      case 'reach-landmark':
        return {
          objective,
          label: `Reach ${objective.name}`,
          done: progress.landmarks.includes(objective.name),
        };
      case 'return-to-lander':
        return { objective, label: 'Return to the lander after a trek', done: progress.returned };
    }
  });
}

/** True when there is at least one objective and every one is done. */
export function objectivesComplete(statuses: readonly ObjectiveStatus[]): boolean {
  return statuses.length > 0 && statuses.every((status) => status.done);
}

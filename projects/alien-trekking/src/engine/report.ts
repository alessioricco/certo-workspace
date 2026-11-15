import type { Level } from './level';
import { evaluateObjectives, objectivesComplete, type ObjectiveStatus } from './objectives';
import type { Progress } from './progress';
import type { SpeciesInfo } from './species';
import { computeWorldFacts, type WorldFacts } from './worldFacts';

export interface SurveyReport {
  worldName: string;
  facts: WorldFacts;
  objectives: ObjectiveStatus[];
  complete: boolean;
  species: SpeciesInfo[];
}

/** The planet's facts, the objectives' status and the species logged so far. */
export function buildSurveyReport(level: Level, progress: Progress): SurveyReport {
  const objectives = evaluateObjectives(level.objectives, progress);
  return {
    worldName: level.name,
    facts: computeWorldFacts(level),
    objectives,
    complete: objectivesComplete(objectives),
    species: progress.species,
  };
}

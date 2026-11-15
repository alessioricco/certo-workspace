import type { SpeciesInfo } from './species';

export interface ScanOutcome {
  log: SpeciesInfo[];
  isNew: boolean;
}

/** Adds a species to the survey log once: a second scan of the same species changes nothing. */
export function recordScan(log: readonly SpeciesInfo[], species: SpeciesInfo): ScanOutcome {
  if (log.some((entry) => entry.id === species.id)) return { log: [...log], isNew: false };
  const entry: SpeciesInfo = {
    id: species.id,
    kind: species.kind,
    name: species.name,
    description: species.description,
  };
  return { log: [...log, entry], isNew: true };
}

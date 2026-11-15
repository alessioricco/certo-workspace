import type { SpeciesInfo } from './species';
import { recordScan } from './survey';

/** What the player has done in one world. Kept per world in the browser. */
export interface Progress {
  species: SpeciesInfo[];
  landmarks: string[];
  returned: boolean;
}

export function emptyProgress(): Progress {
  return { species: [], landmarks: [], returned: false };
}

export function recordSpecies(progress: Progress, species: SpeciesInfo): Progress {
  return { ...progress, species: recordScan(progress.species, species).log };
}

export function reachLandmark(progress: Progress, name: string): Progress {
  if (progress.landmarks.includes(name)) return progress;
  return { ...progress, landmarks: [...progress.landmarks, name] };
}

export function markReturned(progress: Progress): Progress {
  return progress.returned ? progress : { ...progress, returned: true };
}

/** Reads a saved progress record. A missing or unreadable record means the world has not been started. */
export function parseProgress(text: string | null): Progress {
  if (text === null) return emptyProgress();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return emptyProgress();
  }
  return isProgress(json) ? json : emptyProgress();
}

function isSpeciesInfo(value: unknown): value is SpeciesInfo {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    (entry.kind === 'plant' || entry.kind === 'animal') &&
    typeof entry.name === 'string' &&
    typeof entry.description === 'string'
  );
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false;
  const saved = value as Record<string, unknown>;
  return (
    Array.isArray(saved.species) &&
    saved.species.every(isSpeciesInfo) &&
    Array.isArray(saved.landmarks) &&
    saved.landmarks.every((name) => typeof name === 'string') &&
    typeof saved.returned === 'boolean'
  );
}

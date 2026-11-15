import { isStarClass, type StarClass } from './star';
import { MAX_SCAN_COUNT, OBJECTIVE_KINDS, isObjectiveKind, type Objective } from './objectives';

/** A model, a texture, or both, by path or URL. */
export interface AssetRef {
  model?: string;
  texture?: string;
}

export interface Assets {
  lander?: AssetRef;
  /** Keyed by the species' generated name, as the survey log shows it. */
  species?: Record<string, AssetRef>;
}

export interface Level {
  id: string;
  name: string;
  seed: number;
  star: { class: StarClass };
  planet: {
    massEarths: number;
    radiusEarths: number;
    orbitAU: number;
    albedo: number;
    dayLengthHours: number;
    atmosphere: { pressureAtm: number; oxygenFraction: number };
  };
  objectives: Objective[];
  assets?: Assets;
}

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDict(parent: Dict, key: string, path: string, errors: string[]): Dict | undefined {
  const value = parent[key];
  if (value === undefined) {
    errors.push(`${path} is missing`);
    return undefined;
  }
  if (!isDict(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }
  return value;
}

function readString(parent: Dict, key: string, path: string, errors: string[]): void {
  const value = parent[key];
  if (value === undefined) errors.push(`${path} is missing`);
  else if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path} must be a non-empty text`);
  }
}

function readNumber(
  parent: Dict,
  key: string,
  path: string,
  range: { min: number; max: number },
  errors: string[],
): void {
  const value = parent[key];
  if (value === undefined) {
    errors.push(`${path} is missing`);
  } else if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a number`);
  } else if (value < range.min || value > range.max) {
    errors.push(`${path} must be between ${range.min} and ${range.max} (got ${value})`);
  }
}

const RANGES = {
  seed: { min: 0, max: 4294967295 },
  massEarths: { min: 0.1, max: 10 },
  radiusEarths: { min: 0.3, max: 3 },
  orbitAU: { min: 0.01, max: 100 },
  albedo: { min: 0, max: 1 },
  dayLengthHours: { min: 0.1, max: 10000 },
  pressureAtm: { min: 0, max: 10 },
  oxygenFraction: { min: 0, max: 1 },
} as const;

/** Returns plain-language problems with a level file; an empty list means the level is valid. */
export function validateLevel(json: unknown): string[] {
  if (!isDict(json)) return ['the level must be a JSON object'];
  const errors: string[] = [];

  readString(json, 'id', 'id', errors);
  readString(json, 'name', 'name', errors);
  readNumber(json, 'seed', 'seed', RANGES.seed, errors);
  if (typeof json.seed === 'number' && Number.isFinite(json.seed) && !Number.isInteger(json.seed)) {
    errors.push('seed must be a whole number');
  }

  const star = readDict(json, 'star', 'star', errors);
  if (star) {
    if (!isStarClass(star.class)) {
      errors.push(`star.class must be one of M, K, G, F, A (got ${JSON.stringify(star.class)})`);
    }
  }

  const planet = readDict(json, 'planet', 'planet', errors);
  if (planet) {
    readNumber(planet, 'massEarths', 'planet.massEarths', RANGES.massEarths, errors);
    readNumber(planet, 'radiusEarths', 'planet.radiusEarths', RANGES.radiusEarths, errors);
    readNumber(planet, 'orbitAU', 'planet.orbitAU', RANGES.orbitAU, errors);
    readNumber(planet, 'albedo', 'planet.albedo', RANGES.albedo, errors);
    readNumber(planet, 'dayLengthHours', 'planet.dayLengthHours', RANGES.dayLengthHours, errors);
    const atmosphere = readDict(planet, 'atmosphere', 'planet.atmosphere', errors);
    if (atmosphere) {
      readNumber(atmosphere, 'pressureAtm', 'planet.atmosphere.pressureAtm', RANGES.pressureAtm, errors);
      readNumber(
        atmosphere,
        'oxygenFraction',
        'planet.atmosphere.oxygenFraction',
        RANGES.oxygenFraction,
        errors,
      );
    }
  }

  if (json.objectives === undefined) {
    errors.push('objectives is missing');
  } else if (!Array.isArray(json.objectives)) {
    errors.push('objectives must be a list');
  } else {
    json.objectives.forEach((objective: unknown, index) => readObjective(objective, `objectives[${index}]`, errors));
  }

  if (json.assets !== undefined) readAssets(json.assets, errors);

  return errors;
}

function readObjective(value: unknown, path: string, errors: string[]): void {
  if (!isDict(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  readString(value, 'kind', `${path}.kind`, errors);
  if (value.kind === undefined) return;
  if (!isObjectiveKind(value.kind)) {
    errors.push(`${path}.kind must be one of ${OBJECTIVE_KINDS.join(', ')} (got ${JSON.stringify(value.kind)})`);
  } else if (value.kind === 'scan-species') {
    readNumber(value, 'count', `${path}.count`, { min: 1, max: MAX_SCAN_COUNT }, errors);
    if (typeof value.count === 'number' && !Number.isInteger(value.count)) {
      errors.push(`${path}.count must be a whole number`);
    }
  } else if (value.kind === 'reach-landmark') {
    readString(value, 'name', `${path}.name`, errors);
  }
}

const ASSET_KEYS = ['lander', 'species'];

function readAssets(value: unknown, errors: string[]): void {
  if (!isDict(value)) {
    errors.push('assets must be an object');
    return;
  }
  for (const key of Object.keys(value)) {
    if (!ASSET_KEYS.includes(key)) errors.push(`assets.${key} is not a known asset (use lander or species)`);
  }
  if (value.lander !== undefined) readAssetRef(value.lander, 'assets.lander', errors);
  if (value.species !== undefined) {
    if (!isDict(value.species)) {
      errors.push('assets.species must be an object');
      return;
    }
    for (const [name, ref] of Object.entries(value.species)) {
      readAssetRef(ref, `assets.species.${name}`, errors);
    }
  }
}

function readAssetRef(value: unknown, path: string, errors: string[]): void {
  if (!isDict(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (value.model === undefined && value.texture === undefined) errors.push(`${path}.model is missing`);
  if (value.model !== undefined) readString(value, 'model', `${path}.model`, errors);
  if (value.texture !== undefined) readString(value, 'texture', `${path}.texture`, errors);
}

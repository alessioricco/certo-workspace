import { validateLevel, type Level } from './level';

export interface LevelIndexEntry {
  id: string;
  file: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export type FetchFn = (url: string) => Promise<Response>;

const LEVELS_DIR = 'levels/';
const INDEX_URL = `${LEVELS_DIR}index.json`;

function isIndexEntry(value: unknown): value is LevelIndexEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.file === 'string';
}

async function fetchJson(url: string, fetchFn: FetchFn): Promise<Result<unknown>> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch {
    return { ok: false, errors: [`could not reach ${url}`] };
  }
  if (!response.ok) {
    return { ok: false, errors: [`could not load ${url} (HTTP ${response.status})`] };
  }
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false, errors: [`${url} is not valid JSON`] };
  }
}

export async function loadLevelIndex(fetchFn: FetchFn = fetch): Promise<Result<LevelIndexEntry[]>> {
  const json = await fetchJson(INDEX_URL, fetchFn);
  if (!json.ok) return json;
  if (!Array.isArray(json.value) || !json.value.every(isIndexEntry)) {
    return { ok: false, errors: [`${INDEX_URL} must be a list of { "id", "file" } entries`] };
  }
  return { ok: true, value: json.value };
}

/** A level is addressed by a URL, a path, a file name in levels/, or an id listed in levels/index.json. */
export async function resolveLevelUrl(source: string, fetchFn: FetchFn = fetch): Promise<Result<string>> {
  if (/^https?:\/\//.test(source) || /^\.{0,2}\//.test(source)) {
    return { ok: true, value: source };
  }
  const index = await loadLevelIndex(fetchFn);
  if (!index.ok) return index;
  const entry = index.value.find((candidate) => candidate.id === source);
  return { ok: true, value: LEVELS_DIR + (entry ? entry.file : source) };
}

export async function loadLevelAt(url: string, fetchFn: FetchFn = fetch): Promise<Result<Level>> {
  const json = await fetchJson(url, fetchFn);
  if (!json.ok) return json;
  const errors = validateLevel(json.value);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: json.value as Level };
}

export async function loadLevel(source: string, fetchFn: FetchFn = fetch): Promise<Result<Level>> {
  const url = await resolveLevelUrl(source, fetchFn);
  if (!url.ok) return url;
  return loadLevelAt(url.value, fetchFn);
}

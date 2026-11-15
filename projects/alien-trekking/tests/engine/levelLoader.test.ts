import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadLevel,
  loadLevelIndex,
  resolveLevelUrl,
  type FetchFn,
} from '../../src/engine/levelLoader';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Serves project files from disk, the way the dev server serves them from the project root. */
const diskFetch: FetchFn = async (url) => {
  const path = `${ROOT}${url.replace(/^\.\//, '')}`;
  try {
    return new Response(readFileSync(path, 'utf8'));
  } catch {
    return new Response('not found', { status: 404 });
  }
};

describe('loadLevelIndex', () => {
  it('lists the three shipped worlds', async () => {
    const index = await loadLevelIndex(diskFetch);
    expect(index).toEqual({
      ok: true,
      value: [
        { id: 'verdant-g', file: 'verdant-g.json' },
        { id: 'ember-m', file: 'ember-m.json' },
        { id: 'boulder-k', file: 'boulder-k.json' },
      ],
    });
  });
});

describe('shipped worlds', () => {
  it('loads and validates every world the index lists', async () => {
    const index = await loadLevelIndex(diskFetch);
    if (!index.ok) throw new Error(index.errors.join('\n'));
    for (const entry of index.value) {
      const level = await loadLevel(entry.id, diskFetch);
      expect(level.ok, entry.id).toBe(true);
    }
  });
});

describe('resolveLevelUrl', () => {
  it('maps a listed id to its file in levels/', async () => {
    expect(await resolveLevelUrl('ember-m', diskFetch)).toEqual({
      ok: true,
      value: 'levels/ember-m.json',
    });
  });

  it('maps a bare file name to levels/ and keeps URLs as they are', async () => {
    expect(await resolveLevelUrl('boulder-k.json', diskFetch)).toEqual({
      ok: true,
      value: 'levels/boulder-k.json',
    });
    expect(await resolveLevelUrl('https://example.com/worlds/x.json', diskFetch)).toEqual({
      ok: true,
      value: 'https://example.com/worlds/x.json',
    });
  });
});

describe('loadLevel', () => {
  it('loads a shipped level by id', async () => {
    const result = await loadLevel('verdant-g', diskFetch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Verdant');
      expect(result.value.star.class).toBe('G');
    }
  });

  it('loads a level from a URL, without going through levels/', async () => {
    const requested: string[] = [];
    const remote: FetchFn = async (url) => {
      requested.push(url);
      return new Response(readFileSync(`${ROOT}levels/ember-m.json`, 'utf8'));
    };
    const result = await loadLevel('https://example.com/worlds/ember.json', remote);
    expect(requested).toEqual(['https://example.com/worlds/ember.json']);
    expect(result.ok && result.value.id).toBe('ember-m');
  });

  it('returns the validation errors of an invalid level file', async () => {
    const result = await loadLevel('./tests/fixtures/bad-level.json', diskFetch);
    expect(result).toEqual({
      ok: false,
      errors: [
        'star.class must be one of M, K, G, F, A (got "Z")',
        'planet.massEarths must be between 0.1 and 10 (got 25)',
      ],
    });
  });

  it('reports a level that does not exist', async () => {
    const result = await loadLevel('no-such-world', diskFetch);
    expect(result).toEqual({
      ok: false,
      errors: ['could not load levels/no-such-world (HTTP 404)'],
    });
  });
});

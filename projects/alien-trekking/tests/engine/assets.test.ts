import { describe, expect, it } from 'vitest';
import { resolveAssets } from '../../src/engine/assets';

const LEVEL_URL = 'https://example.com/worlds/ember.json';

describe('resolveAssets', () => {
  it('resolves model and texture paths against the level file, and keeps absolute URLs', () => {
    const resolved = resolveAssets(
      {
        lander: { model: 'models/lander.glb', texture: 'textures/hull.png' },
        species: { Vorox: { model: 'https://cdn.example.org/vorox.glb' } },
      },
      LEVEL_URL,
    );
    expect(resolved).toEqual({
      lander: {
        model: 'https://example.com/worlds/models/lander.glb',
        texture: 'https://example.com/worlds/textures/hull.png',
      },
      species: { Vorox: { model: 'https://cdn.example.org/vorox.glb' } },
    });
  });

  it('resolves texture-only references relative to the level', () => {
    expect(resolveAssets({ lander: { texture: 'hull.png' } }, LEVEL_URL).lander)
      .toEqual({ texture: 'https://example.com/worlds/hull.png' });
  });

  it('resolves to nothing when a level has no assets', () => {
    expect(resolveAssets(undefined, LEVEL_URL)).toEqual({ lander: undefined, species: {} });
  });
});

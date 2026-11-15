import { readFileSync } from 'node:fs';
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChunkCoord } from '../../src/engine/chunks';
import { createEcosystem, plantsInChunk } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { TERRAIN_CELLS_PER_CHUNK } from '../../src/engine/terrain';
import { CHUNK_BUILD_LIMIT_MS } from '../../src/render/budget';
import { plantChunkGeometry, plantTemplate } from '../../src/render/lifeMeshes';
import { terrainChunkGeometry } from '../../src/render/terrain';

const WARM_UP_CHUNKS = 10;
const TIMED_CHUNKS = 15;

describe('frame time', () => {
  it('generates one detailed chunk with its plants within the chunk time limit', () => {
    const level = JSON.parse(readFileSync(new URL('../../levels/verdant-g.json', import.meta.url), 'utf8')) as Level;
    const ecosystem = createEcosystem(level);
    const templates = new Map(ecosystem.plants.map((plant) => [plant.id, plantTemplate(plant)]));
    const templateOf = (speciesId: string): BufferGeometry => {
      const template = templates.get(speciesId);
      if (!template) throw new Error(`No plant template ${speciesId}`);
      return template;
    };
    const buildChunk = (coord: ChunkCoord): number => {
      const start = performance.now();
      terrainChunkGeometry(coord, level.seed, TERRAIN_CELLS_PER_CHUNK);
      plantChunkGeometry(plantsInChunk(ecosystem, coord), templateOf);
      return performance.now() - start;
    };
    const coords = Array.from({ length: WARM_UP_CHUNKS + TIMED_CHUNKS }, (_, i) => ({
      cx: (i % 5) - 2,
      cz: Math.floor(i / 5) - 2,
    }));

    for (const coord of coords.slice(0, WARM_UP_CHUNKS)) buildChunk(coord);
    const times = coords.slice(WARM_UP_CHUNKS).map(buildChunk).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    expect(median).toBeLessThan(CHUNK_BUILD_LIMIT_MS);
  });
});

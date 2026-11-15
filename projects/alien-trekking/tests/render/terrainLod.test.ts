import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE_M, type ChunkCoord } from '../../src/engine/chunks';
import type { Level } from '../../src/engine/level';
import { COARSE_TERRAIN_CELLS_PER_CHUNK, terrainHeight, TERRAIN_CELLS_PER_CHUNK } from '../../src/engine/terrain';
import { BuildBudget } from '../../src/render/budget';
import { SKIRT_DEPTH_M, TerrainStreamer, terrainChunkGeometry } from '../../src/render/terrain';

const unlimited = new BuildBudget(Infinity);
const STEP_M = CHUNK_SIZE_M / TERRAIN_CELLS_PER_CHUNK;
const LEVEL_FILES = ['verdant-g.json', 'ember-m.json', 'boulder-k.json'];

function triangles(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

describe('detailed and coarse terrain chunks', () => {
  it('draws a coarse chunk with a quarter of the cells of a detailed one, plus a skirt on each edge', () => {
    const detailed = terrainChunkGeometry({ cx: 0, cz: 0 }, 42, TERRAIN_CELLS_PER_CHUNK);
    const coarse = terrainChunkGeometry({ cx: 0, cz: 0 }, 42, COARSE_TERRAIN_CELLS_PER_CHUNK);
    expect(triangles(detailed)).toBe(2 * 16 * 16 + 4 * 16 * 2);
    expect(triangles(coarse)).toBe(2 * 8 * 8 + 4 * 8 * 2);
  });

  it('keeps the coarse edge within the skirt depth of the detailed edge beside it, on every test world', () => {
    let worst = 0;
    for (const file of LEVEL_FILES) {
      const { seed } = JSON.parse(readFileSync(new URL(`../../levels/${file}`, import.meta.url), 'utf8')) as Level;
      for (let cz = -3; cz <= 3; cz++) {
        const edgeX = 3 * CHUNK_SIZE_M;
        for (let k = 1; k < TERRAIN_CELLS_PER_CHUNK * 2; k += 2) {
          const z = cz * CHUNK_SIZE_M + k * STEP_M;
          const detailed = terrainHeight(edgeX, z, seed);
          const coarseLine =
            (terrainHeight(edgeX, z - STEP_M, seed) + terrainHeight(edgeX, z + STEP_M, seed)) / 2;
          worst = Math.max(worst, Math.abs(detailed - coarseLine));
        }
      }
    }
    expect(worst).toBeLessThan(SKIRT_DEPTH_M);
  });

  it('builds detailed chunks near the player and coarse ones beyond, and lists only the detailed', () => {
    const scene = new THREE.Scene();
    const terrain = new TerrainStreamer(scene, 42);
    terrain.update(1, 1, 4, unlimited);
    expect(terrain.loadedCoords()).toHaveLength(81);
    const detailed = terrain.detailedCoords();
    expect(detailed).toHaveLength(25);
    expect(detailed).toContainEqual({ cx: 2, cz: -2 });
    expect(detailed).not.toContainEqual({ cx: 3, cz: 0 });
    terrain.dispose();
  });

  it('rebuilds a chunk at its new detail when the player walks into the detail radius', () => {
    const scene = new THREE.Scene();
    const terrain = new TerrainStreamer(scene, 42);
    terrain.update(1, 1, 4, unlimited);
    const edge: ChunkCoord = { cx: 3, cz: 0 };
    expect(terrain.detailedCoords()).not.toContainEqual(edge);
    terrain.update(3 * CHUNK_SIZE_M + 1, 1, 4, unlimited);
    expect(terrain.detailedCoords()).toContainEqual(edge);
    expect(terrain.detailedCoords()).not.toContainEqual({ cx: -2, cz: 0 });
    terrain.dispose();
  });
});

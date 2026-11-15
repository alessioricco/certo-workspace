import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AnimalSpecies } from '../../src/engine/animals';
import type { ChunkCoord } from '../../src/engine/chunks';
import { createEcosystem, predatorsInChunk, speciesById } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { stunCreature } from '../../src/engine/sampler';
import { terrainSurfaceHeight } from '../../src/engine/terrain';
import { BuildBudget } from '../../src/render/budget';
import { LifeRenderer } from '../../src/render/life';

const level = JSON.parse(readFileSync(new URL('../../levels/verdant-g.json', import.meta.url), 'utf8')) as Level;
const ecosystem = createEcosystem(level);
const unlimited = new BuildBudget(Infinity);

function findPredator(): { coord: ChunkCoord; homeX: number; homeZ: number; species: AnimalSpecies } {
  for (let cz = -5; cz <= 5; cz++) {
    for (let cx = -5; cx <= 5; cx++) {
      const coord = { cx, cz };
      const [predator] = predatorsInChunk(ecosystem, coord);
      if (!predator) continue;
      const species = speciesById(ecosystem, predator.speciesId) as AnimalSpecies;
      return { coord, homeX: predator.homeX, homeZ: predator.homeZ, species };
    }
  }
  throw new Error('no predator near the landing point');
}

describe('predators in the renderer', () => {
  it('draws the predators and their territory marks as real geometry', () => {
    const { coord } = findPredator();
    const scene = new THREE.Scene();
    const life = new LifeRenderer(scene, ecosystem);
    life.update([coord], { x: 1e6, z: 1e6, running: false }, 0, unlimited);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('does not advance predator behavior while the world is paused', () => {
    const { coord, homeX, homeZ } = findPredator();
    const life = new LifeRenderer(new THREE.Scene(), ecosystem);
    const nearby = { x: homeX + 5, z: homeZ, running: false };
    expect(life.update([coord], nearby, 0, unlimited, false)).toEqual([]);
    expect(life.update([coord], nearby, 0.1, unlimited).map((event) => event.kind)).toEqual(['warn']);
  });

  it('warns when the player walks into a territory, and strikes when the player stays', () => {
    const { coord, homeX, homeZ } = findPredator();
    const life = new LifeRenderer(new THREE.Scene(), ecosystem);
    const nearby = { x: homeX + 5, z: homeZ, running: false };

    expect(life.update([coord], nearby, 0, unlimited).map((event) => event.kind)).toEqual(['warn']);

    let strikes = 0;
    for (let i = 0; i < 100; i++) {
      strikes += life.update([coord], nearby, 0.1, unlimited).filter((event) => event.kind === 'strike').length;
    }
    expect(strikes).toBeGreaterThan(0);
  });

  it('aims at a predator from the sampler and stuns it, so it stops attacking', () => {
    const { coord, homeX, homeZ, species } = findPredator();
    const life = new LifeRenderer(new THREE.Scene(), ecosystem);
    const nearby = { x: homeX + 5, z: homeZ, running: false };
    life.update([coord], nearby, 0, unlimited);

    const height = terrainSurfaceHeight(homeX, homeZ, level.seed) + species.legLengthM + species.bodyHeightM / 2;
    const target = life.aimTarget([homeX + 5, height, homeZ], [-1, 0, 0]);
    expect(target?.speciesId).toBe(species.id);
    const creature = target?.creature;
    expect(creature).toBeDefined();
    if (!creature) return;

    stunCreature(creature);
    let strikes = 0;
    for (let i = 0; i < 40; i++) {
      strikes += life.update([coord], nearby, 0.1, unlimited).filter((event) => event.kind === 'strike').length;
    }
    expect(strikes).toBe(0);
    expect(creature.mood).toBe('stunned');
  });
});

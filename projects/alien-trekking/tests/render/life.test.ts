import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEcosystem, plantsInChunk } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { terrainSurfaceHeight } from '../../src/engine/terrain';
import { BuildBudget } from '../../src/render/budget';
import { LifeRenderer } from '../../src/render/life';
import { TerrainStreamer } from '../../src/render/terrain';

const level = JSON.parse(readFileSync(new URL('../../levels/verdant-g.json', import.meta.url), 'utf8')) as Level;
const unlimited = new BuildBudget(Infinity);

describe('life and terrain integration', () => {
  it('matches the drawn terrain surface at points on both triangle halves', () => {
    const scene = new THREE.Scene();
    const terrain = new TerrainStreamer(scene, level.seed);
    terrain.update(1, 1, 4, unlimited);
    scene.updateMatrixWorld(true);
    for (const [x, z] of [[1, 1], [3, 3], [8.2, 5.7], [31.5, 61.9], [-2.3, -3.1]]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)).intersectObjects(scene.children);
      expect(hits.length).toBeGreaterThan(0);
      expect(terrainSurfaceHeight(x, z, level.seed)).toBeCloseTo(hits[0].point.y, 4);
    }
    terrain.dispose();
  });

  it('places plant models on terrain and removes them with their chunk', () => {
    const ecosystem = createEcosystem(level);
    const scene = new THREE.Scene();
    const coord = { cx: 0, cz: 0 };
    const spot = plantsInChunk(ecosystem, coord)[0];
    const model = new THREE.Group();
    model.name = 'custom-plant';
    const life = new LifeRenderer(scene, ecosystem, new Map([[spot.speciesId, model]]));
    life.update([coord], { x: 1000, z: 1000, running: false }, 0, unlimited);
    const plants: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.name === 'custom-plant') plants.push(child);
    });
    expect(plants.length).toBeGreaterThan(0);
    expect(plants.some((child) => child.position.x === spot.position[0] &&
      child.position.z === spot.position[2] &&
      Math.abs(child.position.y - terrainSurfaceHeight(spot.position[0], spot.position[2], level.seed)) < 0.01)).toBe(true);
    life.update([], { x: 1000, z: 1000, running: false }, 0, unlimited);
    expect(scene.children).toHaveLength(0);
  });

  it('streams real life, aims at a plant, and unloads the chunk', () => {
    const ecosystem = createEcosystem(level);
    const scene = new THREE.Scene();
    const life = new LifeRenderer(scene, ecosystem);
    const coord = { cx: 0, cz: 0 };
    const spot = plantsInChunk(ecosystem, coord)[0];
    life.update([coord], { x: 1000, z: 1000, running: false }, 0, unlimited);
    const height = terrainSurfaceHeight(spot.position[0], spot.position[2], level.seed);
    const eye: [number, number, number] = [spot.position[0], height + (spot.scanPoint[1] - spot.position[1]), spot.position[2] + 10];
    expect(life.aim(eye, [0, 0, -1])?.id).toBe(spot.speciesId);
    expect(scene.children.length).toBeGreaterThan(0);
    life.update([], { x: 1000, z: 1000, running: false }, 0, unlimited);
    expect(scene.children).toHaveLength(0);
    expect(life.aim(eye, [0, 0, -1])).toBeUndefined();
  });
});

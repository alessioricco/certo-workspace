import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEcosystem } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { BuildBudget } from '../../src/render/budget';
import { LifeRenderer } from '../../src/render/life';

const level = JSON.parse(readFileSync(new URL('../../levels/verdant-g.json', import.meta.url), 'utf8')) as Level;
const ecosystem = createEcosystem(level);
const unlimited = new BuildBudget(Infinity);

function shown(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

describe('life culling', () => {
  it('hides the plants of a chunk behind the camera and shows those in front', () => {
    const model = new THREE.Group();
    model.name = 'plant';
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    const models = new Map(ecosystem.plants.map((plant) => [plant.id, model]));
    const scene = new THREE.Scene();
    const life = new LifeRenderer(scene, ecosystem, models);
    const observer = { x: 32, z: 32, running: false };
    life.update([{ cx: 0, cz: -2 }, { cx: 0, cz: 2 }], observer, 0, unlimited);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1200);
    camera.position.set(32, 30, 32);
    life.cull(camera);

    const plants: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.name === 'plant') plants.push(child);
    });
    const ahead = plants.filter((plant) => plant.position.z < 0);
    const behind = plants.filter((plant) => plant.position.z > 0);
    expect(ahead.length).toBeGreaterThan(0);
    expect(behind.length).toBeGreaterThan(0);
    expect(ahead.every(shown)).toBe(true);
    expect(behind.some(shown)).toBe(false);
  });
});

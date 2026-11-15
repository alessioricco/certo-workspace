import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { planAnimalSpecies } from '../../src/engine/animals';
import { createEcosystem, type PlantSpot } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { planPlantSpecies } from '../../src/engine/plants';
import { mulberry32 } from '../../src/engine/random';
import { animalShape, plantChunkGeometry, plantTemplate } from '../../src/render/lifeMeshes';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const verdant = JSON.parse(readFileSync(`${ROOT}levels/verdant-g.json`, 'utf8')) as Level;

function boundsOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  return new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
}

function expectFlatShaded(geometry: THREE.BufferGeometry): void {
  const normals = geometry.getAttribute('normal');
  for (let vertex = 0; vertex < normals.count; vertex += 3) {
    for (let k = 1; k < 3; k++) {
      expect(normals.getX(vertex + k)).toBeCloseTo(normals.getX(vertex), 5);
      expect(normals.getY(vertex + k)).toBeCloseTo(normals.getY(vertex), 5);
      expect(normals.getZ(vertex + k)).toBeCloseTo(normals.getZ(vertex), 5);
    }
  }
}

describe('plantTemplate', () => {
  it('builds each plant as flat-shaded triangles in its colour, reaching about its generated height', () => {
    const plants = planPlantSpecies(mulberry32(5), 'green', 3, new Set());
    for (const plant of plants) {
      const geometry = plantTemplate(plant);
      expect(geometry.getAttribute('position').count % 3).toBe(0);
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
      expect(boundsOf(geometry).max.y).toBeCloseTo(plant.heightM, 1);
      expectFlatShaded(geometry);
    }
  });
});

describe('plantChunkGeometry', () => {
  it('merges one copy of the plant template per spot into a single geometry', () => {
    const ecosystem = createEcosystem(verdant);
    const template = plantTemplate(ecosystem.plants[0]);
    const spot: PlantSpot = {
      speciesId: ecosystem.plants[0].id,
      position: [10, 2, 20],
      yawRad: 0.5,
      scale: 1,
      scanPoint: [10, 3, 20],
    };
    const merged = plantChunkGeometry([spot, { ...spot, position: [30, 2, 40] }], () => template);
    expect(merged.getAttribute('position').count).toBe(2 * template.getAttribute('position').count);
  });
});

describe('animalShape', () => {
  it('orients the elongated body along the same axis as the head and legs', () => {
    const [species] = planAnimalSpecies(mulberry32(3), 9.81, [200, 170, 140], 1, new Set());
    const bounds = boundsOf(animalShape(species).frame);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(bounds.max.x - bounds.min.x);
  });

  it('stands on the ground with its head in front of the body', () => {
    const [species] = planAnimalSpecies(mulberry32(3), 9.81, [200, 170, 140], 1, new Set());
    const shape = animalShape(species);
    const frame = boundsOf(shape.frame);
    expect(frame.min.y).toBeCloseTo(0, 2);
    expect(frame.max.y).toBeGreaterThan(species.legLengthM + species.bodyHeightM / 2);
    expect(boundsOf(shape.head).getCenter(new THREE.Vector3()).z).toBeGreaterThan(0);
    expectFlatShaded(shape.frame);
  });
});

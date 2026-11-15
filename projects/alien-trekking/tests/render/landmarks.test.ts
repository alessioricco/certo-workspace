import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/engine/level';
import { planLandmarks } from '../../src/engine/landmarks';
import { terrainSurfaceHeight } from '../../src/engine/terrain';
import { createLandmarks } from '../../src/render/landmarks';
import { expectClose } from '../engine/helpers';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function loadShipped(file: string): Level {
  return JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8')) as Level;
}

describe('createLandmarks', () => {
  it('builds each landmark standing on the terrain, as tall as its generated height', () => {
    const levels = [loadShipped('verdant-g.json'), loadShipped('ember-m.json'), loadShipped('boulder-k.json')];
    const scene = new THREE.Scene();
    const landmarks = levels.flatMap((level) => {
      const planned = planLandmarks(level);
      createLandmarks(scene, planned, level.seed);
      return planned.map((landmark) => ({ landmark, seed: level.seed }));
    });

    expect(scene.children).toHaveLength(landmarks.length);
    scene.children.forEach((group, index) => {
      const { landmark, seed } = landmarks[index];
      const bounds = new THREE.Box3().setFromObject(group);
      expectClose(bounds.max.y - bounds.min.y, landmark.heightM);
      expectClose(bounds.min.y, terrainSurfaceHeight(landmark.x, landmark.z, seed));
    });
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { skyState, type SkyWorld } from '../../src/engine/sky';
import { SkyRenderer } from '../../src/render/sky';

const world: SkyWorld = { starClass: 'G', dayLengthHours: 24, pressureAtm: 1.5 };

describe('SkyRenderer', () => {
  it('keeps the star field centred on the moving camera and follows night visibility', () => {
    const scene = new THREE.Scene();
    const renderer = new SkyRenderer(scene, 42, 0);
    const stars = scene.children.find((child): child is THREE.Points => child instanceof THREE.Points);
    expect(stars).toBeDefined();
    if (!stars) throw new Error('Missing star field');

    const camera = new THREE.Vector3(350, 25, -480);
    renderer.update(skyState(world, 18), [], camera);
    expect(stars.position.toArray()).toEqual(camera.toArray());
    expect(stars.geometry.drawRange.count).toBe(600);
    expect((stars.material as THREE.PointsMaterial).opacity).toBe(1);

    camera.set(-100, 12, 640);
    renderer.update(skyState(world, 6), [], camera);
    expect(stars.position.toArray()).toEqual(camera.toArray());
    expect((stars.material as THREE.PointsMaterial).opacity).toBe(0);
  });
});

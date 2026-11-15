import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEcosystem } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { ensureTextureCoordinates, fitToHeight, loadAssets } from '../../src/render/assets';
import { LANDER_HEIGHT_M } from '../../src/render/lander';
import { expectClose } from '../engine/helpers';

/** three.js reports download progress with the browser's ProgressEvent, which Node does not have. */
class NodeProgressEvent extends Event {
  readonly lengthComputable: boolean;
  readonly loaded: number;
  readonly total: number;

  constructor(type: string, init: { lengthComputable: boolean; loaded: number; total: number }) {
    super(type);
    this.lengthComputable = init.lengthComputable;
    this.loaded = init.loaded;
    this.total = init.total;
  }
}
Object.assign(globalThis, { ProgressEvent: NodeProgressEvent });

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const verdant = JSON.parse(readFileSync(`${ROOT}levels/verdant-g.json`, 'utf8')) as Level;
const ecosystem = createEcosystem(verdant);

/** A one-triangle glTF model, 1 m wide and 2 m tall, embedded as a data URL. */
function triangleModel(): string {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0]);
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 2, 0] },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [
      { byteLength: 36, uri: `data:application/octet-stream;base64,${Buffer.from(positions.buffer).toString('base64')}` },
    ],
  };
  return `data:model/gltf+json;base64,${Buffer.from(JSON.stringify(gltf)).toString('base64')}`;
}

const UNREACHABLE = 'http://127.0.0.1:9';

describe('fitToHeight', () => {
  it('scales an object to the height asked for, standing on the ground and centred', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
    mesh.position.set(5, 3, -2);
    const bounds = new THREE.Box3().setFromObject(fitToHeight(mesh, 1.5));
    const centre = bounds.getCenter(new THREE.Vector3());
    expectClose(bounds.max.y - bounds.min.y, 1.5);
    expectClose(bounds.min.y, 0);
    expectClose(centre.x, 0);
    expectClose(centre.z, 0);
  });
});

describe('texture coordinates', () => {
  it('projects coordinates onto generated geometry without replacing existing UVs', () => {
    const geometry = new THREE.BoxGeometry(2, 4, 1);
    geometry.deleteAttribute('uv');
    ensureTextureCoordinates(geometry);
    expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
    const uv = geometry.getAttribute('uv');
    ensureTextureCoordinates(geometry);
    expect(geometry.getAttribute('uv')).toBe(uv);
  });
});

describe('loadAssets', () => {
  it('loads a glTF model and fits it to the lander', async () => {
    const assets = await loadAssets({ lander: { model: triangleModel() }, species: {} }, ecosystem);
    expect(assets.notes).toEqual([]);
    expect(assets.lander).toBeDefined();
    const bounds = new THREE.Box3().setFromObject(assets.lander as THREE.Object3D);
    expectClose(bounds.max.y - bounds.min.y, LANDER_HEIGHT_M);
  });

  it('falls back to the generated lander and says so when the model cannot be loaded', async () => {
    const url = `${UNREACHABLE}/lander.glb`;
    const assets = await loadAssets({ lander: { model: url }, species: {} }, ecosystem);
    expect(assets.lander).toBeUndefined();
    expect(assets.notes).toEqual([
      `Lander: could not load the model ${url}; the generated version is shown.`,
    ]);
  });

  it('uses the generated fallback when a requested texture cannot be loaded', async () => {
    const texture = `${UNREACHABLE}/hull.png`;
    const assets = await loadAssets(
      { lander: { model: triangleModel(), texture }, species: {} },
      ecosystem,
    );
    expect(assets.lander).toBeUndefined();
    expect(assets.notes).toEqual([
      `Lander: could not load the texture ${texture}; the generated version is shown.`,
    ]);
  });

  it('fits a species model to the animal it replaces, keyed by species id', async () => {
    const animal = ecosystem.animals[0];
    const assets = await loadAssets(
      { species: { [animal.name]: { model: triangleModel() } } },
      ecosystem,
    );
    expect(assets.notes).toEqual([]);
    const model = assets.species.get(animal.id);
    expect(model).toBeDefined();
    const bounds = new THREE.Box3().setFromObject(model as THREE.Object3D);
    expectClose(bounds.max.y - bounds.min.y, animal.legLengthM + animal.bodyHeightM + 2 * animal.headRadiusM);
  });

  it('loads a model for a named plant', async () => {
    const plant = ecosystem.plants[0];
    const assets = await loadAssets({ species: { [plant.name]: { model: triangleModel() } } }, ecosystem);
    expect(assets.notes).toEqual([]);
    const model = assets.species.get(plant.id);
    expect(model).toBeDefined();
    expectClose(new THREE.Box3().setFromObject(model as THREE.Object3D).getSize(new THREE.Vector3()).y, plant.heightM);
  });

  it('does not use an asset for a name that no animal in the world has', async () => {
    const assets = await loadAssets({ species: { Rover: { model: triangleModel() } } }, ecosystem);
    expect(assets.species.size).toBe(0);
    expect(assets.notes).toEqual([
      'Rover: no species with this name in this world; the asset is not used.',
    ]);
  });
});

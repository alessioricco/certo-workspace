import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ResolvedAsset, ResolvedAssets } from '../engine/assets';
import type { AnimalSpecies } from '../engine/animals';
import type { Ecosystem } from '../engine/ecosystem';
import type { PlantSpecies } from '../engine/plants';
import { createLander, LANDER_HEIGHT_M } from './lander';
import { animalShape, neckPoint, plantTemplate } from './lifeMeshes';

export interface LoadedAssets {
  lander?: THREE.Object3D;
  /** Models by species id. */
  species: Map<string, THREE.Object3D>;
  /** What could not be used. Each one means the generated version is shown instead. */
  notes: string[];
}

const modelLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

function speciesHeightM(species: AnimalSpecies | PlantSpecies): number {
  return species.kind === 'plant' ? species.heightM : species.legLengthM + species.bodyHeightM + 2 * species.headRadiusM;
}

function generatedSpecies(species: AnimalSpecies | PlantSpecies): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  if (species.kind === 'plant') {
    group.add(new THREE.Mesh(plantTemplate(species), material));
  } else {
    const shape = animalShape(species);
    const head = new THREE.Mesh(shape.head, material);
    head.position.set(...neckPoint(species));
    group.add(new THREE.Mesh(shape.frame, material), head);
  }
  return group;
}

/** Give generated geometry planar coordinates; imported glTF retains its own UVs. */
export function ensureTextureCoordinates(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('uv')) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const positions = geometry.getAttribute('position');
  const width = box.max.x - box.min.x || 1;
  const height = box.max.y - box.min.y || 1;
  const uv: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    uv.push((positions.getX(i) - box.min.x) / width, (positions.getY(i) - box.min.y) / height);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
}

/**
 * Scales an object so it stands on the ground at the origin, centred, at the given height.
 * Returns a group that holds it, so the caller can clone the result.
 */
export function fitToHeight(object: THREE.Object3D, heightM: number): THREE.Group {
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  if (size.y <= 0) throw new Error('the model has no height');
  object.scale.multiplyScalar(heightM / size.y);
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  object.position.add(new THREE.Vector3(-centre.x, -box.min.y, -centre.z));
  const fitted = new THREE.Group();
  fitted.add(object);
  return fitted;
}

/** Paints the model's surfaces with a texture, replacing the model's own colour map. */
function applyTexture(model: THREE.Object3D, texture: THREE.Texture): void {
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    ensureTextureCoordinates(node.geometry);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.map = texture;
        material.needsUpdate = true;
      }
    }
  });
}

async function loadModel(
  label: string,
  asset: ResolvedAsset,
  heightM: number,
  notes: string[],
  generated: () => THREE.Object3D,
): Promise<THREE.Object3D | undefined> {
  let model: THREE.Object3D;
  if (asset.model !== undefined) {
    try {
      const gltf = await modelLoader.loadAsync(asset.model);
      model = fitToHeight(gltf.scene, heightM);
    } catch {
      notes.push(`${label}: could not load the model ${asset.model}; the generated version is shown.`);
      return undefined;
    }
  } else {
    model = generated();
  }
  if (asset.texture !== undefined) {
    try {
      const texture = await textureLoader.loadAsync(asset.texture);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      applyTexture(model, texture);
    } catch {
      notes.push(`${label}: could not load the texture ${asset.texture}; the generated version is shown.`);
      return undefined;
    }
  }
  return model;
}

/** Loads the level's models and textures. Anything that fails is left out and listed in `notes`. */
export async function loadAssets(assets: ResolvedAssets, ecosystem: Ecosystem): Promise<LoadedAssets> {
  const notes: string[] = [];
  const lander = assets.lander && (await loadModel('Lander', assets.lander, LANDER_HEIGHT_M, notes, () => {
    const craft = createLander(new THREE.Scene(), ecosystem.seed);
    craft.position.set(0, 0, 0);
    return craft;
  }));

  const allSpecies = [...ecosystem.plants, ...ecosystem.animals, ...ecosystem.predators];
  const species = new Map<string, THREE.Object3D>();
  for (const [name, asset] of Object.entries(assets.species)) {
    const kind = allSpecies.find((candidate) => candidate.name === name);
    if (!kind) {
      notes.push(`${name}: no species with this name in this world; the asset is not used.`);
      continue;
    }
    const model = await loadModel(name, asset, speciesHeightM(kind), notes, () => generatedSpecies(kind));
    if (model) species.set(kind.id, model);
  }
  return { lander, species, notes };
}

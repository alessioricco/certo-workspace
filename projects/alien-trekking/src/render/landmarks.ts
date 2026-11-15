import * as THREE from 'three';
import type { Landmark } from '../engine/landmarks';
import { terrainSurfaceHeight } from '../engine/terrain';

const ROCK_COLOUR = 0x8c8079;
const LEG_WIDTH_M = 2.2;
const ARCH_SPAN_M = 3;

function rockPiece(geometry: THREE.BufferGeometry, material: THREE.Material, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  return mesh;
}

/** A striking rock feature, flat-shaded, standing on the terrain where its landmark is placed. */
function landmarkGroup(landmark: Landmark, material: THREE.Material, seed: number): THREE.Group {
  const { heightM } = landmark;
  const group = new THREE.Group();
  switch (landmark.shape) {
    case 'spire':
      group.add(rockPiece(new THREE.CylinderGeometry(0.4, 2.2, heightM, 5), material, heightM / 2));
      break;
    case 'pillar':
      group.add(rockPiece(new THREE.CylinderGeometry(1.4, 1.8, heightM, 6), material, heightM / 2));
      break;
    case 'arch': {
      const legHeight = heightM * 0.85;
      for (const side of [-1, 1]) {
        const leg = rockPiece(new THREE.BoxGeometry(LEG_WIDTH_M, legHeight, LEG_WIDTH_M), material, legHeight / 2);
        leg.position.x = side * ARCH_SPAN_M;
        group.add(leg);
      }
      const beamHeight = heightM * 0.2;
      const beam = rockPiece(
        new THREE.BoxGeometry(ARCH_SPAN_M * 2 + LEG_WIDTH_M, beamHeight, LEG_WIDTH_M),
        material,
        heightM - beamHeight / 2,
      );
      group.add(beam);
      break;
    }
  }
  group.rotation.y = landmark.yawRad;
  group.position.set(landmark.x, terrainSurfaceHeight(landmark.x, landmark.z, seed), landmark.z);
  return group;
}

/** Adds each landmark to the scene once; they stay there, and fog softens the distant ones. */
export function createLandmarks(scene: THREE.Scene, landmarks: readonly Landmark[], seed: number): void {
  const material = new THREE.MeshStandardMaterial({ color: ROCK_COLOUR, flatShading: true, roughness: 0.95 });
  for (const landmark of landmarks) scene.add(landmarkGroup(landmark, material, seed));
}

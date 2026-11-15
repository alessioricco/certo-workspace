import * as THREE from 'three';
import { LANDER } from '../engine/lander';
import { terrainSurfaceHeight } from '../engine/terrain';

const HULL_COLOUR = 0xc9ccd6;
const GLASS_COLOUR = 0x6fb8c9;
const LEG_COLOUR = 0x4a4650;
const LEG_COUNT = 3;
const LEG_SPREAD_M = 1.4;
const LEG_HEIGHT_M = 2.2;
/** Height of the generated craft, from the ground to the top of its dome. */
export const LANDER_HEIGHT_M = 3.8;

/** The landed craft at the lander: a hull on three legs, where the player wakes, or the level's model of it. */
export function createLander(scene: THREE.Scene, seed: number, model?: THREE.Object3D): THREE.Object3D {
  const group = model ? model.clone() : generatedLander();
  group.position.set(LANDER.x, terrainSurfaceHeight(LANDER.x, LANDER.z, seed), LANDER.z);
  scene.add(group);
  return group;
}

function generatedLander(): THREE.Group {
  const group = new THREE.Group();
  const flat = (colour: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: colour, flatShading: true, roughness: 0.8 });

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 1.4, 8), flat(HULL_COLOUR));
  hull.position.y = LEG_HEIGHT_M;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    flat(GLASS_COLOUR),
  );
  dome.position.y = LEG_HEIGHT_M + 0.7;
  group.add(hull, dome);

  const legMaterial = flat(LEG_COLOUR);
  for (let i = 0; i < LEG_COUNT; i++) {
    const angle = (i / LEG_COUNT) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, LEG_HEIGHT_M, 5), legMaterial);
    leg.position.set(Math.cos(angle) * LEG_SPREAD_M, LEG_HEIGHT_M / 2, Math.sin(angle) * LEG_SPREAD_M);
    group.add(leg);
  }
  return group;
}

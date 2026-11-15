import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AnimalSpecies } from '../engine/animals';
import { mixRgb, type Rgb } from '../engine/color';
import type { PlantSpot } from '../engine/ecosystem';
import { CAP_FLATNESS, type PlantPart, type PlantSpecies } from '../engine/plants';
import type { Vec3 } from '../engine/sky';

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const STALK_SHADE = 0.35;
const CAP_TINT = 0.25;
const LEG_SHADE = 0.3;
const NECK_HEIGHT_SHARE = 0.75;
const UP = new THREE.Vector3(0, 1, 0);

export interface AnimalShape {
  /** Body and legs, in the animal's own frame, standing on the ground at the origin. */
  frame: THREE.BufferGeometry;
  /** The head, in the frame of the neck, which the animal lowers to graze. */
  head: THREE.BufferGeometry;
}

function colourOf(rgb: Rgb): THREE.Color {
  return new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
}

/** Flat-shaded: every triangle has its own normal, and every vertex carries the colour. */
function paint(geometry: THREE.BufferGeometry, rgb: Rgb): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute('uv');
  flat.computeVertexNormals();
  const colour = colourOf(rgb);
  const count = flat.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colours.set([colour.r, colour.g, colour.b], i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return flat;
}

/** Turns a geometry built along +y from the origin so that it starts at `base` and points along `direction`. */
function oriented(geometry: THREE.BufferGeometry, base: Vec3, direction: Vec3): THREE.BufferGeometry {
  const rotation = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...direction));
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...base),
    rotation,
    new THREE.Vector3(1, 1, 1),
  );
  return geometry.applyMatrix4(matrix);
}

function partGeometry(part: PlantPart, colour: Rgb): THREE.BufferGeometry {
  switch (part.kind) {
    case 'stalk': {
      const stalk = new THREE.CylinderGeometry(part.radiusM * 0.6, part.radiusM, part.lengthM, 5);
      stalk.translate(0, part.lengthM / 2, 0);
      return paint(oriented(stalk, part.base, part.direction), mixRgb(colour, BLACK, STALK_SHADE));
    }
    case 'frond': {
      const blade = new THREE.CylinderGeometry(0.02, part.widthM / 2, part.lengthM, 4);
      blade.translate(0, part.lengthM / 2, 0);
      return paint(oriented(blade, part.base, part.direction), colour);
    }
    case 'cap': {
      const cap = new THREE.SphereGeometry(part.radiusM, 6, 4);
      cap.scale(1, CAP_FLATNESS, 1);
      cap.translate(...part.base);
      return paint(cap, mixRgb(colour, WHITE, CAP_TINT));
    }
  }
}

/** One plant at its natural size, in its own frame: its base at the origin. */
export function plantTemplate(species: PlantSpecies): THREE.BufferGeometry {
  const pieces = species.parts.map((part) => partGeometry(part, species.colour));
  return mergeGeometries(pieces);
}

/** All the plants of a chunk in one geometry. Each template is copied and turned into place. */
export function plantChunkGeometry(
  spots: readonly PlantSpot[],
  templateOf: (speciesId: string) => THREE.BufferGeometry,
): THREE.BufferGeometry {
  const pieces = spots.map((spot) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...spot.position),
      new THREE.Quaternion().setFromAxisAngle(UP, spot.yawRad),
      new THREE.Vector3(spot.scale, spot.scale, spot.scale),
    );
    return templateOf(spot.speciesId).clone().applyMatrix4(matrix);
  });
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return merged;
}

export interface PlacedMark {
  kind: 'bone' | 'scratch';
  /** On the ground, at the mark's centre. */
  position: Vec3;
  yawRad: number;
}

const BONE: Rgb = [228, 220, 200];
const SCRATCH: Rgb = [58, 40, 52];
const MARK_LIFT_M = 0.02;

function markPiece(mark: PlacedMark): THREE.BufferGeometry {
  if (mark.kind === 'scratch') {
    return paint(new THREE.BoxGeometry(0.8, 0.02, 0.06), SCRATCH);
  }
  const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5);
  shaft.rotateZ(Math.PI / 2);
  const knobs = [-0.25, 0.25].map((x) => new THREE.IcosahedronGeometry(0.06, 0).translate(x, 0, 0));
  return mergeGeometries([paint(shaft, BONE), ...knobs.map((knob) => paint(knob, BONE))]);
}

/** Bones and claw marks of one or more territories, lying flat on the ground. */
export function territoryMarkGeometry(marks: readonly PlacedMark[]): THREE.BufferGeometry {
  const pieces = marks.map((mark) => {
    const piece = markPiece(mark);
    piece.rotateY(mark.yawRad);
    piece.translate(mark.position[0], mark.position[1] + MARK_LIFT_M, mark.position[2]);
    return piece;
  });
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return merged;
}

/** Where the head joins the body, in the frame of the animal. */
export function neckPoint(species: AnimalSpecies): Vec3 {
  return [0, species.legLengthM + species.bodyHeightM * NECK_HEIGHT_SHARE, species.bodyLengthM * 0.32];
}

/** An animal from a body, four legs and a head, built from its species' sizes. */
export function animalShape(species: AnimalSpecies): AnimalShape {
  const { bodyLengthM, bodyWidthM, bodyHeightM, legLengthM, legRadiusM, headRadiusM } = species;
  const body = new THREE.IcosahedronGeometry(1, 1);
  body.scale(bodyWidthM / 2, bodyHeightM / 2, bodyLengthM / 2);
  body.translate(0, legLengthM + bodyHeightM / 2, 0);
  const legColour = mixRgb(species.colour, BLACK, LEG_SHADE);
  const pieces = [paint(body, species.colour)];
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const height = legLengthM + bodyHeightM * 0.3;
      const leg = new THREE.CylinderGeometry(legRadiusM, legRadiusM, height, 4);
      leg.translate(sideX * bodyWidthM * 0.3, height / 2, sideZ * bodyLengthM * 0.3);
      pieces.push(paint(leg, legColour));
    }
  }
  const head = new THREE.IcosahedronGeometry(headRadiusM, 0);
  head.translate(0, 0, headRadiusM);
  return {
    frame: mergeGeometries(pieces),
    head: paint(head, species.colour),
  };
}

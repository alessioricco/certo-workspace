import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { CHUNK_SIZE_M } from './chunks';
import { mulberry32 } from './random';

export const TERRAIN_CELLS_PER_CHUNK = 16;
/** Cells per side of a chunk beyond the detail radius: a quarter of the triangles. */
export const COARSE_TERRAIN_CELLS_PER_CHUNK = 8;

interface Octave {
  wavelengthM: number;
  amplitudeM: number;
}

/** Broad hills first, then smaller bumps and detail. */
const OCTAVES: readonly Octave[] = [
  { wavelengthM: 220, amplitudeM: 26 },
  { wavelengthM: 60, amplitudeM: 7 },
  { wavelengthM: 16, amplitudeM: 1.2 },
];

const ROCK_SLOPE_DEG = 30;
const HIGHLAND_HEIGHT_M = 12;

export type GroundKind = 'lowland' | 'highland' | 'rock';

let cached: { seed: number; noise: NoiseFunction2D } | undefined;

function noiseFor(seed: number): NoiseFunction2D {
  if (cached?.seed !== seed) cached = { seed, noise: createNoise2D(mulberry32(seed)) };
  return cached.noise;
}

/** Ground height in metres at a point, the same for the same seed. */
export function terrainHeight(x: number, z: number, seed: number): number {
  const noise = noiseFor(seed);
  let height = 0;
  OCTAVES.forEach(({ wavelengthM, amplitudeM }, octave) => {
    const offset = octave * 97.3;
    height += amplitudeM * noise(x / wavelengthM + offset, z / wavelengthM - offset);
  });
  return height;
}

/**
 * Heights on a square grid of `cells` × `cells` cells starting at (originX, originZ),
 * row by row: the height at column ix and row iz is at index iz * (cells + 1) + ix.
 */
export function terrainGrid(
  originX: number,
  originZ: number,
  sizeM: number,
  cells: number,
  seed: number,
): Float32Array {
  const stride = cells + 1;
  const heights = new Float32Array(stride * stride);
  const step = sizeM / cells;
  for (let iz = 0; iz <= cells; iz++) {
    for (let ix = 0; ix <= cells; ix++) {
      heights[iz * stride + ix] = terrainHeight(originX + ix * step, originZ + iz * step, seed);
    }
  }
  return heights;
}

/** Interpolates the same two triangles used to draw each terrain cell. */
export function terrainSurfaceHeight(x: number, z: number, seed: number): number {
  const step = CHUNK_SIZE_M / TERRAIN_CELLS_PER_CHUNK;
  const x0 = Math.floor(x / step) * step;
  const z0 = Math.floor(z / step) * step;
  const fx = (x - x0) / step;
  const fz = (z - z0) / step;
  const h00 = Math.fround(terrainHeight(x0, z0, seed));
  const h10 = Math.fround(terrainHeight(x0 + step, z0, seed));
  const h01 = Math.fround(terrainHeight(x0, z0 + step, seed));
  if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
  const h11 = Math.fround(terrainHeight(x0 + step, z0 + step, seed));
  return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
}

/** Rock on steep ground; otherwise lowland or highland by height. */
export function groundKind(heightM: number, slopeDeg: number): GroundKind {
  if (slopeDeg >= ROCK_SLOPE_DEG) return 'rock';
  return heightM >= HIGHLAND_HEIGHT_M ? 'highland' : 'lowland';
}

const SLOPE_STEP_M = 1;

/** Steepness of the ground at a point, in degrees from flat. */
export function slopeDegAt(x: number, z: number, seed: number): number {
  const gradientX =
    (terrainHeight(x + SLOPE_STEP_M, z, seed) - terrainHeight(x - SLOPE_STEP_M, z, seed)) /
    (2 * SLOPE_STEP_M);
  const gradientZ =
    (terrainHeight(x, z + SLOPE_STEP_M, seed) - terrainHeight(x, z - SLOPE_STEP_M, seed)) /
    (2 * SLOPE_STEP_M);
  return (Math.atan(Math.hypot(gradientX, gradientZ)) * 180) / Math.PI;
}

import * as THREE from 'three';
import {
  CHUNK_SIZE_M,
  chunkAt,
  chunkDistance,
  chunkKey,
  chunkOrigin,
  isDetailed,
  planChunks,
  type ChunkCoord,
} from '../engine/chunks';
import {
  COARSE_TERRAIN_CELLS_PER_CHUNK,
  groundKind,
  terrainGrid,
  TERRAIN_CELLS_PER_CHUNK,
  type GroundKind,
} from '../engine/terrain';
import type { BuildBudget } from './budget';

const KEEP_MARGIN_CHUNKS = 2;
/**
 * How far each chunk edge drops below the ground. A detailed chunk and a coarse
 * neighbour cut the same edge at different points, so the edge can sit a metre or
 * two off the other; the skirt hides that gap.
 */
export const SKIRT_DEPTH_M = 4;
const UP = new THREE.Vector3(0, 1, 0);

const PALETTE: Record<GroundKind, THREE.Color> = {
  lowland: new THREE.Color(0x7d9a6b),
  highland: new THREE.Color(0xb49c72),
  rock: new THREE.Color(0x6e6463),
};

interface LoadedChunk {
  coord: ChunkCoord;
  detailed: boolean;
  mesh: THREE.Mesh;
}

/**
 * The ground of one chunk: a grid of `cells` × `cells` cells with two triangles each,
 * flat-shaded, and a skirt of rock hanging from each of the four edges.
 */
export function terrainChunkGeometry(coord: ChunkCoord, seed: number, cells: number): THREE.BufferGeometry {
  const origin = chunkOrigin(coord, CHUNK_SIZE_M);
  const heights = terrainGrid(origin.x, origin.z, CHUNK_SIZE_M, cells, seed);
  const stride = cells + 1;
  const step = CHUNK_SIZE_M / cells;
  const corner = (ix: number, iz: number): THREE.Vector3 =>
    new THREE.Vector3(origin.x + ix * step, heights[iz * stride + ix], origin.z + iz * step);

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, facing: THREE.Vector3): void => {
    let normal = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b, a),
      new THREE.Vector3().subVectors(c, a),
    );
    const flip = normal.dot(facing) < 0;
    if (flip) normal = normal.negate();
    normal.normalize();
    const slopeDeg = (Math.acos(Math.min(1, Math.abs(normal.y))) * 180) / Math.PI;
    const meanHeight = (a.y + b.y + c.y) / 3;
    const colour = PALETTE[groundKind(meanHeight, slopeDeg)];
    for (const point of flip ? [a, c, b] : [a, b, c]) {
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(colour.r, colour.g, colour.b);
    }
  };
  const addSkirt = (a: THREE.Vector3, b: THREE.Vector3, outward: THREE.Vector3): void => {
    const drop = new THREE.Vector3(0, -SKIRT_DEPTH_M, 0);
    const aDown = a.clone().add(drop);
    const bDown = b.clone().add(drop);
    addTriangle(a, b, bDown, outward);
    addTriangle(a, bDown, aDown, outward);
  };

  for (let iz = 0; iz < cells; iz++) {
    for (let ix = 0; ix < cells; ix++) {
      const p00 = corner(ix, iz);
      const p10 = corner(ix + 1, iz);
      const p01 = corner(ix, iz + 1);
      const p11 = corner(ix + 1, iz + 1);
      addTriangle(p00, p01, p10, UP);
      addTriangle(p10, p01, p11, UP);
    }
  }
  for (let i = 0; i < cells; i++) {
    addSkirt(corner(i, 0), corner(i + 1, 0), new THREE.Vector3(0, 0, -1));
    addSkirt(corner(i + 1, cells), corner(i, cells), new THREE.Vector3(0, 0, 1));
    addSkirt(corner(0, i + 1), corner(0, i), new THREE.Vector3(-1, 0, 0));
    addSkirt(corner(cells, i), corner(cells, i + 1), new THREE.Vector3(1, 0, 0));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Builds the ground chunks around the player, at full or coarse detail, and drops the ones left behind. */
export class TerrainStreamer {
  private readonly chunks = new Map<string, LoadedChunk>();
  private readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
  });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly seed: number,
  ) {}

  /**
   * Keeps the chunks within `radiusChunks` of (x, z) built at the right detail. Chunks
   * that changed detail are rebuilt, nearest first, while the budget lasts.
   */
  update(x: number, z: number, radiusChunks: number, budget: BuildBudget): void {
    const centre = chunkAt(x, z, CHUNK_SIZE_M);
    const plan = planChunks(this.loadedCoords(), centre, radiusChunks, radiusChunks + KEEP_MARGIN_CHUNKS);
    for (const coord of plan.drop) this.remove(coord);
    const restyled = [...this.chunks.values()]
      .filter((chunk) => chunk.detailed !== isDetailed(chunk.coord, centre))
      .map((chunk) => chunk.coord);
    const work = [...restyled, ...plan.load].sort(
      (a, b) => chunkDistance(a, centre) - chunkDistance(b, centre),
    );
    for (const coord of work) {
      if (!budget.tryStart()) break;
      this.add(coord, isDetailed(coord, centre));
    }
  }

  loadedCoords(): ChunkCoord[] {
    return [...this.chunks.values()].map((chunk) => chunk.coord);
  }

  /** The chunks whose ground is at full detail, where plants and animals stand. */
  detailedCoords(): ChunkCoord[] {
    return [...this.chunks.values()].filter((chunk) => chunk.detailed).map((chunk) => chunk.coord);
  }

  dispose(): void {
    for (const chunk of [...this.chunks.values()]) this.remove(chunk.coord);
    this.material.dispose();
  }

  private add(coord: ChunkCoord, detailed: boolean): void {
    this.remove(coord);
    const cells = detailed ? TERRAIN_CELLS_PER_CHUNK : COARSE_TERRAIN_CELLS_PER_CHUNK;
    const mesh = new THREE.Mesh(terrainChunkGeometry(coord, this.seed, cells), this.material);
    this.scene.add(mesh);
    this.chunks.set(chunkKey(coord), { coord, detailed, mesh });
  }

  private remove(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    this.chunks.delete(key);
  }
}

export const CHUNK_SIZE_M = 64;

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface ChunkPlan {
  load: ChunkCoord[];
  drop: ChunkCoord[];
}

export function chunkKey({ cx, cz }: ChunkCoord): string {
  return `${cx},${cz}`;
}

export function chunkAt(x: number, z: number, sizeM: number): ChunkCoord {
  return { cx: Math.floor(x / sizeM), cz: Math.floor(z / sizeM) };
}

/** The corner of a chunk with the smallest x and z, in metres. */
export function chunkOrigin({ cx, cz }: ChunkCoord, sizeM: number): { x: number; z: number } {
  return { x: cx * sizeM, z: cz * sizeM };
}

/**
 * Plans which chunks to build and which to drop, around the player's chunk.
 * Chunks within `loadRadius` (in chunks) are wanted, nearest first. Loaded chunks
 * beyond `keepRadius` are dropped; the gap between the two radii avoids flicker
 * at the edge.
 */
export function planChunks(
  loaded: readonly ChunkCoord[],
  centre: ChunkCoord,
  loadRadius: number,
  keepRadius: number,
): ChunkPlan {
  const loadedKeys = new Set(loaded.map(chunkKey));
  const load: ChunkCoord[] = [];
  for (let dz = -loadRadius; dz <= loadRadius; dz++) {
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      const coord = { cx: centre.cx + dx, cz: centre.cz + dz };
      if (!loadedKeys.has(chunkKey(coord))) load.push(coord);
    }
  }
  load.sort((a, b) => chunkDistance(a, centre) - chunkDistance(b, centre));
  const drop = loaded.filter((coord) => chunkDistance(coord, centre) > keepRadius);
  return { load, drop };
}

/** Distance between two chunks, in chunks, counting diagonal neighbours as one step. */
export function chunkDistance(a: ChunkCoord, b: ChunkCoord): number {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cz - b.cz));
}

/**
 * Chunks within this many chunks of the player are detailed: full terrain, plus the
 * plants and animals on it. Farther chunks have coarser ground and no life.
 */
export const DETAIL_RADIUS_CHUNKS = 2;

export function isDetailed(coord: ChunkCoord, centre: ChunkCoord): boolean {
  return chunkDistance(coord, centre) <= DETAIL_RADIUS_CHUNKS;
}

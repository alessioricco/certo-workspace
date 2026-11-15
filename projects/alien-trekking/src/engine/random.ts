/** Mulberry32: returns a generator of pseudo-random numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number drawn from a generator, evenly spread between min and max. */
export function uniform(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

/** A seed derived from a level's seed and some numbers, such as a chunk's coordinates, so each part of a world has its own stream. */
export function mixSeed(...values: number[]): number {
  let hash = 0x9e3779b9;
  for (const value of values) {
    hash = Math.imul(hash ^ (value | 0), 0x85ebca6b);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

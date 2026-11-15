import { mulberry32 } from './random';

const STAR_SEED_SALT = 0x5ca1ab1e;

export interface StarField {
  /** Unit directions, three numbers per star, y up. */
  directions: Float32Array;
  /** From 0.3 (faint) to 1 (bright). */
  brightness: Float32Array;
}

/**
 * Stars spread over the upper sky, from the seed. The stars are not sorted, so the
 * first n of them are a random sample: a thick atmosphere shows only the first few.
 */
export function starField(seed: number, count: number): StarField {
  const random = mulberry32(seed ^ STAR_SEED_SALT);
  const directions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const height = random();
    const azimuth = random() * 2 * Math.PI;
    const ring = Math.sqrt(1 - height * height);
    directions[i * 3] = ring * Math.cos(azimuth);
    directions[i * 3 + 1] = height;
    directions[i * 3 + 2] = ring * Math.sin(azimuth);
    brightness[i] = 0.3 + 0.7 * random() ** 3;
  }
  return { directions, brightness };
}

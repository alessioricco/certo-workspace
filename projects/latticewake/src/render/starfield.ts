import { Xorshift32 } from '../math/random';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../game/tuning';

export const STAR_COUNT = 72;
export const VISUAL_SALT = 0x9e3779b9;

export interface Star {
  x: number;
  y: number;
  layer: number;
}

export class Starfield {
  readonly stars: readonly Star[] = Array.from({ length: STAR_COUNT }, () => ({ x: 0, y: 0, layer: 0 }));

  constructor(seed: number) { this.reset(seed); }

  reset(seed: number): void {
    const random = new Xorshift32((seed ^ VISUAL_SALT) >>> 0);
    for (const star of this.stars) {
      star.x = 8 + random.nextUint32() % (FIELD_WIDTH - 16);
      star.y = random.nextUint32() % FIELD_HEIGHT;
      star.layer = random.nextUint32() % 3;
    }
  }

  x(star: Readonly<Star>, playerX: number): number {
    return ((star.x - (playerX - FIELD_WIDTH / 2) * (star.layer + 1) * 0.035) % FIELD_WIDTH + FIELD_WIDTH) % FIELD_WIDTH;
  }

  y(star: Readonly<Star>, tick: number): number {
    return (star.y + tick * (star.layer + 1) * 0.18) % FIELD_HEIGHT;
  }
}

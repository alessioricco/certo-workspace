import { at } from '../math/indexed';
export const PARTICLE_CAPACITY = 512;
const DIRECTIONS: readonly number[] = [60, 0, 52, 30, 30, 52, 0, 60, -30, 52, -52, 30, -60, 0, -52, -30, -30, -52, 0, -60, 30, -52, 52, -30];
export interface Particle {
  active: boolean; x: number; y: number; previousX: number; previousY: number;
  velocityX: number; velocityY: number; remaining: number;
}

export class ParticlePool {
  readonly slots: readonly Particle[] = Array.from({ length: PARTICLE_CAPACITY }, () => ({
    active: false, x: 0, y: 0, previousX: 0, previousY: 0, velocityX: 0, velocityY: 0, remaining: 0,
  }));
  count = 0;
  peak = 0;
  dropped = 0;

  reset(): void {
    for (const particle of this.slots) particle.active = false;
    this.count = 0;
    this.peak = 0;
    this.dropped = 0;
  }

  burst(x: number, y: number): void {
    let emitted = 0;
    for (const particle of this.slots) {
      if (emitted === 12) break;
      if (particle.active) continue;
      particle.active = true;
      particle.x = particle.previousX = x;
      particle.y = particle.previousY = y;
      particle.velocityX = at(DIRECTIONS, emitted * 2);
      particle.velocityY = at(DIRECTIONS, emitted * 2 + 1);
      particle.remaining = 30;
      emitted++;
    }
    this.count += emitted;
    this.dropped += 12 - emitted;
    this.peak = Math.max(this.peak, this.count);
  }

  step(): void {
    for (const particle of this.slots) {
      if (!particle.active) continue;
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      particle.x += particle.velocityX / 60;
      particle.y += particle.velocityY / 60;
      if (--particle.remaining === 0) { particle.active = false; this.count--; }
    }
  }
}

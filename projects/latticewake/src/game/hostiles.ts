import { CollisionLayer } from './layers';
import { FIELD_HEIGHT, FIELD_WIDTH, quantize } from './tuning';

export const HOSTILE_CAPACITY = 128;
export const HOSTILE_RADIUS = 4;
export interface HostileShot {
  readonly layer: number;
  active: boolean; id: number; generation: number; owner: number; marked: boolean;
  x: number; y: number; previousX: number; previousY: number;
  velocityX: number; velocityY: number;
}

export class HostilePool {
  readonly slots: readonly HostileShot[] = Array.from({ length: HOSTILE_CAPACITY }, () => ({
    layer: CollisionLayer.HostileShot, active: false, id: 0, generation: 0, owner: 0, marked: false,
    x: 0, y: 0, previousX: 0, previousY: 0, velocityX: 0, velocityY: 0,
  }));
  count = 0;
  peak = 0;
  deferred = 0;
  fired = 0;
  private nextId = 1;

  clear(): void {
    for (const shot of this.slots) shot.active = false;
    this.count = 0;
  }

  clearOwner(owner: number): void {
    for (let index = 0; index < this.slots.length; index++) {
      const shot = this.slots[index];
      if (shot?.active && shot.owner === owner) this.release(index, shot.generation);
    }
  }

  reset(): void {
    this.clear();
    this.peak = this.deferred = this.fired = 0;
    this.nextId = 1;
  }

  spawn(x: number, y: number, velocityX: number, velocityY: number, owner: number, cap = HOSTILE_CAPACITY, marked = false): boolean {
    if (this.count >= cap || this.count === HOSTILE_CAPACITY) { this.deferred++; return false; }
    for (const shot of this.slots) {
      if (shot.active) continue;
      shot.active = true;
      shot.id = this.nextId++;
      shot.generation++;
      shot.owner = owner;
      shot.marked = marked;
      shot.x = shot.previousX = quantize(x);
      shot.y = shot.previousY = quantize(y);
      shot.velocityX = quantize(velocityX);
      shot.velocityY = quantize(velocityY);
      this.count++;
      this.fired++;
      this.peak = Math.max(this.peak, this.count);
      return true;
    }
    return false;
  }

  release(index: number, generation: number): boolean {
    const shot = this.slots[index];
    if (!shot?.active || shot.generation !== generation) return false;
    shot.active = false;
    this.count--;
    return true;
  }

  step(): void {
    for (const shot of this.slots) {
      if (!shot.active) continue;
      shot.previousX = shot.x;
      shot.previousY = shot.y;
      shot.x = quantize(shot.x + shot.velocityX / 60);
      shot.y = quantize(shot.y + shot.velocityY / 60);
    }
  }

  expire(): void {
    for (let index = 0; index < this.slots.length; index++) {
      const shot = this.slots[index];
      if (shot?.active && (shot.x < -HOSTILE_RADIUS || shot.x > FIELD_WIDTH + HOSTILE_RADIUS
        || shot.y < -HOSTILE_RADIUS || shot.y > FIELD_HEIGHT + HOSTILE_RADIUS)) this.release(index, shot.generation);
    }
  }

  clearNear(x: number, y: number, radius: number): void {
    for (let index = 0; index < this.slots.length; index++) {
      const shot = this.slots[index];
      if (shot?.active && (shot.x - x) ** 2 + (shot.y - y) ** 2 <= radius ** 2) this.release(index, shot.generation);
    }
  }
}

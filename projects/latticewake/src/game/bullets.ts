import { CollisionLayer } from './layers';
import { BULLET_CAPACITY, BULLET_RADIUS, BULLET_SPEED, FIELD_WIDTH, quantize } from './tuning';

export interface Bullet {
  readonly layer: number;
  active: boolean;
  id: number;
  generation: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  velocityX: number;
}

export class BulletPool {
  readonly slots: readonly Bullet[] = Array.from({ length: BULLET_CAPACITY }, () => ({
    layer: CollisionLayer.PlayerShot, active: false, id: 0, generation: 0, x: 0, y: 0, previousX: 0, previousY: 0, velocityX: 0,
  }));
  count = 0;
  peak = 0;
  deniedVolleys = 0;
  private nextId = 1;

  clear(): void {
    for (const bullet of this.slots) bullet.active = false;
    this.count = 0;
  }

  reset(): void {
    this.clear();
    this.peak = 0;
    this.deniedVolleys = 0;
    this.nextId = 1;
  }

  spawnVolley(x: number, y: number, velocitiesX: readonly number[], offsetsX?: readonly number[]): boolean {
    if (velocitiesX.length > BULLET_CAPACITY - this.count) {
      this.deniedVolleys++;
      return false;
    }
    let shot = 0;
    for (const bullet of this.slots) {
      if (shot === velocitiesX.length) break;
      if (bullet.active) continue;
      bullet.active = true;
      bullet.id = this.nextId++;
      bullet.generation++;
      bullet.x = bullet.previousX = quantize(x + (offsetsX?.[shot] ?? 0));
      bullet.y = bullet.previousY = quantize(y);
      bullet.velocityX = velocitiesX[shot++] ?? 0;
    }
    this.count += velocitiesX.length;
    this.peak = Math.max(this.peak, this.count);
    return true;
  }

  release(index: number, generation: number): boolean {
    const bullet = this.slots[index];
    if (!bullet?.active || bullet.generation !== generation) return false;
    bullet.active = false;
    this.count--;
    return true;
  }

  step(expire = true): void {
    for (let index = 0; index < this.slots.length; index++) {
      const bullet = this.slots[index];
      if (!bullet?.active) continue;
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x = quantize(bullet.x + bullet.velocityX / 60);
      bullet.y = quantize(bullet.y - BULLET_SPEED / 60);
    }
    if (expire) this.expireOffscreen();
  }

  expireOffscreen(): void {
    for (let index = 0; index < this.slots.length; index++) {
      const bullet = this.slots[index];
      if (!bullet?.active) continue;
      if (bullet.y < -BULLET_RADIUS || bullet.x < -BULLET_RADIUS || bullet.x > FIELD_WIDTH + BULLET_RADIUS) {
        this.release(index, bullet.generation);
      }
    }
  }
}

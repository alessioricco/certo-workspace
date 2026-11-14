import { at } from '../math/indexed';
import { sweptCircleTime } from '../math/collision';
import type { BulletPool } from './bullets';
import { ENEMY_CAPACITY, type EnemyPool } from './enemies';
import { BULLET_CAPACITY, BULLET_RADIUS, FIELD_HEIGHT, FIELD_WIDTH } from './tuning';

import { collides } from './layers';
export { CollisionLayer, collides } from './layers';

const CELL_SIZE = 64;
const COLUMNS = Math.ceil(FIELD_WIDTH / CELL_SIZE);
const ROWS = Math.ceil(FIELD_HEIGHT / CELL_SIZE);

export class SweptGrid {
  private readonly counts = new Uint8Array(COLUMNS * ROWS);
  private readonly cells = new Uint8Array(COLUMNS * ROWS * ENEMY_CAPACITY);
  private readonly seen = new Uint8Array(ENEMY_CAPACITY);
  readonly results = new Uint8Array(ENEMY_CAPACITY);
  peakCell = 0;

  rebuild(pool: EnemyPool): void {
    this.counts.fill(0);
    this.peakCell = 0;
    for (let index = 0; index < pool.slots.length; index++) {
      const enemy = at(pool.slots, index);
      if (!enemy.active || enemy.state === 'queued') continue;
      const left = Math.max(0, Math.floor((Math.min(enemy.previousX, enemy.x) - enemy.radius) / CELL_SIZE));
      const right = Math.min(COLUMNS - 1, Math.floor((Math.max(enemy.previousX, enemy.x) + enemy.radius) / CELL_SIZE));
      const top = Math.max(0, Math.floor((Math.min(enemy.previousY, enemy.y) - enemy.radius) / CELL_SIZE));
      const bottom = Math.min(ROWS - 1, Math.floor((Math.max(enemy.previousY, enemy.y) + enemy.radius) / CELL_SIZE));
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          const cell = y * COLUMNS + x;
          const count = at(this.counts, cell);
          this.cells[cell * ENEMY_CAPACITY + count] = index;
          this.counts[cell] = count + 1;
          this.peakCell = Math.max(this.peakCell, count + 1);
        }
      }
    }
  }

  query(left: number, top: number, right: number, bottom: number): number {
    this.seen.fill(0);
    const fromX = Math.max(0, Math.floor(left / CELL_SIZE));
    const toX = Math.min(COLUMNS - 1, Math.floor(right / CELL_SIZE));
    const fromY = Math.max(0, Math.floor(top / CELL_SIZE));
    const toY = Math.min(ROWS - 1, Math.floor(bottom / CELL_SIZE));
    let found = 0;
    for (let y = fromY; y <= toY; y++) {
      for (let x = fromX; x <= toX; x++) {
        const cell = y * COLUMNS + x;
        for (let candidate = 0; candidate < at(this.counts, cell); candidate++) {
          const index = at(this.cells, cell * ENEMY_CAPACITY + candidate);
          if (this.seen[index]) continue;
          this.seen[index] = 1;
          this.results[found++] = index;
        }
      }
    }
    return found;
  }
}

interface Contact {
  time: number; bullet: number; bulletId: number; bulletGeneration: number;
  enemy: number; enemyId: number; enemyGeneration: number;
}
export interface HitReceiver { hit(index: number, generation: number): boolean }

function compare(a: Contact, b: Contact): number {
  return a.time - b.time || a.bulletId - b.bulletId || a.enemyId - b.enemyId;
}

export class CollisionSystem {
  readonly grid = new SweptGrid();
  private readonly contacts: Contact[] = Array.from({ length: BULLET_CAPACITY * ENEMY_CAPACITY }, () => ({
    time: 0, bullet: 0, bulletId: 0, bulletGeneration: 0, enemy: 0, enemyId: 0, enemyGeneration: 0,
  }));
  count = 0;

  resolve(bullets: BulletPool, enemies: EnemyPool, receiver: HitReceiver): void {
    this.count = 0;
    this.grid.rebuild(enemies);
    for (let index = 0; index < bullets.slots.length; index++) {
      const bullet = at(bullets.slots, index);
      if (!bullet.active) continue;
      const found = this.grid.query(Math.min(bullet.previousX, bullet.x) - BULLET_RADIUS,
        Math.min(bullet.previousY, bullet.y) - BULLET_RADIUS, Math.max(bullet.previousX, bullet.x) + BULLET_RADIUS,
        Math.max(bullet.previousY, bullet.y) + BULLET_RADIUS);
      for (let candidate = 0; candidate < found; candidate++) {
        const enemyIndex = at(this.grid.results, candidate);
        const enemy = at(enemies.slots, enemyIndex);
        const time = sweptCircleTime(bullet.previousX, bullet.previousY, bullet.x, bullet.y,
          enemy.previousX, enemy.previousY, enemy.x, enemy.y, BULLET_RADIUS + enemy.radius);
        if (time === Infinity || !collides(bullet.layer, enemy.layer)) continue;
        const contact = at(this.contacts, this.count++);
        contact.time = time;
        contact.bullet = index;
        contact.bulletId = bullet.id;
        contact.bulletGeneration = bullet.generation;
        contact.enemy = enemyIndex;
        contact.enemyId = enemy.id;
        contact.enemyGeneration = enemy.generation;
      }
    }
    this.sort();
    for (let index = 0; index < this.count; index++) {
      const contact = at(this.contacts, index);
      const bullet = at(bullets.slots, contact.bullet);
      const enemy = at(enemies.slots, contact.enemy);
      if (!bullet.active || bullet.generation !== contact.bulletGeneration
        || !enemy.active || enemy.generation !== contact.enemyGeneration) continue;
      if (receiver.hit(contact.enemy, contact.enemyGeneration)) bullets.release(contact.bullet, contact.bulletGeneration);
    }
  }

  private sort(): void {
    for (let root = Math.floor(this.count / 2) - 1; root >= 0; root--) this.sift(root, this.count);
    for (let end = this.count - 1; end > 0; end--) {
      const item = at(this.contacts, 0);
      this.contacts[0] = at(this.contacts, end);
      this.contacts[end] = item;
      this.sift(0, end);
    }
  }

  private sift(root: number, end: number): void {
    while (root * 2 + 1 < end) {
      let child = root * 2 + 1;
      if (child + 1 < end && compare(at(this.contacts, child), at(this.contacts, child + 1)) < 0) child++;
      if (compare(at(this.contacts, root), at(this.contacts, child)) >= 0) return;
      const item = at(this.contacts, root);
      this.contacts[root] = at(this.contacts, child);
      this.contacts[child] = item;
      root = child;
    }
  }
}

import { at } from '../math/indexed';
import { CollisionLayer } from './layers';
export const ENEMY_CAPACITY = 48;
export type EnemyKind = 'shardlet' | 'spindle' | 'bellframe';
export type EnemyState = 'queued' | 'entry' | 'formation' | 'warning' | 'diving' | 'returning' | 'exiting';

export abstract class Enemy {
  readonly layer = CollisionLayer.Enemy;
  abstract readonly kind: EnemyKind;
  abstract readonly maxHP: number;
  abstract readonly radius: number;
  abstract readonly points: number;
  abstract readonly sprite: number;
  active = false;
  id = 0;
  generation = 0;
  hp = 0;
  slot = -1;
  state: EnemyState = 'queued';
  launchTick = 0;
  pathId = 0;
  x = 0;
  y = 0;
  previousX = 0;
  previousY = 0;
  hitTicks = 0;
  attackCooldown = 0;
  attackTick = 0;
  originX = 0;
  originY = 0;
  targetX = 0;
  targetY = 0;
  shotPending = false;

  damage(): boolean {
    this.hp--;
    this.hitTicks = 10;
    return this.hp === 0;
  }
}

export class Shardlet extends Enemy {
  readonly kind = 'shardlet';
  readonly maxHP = 1;
  readonly radius = 12;
  readonly points = 100;
  readonly sprite = 0;
}

export class Spindle extends Enemy {
  readonly kind = 'spindle';
  readonly maxHP = 2;
  readonly radius = 14;
  readonly points = 180;
  readonly sprite = 1;
}

export class Bellframe extends Enemy {
  readonly kind = 'bellframe';
  readonly maxHP = 3;
  readonly radius = 16;
  readonly points = 300;
  readonly sprite = 2;
}

export class EnemyPool {
  readonly slots: readonly Enemy[] = Array.from({ length: ENEMY_CAPACITY }, (_, index) =>
    index % 3 === 0 ? new Shardlet() : index % 3 === 1 ? new Spindle() : new Bellframe());
  count = 0;
  denied = 0;
  private nextId = 1;

  reset(): void {
    for (const enemy of this.slots) {
      enemy.active = false;
      enemy.state = 'queued';
      enemy.hp = 0;
      enemy.hitTicks = 0;
      enemy.id = 0;
      enemy.x = enemy.previousX = 0;
      enemy.y = enemy.previousY = 0;
      enemy.attackCooldown = 0;
      enemy.attackTick = 0;
      enemy.originX = enemy.originY = enemy.targetX = enemy.targetY = 0;
      enemy.shotPending = false;
    }
    this.count = 0;
    this.denied = 0;
    this.nextId = 1;
  }

  spawn(kind: EnemyKind, slot: number, launchTick: number, pathId: number, x: number, y: number): number {
    for (let index = 0; index < this.slots.length; index++) {
      const enemy = at(this.slots, index);
      if (enemy.active || enemy.kind !== kind) continue;
      enemy.active = true;
      enemy.id = this.nextId++;
      enemy.generation++;
      enemy.hp = enemy.maxHP;
      enemy.slot = slot;
      enemy.state = 'queued';
      enemy.launchTick = launchTick;
      enemy.pathId = pathId;
      enemy.x = enemy.previousX = x;
      enemy.y = enemy.previousY = y;
      enemy.hitTicks = 0;
      enemy.attackCooldown = 0;
      enemy.attackTick = 0;
      enemy.originX = enemy.originY = enemy.targetX = enemy.targetY = 0;
      enemy.shotPending = false;
      this.count++;
      return index;
    }
    this.denied++;
    return -1;
  }

  release(index: number, generation: number): boolean {
    const enemy = this.slots[index];
    if (!enemy?.active || enemy.generation !== generation) return false;
    enemy.active = false;
    this.count--;
    return true;
  }
}

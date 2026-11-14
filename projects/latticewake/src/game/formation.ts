import { at } from '../math/indexed';
import { ENTRY_LEFT, ENTRY_RIGHT, ENTRY_TICKS, swayX } from '../math/paths';
import { Xorshift32 } from '../math/random';
import type { BulletPool } from './bullets';
import { CollisionSystem } from './collisions';
import { EnemyPool, type EnemyKind } from './enemies';
import { HitEvents } from './events';
import { quantize } from './tuning';
import type { StageConfig } from './stages';

const KINDS: readonly EnemyKind[] = ['shardlet', 'spindle', 'bellframe'];
export const FORMATION_SIZE = 24;
export interface FormationSlot {
  x: number; y: number; owner: number; generation: number;
  state: 'empty' | 'reserved' | 'occupied' | 'destroyed';
}

export class Formation {
  readonly enemies = new EnemyPool();
  readonly collisions = new CollisionSystem();
  readonly events = new HitEvents();
  readonly slots: readonly FormationSlot[] = Array.from({ length: FORMATION_SIZE }, (_, index) => ({
    x: 55 + index % 6 * 50, y: 96 + Math.floor(index / 6) * 50,
    owner: -1, generation: 0, state: 'empty',
  }));
  score = 0;
  kills = 0;
  hits = 0;
  private tick = 0;
  private targetCount = FORMATION_SIZE;
  private entryTicks = ENTRY_TICKS;
  private bonus = false;
  get cleared(): boolean { return this.kills === this.targetCount; }

  get damaged(): number {
    let count = 0;
    for (const enemy of this.enemies.slots) if (enemy.active && enemy.hp < (this.bonus ? 1 : enemy.maxHP)) count++;
    return count;
  }

  reset(seed: number, stage?: StageConfig): void {
    const random = new Xorshift32(seed);
    this.enemies.reset();
    this.events.reset();
    this.collisions.count = 0;
    this.score = 0;
    this.kills = 0;
    this.hits = 0;
    this.tick = 0;
    this.targetCount = stage?.layout.length ?? FORMATION_SIZE;
    this.entryTicks = stage?.entryTicks ?? ENTRY_TICKS;
    this.bonus = stage?.kind === 'bonus';
    for (const slot of this.slots) { slot.state = 'empty'; slot.owner = -1; slot.generation = 0; }
    for (let index = 0; index < this.targetCount; index++) {
      const path = random.nextUint32() & 1;
      if (!this.reserve(index, stage ? at(stage.layout, index) : at(KINDS, (index + Math.floor(index / 6)) % 3),
        1 + index * (stage?.entrySpacing ?? 6), stage ? at(stage.pathIds, path) : path)) {
        throw new Error('Formation exceeds enemy capacity.');
      }
      if (this.bonus) at(this.enemies.slots, at(this.slots, index).owner).hp = 1;
    }
  }

  reserve(index: number, kind: EnemyKind, launchTick: number, pathId: number): boolean {
    const slot = this.slots[index];
    if (!slot || slot.state !== 'empty') return false;
    const owner = this.enemies.spawn(kind, index, launchTick, pathId, slot.x, slot.y);
    if (owner < 0) return false;
    slot.owner = owner;
    slot.generation = at(this.enemies.slots, owner).generation;
    slot.state = 'reserved';
    return true;
  }

  step(bullets: BulletPool, tick: number): void {
    this.advance(tick);
    this.resolve(bullets);
  }

  resolve(bullets: BulletPool): void { this.collisions.resolve(bullets, this.enemies, this); }

  advance(tick: number): void {
    this.tick = tick;
    this.events.begin();
    
    for (let index = 0; index < this.enemies.slots.length; index++) {
      const enemy = at(this.enemies.slots, index);
      if (!enemy.active) continue;
      if (enemy.hitTicks > 0) enemy.hitTicks--;
      if (enemy.state === 'diving' || enemy.state === 'returning' || enemy.state === 'exiting') continue;
      const age = tick - enemy.launchTick;
      if (age < 0) continue;
      const slot = at(this.slots, enemy.slot);
      if (!slot || slot.owner !== index || slot.generation !== enemy.generation) continue;
      const sample = Math.min(ENTRY_TICKS, Math.floor(age * ENTRY_TICKS / this.entryTicks)) * 2;
      const path = enemy.pathId === 0 ? ENTRY_LEFT : ENTRY_RIGHT;
      const x = quantize(slot.x + swayX(tick) + at(path, sample));
      const y = quantize(slot.y + swayX(tick + 64) / 6 + at(path, sample + 1));
      enemy.previousX = enemy.state === 'queued' ? x : enemy.x;
      enemy.previousY = enemy.state === 'queued' ? y : enemy.y;
      enemy.x = x;
      enemy.y = y;
      if (enemy.state !== 'warning') enemy.state = age < this.entryTicks ? 'entry' : 'formation';
      if (enemy.state === 'formation') slot.state = 'occupied';

    }
  }

  hit(index: number, generation: number): boolean {
    const enemy = this.enemies.slots[index];
    if (!enemy?.active || enemy.generation !== generation || enemy.state === 'queued') return false;
    const slot = this.slots[enemy.slot];
    if (!slot || slot.owner !== index || slot.generation !== generation) return false;
    const destroyed = enemy.damage();
    this.hits++;
    this.events.push(destroyed ? 'destroy' : 'hit', this.tick, enemy.id, enemy.x, enemy.y);
    if (destroyed) {
      this.enemies.release(index, generation);
      slot.state = 'destroyed';
      this.score += this.bonus ? 150 : enemy.state === 'diving' || enemy.state === 'returning' || enemy.state === 'exiting'
        ? enemy.kind === 'shardlet' ? 180 : enemy.kind === 'spindle' ? 300 : 500 : enemy.points;
      this.kills++;
    }
    return true;
  }
}

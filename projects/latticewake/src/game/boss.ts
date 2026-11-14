import type { HitEvents } from './events';
import { sweptCircleTime } from '../math/collision';
import { at } from '../math/indexed';
import { swayX } from '../math/paths';
import type { BulletPool } from './bullets';
import type { HostilePool } from './hostiles';
import { BULLET_RADIUS, quantize } from './tuning';

export const BOSS_TUNING = {
  warning: 60, emitterHP: 8, gateHP: 16, finalHP: 20,
  hpPerIndex: 2, cadence: [90, 72, 54], speed: 150,
} as const;
export interface BossPart {
  id: number; x: number; y: number; previousX: number; previousY: number;
  hp: number; maxHP: number; radius: number;
}
interface BossContact { time: number; bullet: number; id: number; generation: number; part: number }

export class MeridianEngine {
  readonly parts: readonly BossPart[] = Array.from({ length: 3 }, (_, id) => ({
    id, x: 0, y: 0, previousX: 0, previousY: 0, hp: 0, maxHP: 0, radius: id === 2 ? 27 : 20,
  }));
  private readonly contacts: BossContact[] = Array.from({ length: 384 }, () => ({ time: 0, bullet: 0, id: 0, generation: 0, part: 0 }));
  active = false;
  defeated = false;
  phase = 1;
  warning = 0;
  index = 1;
  hits = 0;
  volleys = 0;
  private cooldown = 0;
  private age = 0;
  get owner(): number { return -100 - this.phase; }
  get points(): number { return 5000 + 500 * this.index; }
  get count(): number { return this.active ? 1 + Number(at(this.parts, 0).hp > 0) + Number(at(this.parts, 1).hp > 0) : 0; }
  get targets(): number { return this.active ? (this.phase === 1 ? Number(at(this.parts, 0).hp > 0) + Number(at(this.parts, 1).hp > 0) : 1) : 0; }
  vulnerable(part: BossPart): boolean { return this.active && this.warning === 0 && part.hp > 0 && (this.phase === 1 ? part.id < 2 : part.id === 2); }

  reset(stage = 0): void {
    this.active = stage > 0; this.defeated = false; this.index = Math.max(1, Math.floor(stage / 5));
    this.phase = 1; this.warning = BOSS_TUNING.warning;
    this.hits = this.volleys = this.cooldown = this.age = 0;
    const scale = Math.min(this.index - 1, 12) * BOSS_TUNING.hpPerIndex;
    for (const part of this.parts) {
      part.hp = part.maxHP = part.id < 2 ? BOSS_TUNING.emitterHP + scale : BOSS_TUNING.gateHP + scale * 2;
      part.x = part.previousX = 180 + (part.id === 0 ? -65 : part.id === 1 ? 65 : 0);
      part.y = part.previousY = 145;
    }
  }

  step(): void {
    if (!this.active) return;
    this.age++;
    if (this.warning > 0) this.warning--;
    if (this.cooldown > 0) this.cooldown--;
    const center = 180 + swayX(this.age * (this.phase === 3 ? 3 : 1)) * (this.phase === 3 ? 3 : 1);
    for (const part of this.parts) {
      part.previousX = part.x; part.previousY = part.y;
      part.x = quantize(center + (part.id === 0 ? -65 : part.id === 1 ? 65 : 0));
    }
  }

  fire(pool: HostilePool, cap: number, enabled: boolean): void {
    if (!enabled || !this.active || this.warning > 0 || this.cooldown > 0) return;
    const count = this.phase === 1 ? this.targets : 3;
    if (pool.count + count > cap) { pool.deferred++; return; }
    const pulse = this.volleys % 2 === 0;
    if (this.phase === 1) {
      for (const part of this.parts) if (part.id < 2 && part.hp > 0) pool.spawn(part.x, part.y + 28, 0, BOSS_TUNING.speed, this.owner, cap, pulse && part.id === 0);
    } else {
      const gate = at(this.parts, 2);
      const direction = this.phase === 3 ? (this.volleys % 2 === 0 ? -1 : 1) : 0;
      for (let shot = -1; shot <= 1; shot++) pool.spawn(gate.x, gate.y + 32,
        shot * 70 + direction * 35, BOSS_TUNING.speed, this.owner, cap, pulse && shot === 0);
    }
    this.volleys++;
    this.cooldown = at(BOSS_TUNING.cadence, this.phase - 1);
  }

  resolve(bullets: BulletPool, pool: HostilePool, events?: HitEvents, tick = 0): void {
    if (!this.active || this.warning > 0) return;
    let count = 0;
    for (let index = 0; index < bullets.slots.length; index++) {
      const bullet = at(bullets.slots, index);
      if (!bullet.active) continue;
      for (const part of this.parts) {
        if (!this.vulnerable(part)) continue;
        const time = sweptCircleTime(bullet.previousX, bullet.previousY, bullet.x, bullet.y,
          part.previousX, part.previousY, part.x, part.y, BULLET_RADIUS + part.radius);
        if (time === Infinity) continue;
        const contact = at(this.contacts, count++);
        contact.time = time; contact.bullet = index; contact.id = bullet.id;
        contact.generation = bullet.generation; contact.part = part.id;
      }
    }
    for (let index = 1; index < count; index++) {
      const contact = at(this.contacts, index);
      let position = index;
      while (position > 0) {
        const previous = at(this.contacts, position - 1);
        if (previous.time < contact.time || (previous.time === contact.time && (previous.id < contact.id
          || (previous.id === contact.id && previous.part <= contact.part)))) break;
        this.contacts[position] = previous; position--;
      }
      this.contacts[position] = contact;
    }
    for (let index = 0; index < count; index++) {
      const contact = at(this.contacts, index);
      const bullet = at(bullets.slots, contact.bullet);
      const part = at(this.parts, contact.part);
      if (!bullet.active || bullet.generation !== contact.generation || !this.vulnerable(part)) continue;
      bullets.release(contact.bullet, contact.generation); part.hp--; this.hits++;
      events?.push('boss-hit', tick, part.id, part.x, part.y);
      if (this.phase === 1 ? at(this.parts, 0).hp === 0 && at(this.parts, 1).hp === 0 : part.hp === 0) {
        pool.clearOwner(this.owner);
        if (this.phase === 3) { this.active = false; this.defeated = true; }
        else {
          this.phase++; events?.push('phase', tick, this.phase, part.x, part.y); this.warning = BOSS_TUNING.warning; this.cooldown = 0;
          if (this.phase === 3) {
            const gate = at(this.parts, 2);
            gate.hp = gate.maxHP = BOSS_TUNING.finalHP + Math.min(this.index - 1, 12) * BOSS_TUNING.hpPerIndex * 2;
          }
        }
      }
    }
  }
}

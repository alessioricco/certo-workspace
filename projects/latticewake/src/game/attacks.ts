import { at } from '../math/indexed';
import { sampleBezier, swayX } from '../math/paths';
import type { Enemy } from './enemies';
import type { Formation } from './formation';
import type { HostilePool } from './hostiles';
import type { StageConfig } from './stages';
import { difficulty } from './stages';
import { quantize } from './tuning';

const PATH_TICKS = 240;
const SHALLOW = sampleBezier([0, 0, 0.1, 0.4, 0.85, 0.85, 1, 1], PATH_TICKS);
const HOOK = sampleBezier([0, 0, 1.4, 0.15, -0.4, 0.85, 1, 1], PATH_TICKS);
const SWEEP = sampleBezier([0, 0, -0.8, 0.3, 1.4, 0.7, 1, 1], PATH_TICKS);
const RETURN = sampleBezier([0, 0, 0, 0.6, 1, 0.9, 1, 1], 90);

export class AttackDirector {
  private nextTick = 360;
  private cursor = 0;
  active = 0;
  peak = 0;
  launches = 0;

  reset(seed: number): void {
    this.nextTick = 360;
    this.cursor = seed % 24;
    this.active = this.peak = this.launches = 0;
  }

  step(formation: Formation, tick: number, playerX: number, config: StageConfig, stage: number, enabled: boolean): void {
    this.active = 0;
    for (const enemy of formation.enemies.slots) {
      if (!enemy.active) continue;
      if (enemy.attackCooldown > 0) enemy.attackCooldown--;
      if (!enabled) {
        enemy.shotPending = false;
        if (enemy.state === 'warning') enemy.state = 'formation';
      }
      if (enemy.state === 'warning' && tick - enemy.attackTick >= config.warningTicks) {
        enemy.state = 'diving';
        enemy.attackTick = tick;
        enemy.originX = enemy.x;
        enemy.originY = enemy.y;
        enemy.targetX = enemy.kind === 'bellframe' ? 360 - playerX : playerX;
        enemy.targetY = 620;
        enemy.shotPending = true;
        this.launches++;
      }
      if (enemy.state === 'diving') this.dive(enemy, tick, stage);
      else if (enemy.state === 'returning') this.returnToSlot(enemy, formation, tick);
      else if (enemy.state === 'exiting') {
        enemy.previousX = enemy.x;
        enemy.previousY = enemy.y;
        enemy.y = quantize(enemy.y + 5);
        if (enemy.y > 690) {
          enemy.state = 'queued';
          enemy.launchTick = tick + 30;
          at(formation.slots, enemy.slot).state = 'reserved';
        }
      }
      if (enemy.state === 'warning' || enemy.state === 'diving' || enemy.state === 'returning' || enemy.state === 'exiting') this.active++;
    }
    if (enabled && tick >= this.nextTick && this.active < config.maxDivers) {
      for (let attempt = 0; attempt < formation.slots.length; attempt++) {
        const slot = at(formation.slots, this.cursor++ % formation.slots.length);
        const enemy = formation.enemies.slots[slot.owner];
        if (!enemy?.active || enemy.generation !== slot.generation || enemy.state !== 'formation'
          || !config.attackKinds.includes(enemy.kind)) continue;
        enemy.state = 'warning';
        enemy.attackTick = tick;
        slot.state = 'reserved';
        this.nextTick = tick + config.diveCadence;
        this.active++;
        break;
      }
    }
    this.peak = Math.max(this.peak, this.active);
  }

  fire(formation: Formation, pool: HostilePool, config: StageConfig, enabled: boolean): void {
    if (!enabled) return;
    for (const enemy of formation.enemies.slots) {
      if (!enemy.active || enemy.state !== 'diving' || enemy.y > 480 || enemy.attackCooldown > 0) continue;
      let vx = 0;
      let vy = config.shotSpeed;
      if (enemy.kind === 'spindle') {
        const dx = enemy.targetX - enemy.x;
        const dy = Math.max(80, enemy.targetY - 40 - enemy.y);
        const length = Math.sqrt(dx * dx + dy * dy);
        vx = dx / length * config.shotSpeed;
        vy = dy / length * config.shotSpeed;
      }
      if (pool.spawn(enemy.x, enemy.y + 20, vx, vy, enemy.id, config.hostileCap, enemy.kind === 'bellframe')) {
        enemy.attackCooldown = config.shotInterval;
        enemy.shotPending = false;
      } else enemy.shotPending = true;
    }
  }

  private dive(enemy: Enemy, tick: number, stage: number): void {
    const base = enemy.kind === 'shardlet' ? 150 : enemy.kind === 'spindle' ? 195 : 240;
    const duration = Math.max(90, Math.round(base / difficulty(stage)));
    const age = tick - enemy.attackTick;
    const sample = Math.min(PATH_TICKS, Math.floor(age * PATH_TICKS / duration)) * 2;
    const path = enemy.kind === 'shardlet' ? SHALLOW : enemy.kind === 'spindle' ? HOOK : SWEEP;
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    enemy.x = quantize(enemy.originX + (enemy.targetX - enemy.originX) * at(path, sample));
    enemy.y = quantize(enemy.originY + (enemy.targetY - enemy.originY) * at(path, sample + 1));
    if (age >= duration) {
      enemy.state = enemy.kind === 'shardlet' ? 'exiting' : 'returning';
      enemy.attackTick = tick;
      enemy.originX = enemy.x;
      enemy.originY = enemy.y;
    }
  }

  private returnToSlot(enemy: Enemy, formation: Formation, tick: number): void {
    const slot = at(formation.slots, enemy.slot);
    const age = Math.min(90, tick - enemy.attackTick);
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    enemy.x = quantize(enemy.originX + (slot.x + swayX(tick) - enemy.originX) * at(RETURN, age * 2));
    enemy.y = quantize(enemy.originY + (slot.y + swayX(tick + 64) / 6 - enemy.originY) * at(RETURN, age * 2 + 1));
    if (age === 90) { enemy.state = 'formation'; slot.state = 'occupied'; }
  }
}

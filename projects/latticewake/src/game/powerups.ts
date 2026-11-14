import { sweptCircleTime } from '../math/collision';
import type { BulletPool } from './bullets';
import type { EchoLattice } from './echo';
import type { Player } from './player';
import { quantize } from './tuning';

export type PowerKind = 'ward' | 'fan' | 'overclock';
export const POWER_KINDS: readonly PowerKind[] = ['ward', 'fan', 'overclock'];
export const POWER_TICKS = { ward: 900, fan: 480, overclock: 360 } as const;

export class PowerUps {
  ward = 0;
  fan = 0;
  overclock = 0;
  absorbed = 0;
  private readonly velocities: number[] = [];
  private readonly offsets: number[] = [];

  clear(): void { this.ward = this.fan = this.overclock = 0; }
  reset(): void { this.clear(); this.absorbed = 0; }
  collect(kind: PowerKind): void { this[kind] = POWER_TICKS[kind]; }
  step(): void { for (const kind of POWER_KINDS) if (this[kind] > 0) this[kind]--; }
  absorb(marked: boolean): boolean {
    if (marked || this.ward === 0) return false;
    this.ward = 0;
    this.absorbed++;
    return true;
  }

  volley(pool: BulletPool, player: Player, echo: EchoLattice): boolean {
    this.velocities.length = this.offsets.length = this.fan > 0 ? 3 : 1;
    this.velocities[0] = 0; this.offsets[0] = 0;
    if (this.fan > 0) { this.velocities[1] = -140; this.velocities[2] = 140; this.offsets[1] = this.offsets[2] = 0; }
    for (let index = 0; index < echo.drones.length; index++) {
      if ((echo.drones[index] ?? 0) === 0) continue;
      this.velocities.push(0); this.offsets.push(index === 0 ? -24 : 24);
    }
    return pool.spawnVolley(player.x, player.y - 20, this.velocities, this.offsets);
  }
}

export interface Drop {
  active: boolean; id: number; generation: number; kind: PowerKind;
  x: number; y: number; previousY: number; remaining: number;
}

export class DropPool {
  readonly slots: readonly Drop[] = Array.from({ length: 12 }, () => ({
    active: false, id: 0, generation: 0, kind: 'ward', x: 0, y: 0, previousY: 0, remaining: 0,
  }));
  count = 0;
  denied = 0;
  collected = 0;
  private nextId = 1;

  clear(): void { for (const drop of this.slots) drop.active = false; this.count = 0; }
  reset(): void { this.clear(); this.denied = this.collected = 0; this.nextId = 1; }
  spawn(kind: PowerKind, x: number, y: number): boolean {
    for (const drop of this.slots) {
      if (drop.active) continue;
      drop.active = true; drop.id = this.nextId++; drop.generation++; drop.kind = kind;
      drop.x = quantize(x); drop.y = drop.previousY = quantize(y); drop.remaining = 480;
      this.count++;
      return true;
    }
    this.denied++;
    return false;
  }
  step(): void {
    for (const drop of this.slots) if (drop.active) {
      drop.previousY = drop.y; drop.y = quantize(drop.y + 1); drop.remaining--;
    }
  }
  resolve(player: Player, powers: PowerUps, enabled: boolean): void {
    for (const drop of this.slots) {
      if (!drop.active) continue;
      if (enabled && sweptCircleTime(drop.x, drop.previousY, drop.x, drop.y,
        player.previousX, player.y, player.x, player.y, 28) !== Infinity) {
        powers.collect(drop.kind); this.collected++; drop.active = false; this.count--;
      } else if (drop.remaining <= 0 || drop.y > 656) { drop.active = false; this.count--; }
    }
  }
}

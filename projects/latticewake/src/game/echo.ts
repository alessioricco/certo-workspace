import { sweptCircleTime } from '../math/collision';
import type { HostilePool } from './hostiles';
import type { Player } from './player';

export const CAPTURE_TICKS = 24;
export const CAPTURE_COOLDOWN = 240;
export const DRONE_TICKS = 360;
export const CAPTURE_RADIUS = 32;

export class EchoLattice {
  field = 0;
  cooldown = 0;
  readonly drones = [0, 0];
  captures = 0;
  activations = 0;

  get count(): number { return Number((this.drones[0] ?? 0) > 0) + Number((this.drones[1] ?? 0) > 0); }

  clear(): void { this.field = 0; this.drones.fill(0); }
  reset(): void { this.clear(); this.cooldown = this.captures = this.activations = 0; }

  step(pressed: boolean, enabled: boolean): void {
    if (!enabled) return;
    if (this.field > 0) this.field--;
    if (this.cooldown > 0) this.cooldown--;
    for (let index = 0; index < this.drones.length; index++) if ((this.drones[index] ?? 0) > 0) this.drones[index] = (this.drones[index] ?? 0) - 1;
    if (pressed && this.cooldown === 0 && this.count < 2) {
      this.field = CAPTURE_TICKS;
      this.cooldown = CAPTURE_COOLDOWN;
      this.activations++;
    }
  }

  intercept(pool: HostilePool, player: Player): boolean {
    if (this.field === 0 || this.count === 2) return false;
    let first = -1;
    let time = Infinity;
    let id = Infinity;
    for (let index = 0; index < pool.slots.length; index++) {
      const shot = pool.slots[index];
      if (!shot?.active || !shot.marked) continue;
      const impact = sweptCircleTime(shot.previousX, shot.previousY, shot.x, shot.y,
        player.previousX, player.y, player.x, player.y, CAPTURE_RADIUS + 4);
      if (impact < time || (impact !== Infinity && impact === time && shot.id < id)) {
        first = index; time = impact; id = shot.id;
      }
    }
    const shot = pool.slots[first];
    if (!shot || !pool.release(first, shot.generation)) return false;
    this.drones[(this.drones[0] ?? 0) === 0 ? 0 : 1] = DRONE_TICKS;
    this.field = 0;
    this.captures++;
    return true;
  }
}

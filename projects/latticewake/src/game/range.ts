import type { Actions } from '../input/actions';
import { BulletPool } from './bullets';
import { Player } from './player';
import { SHOT_INTERVAL, SINGLE_SHOT } from './tuning';

export class FiringRange {
  readonly player = new Player();
  readonly bullets = new BulletPool();
  seed = 0;
  ticks = 0;
  cooldown = 0;
  shotsFired = 0;

  reset(seed: number): void {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid uint32 seed.');
    this.seed = seed;
    this.ticks = 0;
    this.cooldown = 0;
    this.shotsFired = 0;
    this.player.reset();
    this.bullets.reset();
  }

  step(actions: Readonly<Actions>, deferBulletResolution = false): void {
    this.ticks++;
    this.player.step(actions.moveX);
    // A formation session must resolve the final sweep before recycling offscreen shots.
    this.bullets.step(!deferBulletResolution);
    if (this.cooldown > 0) this.cooldown--;
    if (!deferBulletResolution) this.fire(actions.fire);
  }

  fire(held: boolean): void {
    if (held && this.cooldown === 0
      && this.bullets.spawnVolley(this.player.x, this.player.y - 20, SINGLE_SHOT)) {
      this.cooldown = SHOT_INTERVAL;
      this.shotsFired++;
    }
  }

}

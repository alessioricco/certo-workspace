import { at } from '../math/indexed';
import type { Actions } from '../input/actions';
import { Formation } from './formation';
import { ParticlePool } from './particles';
import { FiringRange } from './range';

export class FormationSession {
  readonly range = new FiringRange();
  readonly formation = new Formation();
  readonly particles = new ParticlePool();
  private readonly actions: Actions = { moveX: 0, fire: false, capture: false };

  get complete(): boolean {
    return this.formation.cleared && this.range.bullets.count === 0 && this.particles.count === 0;
  }

  reset(seed: number): void {
    this.range.reset(seed);
    this.formation.reset(seed);
    this.particles.reset();
  }

  step(actions: Readonly<Actions>): void {
    this.actions.moveX = actions.moveX;
    this.actions.fire = actions.fire && !this.formation.cleared;
    this.actions.capture = actions.capture;
    this.range.step(this.actions, true);
    this.particles.step();
    this.formation.step(this.range.bullets, this.range.ticks);
    this.range.bullets.expireOffscreen();
    this.range.fire(this.actions.fire && !this.formation.cleared);
    for (let index = 0; index < this.formation.events.count; index++) {
      const event = at(this.formation.events.slots, index);
      if (event.kind === 'destroy') this.particles.burst(event.x, event.y);
    }
  }
}

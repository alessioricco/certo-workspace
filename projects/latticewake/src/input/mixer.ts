import type { Actions } from './actions';

export class ActionMixer {
  private readonly previous = [0, 0, 0];
  private readonly changed = [0, 0, 0];
  private clock = 0;
  activate(source: 0 | 1 | 2, moveX: number): void {
    if (this.previous[source] !== moveX) { this.previous[source] = moveX; this.changed[source] = ++this.clock; }
  }
  combine(output: Actions, keyboard: Readonly<Actions>, touch: Readonly<Actions>, pad: Readonly<Actions>, autofire = false): void {
    let chosen = 0;
    let latest = -1;
    for (let index = 0; index < 3; index++) {
      const value = (index === 0 ? keyboard : index === 1 ? touch : pad).moveX;
      if (value !== this.previous[index]) { this.previous[index] = value; this.changed[index] = ++this.clock; }
      const stamp = this.changed[index] ?? 0;
      if (Math.abs(value) > Math.abs(chosen) || (Math.abs(value) === Math.abs(chosen) && stamp > latest)) { chosen = value; latest = stamp; }
    }
    output.moveX = chosen;
    output.fire = keyboard.fire || touch.fire || pad.fire || autofire;
    output.capture = keyboard.capture || touch.capture || pad.capture;
  }
  clear(): void { this.previous.fill(0); this.changed.fill(0); this.clock = 0; }
}

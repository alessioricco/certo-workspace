import type { Actions } from './actions';
export type PadCommand = 'confirm' | 'back' | 'pause' | 'next' | 'previous' | 'decrease' | 'increase';
export interface PadSnapshot { readonly connected: boolean; readonly mapping: string; readonly index: number; readonly axes: readonly number[]; readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[] }
function down(pad: PadSnapshot, index: number): boolean {
  const button = pad.buttons[index];
  return Boolean(button && (button.pressed || (Number.isFinite(button.value) && button.value > 0.5)));
}
const COMMANDS: readonly [number, PadCommand][] = [[0, 'confirm'], [1, 'back'], [9, 'pause'], [12, 'previous'], [13, 'next'], [14, 'decrease'], [15, 'increase']];
export function normalizeAxis(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) <= 0.18) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - 0.18) / 0.82);
}
export class GamepadInput {
  readonly actions: Actions = { moveX: 0, fire: false, capture: false };
  private readonly held = new Set<number>();
  private readonly blocked = new Set<number>();
  private readonly commands = new Set<PadCommand>();
  private axisBlocked = false;
  private capture = false;
  private vertical = 0;
  index: number | undefined;
  available = true;
  poll(read: () => readonly (PadSnapshot | null)[]): boolean {
    let pad: PadSnapshot | undefined;
    try { const pads = read(); this.available = true; for (const item of pads) if (item?.connected && item.mapping === 'standard' && (!pad || item.index < pad.index)) pad = item; }
    catch { this.available = false; }
    const disconnected = this.index !== undefined && this.index !== pad?.index;
    if (this.index !== pad?.index) { this.clear(); this.index = pad?.index; }
    if (!pad) { this.actions.moveX = 0; this.actions.fire = false; return disconnected; }
    for (let index = 0; index < 17; index++) {
      if (!down(pad, index)) { this.held.delete(index); this.blocked.delete(index); continue; }
      if (this.blocked.has(index)) continue;
      if (!this.held.has(index)) {
        if (index === 2) this.capture = true;
        for (const [button, command] of COMMANDS) if (index === button) this.commands.add(command);
      }
      this.held.add(index);
    }
    const axis = normalizeAxis(pad.axes[0] ?? 0);
    if (axis === 0) this.axisBlocked = false;
    this.actions.moveX = this.held.has(14) || this.held.has(15) ? Number(this.held.has(15)) - Number(this.held.has(14)) : this.axisBlocked ? 0 : axis;
    this.actions.fire = this.held.has(0) || this.held.has(7);
    const vertical = normalizeAxis(pad.axes[1] ?? 0);
    const direction = vertical < -0.5 ? -1 : vertical > 0.5 ? 1 : 0;
    if (direction !== 0 && this.vertical === 0) this.commands.add(direction < 0 ? 'previous' : 'next');
    this.vertical = direction;
    return disconnected;
  }
  sample(output: Actions): void { Object.assign(output, this.actions); output.capture = this.capture; this.capture = false; }
  consume(command: PadCommand): boolean { return this.commands.delete(command); }
  clear(): void {
    this.actions.moveX = 0; this.actions.fire = this.actions.capture = this.capture = false;
    this.commands.clear(); this.held.clear(); this.blocked.clear();
    for (let index = 0; index < 17; index++) this.blocked.add(index);
    this.axisBlocked = true; this.vertical = 1;
  }
}

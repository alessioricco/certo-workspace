import type { HitEventKind, HitEvents } from '../game/events';

export interface EffectSettings { low: boolean; particles: boolean; shake: boolean; glow: boolean; scanlines: boolean }
interface Mark { kind: HitEventKind; x: number; y: number; until: number }
export class Feedback {
  readonly settings: EffectSettings = { low: false, particles: true, shake: true, glow: false, scanlines: false };
  readonly marks: readonly Mark[] = Array.from({ length: 32 }, () => ({ kind: 'hit', x: 0, y: 0, until: 0 }));
  private cursor = 0;
  shakeUntil = 0;
  reset(): void { for (const mark of this.marks) mark.until = 0; this.cursor = this.shakeUntil = 0; }
  consume(events: Readonly<HitEvents>): void {
    for (let index = 0; index < events.count; index++) {
      const event = events.slots[index];
      if (!event) continue;
      if (event.kind === 'damage') this.shakeUntil = event.tick + 12;
      if (event.kind !== 'boss-hit' && event.kind !== 'capture' && event.kind !== 'ward' && event.kind !== 'pickup' && event.kind !== 'damage') continue;
      const mark = this.marks[this.cursor];
      if (!mark) continue;
      mark.kind = event.kind; mark.x = event.x; mark.y = event.y; mark.until = event.tick + 10;
      this.cursor = (this.cursor + 1) % this.marks.length;
    }
  }
  shake(tick: number, reducedMotion: boolean): number {
    if (reducedMotion || this.settings.low || !this.settings.shake || tick >= this.shakeUntil) return 0;
    return (this.shakeUntil - tick) / 6 * (Math.floor(tick) % 2 === 0 ? 1 : -1);
  }
}

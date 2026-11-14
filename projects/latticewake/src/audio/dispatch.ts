import type { HitEvent, HitEventKind, HitEvents } from '../game/events';
import type { Sound } from './patches';

export function eventSound(kind: HitEventKind): Sound {
  return kind === 'boss-hit' ? 'hit' : kind;
}

export class AudioDispatch {
  private readonly seen: HitEvent[] = Array.from({ length: 192 }, () => ({ kind: 'hit', tick: -1, id: -1, x: 0, y: 0 }));
  private cursor = 0;
  private latestTick = -1;
  reset(): void { this.latestTick = -1; this.cursor = 0; for (const event of this.seen) event.tick = -1; }
  consume(events: Readonly<HitEvents>, play: (sound: Sound) => void): void {
    for (let index = 0; index < events.count; index++) {
      const event = events.slots[index];
      if (!event || event.tick < this.latestTick) continue;
      let duplicate = false;
      for (const seen of this.seen) if (seen.tick === event.tick && seen.id === event.id && seen.kind === event.kind) { duplicate = true; break; }
      if (duplicate) continue;
      const slot = this.seen[this.cursor];
      if (!slot) continue;
      slot.tick = event.tick; slot.id = event.id; slot.kind = event.kind;
      this.cursor = (this.cursor + 1) % this.seen.length;
      this.latestTick = event.tick;
      play(eventSound(event.kind));
    }
  }
}

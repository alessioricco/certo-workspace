export const EVENT_CAPACITY = 192;
export type HitEventKind = 'hit' | 'destroy' | 'boss-hit' | 'shot' | 'capture' | 'open' | 'pickup' | 'damage' | 'ward' | 'phase' | 'clear';
export interface HitEvent { kind: HitEventKind; tick: number; id: number; x: number; y: number }

export class HitEvents {
  readonly slots: readonly HitEvent[] = Array.from({ length: EVENT_CAPACITY }, () => ({
    kind: 'hit', tick: 0, id: 0, x: 0, y: 0,
  }));
  count = 0;
  dropped = 0;

  reset(): void { this.count = 0; this.dropped = 0; }
  begin(): void { this.count = 0; }

  push(kind: HitEventKind, tick: number, id: number, x: number, y: number): void {
    const event = this.slots[this.count];
    if (!event) { this.dropped++; return; }
    event.kind = kind;
    event.tick = tick;
    event.id = id;
    event.x = x;
    event.y = y;
    this.count++;
  }
}

import type { Actions } from './actions';
export type TouchAction = 'left' | 'right' | 'drag' | 'fire' | 'capture';
interface Contact { action: TouchAction; start: number; move: number }
export class TouchState {
  private readonly contacts = new Map<number, Contact>();
  private capture = false;
  down(id: number, action: TouchAction, x: number): boolean {
    if (this.contacts.has(id) || this.contacts.size >= 10 || !Number.isFinite(x)) return false;
    if (action === 'capture' && !this.has('capture')) this.capture = true;
    this.contacts.set(id, { action, start: x, move: 0 }); return true;
  }
  move(id: number, x: number): void { const contact = this.contacts.get(id); if (contact && Number.isFinite(x)) contact.move = Math.max(-1, Math.min(1, (x - contact.start) / 48)); }
  up(id: number): void { this.contacts.delete(id); }
  get moveX(): number {
    let drag = 0;
    for (const contact of this.contacts.values()) if (contact.action === 'drag') drag = contact.move;
    return this.has('left') || this.has('right') ? Number(this.has('right')) - Number(this.has('left')) : drag;
  }
  sample(output: Actions): void {
    output.moveX = this.moveX;
    output.fire = this.has('fire'); output.capture = this.capture; this.capture = false;
  }
  clear(): void { this.contacts.clear(); this.capture = false; }
  private has(action: TouchAction): boolean { for (const contact of this.contacts.values()) if (contact.action === action) return true; return false; }
}
export class TouchInput {
  readonly state = new TouchState();
  constructor(private readonly host: HTMLElement, private readonly activity: (moveX: number) => void = () => {}) {}
  start(): void {
    this.host.addEventListener('pointerdown', this.down);
    this.host.addEventListener('pointermove', this.move);
    this.host.addEventListener('pointerup', this.up);
    this.host.addEventListener('pointercancel', this.up);
    this.host.addEventListener('lostpointercapture', this.up);
  }
  clear(): void { this.state.clear(); }
  dispose(): void {
    this.clear(); this.host.removeEventListener('pointerdown', this.down); this.host.removeEventListener('pointermove', this.move);
    this.host.removeEventListener('pointerup', this.up); this.host.removeEventListener('pointercancel', this.up); this.host.removeEventListener('lostpointercapture', this.up);
  }
  private readonly down = (event: PointerEvent): void => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-touch]') : null;
    const action = element?.dataset.touch;
    if (!element || !['left', 'right', 'drag', 'fire', 'capture'].includes(action ?? '') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (this.state.down(event.pointerId, action as TouchAction, event.clientX)) {
      event.preventDefault(); element.setPointerCapture(event.pointerId); this.activity(this.state.moveX);
    }
  };
  private readonly move = (event: PointerEvent): void => { this.state.move(event.pointerId, event.clientX); this.activity(this.state.moveX); };
  private readonly up = (event: PointerEvent): void => { this.state.up(event.pointerId); this.activity(this.state.moveX); };
}

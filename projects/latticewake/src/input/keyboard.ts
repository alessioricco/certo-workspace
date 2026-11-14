import type { Actions } from './actions';

export type Action = 'left' | 'right' | 'fire' | 'capture' | 'confirm' | 'pause' | 'debug' | 'end';

const BINDINGS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'fire', KeyJ: 'fire', KeyX: 'capture', KeyK: 'capture', Enter: 'confirm', Escape: 'pause',
  KeyP: 'pause', F3: 'debug', KeyG: 'end',
};

export class Keyboard {
  private readonly down = new Set<string>();
  private readonly edges = new Set<Action>();
  private started = false;

  constructor(
    private readonly target: EventTarget,
    private readonly acceptsEvent: (event: KeyboardEvent) => boolean = () => true,
    private readonly activity: (moveX: number) => void = () => {},
  ) {}

  get moveX(): number { return Number(this.held('right')) - Number(this.held('left')); }

  held(action: Action): boolean {
    for (const code of this.down) if (BINDINGS[code] === action) return true;
    return false;
  }

  consume(action: Action): boolean { return this.edges.delete(action); }

  sample(actions: Actions): void {
    actions.moveX = this.moveX;
    actions.fire = this.held('fire');
    actions.capture = this.consume('capture');
  }

  clear = (): void => {
    this.down.clear();
    this.edges.clear();
  };

  start(): void {
    if (this.started) return;
    this.started = true;
    this.target.addEventListener('keydown', this.onDown);
    this.target.addEventListener('keyup', this.onUp);
    this.target.addEventListener('blur', this.clear);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.clear);
    this.started = false;
    this.clear();
  }

  private readonly onDown = (event: Event): void => {
    const key = event as KeyboardEvent;
    const action = BINDINGS[key.code];
    if (!action || key.ctrlKey || key.metaKey || key.altKey || key.isComposing || !this.acceptsEvent(key)) return;
    key.preventDefault();
    if (key.repeat && !this.down.has(key.code)) return;
    if (!key.repeat && !this.down.has(key.code) && !this.held(action)) this.edges.add(action);
    this.down.add(key.code);
    this.activity(this.moveX);
  };

  private readonly onUp = (event: Event): void => {
    this.down.delete((event as KeyboardEvent).code);
    this.activity(this.moveX);
  };
}

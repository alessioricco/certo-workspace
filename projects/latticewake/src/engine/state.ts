export type Scene = 'boot' | 'menu' | 'play' | 'pause' | 'gameover';

const TRANSITIONS: Readonly<Record<Scene, readonly Scene[]>> = {
  boot: ['menu'],
  menu: ['play'],
  play: ['pause', 'gameover'],
  pause: ['play', 'menu'],
  gameover: ['play', 'menu'],
};

export class StateMachine {
  private current: Scene = 'boot';

  get scene(): Scene { return this.current; }

  transition(next: Scene): boolean {
    if (!TRANSITIONS[this.current].includes(next)) return false;
    this.current = next;
    return true;
  }
}

import { describe, expect, it } from 'vitest';
import { Keyboard } from '../../src/input/keyboard';

function key(target: EventTarget, type: string, code: string, options: {
  repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean;
} = {}): Event {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat: false, ...options });
  target.dispatchEvent(event);
  return event;
}

it('honors an input-context policy before suppressing native events', () => {
  const target = new EventTarget();
  const keyboard = new Keyboard(target, event => event.code !== 'KeyP');
  keyboard.start();
  expect(key(target, 'keydown', 'KeyP').defaultPrevented).toBe(false);
  expect(keyboard.consume('pause')).toBe(false);
  expect(key(target, 'keydown', 'Escape').defaultPrevented).toBe(true);
  expect(keyboard.consume('pause')).toBe(true);
  keyboard.dispose();
});

describe('keyboard action adapter', () => {
  it('normalizes aliases, opposing directions, held actions, and press edges', () => {
    const target = new EventTarget();
    const keyboard = new Keyboard(target);
    keyboard.start();
    expect(key(target, 'keydown', 'ArrowLeft').defaultPrevented).toBe(true);
    expect(keyboard.moveX).toBe(-1);
    key(target, 'keydown', 'KeyA');
    key(target, 'keyup', 'ArrowLeft');
    expect(keyboard.moveX).toBe(-1);
    key(target, 'keydown', 'ArrowRight');
    expect(keyboard.moveX).toBe(0);
    key(target, 'keydown', 'Space');
    key(target, 'keydown', 'KeyX');
    expect(keyboard.held('fire')).toBe(true);
    expect(keyboard.held('capture')).toBe(true);
    key(target, 'keydown', 'Escape');
    expect(keyboard.consume('pause')).toBe(true);
    expect(keyboard.consume('pause')).toBe(false);
    key(target, 'keydown', 'Escape', { repeat: true });
    expect(keyboard.consume('pause')).toBe(false);
    key(target, 'keyup', 'Escape');
    key(target, 'keydown', 'Escape');
    expect(keyboard.consume('pause')).toBe(true);
    expect(key(target, 'keydown', 'KeyQ').defaultPrevented).toBe(false);
    keyboard.dispose();
  });

  it('clears on focus loss, ignores shortcuts, and owns listener teardown', () => {
    const target = new EventTarget();
    const keyboard = new Keyboard(target);
    keyboard.start();
    keyboard.start();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
      expect(key(target, 'keydown', 'KeyD', modifier).defaultPrevented).toBe(false);
      expect(keyboard.moveX).toBe(0);
    }
    key(target, 'keydown', 'KeyD');
    target.dispatchEvent(new Event('blur'));
    expect(keyboard.moveX).toBe(0);
    key(target, 'keydown', 'KeyD', { repeat: true });
    expect(keyboard.moveX).toBe(0);
    key(target, 'keydown', 'Enter');
    keyboard.clear();
    expect(keyboard.consume('confirm')).toBe(false);
    keyboard.dispose();
    keyboard.dispose();
    key(target, 'keydown', 'ArrowLeft');
    expect(keyboard.moveX).toBe(0);
    keyboard.start();
    key(target, 'keydown', 'F3');
    expect(keyboard.consume('debug')).toBe(true);
    keyboard.dispose();
  });
});


it('samples device-independent actions with held fire and one capture per press', () => {
  const target = new EventTarget();
  const keyboard = new Keyboard(target);
  const actions = { moveX: 0, fire: false, capture: false };
  keyboard.start();
  key(target, 'keydown', 'KeyD');
  key(target, 'keydown', 'KeyJ');
  key(target, 'keydown', 'KeyK');
  keyboard.sample(actions);
  expect(actions).toEqual({ moveX: 1, fire: true, capture: true });
  keyboard.sample(actions);
  expect(actions).toEqual({ moveX: 1, fire: true, capture: false });
  key(target, 'keydown', 'KeyX');
  keyboard.sample(actions);
  expect(actions.capture).toBe(false);
  key(target, 'keyup', 'KeyK');
  key(target, 'keyup', 'KeyX');
  key(target, 'keydown', 'KeyX');
  keyboard.sample(actions);
  expect(actions.capture).toBe(true);
  keyboard.clear();
  keyboard.sample(actions);
  expect(actions).toEqual({ moveX: 0, fire: false, capture: false });
  keyboard.dispose();
});


it('retains a short capture tap until the next simulation sample and consumes it once', () => {
  const target = new EventTarget();
  const keyboard = new Keyboard(target);
  const actions = { moveX: 0, fire: false, capture: false };
  keyboard.start();
  key(target, 'keydown', 'KeyX');
  key(target, 'keyup', 'KeyX');
  expect(keyboard.held('capture')).toBe(false);
  keyboard.sample(actions);
  expect(actions.capture).toBe(true);
  keyboard.sample(actions);
  expect(actions.capture).toBe(false);
  key(target, 'keydown', 'KeyK');
  target.dispatchEvent(new Event('blur'));
  keyboard.sample(actions);
  expect(actions.capture).toBe(false);
  keyboard.dispose();
});

import { expect, it } from 'vitest';
import { ActionMixer } from '../../src/input/mixer';
import { GamepadInput, normalizeAxis } from '../../src/input/gamepad';
import { TouchState } from '../../src/input/touch';
const idle = () => ({ moveX: 0, fire: false, capture: false });
const pad = () => ({ index: 0, mapping: 'standard', connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
it('uses event chronology rather than device enumeration to break equal movement ties', () => {
  const mixer = new ActionMixer(), out = idle(), key = { ...idle(), moveX: -1 }, touch = { ...idle(), moveX: 1 };
  mixer.activate(1, 1); mixer.activate(0, -1);
  mixer.combine(out, key, touch, idle()); expect(out.moveX).toBe(-1);
  mixer.activate(0, 0); key.moveX = 0; mixer.combine(out, key, touch, idle()); expect(out.moveX).toBe(1);
});
it('arbitrates strongest magnitude, most recently changed ties, OR fire and press edges', () => {
  const mixer = new ActionMixer(), out = idle(), key = idle(), touch = idle(), gamepad = idle();
  key.moveX = 1; gamepad.moveX = -0.6; mixer.combine(out, key, touch, gamepad); expect(out.moveX).toBe(1);
  touch.moveX = -1; mixer.combine(out, key, touch, gamepad); expect(out.moveX).toBe(-1);
  touch.moveX = 0; mixer.combine(out, key, touch, gamepad); expect(out.moveX).toBe(1);
  key.fire = true; touch.capture = true; mixer.combine(out, key, touch, gamepad); expect(out).toEqual({ moveX: 1, fire: true, capture: true });
  mixer.clear(); mixer.combine(out, idle(), idle(), idle(), true); expect(out).toEqual({ moveX: 0, fire: true, capture: false });
});
it('normalizes standard pads, dead zone, dpad, trigger and independent capture edges', () => {
  expect(normalizeAxis(NaN)).toBe(0); expect(normalizeAxis(0.18)).toBe(0); expect(normalizeAxis(2)).toBe(1); expect(normalizeAxis(-0.59)).toBeCloseTo(-0.5);
  const input = new GamepadInput(), device = pad(), out = idle(); input.poll(() => [null, device]);
  device.axes[0] = 0.59; device.buttons[7] = { pressed: false, value: 0.7 }; device.buttons[2] = { pressed: true, value: 1 };
  input.poll(() => [device]); input.sample(out); expect(out.moveX).toBeCloseTo(0.5); expect(out.fire).toBe(true); expect(out.capture).toBe(true);
  input.sample(out); expect(out.capture).toBe(false); input.poll(() => [device]); input.sample(out); expect(out.capture).toBe(false);
  device.buttons[14] = { pressed: true, value: 1 }; device.buttons[0] = { pressed: true, value: 1 }; input.poll(() => [device]);
  expect(input.consume('confirm')).toBe(true); expect(input.consume('confirm')).toBe(false); expect(input.consume('decrease')).toBe(true);
  input.sample(out); expect(out.moveX).toBe(-1);
  device.buttons[15] = { pressed: true, value: 1 }; input.poll(() => [device]); input.sample(out); expect(out.moveX).toBe(0);
});
it('clears disconnects and suppresses held controls across pause/reconnect until released', () => {
  const input = new GamepadInput(), device = pad(), out = idle(); input.poll(() => [device]);
  device.axes[0] = 1; device.buttons[0] = { pressed: true, value: 1 }; input.poll(() => [device]); input.clear(); input.poll(() => [device]); input.sample(out); expect(out).toEqual(idle());
  expect(input.poll(() => [])).toBe(true); input.sample(out); expect(out).toEqual(idle());
  input.poll(() => [device]); input.sample(out); expect(out).toEqual(idle());
  device.axes[0] = 0; device.buttons[0] = { pressed: false, value: 0 }; input.poll(() => [device]);
  device.buttons[9] = { pressed: true, value: 1 }; input.poll(() => [device]); expect(input.consume('pause')).toBe(true);
  device.buttons[1] = { pressed: true, value: 1 }; device.axes[1] = -1; input.poll(() => [device]); expect(input.consume('back')).toBe(true); expect(input.consume('previous')).toBe(true);
  device.axes[1] = 0; input.poll(() => [device]); device.axes[1] = 1; input.poll(() => [device]); expect(input.consume('next')).toBe(true);
  expect(input.poll(() => { throw new Error('denied'); })).toBe(true); expect(input.available).toBe(false);
  const other = pad(); other.mapping = ''; input.poll(() => [other]); expect(input.index).toBeUndefined();
});
it('owns simultaneous pointer movement, held fire, short capture taps and cancellation', () => {
  const touch = new TouchState(), out = idle(); expect(touch.down(1, 'drag', 100)).toBe(true); touch.move(1, 124);
  touch.down(2, 'fire', 0); touch.down(3, 'capture', 0); touch.up(3); touch.sample(out); expect(out).toEqual({ moveX: 0.5, fire: true, capture: true });
  touch.sample(out); expect(out.capture).toBe(false); touch.move(1, 300); touch.sample(out); expect(out.moveX).toBe(1);
  touch.down(4, 'left', 0); touch.down(5, 'right', 0); touch.sample(out); expect(out.moveX).toBe(0);
  touch.up(5); touch.sample(out); expect(out.moveX).toBe(-1); touch.up(2); touch.sample(out); expect(out.fire).toBe(false);
  expect(touch.down(4, 'fire', 0)).toBe(false); expect(touch.down(10, 'fire', NaN)).toBe(false); touch.move(50, 0); touch.move(1, NaN);
  touch.clear(); touch.sample(out); expect(out).toEqual(idle());
  for (let id = 0; id < 10; id++) touch.down(id, 'capture', 0);
  expect(touch.down(11, 'fire', 0)).toBe(false); touch.sample(out); expect(out.capture).toBe(true);
});

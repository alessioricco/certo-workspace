import { describe, expect, it } from 'vitest';
import { FixedLoop, STEP_MS } from '../../src/engine/loop';
import { StateMachine, type Scene } from '../../src/engine/state';
import { loadResources } from '../../src/engine/resources';
import { parseSeed, Xorshift32 } from '../../src/math/random';

describe('fixed loop', () => {
  it('updates at 60 Hz and interpolates between ticks', () => {
    const steps: number[] = [];
    const alphas: number[] = [];
    const loop = new FixedLoop(dt => steps.push(dt), alpha => alphas.push(alpha));
    loop.frame(0);
    loop.frame(25);
    expect(steps).toEqual([1 / 60]);
    expect(alphas.at(-1)).toBeCloseTo(0.5);
    loop.frame(50);
    expect(steps).toHaveLength(3);
    expect(alphas.at(-1)).toBeCloseTo(0);
  });

  it('caps catch-up and records discarded time', () => {
    let ticks = 0;
    const loop = new FixedLoop(() => ticks++, () => {});
    loop.frame(0);
    loop.frame(1005);
    expect(ticks).toBe(5);
    expect(loop.droppedMs).toBeCloseTo(1005 - 5 * STEP_MS);
    expect(loop.alpha).toBeCloseTo(0);
    loop.frame(1030);
    expect(loop.alpha).toBeCloseTo(0.5);
  });

  it('retains the fractional remainder when dropping excess whole steps', () => {
    let ticks = 0;
    const loop = new FixedLoop(() => ticks++, () => {});
    loop.frame(0);
    loop.frame(240);
    expect(ticks).toBe(5);
    expect(loop.droppedMs).toBeCloseTo(9 * STEP_MS);
    expect(loop.alpha).toBeCloseTo(0.4);
    loop.frame(250);
    expect(ticks).toBe(6);
    expect(loop.alpha).toBeCloseTo(0);
  });

  it('resets pause timing, ignores backwards time, and rejects invalid clocks', () => {
    let ticks = 0;
    const loop = new FixedLoop(() => ticks++, () => {});
    loop.frame(100);
    loop.frame(90);
    loop.frame(110);
    expect(ticks).toBe(0);
    loop.reset();
    loop.frame(9000);
    expect(ticks).toBe(0);
    loop.frame(9000 + STEP_MS);
    expect(ticks).toBe(1);
    expect(() => loop.frame(NaN)).toThrow(RangeError);
    expect(() => loop.frame(Infinity)).toThrow(RangeError);
  });

  it('preserves elapsed simulation time and interpolation under jittered frame delivery', () => {
    let ticks = 0;
    const alphas: number[] = [];
    const loop = new FixedLoop(() => ticks++, alpha => alphas.push(alpha));
    loop.frame(0);
    let timestamp = 0;
    const deltas = [4, 12, 21, 28, 6, 16, 33, 8];
    for (let cycle = 0; cycle < 100; cycle++) {
      for (const delta of deltas) {
        timestamp += delta;
        loop.frame(timestamp);
        expect(ticks).toBe(Math.floor((timestamp + 1e-7) / STEP_MS));
        expect(ticks * STEP_MS + loop.alpha * STEP_MS).toBeCloseTo(timestamp, 7);
      }
    }
    expect(loop.droppedMs).toBe(0);
    expect(alphas.every(alpha => alpha >= 0 && alpha < 1)).toBe(true);
  });

  it('gives equal tick results at different render cadences', () => {
    function run(hz: number): number {
      let ticks = 0;
      const loop = new FixedLoop(() => ticks++, () => {});
      for (let frame = 0; frame <= hz * 10; frame++) loop.frame(frame * 1000 / hz);
      return ticks;
    }
    expect([30, 60, 90, 120, 144].map(run)).toEqual([600, 600, 600, 600, 600]);
  });
});

describe('owned state machine', () => {
  const allowed: Record<Scene, Scene[]> = {
    boot: ['menu'], menu: ['play'], play: ['pause', 'gameover'],
    pause: ['play', 'menu'], gameover: ['play', 'menu'],
  };
  const paths: Record<Scene, Scene[]> = {
    boot: [], menu: ['menu'], play: ['menu', 'play'],
    pause: ['menu', 'play', 'pause'], gameover: ['menu', 'play', 'gameover'],
  };
  for (const from of Object.keys(allowed) as Scene[]) {
    for (const to of Object.keys(allowed) as Scene[]) {
      it(`${from} → ${to} is ${allowed[from].includes(to) ? 'legal' : 'rejected'}`, () => {
        const machine = new StateMachine();
        for (const scene of paths[from]) machine.transition(scene);
        expect(machine.transition(to)).toBe(allowed[from].includes(to));
        expect(machine.scene).toBe(allowed[from].includes(to) ? to : from);
      });
    }
  }
});

describe('resource loading', () => {
  it('loads real factories and permits an empty manifest', async () => {
    const signal = new AbortController().signal;
    expect(await loadResources({ grid: () => 'grid', palette: async () => 12 }, signal))
      .toEqual({ grid: 'grid', palette: 12 });
    expect(await loadResources({}, signal)).toEqual({});
  });

  it('propagates failure and permits a fresh retry', async () => {
    let attempts = 0;
    const resources = { atlas: () => {
      if (++attempts === 1) throw new Error('unavailable');
      return 'ready';
    } };
    const signal = new AbortController().signal;
    await expect(loadResources(resources, signal)).rejects.toThrow('unavailable');
    await expect(loadResources(resources, signal)).resolves.toEqual({ atlas: 'ready' });
  });

  it('waits for asynchronous resources before starting dependent preparation', async () => {
    const order: string[] = [];
    const resources = await loadResources({
      grid: async () => {
        order.push('grid:start');
        await Promise.resolve();
        order.push('grid:ready');
        return 'grid';
      },
      palette: () => { order.push('palette'); return 12; },
    }, new AbortController().signal);
    expect(order).toEqual(['grid:start', 'grid:ready', 'palette']);
    expect(resources).toEqual({ grid: 'grid', palette: 12 });
  });

  it('rejects teardown during an awaited resource without loading the next resource', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const pending = loadResources({
      grid: async () => {
        calls.push('grid');
        await Promise.resolve();
        return 'late grid';
      },
      palette: () => { calls.push('palette'); return 12; },
    }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toEqual(['grid']);
  });

  it('checks cancellation before and after each factory', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(loadResources({ asset: () => ++calls }, controller.signal)).rejects.toThrow();
    expect(calls).toBe(0);
    const pending = new AbortController();
    await expect(loadResources({ asset: () => {
      pending.abort();
      return 1;
    } }, pending.signal)).rejects.toThrow();
  });
});

describe('seed contract', () => {
  it('accepts only bounded decimal and hexadecimal uint32 values', () => {
    expect(parseSeed(null)).toBeUndefined();
    expect(parseSeed('0')).toBe(0);
    expect(parseSeed('4294967295')).toBe(0xffffffff);
    expect(parseSeed('0xFFFFFFFF')).toBe(0xffffffff);
    for (const value of ['', '-1', '1.5', '1e2', ' 1', '0x', '4294967296', '0x100000000', '00000000001']) {
      expect(() => parseSeed(value)).toThrow(RangeError);
    }
  });

  it('matches known xorshift32 vectors and documents zero remapping', () => {
    const random = new Xorshift32(1);
    expect(Array.from({ length: 5 }, () => random.nextUint32()))
      .toEqual([270369, 67634689, 2647435461, 307599695, 2398689233]);
    expect(new Xorshift32(0).nextUint32()).toBe(new Xorshift32(0x6d2b79f5).nextUint32());
    for (const seed of [-1, 1.5, 0x100000000, NaN]) expect(() => new Xorshift32(seed)).toThrow(RangeError);
  });
});

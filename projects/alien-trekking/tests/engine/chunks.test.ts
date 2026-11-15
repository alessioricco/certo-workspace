import { describe, expect, it } from 'vitest';
import { chunkAt, chunkKey, chunkOrigin, isDetailed, planChunks } from '../../src/engine/chunks';

describe('isDetailed', () => {
  it('is detailed within two chunks of the player, diagonals included', () => {
    expect(isDetailed({ cx: 2, cz: -2 }, { cx: 0, cz: 0 })).toBe(true);
    expect(isDetailed({ cx: 7, cz: 3 }, { cx: 5, cz: 5 })).toBe(true);
    expect(isDetailed({ cx: 3, cz: 0 }, { cx: 0, cz: 0 })).toBe(false);
  });
});

describe('chunkAt', () => {
  it('finds the chunk that holds a point', () => {
    expect(chunkAt(0, 0, 64)).toEqual({ cx: 0, cz: 0 });
    expect(chunkAt(63.9, -0.1, 64)).toEqual({ cx: 0, cz: -1 });
    expect(chunkAt(-64, 64, 64)).toEqual({ cx: -1, cz: 1 });
  });

  it('gives the corner of a chunk', () => {
    expect(chunkOrigin({ cx: -1, cz: 2 }, 64)).toEqual({ x: -64, z: 128 });
  });
});

describe('planChunks', () => {
  it('wants the square around the centre, nearest first', () => {
    const plan = planChunks([], { cx: 0, cz: 0 }, 1, 2);
    expect(plan.load.length).toBe(9);
    expect(plan.load[0]).toEqual({ cx: 0, cz: 0 });
    expect(plan.drop).toEqual([]);
  });

  it('builds the chunks ahead and drops the ones behind', () => {
    const loaded = planChunks([], { cx: 0, cz: 0 }, 1, 1);
    const moved = planChunks(
      [...loaded.load],
      { cx: 1, cz: 0 },
      1,
      1,
    );
    expect(moved.load.map(chunkKey)).toEqual(['2,-1', '2,0', '2,1']);
    expect(moved.drop.map(chunkKey).sort()).toEqual(['-1,-1', '-1,0', '-1,1']);
  });

  it('keeps chunks in the gap between the load and keep radius', () => {
    const plan = planChunks([{ cx: -1, cz: 0 }], { cx: 0, cz: 0 }, 1, 2);
    expect(plan.drop).toEqual([]);
    expect(plan.load.map(chunkKey)).not.toContain('-1,0');
  });
});

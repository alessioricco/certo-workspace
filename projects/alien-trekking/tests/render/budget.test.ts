import { describe, expect, it } from 'vitest';
import { BuildBudget } from '../../src/render/budget';

describe('BuildBudget', () => {
  it('lets a build start while time remains in the frame', () => {
    const budget = new BuildBudget(Infinity);
    for (let i = 0; i < 100; i++) expect(budget.tryStart()).toBe(true);
  });

  it('always lets the first build of a frame start, even with no time left', () => {
    const budget = new BuildBudget(0);
    expect(budget.tryStart()).toBe(true);
    expect(budget.tryStart()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  evaluateObjectives,
  isAwayFromLander,
  objectivesComplete,
  type Objective,
} from '../../src/engine/objectives';
import { emptyProgress, type Progress } from '../../src/engine/progress';

const SPECIES = { id: 'p1', kind: 'plant' as const, name: 'Tallis', description: 'A stalk.' };

function withSpecies(count: number): Progress {
  const species = Array.from({ length: count }, (_, i) => ({ ...SPECIES, id: `s${i}` }));
  return { ...emptyProgress(), species };
}

const objectives: Objective[] = [
  { kind: 'scan-species', count: 3 },
  { kind: 'reach-landmark', name: 'the tall spire' },
  { kind: 'return-to-lander' },
];

describe('evaluateObjectives', () => {
  it('labels each objective and reports nothing done for a new world', () => {
    const statuses = evaluateObjectives(objectives, emptyProgress());
    expect(statuses.map((status) => [status.label, status.done])).toEqual([
      ['Scan 3 species (0 of 3)', false],
      ['Reach the tall spire', false],
      ['Return to the lander after a trek', false],
    ]);
  });

  it('counts logged species up to the target and marks the scan done at the target', () => {
    const partial = evaluateObjectives(objectives, withSpecies(2))[0];
    expect(partial).toMatchObject({ label: 'Scan 3 species (2 of 3)', done: false });
    const done = evaluateObjectives(objectives, withSpecies(4))[0];
    expect(done).toMatchObject({ label: 'Scan 3 species (3 of 3)', done: true });
  });

  it('marks a landmark done once it is reached, and the return once made', () => {
    const progress = { ...emptyProgress(), landmarks: ['the tall spire'], returned: true };
    const [, landmark, back] = evaluateObjectives(objectives, progress);
    expect(landmark.done).toBe(true);
    expect(back.done).toBe(true);
  });
});

describe('objectivesComplete', () => {
  it('needs every objective done, and at least one objective', () => {
    expect(objectivesComplete([])).toBe(false);
    const progress = { ...withSpecies(3), landmarks: ['the tall spire'], returned: false };
    expect(objectivesComplete(evaluateObjectives(objectives, progress))).toBe(false);
    const all = { ...progress, returned: true };
    expect(objectivesComplete(evaluateObjectives(objectives, all))).toBe(true);
  });
});

describe('isAwayFromLander', () => {
  it('counts a trek only beyond 60 m from the lander', () => {
    expect(isAwayFromLander({ x: 0, z: 0 })).toBe(false);
    expect(isAwayFromLander({ x: 60, z: 0 })).toBe(false);
    expect(isAwayFromLander({ x: 0, z: 61 })).toBe(true);
  });
});

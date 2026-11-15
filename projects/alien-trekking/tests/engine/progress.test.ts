import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  markReturned,
  parseProgress,
  reachLandmark,
  recordSpecies,
} from '../../src/engine/progress';

const TALLIS = { id: 'p1', kind: 'plant' as const, name: 'Tallis', description: 'A stalk.' };
const VOROX = { id: 'a1', kind: 'animal' as const, name: 'Vorox', description: 'A grazer.' };

describe('recordSpecies', () => {
  it('logs each species once, however often it is scanned', () => {
    const once = recordSpecies(emptyProgress(), TALLIS);
    const twice = recordSpecies(once, TALLIS);
    expect(twice.species).toEqual([TALLIS]);
    expect(recordSpecies(twice, VOROX).species.map((entry) => entry.name)).toEqual(['Tallis', 'Vorox']);
  });
});

describe('reachLandmark and markReturned', () => {
  it('keeps each landmark and the return once', () => {
    const reached = reachLandmark(reachLandmark(emptyProgress(), 'the tall spire'), 'the tall spire');
    expect(reached.landmarks).toEqual(['the tall spire']);
    expect(markReturned(markReturned(reached)).returned).toBe(true);
  });

  it('does not change the progress it was given', () => {
    const before = emptyProgress();
    reachLandmark(before, 'the tall spire');
    markReturned(before);
    expect(before).toEqual(emptyProgress());
  });
});

describe('parseProgress', () => {
  it('starts a world afresh when nothing is saved', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
  });

  it('starts afresh when the saved text is not a progress record', () => {
    expect(parseProgress('{not json')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ species: 'many' }))).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ species: [{ id: 'x' }], landmarks: [], returned: false }))).toEqual(
      emptyProgress(),
    );
  });

  it('reads back what was saved', () => {
    const progress = markReturned(reachLandmark(recordSpecies(emptyProgress(), VOROX), 'the tall spire'));
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
});

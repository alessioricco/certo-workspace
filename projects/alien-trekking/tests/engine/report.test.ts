import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/engine/level';
import { buildSurveyReport } from '../../src/engine/report';
import { emptyProgress, markReturned, reachLandmark, recordSpecies } from '../../src/engine/progress';
import { computeWorldFacts } from '../../src/engine/worldFacts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const verdant = JSON.parse(readFileSync(`${ROOT}levels/verdant-g.json`, 'utf8')) as Level;

const SPECIES = [1, 2, 3, 4, 5].map((i) => ({
  id: `s${i}`,
  kind: 'plant' as const,
  name: `Plant ${i}`,
  description: 'A plant.',
}));

describe('buildSurveyReport', () => {
  it('is not complete while an objective is still open', () => {
    const progress = reachLandmark(emptyProgress(), 'the tall spire');
    const report = buildSurveyReport(verdant, progress);
    expect(report.complete).toBe(false);
    expect(report.objectives.map((status) => status.done)).toEqual([false, true]);
  });

  it('is complete once every objective is done, and lists the planet and the species', () => {
    const progress = SPECIES.reduce(recordSpecies, emptyProgress());
    const done = markReturned(reachLandmark(progress, 'the tall spire'));
    const report = buildSurveyReport(verdant, done);
    expect(report.complete).toBe(true);
    expect(report.worldName).toBe('Verdant');
    expect(report.facts).toEqual(computeWorldFacts(verdant));
    expect(report.species.map((entry) => entry.name)).toEqual(SPECIES.map((entry) => entry.name));
  });
});

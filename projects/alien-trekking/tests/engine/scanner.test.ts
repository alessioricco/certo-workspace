import { describe, expect, it } from 'vitest';
import { lookDirection } from '../../src/engine/player';
import { findAimedTarget, SCAN_RANGE_M, type ScanTarget } from '../../src/engine/scanner';
import { recordScan } from '../../src/engine/survey';
import type { SpeciesInfo } from '../../src/engine/species';
import type { Vec3 } from '../../src/engine/sky';
import { expectClose } from './helpers';

const EYE: Vec3 = [0, 1.7, 0];
const AHEAD: Vec3 = [0, 0, -1];

function target(speciesId: string, x: number, z: number): ScanTarget {
  return { speciesId, position: [x, 1.7, z] };
}

describe('lookDirection', () => {
  it('looks along -z at heading 0 and level pitch, and along -x after a quarter turn to the left', () => {
    const level = lookDirection(0, 0);
    expectClose(level[0], 0);
    expectClose(level[1], 0);
    expectClose(level[2], -1);
    const quarter = lookDirection(Math.PI / 2, 0);
    expectClose(quarter[0], -1);
    expectClose(quarter[2], 0);
  });

  it('points up with positive pitch and stays a unit vector', () => {
    const up = lookDirection(0.7, 0.4);
    expectClose(up[1], Math.sin(0.4));
    expectClose(Math.hypot(...up), 1);
  });
});

describe('findAimedTarget', () => {
  it('finds a target straight ahead within range', () => {
    const plant = target('plant-0', 0, -10);
    expect(findAimedTarget(EYE, AHEAD, [plant])).toBe(plant);
  });

  it('ignores targets off to the side, behind, or beyond scanning range', () => {
    const side = target('plant-0', 10, -1);
    const behind = target('plant-1', 0, 10);
    const far = target('animal-0', 0, -(SCAN_RANGE_M + 5));
    expect(findAimedTarget(EYE, AHEAD, [side, behind, far])).toBeUndefined();
  });

  it('picks the target nearest the middle of the view', () => {
    const edge = target('plant-0', 0.7, -10);
    const centre = target('animal-0', 0.1, -10);
    expect(findAimedTarget(EYE, AHEAD, [edge, centre])).toBe(centre);
  });

  it('is empty when nothing is in view', () => {
    expect(findAimedTarget(EYE, AHEAD, [])).toBeUndefined();
  });
});

describe('recordScan', () => {
  const species: SpeciesInfo = {
    id: 'plant-0',
    kind: 'plant',
    name: 'Vorila',
    description: 'A slender stalk, deep violet, about 4.0 m tall.',
  };

  it('adds a species once: a second scan of it changes nothing', () => {
    const first = recordScan([], species);
    expect(first.isNew).toBe(true);
    expect(first.log).toEqual([species]);
    const second = recordScan(first.log, species);
    expect(second.isNew).toBe(false);
    expect(second.log).toEqual([species]);
  });

  it('keeps the order of identification and other species', () => {
    const animal: SpeciesInfo = { ...species, id: 'animal-0', kind: 'animal', name: 'Tessox' };
    const log = recordScan(recordScan([], species).log, animal).log;
    expect(log.map((entry) => entry.id)).toEqual(['plant-0', 'animal-0']);
  });
});

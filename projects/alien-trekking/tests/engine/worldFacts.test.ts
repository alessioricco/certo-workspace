import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Level } from '../../src/engine/level';
import { computeWorldFacts } from '../../src/engine/worldFacts';
import { expectClose } from './helpers';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function loadShipped(file: string): Level {
  return JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8')) as Level;
}

describe('computeWorldFacts', () => {
  it('describes Verdant: Earth-like, habitable and breathable', () => {
    const facts = computeWorldFacts(loadShipped('verdant-g.json'));
    expectClose(facts.gravityMS2, 9.81);
    expectClose(facts.escapeVelocityKmS, 11.186);
    expectClose(facts.surfaceTemperatureK, 287.83);
    expect(facts.inHabitableZone).toBe(true);
    expect(facts.air).toBe('breathable');
  });

  it('describes Ember: a hot red dwarf world, too close for the habitable zone, with thin air', () => {
    const facts = computeWorldFacts(loadShipped('ember-m.json'));
    expectClose(facts.surfaceTemperatureK, 310.76);
    expectClose(facts.habitableZone.inner, 0.1907);
    expectClose(facts.habitableZone.outer, 0.2747);
    expect(facts.inHabitableZone).toBe(false);
    expect(facts.air).toBe('too thin');
  });

  it('describes Boulder: strong gravity, habitable zone, breathable air', () => {
    const facts = computeWorldFacts(loadShipped('boulder-k.json'));
    expectClose(facts.gravityMS2, 21.8);
    expectClose(facts.surfaceTemperatureK, 319.04);
    expect(facts.inHabitableZone).toBe(true);
    expect(facts.air).toBe('breathable');
  });
});

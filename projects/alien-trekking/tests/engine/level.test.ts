import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLevel } from '../../src/engine/level';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function validLevel(): Record<string, unknown> {
  return {
    id: 'verdant-g',
    name: 'Verdant',
    seed: 42,
    star: { class: 'G' },
    planet: {
      massEarths: 1.0,
      radiusEarths: 1.0,
      orbitAU: 1.0,
      albedo: 0.3,
      dayLengthHours: 24,
      atmosphere: { pressureAtm: 1.0, oxygenFraction: 0.21 },
    },
    objectives: [
      { kind: 'scan-species', count: 5 },
      { kind: 'reach-landmark', name: 'the tall spire' },
    ],
    assets: {},
  };
}

function withPlanet(changes: Record<string, unknown>): Record<string, unknown> {
  const level = validLevel();
  level.planet = { ...(level.planet as Record<string, unknown>), ...changes };
  return level;
}

describe('validateLevel', () => {
  it('accepts a valid level', () => {
    expect(validateLevel(validLevel())).toEqual([]);
  });

  it.each(['verdant-g.json', 'ember-m.json', 'boulder-k.json'])(
    'accepts the shipped level %s',
    (file) => {
      const json: unknown = JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8'));
      expect(validateLevel(json)).toEqual([]);
    },
  );

  it('reports a missing field by its path', () => {
    const level = validLevel();
    delete (level.planet as Record<string, unknown>).massEarths;
    expect(validateLevel(level)).toEqual(['planet.massEarths is missing']);
  });

  it('reports a number out of range with its limits', () => {
    const errors = validateLevel(withPlanet({ massEarths: 12 }));
    expect(errors).toEqual(['planet.massEarths must be between 0.1 and 10 (got 12)']);
  });

  it('rejects radius, pressure and oxygen outside their ranges', () => {
    const errors = validateLevel(
      withPlanet({
        radiusEarths: 0.1,
        atmosphere: { pressureAtm: -1, oxygenFraction: 1.5 },
      }),
    );
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toContain('planet.radiusEarths must be between 0.3 and 3');
    expect(errors.join('\n')).toContain('planet.atmosphere.pressureAtm must be between 0 and 10');
    expect(errors.join('\n')).toContain('planet.atmosphere.oxygenFraction must be between 0 and 1');
  });

  it('rejects a fractional seed', () => {
    const level = validLevel();
    level.seed = 1.5;
    expect(validateLevel(level)).toEqual(['seed must be a whole number']);
  });

  it('rejects an unknown star class', () => {
    const level = validLevel();
    level.star = { class: 'Q' };
    expect(validateLevel(level)).toEqual([
      'star.class must be one of M, K, G, F, A (got "Q")',
    ]);
  });

  it('rejects a non-numeric value', () => {
    expect(validateLevel(withPlanet({ albedo: 'bright' }))).toEqual([
      'planet.albedo must be a number',
    ]);
  });

  it('rejects objectives that are not a list of kinds', () => {
    const level = validLevel();
    level.objectives = [{ count: 3 }];
    expect(validateLevel(level)).toEqual(['objectives[0].kind is missing']);
  });

  it('rejects something that is not a level object', () => {
    expect(validateLevel([])).toEqual(['the level must be a JSON object']);
  });

  it('accepts the three objective kinds and an optional assets block', () => {
    const level = validLevel();
    level.objectives = [
      { kind: 'scan-species', count: 7 },
      { kind: 'reach-landmark', name: 'the tall spire' },
      { kind: 'return-to-lander' },
    ];
    level.assets = {
      lander: { model: 'models/lander.glb', texture: 'textures/hull.png' },
      species: { Vorox: { model: 'https://example.com/vorox.glb' } },
    };
    expect(validateLevel(level)).toEqual([]);
    delete level.assets;
    expect(validateLevel(level)).toEqual([]);
  });

  it('rejects an unknown objective kind and lists the kinds that exist', () => {
    const level = validLevel();
    level.objectives = [{ kind: 'collect-rocks' }];
    expect(validateLevel(level)).toEqual([
      'objectives[0].kind must be one of scan-species, reach-landmark, return-to-lander (got "collect-rocks")',
    ]);
  });

  it('checks the count of a scan objective: a whole number from 1 to 7', () => {
    const level = validLevel();
    level.objectives = [{ kind: 'scan-species', count: 9 }];
    expect(validateLevel(level)).toEqual(['objectives[0].count must be between 1 and 7 (got 9)']);
    level.objectives = [{ kind: 'scan-species', count: 2.5 }];
    expect(validateLevel(level)).toEqual(['objectives[0].count must be a whole number']);
    level.objectives = [{ kind: 'scan-species' }];
    expect(validateLevel(level)).toEqual(['objectives[0].count is missing']);
  });

  it('requires a name on a reach-landmark objective', () => {
    const level = validLevel();
    level.objectives = [{ kind: 'reach-landmark' }];
    expect(validateLevel(level)).toEqual(['objectives[0].name is missing']);
  });

  it('rejects an unknown asset name and an empty asset', () => {
    const level = validLevel();
    level.assets = { rover: { model: 'rover.glb' }, lander: {} };
    expect(validateLevel(level)).toEqual([
      'assets.rover is not a known asset (use lander or species)',
      'assets.lander.model is missing',
    ]);
  });

  it('accepts texture-only assets for lander and species', () => {
    const level = validLevel();
    level.assets = { lander: { texture: 'hull.png' }, species: { Tallis: { texture: 'plant.png' } } };
    expect(validateLevel(level)).toEqual([]);
  });

  it('rejects a species asset that is not an object with a model', () => {
    const level = validLevel();
    level.assets = { species: { Vorox: 'vorox.glb' } };
    expect(validateLevel(level)).toEqual(['assets.species.Vorox must be an object']);
  });
});

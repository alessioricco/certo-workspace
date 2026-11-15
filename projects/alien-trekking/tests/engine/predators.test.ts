import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planAnimalSpecies, type AnimalSpecies } from '../../src/engine/animals';
import { CHUNK_SIZE_M, chunkAt, type ChunkCoord } from '../../src/engine/chunks';
import { createEcosystem, predatorsInChunk, type Ecosystem } from '../../src/engine/ecosystem';
import type { HeightFn } from '../../src/engine/gait';
import { LANDER_CLEARANCE_M } from '../../src/engine/lander';
import type { Level } from '../../src/engine/level';
import {
  createPredator,
  inTerritory,
  STRIKE_DAMAGE,
  STRIKE_INTERVAL_S,
  stepPredators,
  TERRITORY_RADIUS_M,
  WARN_SECONDS,
  type Predator,
  type PredatorEvent,
  type Spot,
} from '../../src/engine/predators';
import { mulberry32 } from '../../src/engine/random';
import { stunCreature } from '../../src/engine/sampler';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FRAME = 1 / 60;
const flat: HeightFn = () => 0;
const DEN: Spot = { x: 0, z: 0 };

function loadLevel(file: string): Level {
  return JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8')) as Level;
}

function predatorSpecies(): AnimalSpecies {
  return planAnimalSpecies(mulberry32(8), 9.81, [200, 170, 140], 1, new Set(), 'predator')[0];
}

function predatorAtDen(seed = 5): Predator {
  return createPredator(predatorSpecies(), DEN, mulberry32(seed));
}

function stayAt(x: number, z: number): (t: number) => Spot {
  return () => ({ x, z });
}

/** Runs one predator for `seconds`, with the player where `playerAt` says at each moment. */
function simulate(
  predator: Predator,
  playerAt: (t: number) => Spot,
  seconds: number,
): Array<{ at: number; event: PredatorEvent }> {
  const events: Array<{ at: number; event: PredatorEvent }> = [];
  for (let t = 0; t < seconds; t += FRAME) {
    for (const event of stepPredators([predator], playerAt(t), FRAME, flat)) {
      events.push({ at: t, event });
    }
  }
  return events;
}

const strikesOf = (events: Array<{ at: number; event: PredatorEvent }>) =>
  events.filter((item) => item.event.kind === 'strike');

describe('territory check', () => {
  it('counts a point inside when it is within 16 m of the den', () => {
    const den = predatorAtDen();
    expect(inTerritory(den, { x: 0, z: 0 })).toBe(true);
    expect(inTerritory(den, { x: TERRITORY_RADIUS_M, z: 0 })).toBe(true);
    expect(inTerritory(den, { x: 0, z: -15.9 })).toBe(true);
  });

  it('counts a point outside when it is just beyond 16 m', () => {
    expect(inTerritory(predatorAtDen(), { x: TERRITORY_RADIUS_M + 0.01, z: 0 })).toBe(false);
  });

  it('measures from the den, not from where the predator stands now', () => {
    const den = predatorAtDen();
    den.x = 10;
    expect(inTerritory(den, { x: -15, z: 0 })).toBe(true);
  });
});

describe('warning and attack', () => {
  it('warns once when the player enters the territory', () => {
    const den = predatorAtDen();
    const events = simulate(den, stayAt(5, 0), 0.5);
    expect(events.map((item) => item.event.kind)).toEqual(['warn']);
    expect(den.mood).toBe('warn');
  });

  it('does not strike during the warning, only after it has run out', () => {
    const events = strikesOf(simulate(predatorAtDen(), stayAt(5, 0), 8));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].at).toBeGreaterThanOrEqual(WARN_SECONDS - FRAME);
    expect(events.every((item) => item.event.kind === 'strike' && item.event.damage === STRIKE_DAMAGE)).toBe(true);
  });

  it('strikes again every 1.5 s while the player stays within reach', () => {
    const events = strikesOf(simulate(predatorAtDen(), stayAt(5, 0), 14));
    expect(events.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < events.length; i++) {
      expect(Math.abs(events[i].at - events[i - 1].at - STRIKE_INTERVAL_S)).toBeLessThanOrEqual(FRAME + 1e-9);
    }
  });

  it('does not attack a player who leaves during the warning', () => {
    const den = predatorAtDen();
    const leaves = (t: number): Spot => (t < 1 ? { x: 5, z: 0 } : { x: 40, z: 0 });
    const events = simulate(den, leaves, 12);
    expect(strikesOf(events)).toHaveLength(0);
    expect(den.mood).toBe('patrol');
  });
});

describe('stun on a predator', () => {
  it('stops it attacking while it is stunned, then lets it go', () => {
    const den = predatorAtDen();
    simulate(den, stayAt(1, 0), 1);
    stunCreature(den);
    const during: Array<{ at: number; event: PredatorEvent }> = [];
    for (let t = 0; t < 4.5; t += FRAME) {
      for (const event of stepPredators([den], { x: 1, z: 0 }, FRAME, flat)) during.push({ at: t, event });
    }
    expect(strikesOf(during)).toHaveLength(0);
    expect(den.mood).toBe('stunned');
    for (let t = 0; t < 1; t += FRAME) stepPredators([den], { x: 1, z: 0 }, FRAME, flat);
    expect(den.mood).not.toBe('stunned');
  });
});

describe('patrol', () => {
  it('keeps to its territory for five minutes while the player is far away', () => {
    const den = predatorAtDen(9);
    for (let t = 0; t < 300; t += FRAME) {
      stepPredators([den], { x: 1000, z: 1000 }, FRAME, flat);
      expect(inTerritory(den, den)).toBe(true);
    }
  });

  it('marks its territory with bones and scratches inside the territory', () => {
    const den = predatorAtDen(9);
    expect(den.marks.length).toBeGreaterThan(0);
    for (const mark of den.marks) {
      expect(['bone', 'scratch']).toContain(mark.kind);
      expect(inTerritory(den, mark)).toBe(true);
    }
  });
});

describe('predators in the world', () => {
  const levels = ['verdant-g.json', 'ember-m.json', 'boulder-k.json'].map((file) => loadLevel(file));
  const chunks: ChunkCoord[] = [];
  for (let cz = -5; cz <= 5; cz++) for (let cx = -5; cx <= 5; cx++) chunks.push({ cx, cz });

  function predatorsOf(ecosystem: Ecosystem): Array<{ coord: ChunkCoord; predator: Predator }> {
    return chunks.flatMap((coord) =>
      predatorsInChunk(ecosystem, coord).map((predator) => ({ coord, predator })),
    );
  }

  it('gives every world two predator species, distinct from the herds and plants', () => {
    for (const level of levels) {
      const ecosystem = createEcosystem(level);
      expect(ecosystem.predators).toHaveLength(2);
      expect(ecosystem.predators.every((species) => species.predator)).toBe(true);
      const names = [...ecosystem.plants, ...ecosystem.animals, ...ecosystem.predators].map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('places some predators in every world, each inside its own chunk and clear of the lander', () => {
    for (const level of levels) {
      const found = predatorsOf(createEcosystem(level));
      expect(found.length).toBeGreaterThan(0);
      for (const { coord, predator } of found) {
        expect(chunkAt(predator.homeX, predator.homeZ, CHUNK_SIZE_M)).toEqual(coord);
        expect(Math.hypot(predator.homeX, predator.homeZ)).toBeGreaterThanOrEqual(LANDER_CLEARANCE_M);
      }
    }
  });

  it('gives the same predators every time for the same world', () => {
    const ecosystem = createEcosystem(levels[0]);
    const first = predatorsOf(ecosystem).map((item) => [item.predator.homeX, item.predator.homeZ]);
    const second = predatorsOf(createEcosystem(levels[0])).map((item) => [item.predator.homeX, item.predator.homeZ]);
    expect(second).toEqual(first);
  });
});

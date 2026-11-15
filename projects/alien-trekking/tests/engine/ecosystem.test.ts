import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE_M, chunkOrigin, type ChunkCoord } from '../../src/engine/chunks';
import { createEcosystem, herdsInChunk, plantsInChunk, speciesById } from '../../src/engine/ecosystem';
import type { Level } from '../../src/engine/level';
import { PLANT_MAX_SLOPE_DEG } from '../../src/engine/habitat';
import { slopeDegAt } from '../../src/engine/terrain';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function loadLevel(file: string): Level {
  return JSON.parse(readFileSync(`${ROOT}levels/${file}`, 'utf8')) as Level;
}

const verdant = loadLevel('verdant-g.json');
const ember = loadLevel('ember-m.json');
const boulder = loadLevel('boulder-k.json');

function chunksAround(radius: number): ChunkCoord[] {
  const coords: ChunkCoord[] = [];
  for (let cz = -radius; cz <= radius; cz++) {
    for (let cx = -radius; cx <= radius; cx++) coords.push({ cx, cz });
  }
  return coords;
}

describe('createEcosystem', () => {
  it('gives three plant species and two animal species, with their own names', () => {
    const ecosystem = createEcosystem(verdant);
    expect(ecosystem.plants).toHaveLength(3);
    expect(ecosystem.animals).toHaveLength(2);
    const names = [...ecosystem.plants, ...ecosystem.animals].map((species) => species.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('colours the plants by the star: black on a red dwarf, red on a K star, green on a G star', () => {
    expect(createEcosystem(ember).plants.every((plant) => plant.hue === 'black')).toBe(true);
    expect(createEcosystem(boulder).plants.every((plant) => plant.hue === 'red')).toBe(true);
    expect(createEcosystem(verdant).plants.every((plant) => plant.hue === 'green')).toBe(true);
  });

  it('makes animals squatter on a heavier world with the same seed', () => {
    const light = createEcosystem(verdant).animals[0];
    const heavy = createEcosystem({
      ...verdant,
      planet: { ...verdant.planet, massEarths: 5, radiusEarths: 1.5 },
    }).animals[0];
    expect(heavy.legLengthM / heavy.bodyHeightM).toBeLessThan(light.legLengthM / light.bodyHeightM);
    expect(heavy.bodyLengthM).toBeLessThan(light.bodyLengthM);
  });

  it('finds a species by id', () => {
    const ecosystem = createEcosystem(verdant);
    expect(speciesById(ecosystem, 'plant-1')).toBe(ecosystem.plants[1]);
    expect(speciesById(ecosystem, 'animal-0')).toBe(ecosystem.animals[0]);
    expect(speciesById(ecosystem, 'nothing')).toBeUndefined();
  });
});

describe('plantsInChunk', () => {
  it('gives the same plants for the same chunk of the same world', () => {
    const ecosystem = createEcosystem(verdant);
    const coord = { cx: 2, cz: -1 };
    expect(plantsInChunk(ecosystem, coord)).toEqual(plantsInChunk(ecosystem, coord));
  });

  it('grows plants on Verdant, and places each one inside its chunk on ground that is not too steep', () => {
    const ecosystem = createEcosystem(verdant);
    let total = 0;
    for (const coord of chunksAround(2)) {
      const origin = chunkOrigin(coord, CHUNK_SIZE_M);
      for (const spot of plantsInChunk(ecosystem, coord)) {
        total++;
        const [x, groundM, z] = spot.position;
        expect(x).toBeGreaterThanOrEqual(origin.x);
        expect(x).toBeLessThan(origin.x + CHUNK_SIZE_M);
        expect(z).toBeGreaterThanOrEqual(origin.z);
        expect(z).toBeLessThan(origin.z + CHUNK_SIZE_M);
        expect(slopeDegAt(x, z, verdant.seed)).toBeLessThan(PLANT_MAX_SLOPE_DEG);
        expect(spot.scanPoint[1]).toBeGreaterThan(groundM);
        expect(speciesById(ecosystem, spot.speciesId)).toBeDefined();
      }
    }
    expect(total).toBeGreaterThan(100);
  });
});

describe('herdsInChunk', () => {
  it('starts herds well inside their chunk, with animals of the world’s species', () => {
    const ecosystem = createEcosystem(verdant);
    let herds = 0;
    for (const coord of chunksAround(3)) {
      const origin = chunkOrigin(coord, CHUNK_SIZE_M);
      for (const herd of herdsInChunk(ecosystem, coord)) {
        herds++;
        expect(herd.homeX - origin.x).toBeGreaterThanOrEqual(18);
        expect(origin.x + CHUNK_SIZE_M - herd.homeX).toBeGreaterThanOrEqual(18);
        expect(herd.homeZ - origin.z).toBeGreaterThanOrEqual(18);
        expect(origin.z + CHUNK_SIZE_M - herd.homeZ).toBeGreaterThanOrEqual(18);
        expect(herd.animals.length).toBeGreaterThanOrEqual(3);
        expect(herd.animals.length).toBeLessThanOrEqual(6);
        expect(speciesById(ecosystem, herd.speciesId)?.kind).toBe('animal');
      }
    }
    expect(herds).toBeGreaterThan(0);
  });

  it('gives the same herds for the same chunk', () => {
    const ecosystem = createEcosystem(verdant);
    const coord = { cx: 0, cz: 0 };
    const animals = (): unknown => herdsInChunk(ecosystem, coord).map((herd) => herd.animals);
    expect(animals()).toEqual(animals());
  });
});

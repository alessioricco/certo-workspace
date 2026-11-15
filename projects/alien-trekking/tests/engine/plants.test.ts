import { describe, expect, it } from 'vitest';
import { HUE_PALETTE, plantHue, planPlantSpecies, plantHeight, type PlantHue } from '../../src/engine/plants';
import { plantDensity, plantSuitability, wetness } from '../../src/engine/habitat';
import { mulberry32 } from '../../src/engine/random';

const EARTHLIKE = { heightM: 0, slopeDeg: 0, baseTemperatureK: 288 };

describe('plantHue', () => {
  it('matches the worked examples', () => {
    expect(plantHue(3200)).toBe('black');
    expect(plantHue(4500)).toBe('red');
    expect(plantHue(5778)).toBe('green');
    expect(plantHue(9000)).toBe('blue');
  });

  it('switches hue at the class boundaries', () => {
    expect(plantHue(3499)).toBe('black');
    expect(plantHue(3500)).toBe('red');
    expect(plantHue(4999)).toBe('red');
    expect(plantHue(5000)).toBe('green');
    expect(plantHue(6499)).toBe('green');
    expect(plantHue(6500)).toBe('blue');
  });
});

describe('plant colour', () => {
  it('is nearly black for black plants and clearly green for green plants', () => {
    const [r, g, b] = HUE_PALETTE.black;
    expect(r + g + b).toBeLessThan(120);
    const [gr, gg, gb] = HUE_PALETTE.green;
    expect(gg).toBeGreaterThan(gr);
    expect(gg).toBeGreaterThan(gb);
  });

  it('gives each species the colour of its world’s hue', () => {
    const hues: PlantHue[] = ['black', 'red', 'green', 'blue'];
    for (const hue of hues) {
      const species = planPlantSpecies(mulberry32(7), hue, 3, new Set());
      for (const plant of species) {
        const base = HUE_PALETTE[hue];
        const distance = plant.colour.reduce((sum, value, i) => sum + Math.abs(value - base[i]), 0);
        expect(distance).toBeLessThan(255 * 3 * 0.2);
      }
    }
  });
});

describe('planPlantSpecies', () => {
  it('makes named species with a description, a height, and parts', () => {
    const taken = new Set<string>();
    const species = planPlantSpecies(mulberry32(42), 'green', 3, taken);
    expect(species.map((plant) => plant.id)).toEqual(['plant-0', 'plant-1', 'plant-2']);
    expect(new Set(species.map((plant) => plant.name)).size).toBe(3);
    for (const plant of species) {
      expect(plant.name.length).toBeGreaterThan(2);
      expect(plant.description).toContain(`${plant.heightM.toFixed(1)} m tall`);
      expect(plant.heightM).toBeGreaterThan(0.5);
      expect(plant.heightM).toBeLessThan(10);
      expect(plant.parts.length).toBeGreaterThanOrEqual(2);
      expect(plantHeight(plant.parts)).toBeCloseTo(plant.heightM, 9);
    }
  });

  it('gives the same species for the same seed', () => {
    const first = planPlantSpecies(mulberry32(9), 'red', 3, new Set());
    const second = planPlantSpecies(mulberry32(9), 'red', 3, new Set());
    expect(second).toEqual(first);
  });
});

describe('plantSuitability', () => {
  it('is best on gentle, low, temperate ground', () => {
    expect(plantSuitability(EARTHLIKE)).toBe(1);
  });

  it('is zero on ground of 30 degrees or more', () => {
    expect(plantSuitability({ ...EARTHLIKE, slopeDeg: 30 })).toBe(0);
    expect(plantSuitability({ ...EARTHLIKE, slopeDeg: 45 })).toBe(0);
  });

  it('is zero high up, where the ground is too high', () => {
    expect(plantSuitability({ ...EARTHLIKE, heightM: 30 })).toBe(0);
    expect(plantSuitability({ ...EARTHLIKE, heightM: 18 })).toBeGreaterThan(0);
    expect(plantSuitability({ ...EARTHLIKE, heightM: 18 })).toBeLessThan(1);
  });

  it('is zero when it is too cold or too hot to live', () => {
    expect(plantSuitability({ ...EARTHLIKE, baseTemperatureK: 240 })).toBe(0);
    expect(plantSuitability({ ...EARTHLIKE, baseTemperatureK: 340 })).toBe(0);
    expect(plantSuitability({ ...EARTHLIKE, baseTemperatureK: 320 })).toBeGreaterThan(0);
  });

  it('grows denser on water-filled lowland than on high dry ground', () => {
    expect(wetness(-6)).toBe(1);
    expect(wetness(6)).toBe(0);
    const lowland = plantDensity({ ...EARTHLIKE, heightM: -4 });
    const highland = plantDensity({ ...EARTHLIKE, heightM: 4 });
    expect(lowland).toBeGreaterThan(highland);
    expect(highland).toBeGreaterThan(0);
  });
});

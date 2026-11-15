import { describe, expect, it } from 'vitest';
import {
  dayPhase,
  daylight,
  fogDensityPerM,
  skyDirection,
  skyState,
  starElevation,
  visibleStarFraction,
  worldHours,
  type SkyWorld,
} from '../../src/engine/sky';
import { expectClose } from './helpers';

const EARTHLIKE: SkyWorld = { starClass: 'G', dayLengthHours: 24, pressureAtm: 1 };

describe('starElevation', () => {
  it('matches the worked examples', () => {
    expectClose(starElevation(0, 24), 0);
    expectClose(starElevation(6, 24), 90);
    expectClose(starElevation(9, 24), 45);
    expectClose(starElevation(18, 24), -90);
  });
});

describe('visibleStarFraction', () => {
  it('matches the worked examples', () => {
    expectClose(visibleStarFraction(0), 1);
    expectClose(visibleStarFraction(1.5), 0.5);
    expectClose(visibleStarFraction(3), 0);
    expectClose(visibleStarFraction(4), 0);
  });
});

describe('daylight', () => {
  it('is 0 at night, 1 in full day and half way at the horizon', () => {
    expect(daylight(-30)).toBe(0);
    expect(daylight(30)).toBe(1);
    expect(daylight(0)).toBe(0.5);
  });
});

describe('dayPhase', () => {
  it('runs dawn, day, dusk and night across the day from sunrise', () => {
    expect(dayPhase(0.5, 24)).toBe('dawn');
    expect(dayPhase(6, 24)).toBe('day');
    expect(dayPhase(11.5, 24)).toBe('dusk');
    expect(dayPhase(18, 24)).toBe('night');
    expect(dayPhase(23.5, 24)).toBe('dawn');
  });
});

describe('skyDirection', () => {
  it('is a unit vector whose height is the star elevation', () => {
    for (let hours = 0; hours < 24; hours += 0.5) {
      const direction = skyDirection((2 * Math.PI * hours) / 24, 0);
      const length = Math.hypot(...direction);
      expectClose(length, 1);
      expectClose((Math.asin(direction[1]) * 180) / Math.PI, starElevation(hours, 24));
    }
  });
});

describe('fogDensityPerM', () => {
  it('grows with the atmosphere pressure', () => {
    const densities = [0, 0.5, 1, 2, 5, 10].map(fogDensityPerM);
    for (let i = 1; i < densities.length; i++) {
      expect(densities[i]).toBeGreaterThan(densities[i - 1]);
    }
  });
});

describe('worldHours', () => {
  it('advances ten real seconds per world hour', () => {
    expectClose(worldHours(3, 0), 3);
    expectClose(worldHours(3, 20), 5);
  });
});

describe('skyState', () => {
  it('is the same for the same world and time', () => {
    expect(skyState(EARTHLIKE, 9)).toEqual(skyState(EARTHLIKE, 9));
  });

  it('wraps the time of day into one day, and keeps the star elevation consistent', () => {
    const state = skyState(EARTHLIKE, 24 + 9);
    expectClose(state.timeOfDayHours, 9);
    expectClose(state.starElevationDeg, 45);
    expectClose((Math.asin(state.starDirection[1]) * 180) / Math.PI, 45);
  });

  it('lights the sky by day and darkens it at night', () => {
    const noon = skyState(EARTHLIKE, 6);
    const midnight = skyState(EARTHLIKE, 18);
    expect(noon.phase).toBe('day');
    expect(noon.daylight).toBe(1);
    expect(midnight.phase).toBe('night');
    expect(midnight.daylight).toBe(0);
    expect(noon.zenithColour[2]).toBe(255);
    expect(midnight.zenithColour[2]).toBeLessThan(40);
    expect(midnight.ambientColour[2]).toBeGreaterThan(midnight.zenithColour[2]);
  });

  it('makes a red dwarf light reddish: its star colour is redder than a G star', () => {
    const red = skyState({ starClass: 'M', dayLengthHours: 24, pressureAtm: 1 }, 6);
    const sunlike = skyState(EARTHLIKE, 6);
    expect(red.starColour[2]).toBeLessThan(sunlike.starColour[2]);
  });

  it('shows fewer stars and denser fog through a thicker atmosphere', () => {
    const thin = skyState({ ...EARTHLIKE, pressureAtm: 0.5 }, 18);
    const thick = skyState({ ...EARTHLIKE, pressureAtm: 2.5 }, 18);
    expect(thick.visibleStarFraction).toBeLessThan(thin.visibleStarFraction);
    expect(thick.fogDensityPerM).toBeGreaterThan(thin.fogDensityPerM);
  });
});

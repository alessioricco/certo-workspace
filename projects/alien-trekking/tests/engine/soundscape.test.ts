import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/random';
import {
  CALL_MEAN_INTERVAL_S,
  callIntervalS,
  callLevel,
  callPitchHz,
  nearestCaller,
  stepCallTimer,
  windCutoffHz,
  windLevel,
} from '../../src/engine/soundscape';

describe('windLevel and windCutoffHz', () => {
  it('blows louder and wider in a thicker atmosphere', () => {
    expect(windLevel(1)).toBeCloseTo(0.3, 3);
    expect(windLevel(2)).toBeGreaterThan(windLevel(1));
    expect(windCutoffHz(1)).toBeCloseTo(550, 3);
    expect(windCutoffHz(2)).toBeGreaterThan(windCutoffHz(1));
  });

  it('caps the wind level', () => {
    expect(windLevel(10)).toBeCloseTo(0.6, 3);
  });
});

describe('callPitchHz', () => {
  it('calls lower for a bigger body', () => {
    expect(callPitchHz(2)).toBeCloseTo(300, 3);
    expect(callPitchHz(1.2)).toBeCloseTo(500, 3);
  });
});

describe('callLevel', () => {
  it('is full at the caller and silent at the edge of range', () => {
    expect(callLevel(0)).toBe(1);
    expect(callLevel(30)).toBeCloseTo(0.5, 3);
    expect(callLevel(60)).toBe(0);
    expect(callLevel(90)).toBe(0);
  });
});

describe('nearestCaller', () => {
  const callers = [
    { x: 10, z: 0, bodyLengthM: 1.5 },
    { x: 0, z: 20, bodyLengthM: 2 },
    { x: 100, z: 0, bodyLengthM: 1.2 },
  ];

  it('picks the nearest creature within range', () => {
    const heard = nearestCaller(callers, { x: 0, z: 0 });
    expect(heard?.caller).toBe(callers[0]);
    expect(heard?.distanceM).toBeCloseTo(10, 3);
  });

  it('hears nothing when every creature is out of range', () => {
    expect(nearestCaller([callers[2]], { x: 0, z: 0 })).toBeUndefined();
  });
});

describe('stepCallTimer', () => {
  it('counts down, then calls and starts the next interval', () => {
    const waiting = stepCallTimer({ remainingS: 1 }, 0.5, mulberry32(1));
    expect(waiting.due).toBe(false);
    expect(waiting.timer.remainingS).toBeCloseTo(0.5, 3);

    const due = stepCallTimer(waiting.timer, 0.6, () => 0.5);
    expect(due.due).toBe(true);
    expect(due.timer.remainingS).toBeCloseTo(Math.LN2 * CALL_MEAN_INTERVAL_S, 2);
  });
});

describe('callIntervalS', () => {
  it('averages the mean interval over many calls, from the seeded stream', () => {
    const random = mulberry32(42);
    let total = 0;
    const draws = 20000;
    for (let i = 0; i < draws; i++) total += callIntervalS(random);
    expect(total / draws).toBeGreaterThan(CALL_MEAN_INTERVAL_S * 0.95);
    expect(total / draws).toBeLessThan(CALL_MEAN_INTERVAL_S * 1.05);
  });
});

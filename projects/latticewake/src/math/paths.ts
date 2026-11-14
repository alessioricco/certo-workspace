import { at } from './indexed';
export const ENTRY_TICKS = 120;

export function sampleBezier(points: readonly number[], ticks: number): Float64Array {
  if (points.length !== 8 || !points.every(Number.isFinite) || !Number.isInteger(ticks) || ticks < 1) {
    throw new RangeError('A cubic path requires eight finite coordinates and a positive tick duration.');
  }
  const samples = new Float64Array((ticks + 1) * 2);
  for (let tick = 0; tick <= ticks; tick++) {
    const t = tick / ticks;
    const u = 1 - t;
    for (let axis = 0; axis < 2; axis++) {
      const value = u * u * u * at(points, axis) + 3 * u * u * t * at(points, axis + 2)
        + 3 * u * t * t * at(points, axis + 4) + t * t * t * at(points, axis + 6);
      samples[tick * 2 + axis] = Math.round(value * 1024) / 1024;
    }
  }
  return samples;
}

export const ENTRY_LEFT = sampleBezier([-420, -240, -260, 120, -24, -80, 0, 0], ENTRY_TICKS);
export const ENTRY_RIGHT = sampleBezier([420, -240, 260, 120, 24, -80, 0, 0], ENTRY_TICKS);
const QUARTER_SINE: readonly number[] = [0, 100, 200, 297, 392, 483, 569, 650, 724, 792, 851, 903, 946, 980, 1004, 1019, 1024];

export function swayX(tick: number): number {
  const phase = Math.floor(tick / 4) % 64;
  const quadrant = Math.floor(phase / 16);
  const index = quadrant % 2 === 0 ? phase % 16 : 16 - phase % 16;
  return at(QUARTER_SINE, index) * (quadrant < 2 ? 12 : -12) / 1024;
}

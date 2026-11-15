/** Keeps a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The fractional part of a number, always in [0, 1). */
export function fraction(value: number): number {
  return value - Math.floor(value);
}

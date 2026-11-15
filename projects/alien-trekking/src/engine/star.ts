export const STAR_CLASSES = ['M', 'K', 'G', 'F', 'A'] as const;

export type StarClass = (typeof STAR_CLASSES)[number];

export interface StarProperties {
  temperatureK: number;
  /** Luminosity in solar units. */
  luminosity: number;
}

/** Main-sequence values, approximate. */
export const STAR_PROPERTIES: Record<StarClass, StarProperties> = {
  M: { temperatureK: 3200, luminosity: 0.04 },
  K: { temperatureK: 4500, luminosity: 0.35 },
  G: { temperatureK: 5778, luminosity: 1.0 },
  F: { temperatureK: 6500, luminosity: 2.5 },
  A: { temperatureK: 9000, luminosity: 20 },
};

export function isStarClass(value: unknown): value is StarClass {
  return typeof value === 'string' && (STAR_CLASSES as readonly string[]).includes(value);
}

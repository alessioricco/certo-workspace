const BREATHABLE_MIN_ATM = 0.16;
const BREATHABLE_MAX_ATM = 0.5;

export type AirVerdict = 'too thin' | 'breathable' | 'toxic';

/** Oxygen partial pressure in atm. */
export function oxygenPartialPressure(pressureAtm: number, oxygenFraction: number): number {
  return pressureAtm * oxygenFraction;
}

export function assessAir(pressureAtm: number, oxygenFraction: number): AirVerdict {
  const ppO2 = oxygenPartialPressure(pressureAtm, oxygenFraction);
  if (ppO2 < BREATHABLE_MIN_ATM) return 'too thin';
  if (ppO2 > BREATHABLE_MAX_ATM) return 'toxic';
  return 'breathable';
}

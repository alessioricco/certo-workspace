import { clamp } from './math';

/** Red, green and blue, each a whole number from 0 to 255. */
export type Rgb = [number, number, number];

const WAVELENGTHS_NM = { red: 700, green: 550, blue: 450 } as const;

function toByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

/** Colour of a black body at a temperature in kelvin (Tanner Helland's approximation). */
export function blackbodyColor(kelvin: number): Rgb {
  const t = kelvin / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  let blue: number;
  if (t >= 66) blue = 255;
  else if (t <= 19) blue = 0;
  else blue = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [toByte(red), toByte(green), toByte(blue)];
}

/** The star's light scattered by the air: Rayleigh weights, so blue scatters most. */
export function skyColor(kelvin: number): Rgb {
  const star = blackbodyColor(kelvin);
  const weighted: Rgb = [
    star[0] * (550 / WAVELENGTHS_NM.red) ** 4,
    star[1] * (550 / WAVELENGTHS_NM.green) ** 4,
    star[2] * (550 / WAVELENGTHS_NM.blue) ** 4,
  ];
  const scale = 255 / Math.max(...weighted);
  return [toByte(weighted[0] * scale), toByte(weighted[1] * scale), toByte(weighted[2] * scale)];
}

/** Blends two colours: amount 0 gives `from`, amount 1 gives `to`. */
export function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * amount);
  return [mix(from[0], to[0]), mix(from[1], to[1]), mix(from[2], to[2])];
}

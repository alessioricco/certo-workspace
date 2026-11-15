export const EARTH_GRAVITY_MS2 = 9.81;
const EARTH_ESCAPE_VELOCITY_KM_S = 11.186;
const EQUILIBRIUM_TEMPERATURE_CONSTANT = 278.6;
const GREENHOUSE_KELVIN_PER_ATM = 33;

/** Surface gravity in m/s². */
export function surfaceGravity(massEarths: number, radiusEarths: number): number {
  return (EARTH_GRAVITY_MS2 * massEarths) / (radiusEarths * radiusEarths);
}

/** Escape velocity in km/s. */
export function escapeVelocity(massEarths: number, radiusEarths: number): number {
  return EARTH_ESCAPE_VELOCITY_KM_S * Math.sqrt(massEarths / radiusEarths);
}

/** Equilibrium temperature in kelvin, from luminosity in solar units and orbit in AU. */
export function equilibriumTemperature(
  luminosity: number,
  orbitAU: number,
  albedo: number,
): number {
  return (
    (EQUILIBRIUM_TEMPERATURE_CONSTANT * Math.pow(1 - albedo, 0.25) * Math.pow(luminosity, 0.25)) /
    Math.sqrt(orbitAU)
  );
}

/** Equilibrium temperature plus a simple greenhouse term, in kelvin. */
export function surfaceTemperature(
  luminosity: number,
  orbitAU: number,
  albedo: number,
  pressureAtm: number,
): number {
  return (
    equilibriumTemperature(luminosity, orbitAU, albedo) + GREENHOUSE_KELVIN_PER_ATM * pressureAtm
  );
}

/** Take-off speed of a jump, in m/s. */
export const JUMP_TAKEOFF_SPEED_MS = 3.13;

/** Height of a jump in metres, for gravity in m/s². */
export function jumpHeight(gravityMS2: number): number {
  return (JUMP_TAKEOFF_SPEED_MS * JUMP_TAKEOFF_SPEED_MS) / (2 * gravityMS2);
}

/** Habitable zone boundaries in AU. */
export function habitableZone(luminosity: number): { inner: number; outer: number } {
  return {
    inner: Math.sqrt(luminosity / 1.1),
    outer: Math.sqrt(luminosity / 0.53),
  };
}

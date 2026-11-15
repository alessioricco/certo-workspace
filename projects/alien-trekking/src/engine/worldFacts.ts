import { assessAir, type AirVerdict } from './atmosphere';
import type { Level } from './level';
import { escapeVelocity, habitableZone, surfaceGravity, surfaceTemperature } from './physics';
import { STAR_PROPERTIES } from './star';

export interface WorldFacts {
  gravityMS2: number;
  escapeVelocityKmS: number;
  surfaceTemperatureK: number;
  habitableZone: { inner: number; outer: number };
  inHabitableZone: boolean;
  air: AirVerdict;
}

export function computeWorldFacts(level: Level): WorldFacts {
  const { planet } = level;
  const { luminosity } = STAR_PROPERTIES[level.star.class];
  const zone = habitableZone(luminosity);
  return {
    gravityMS2: surfaceGravity(planet.massEarths, planet.radiusEarths),
    escapeVelocityKmS: escapeVelocity(planet.massEarths, planet.radiusEarths),
    surfaceTemperatureK: surfaceTemperature(
      luminosity,
      planet.orbitAU,
      planet.albedo,
      planet.atmosphere.pressureAtm,
    ),
    habitableZone: zone,
    inHabitableZone: planet.orbitAU >= zone.inner && planet.orbitAU <= zone.outer,
    air: assessAir(planet.atmosphere.pressureAtm, planet.atmosphere.oxygenFraction),
  };
}

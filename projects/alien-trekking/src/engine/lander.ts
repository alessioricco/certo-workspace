/** Where the player lands and wakes. Inside it the suit is sheltered: oxygen refills and health recovers. */
export const LANDER = { x: 0, z: 0, radiusM: 6 } as const;
/** Predators keep their territories this far from the lander. */
export const LANDER_CLEARANCE_M = 40;

export function atLander(point: { x: number; z: number }): boolean {
  return Math.hypot(point.x - LANDER.x, point.z - LANDER.z) <= LANDER.radiusM;
}

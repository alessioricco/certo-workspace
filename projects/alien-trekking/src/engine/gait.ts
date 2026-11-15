export type HeightFn = (x: number, z: number) => number;

export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * Steps `distanceM` along a heading (0 is +z, turning towards +x), unless the ground
 * ahead is steeper than `maxSlopeDeg`. Returns false when blocked.
 */
export function stepAlong(
  point: GroundPoint,
  headingRad: number,
  distanceM: number,
  heightAt: HeightFn,
  maxSlopeDeg: number,
): boolean {
  const nextX = point.x + Math.sin(headingRad) * distanceM;
  const nextZ = point.z + Math.cos(headingRad) * distanceM;
  const rise = heightAt(nextX, nextZ) - heightAt(point.x, point.z);
  if (Math.abs(Math.atan2(rise, distanceM)) > (maxSlopeDeg * Math.PI) / 180) return false;
  point.x = nextX;
  point.z = nextZ;
  return true;
}

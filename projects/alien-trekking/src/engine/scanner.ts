import type { Animal } from './herds';
import type { Predator } from './predators';
import type { Vec3 } from './sky';

/** Something a scan can identify: a plant or an animal, at a point in the world. */
export interface ScanTarget {
  speciesId: string;
  position: Vec3;
  /** The animal or predator itself, for a sampler shot; plants have none. */
  creature?: Animal | Predator;
}

export const SCAN_RANGE_M = 40;
const SCAN_CONE_DEG = 5;

/**
 * The target closest to the middle of the view, among those within scanning range
 * and inside a narrow cone around the look direction (a unit vector).
 */
export function findAimedTarget(
  eye: Vec3,
  forward: Vec3,
  targets: Iterable<ScanTarget>,
): ScanTarget | undefined {
  const cosLimit = Math.cos((SCAN_CONE_DEG * Math.PI) / 180);
  let best: ScanTarget | undefined;
  let bestCos = cosLimit;
  for (const target of targets) {
    const dx = target.position[0] - eye[0];
    const dy = target.position[1] - eye[1];
    const dz = target.position[2] - eye[2];
    const distance = Math.hypot(dx, dy, dz);
    if (distance === 0 || distance > SCAN_RANGE_M) continue;
    const cos = (dx * forward[0] + dy * forward[1] + dz * forward[2]) / distance;
    if (cos >= bestCos) {
      best = target;
      bestCos = cos;
    }
  }
  return best;
}

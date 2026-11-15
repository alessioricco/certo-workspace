import { JUMP_TAKEOFF_SPEED_MS } from './physics';
import type { Vec3 } from './sky';

export const EYE_HEIGHT_M = 1.7;
export const WALK_SPEED_MS = 4;
export const RUN_SPEED_MS = 8;
export const MAX_WALK_SLOPE_DEG = 45;
/** Ground this far below the feet still counts as walking, so the player follows downhill. */
export const STEP_DOWN_M = 0.5;
/** Longest time step, so a stalled frame cannot throw the player through the ground. */
export const MAX_STEP_S = 0.1;

const MAX_WALK_SLOPE_RAD = (MAX_WALK_SLOPE_DEG * Math.PI) / 180;

export interface PlayerBody {
  x: number;
  y: number;
  z: number;
  verticalSpeed: number;
  grounded: boolean;
}

export interface PlayerIntent {
  /** -1 backward to 1 forward. */
  forward: number;
  /** -1 left to 1 right. */
  strafe: number;
  /** Heading in radians; 0 looks along -z. */
  yaw: number;
  running: boolean;
  jump: boolean;
}

export interface Ground {
  gravityMS2: number;
  heightAt(x: number, z: number): number;
}

export const IDLE_INTENT: PlayerIntent = {
  forward: 0,
  strafe: 0,
  yaw: 0,
  running: false,
  jump: false,
};

export function createPlayer(x: number, z: number, ground: Ground): PlayerBody {
  return { x, y: ground.heightAt(x, z), z, verticalSpeed: 0, grounded: true };
}

/** Unit vector the eyes look along, for a heading and a pitch in radians; heading 0 looks along -z. */
export function lookDirection(yaw: number, pitch: number): Vec3 {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

/** Ground-plane unit vector for a movement intent, relative to the heading. */
export function moveDirection(forward: number, strafe: number, yaw: number): { dx: number; dz: number } {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const dx = -sin * forward + cos * strafe;
  const dz = -cos * forward - sin * strafe;
  const length = Math.hypot(dx, dz);
  return length > 1 ? { dx: dx / length, dz: dz / length } : { dx, dz };
}

/** Advances the player by `dtS` seconds: walking, jumping and falling under the planet's gravity. */
export function stepPlayer(
  body: PlayerBody,
  intent: PlayerIntent,
  dtS: number,
  ground: Ground,
): PlayerBody {
  const dt = Math.min(dtS, MAX_STEP_S);
  const jumping = body.grounded && intent.jump;
  let verticalSpeed = jumping ? JUMP_TAKEOFF_SPEED_MS : body.verticalSpeed;

  const { dx, dz } = moveDirection(intent.forward, intent.strafe, intent.yaw);
  const speed = intent.running ? RUN_SPEED_MS : WALK_SPEED_MS;
  const moved = slideAlongGround(body, dx * speed * dt, dz * speed * dt, body.grounded, ground);

  verticalSpeed -= ground.gravityMS2 * dt;
  const y = body.y + verticalSpeed * dt;
  const floor = ground.heightAt(moved.x, moved.z);
  const landed = y <= floor || (!jumping && body.grounded && y - floor <= STEP_DOWN_M);
  if (landed) {
    return { x: moved.x, y: floor, z: moved.z, verticalSpeed: 0, grounded: true };
  }
  return { x: moved.x, y, z: moved.z, verticalSpeed, grounded: false };
}

/** Moves on the ground without climbing slopes steeper than the limit; blocked axes stop, the other still slides. */
function slideAlongGround(
  body: PlayerBody,
  dx: number,
  dz: number,
  grounded: boolean,
  ground: Ground,
): { x: number; z: number } {
  const target = { x: body.x + dx, z: body.z + dz };
  if (!grounded || canWalk(body, target.x, target.z, ground)) return target;
  if (canWalk(body, target.x, body.z, ground)) return { x: target.x, z: body.z };
  if (canWalk(body, body.x, target.z, ground)) return { x: body.x, z: target.z };
  return { x: body.x, z: body.z };
}

function canWalk(body: PlayerBody, x: number, z: number, ground: Ground): boolean {
  const run = Math.hypot(x - body.x, z - body.z);
  if (run === 0) return true;
  const rise = ground.heightAt(x, z) - ground.heightAt(body.x, body.z);
  return Math.atan2(rise, run) <= MAX_WALK_SLOPE_RAD;
}

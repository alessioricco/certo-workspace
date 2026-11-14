export const FIELD_WIDTH = 360;
export const FIELD_HEIGHT = 640;
export const PLAYER_RADIUS = 8;
export const PLAYER_Y = 580;
export const PLAYER_SPEED = 250;
export const PLAYER_ACCELERATION = 1600;
export const SHOT_INTERVAL = 9;
export const BULLET_SPEED = 540;
export const BULLET_RADIUS = 3;
export const BULLET_CAPACITY = 128;
export const SINGLE_SHOT: readonly number[] = [0];

export function quantize(value: number): number {
  return Math.round(value * 1024) / 1024;
}

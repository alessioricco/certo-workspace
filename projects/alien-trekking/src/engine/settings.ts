import { clamp } from './math';

export interface Settings {
  /** Chunks loaded around the player, in each direction. */
  drawDistanceChunks: number;
  /** Multiplier on how fast the mouse turns the view. */
  lookSensitivity: number;
  /** Master volume: 0 is silent, 1 is full. */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  drawDistanceChunks: 4,
  lookSensitivity: 1,
  volume: 0.6,
};

export const SETTING_RANGES: Record<keyof Settings, { min: number; max: number }> = {
  drawDistanceChunks: { min: 2, max: 6 },
  lookSensitivity: { min: 0.25, max: 3 },
  volume: { min: 0, max: 1 },
};

function savedRecord(text: string | null): Record<string, unknown> {
  if (text === null) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readSetting(saved: Record<string, unknown>, key: keyof Settings): number {
  const value = saved[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS[key];
  const { min, max } = SETTING_RANGES[key];
  return clamp(value, min, max);
}

/**
 * Reads saved settings. A missing or damaged value falls back to its default, and
 * a value outside its range is clamped to the range.
 */
export function parseSettings(text: string | null): Settings {
  const saved = savedRecord(text);
  return {
    drawDistanceChunks: Math.round(readSetting(saved, 'drawDistanceChunks')),
    lookSensitivity: readSetting(saved, 'lookSensitivity'),
    volume: readSetting(saved, 'volume'),
  };
}

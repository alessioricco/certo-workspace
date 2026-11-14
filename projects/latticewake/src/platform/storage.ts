import type { EffectSettings } from '../render/feedback';
import { appendCrash, CRASH_LIMIT, validateCrash } from './diagnostics';
import type { CrashRecord } from './diagnostics';

export const STORAGE_KEY = 'latticewake.meta';
export interface Settings {
  master: number; music: number; sfx: number; muted: boolean;
  effects: EffectSettings;
  palette: 'default' | 'color-safe' | 'contrast';
  motion: 'system' | 'reduced';
  touch: 'drag' | 'buttons';
  autofire: boolean;
}
export interface LocalScore { alias: string; score: number; stage: number; seed: number; rules: string }
export interface Meta { version: 3; settings: Settings; scores: LocalScore[]; crashes: CrashRecord[] }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function defaultSettings(): Settings {
  return { master: 0.6, music: 0.35, sfx: 0.65, muted: false,
    effects: { low: false, particles: true, shake: true, glow: false, scanlines: false },
    palette: 'default', motion: 'system', touch: 'drag', autofire: false };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function integer(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max; }
export function sanitizeAlias(value: string): string { return value.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 12) || 'PILOT'; }
export function validateScore(value: unknown): LocalScore | undefined {
  if (!record(value) || typeof value.alias !== 'string' || value.alias.length > 128
    || !integer(value.score, 0, Number.MAX_SAFE_INTEGER) || !integer(value.stage, 1, 999999)
    || !integer(value.seed, 0, 0xffffffff) || typeof value.rules !== 'string' || !/^[a-zA-Z0-9._-]{1,40}$/.test(value.rules)) return;
  return { alias: sanitizeAlias(value.alias), score: value.score, stage: value.stage, seed: value.seed, rules: value.rules };
}
export function validateSettings(value: unknown): Settings {
  const settings = defaultSettings();
  if (!record(value)) return settings;
  for (const key of ['master', 'music', 'sfx'] as const) {
    const level = value[key];
    if (typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 1) settings[key] = level;
  }
  for (const key of ['muted', 'autofire'] as const) if (typeof value[key] === 'boolean') settings[key] = value[key];
  if (record(value.effects)) for (const key of ['low', 'particles', 'shake', 'glow', 'scanlines'] as const) {
    if (typeof value.effects[key] === 'boolean') settings.effects[key] = value.effects[key];
  }
  if (value.palette === 'color-safe' || value.palette === 'contrast') settings.palette = value.palette;
  if (value.motion === 'reduced') settings.motion = value.motion;
  if (value.touch === 'buttons') settings.touch = value.touch;
  return settings;
}
export function decodeMeta(raw: string): Meta {
  if (raw.length > 32768) throw new Error('Oversized storage');
  const value: unknown = JSON.parse(raw);
  const crashItems: unknown = record(value) ? value.crashes ?? [] : undefined;
  if (!record(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3) || !record(value.settings)
    || !Array.isArray(value.scores) || value.scores.length > 100 || !Array.isArray(crashItems) || crashItems.length > 100) throw new Error('Invalid storage');
  const scores: LocalScore[] = [];
  for (const item of value.scores) { const score = validateScore(item); if (score) scores.push(score); }
  const crashes: CrashRecord[] = [];
  for (const item of crashItems) { const crash = validateCrash(item); if (crash) crashes.push(crash); }
  return { version: 3, settings: validateSettings(value.settings), scores: rankScores(scores), crashes: crashes.slice(-CRASH_LIMIT) };
}
export function rankScores(scores: readonly LocalScore[]): LocalScore[] {
  return [...scores].sort((a, b) => b.score - a.score || b.stage - a.stage).slice(0, 10);
}
export class LocalMeta {
  readonly data: Meta = { version: 3, settings: defaultSettings(), scores: [], crashes: [] };
  memoryOnly = false;
  private storage: StoragePort | undefined;
  constructor(open: () => StoragePort = () => window.localStorage) {
    try {
      this.storage = open();
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null) Object.assign(this.data, decodeMeta(raw));
    } catch { this.memoryOnly = true; this.storage = undefined; }
  }
  saveSettings(settings: Settings): void { this.data.settings = validateSettings(settings); this.persist(); }
  addScore(value: LocalScore): void {
    const score = validateScore(value);
    if (!score) return;
    this.data.scores = rankScores([...this.data.scores, score]); this.persist();
  }
  addCrash(value: CrashRecord): void {
    this.data.crashes = appendCrash(this.data.crashes, value); this.persist();
  }
  clearCrashes(): void { this.data.crashes = []; this.persist(); }
  private persist(): void {
    if (!this.storage) return;
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    catch { this.memoryOnly = true; this.storage = undefined; }
  }
}

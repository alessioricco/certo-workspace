import { expect, it } from 'vitest';
import { decodeMeta, defaultSettings, LocalMeta, rankScores, sanitizeAlias, STORAGE_KEY, validateScore, validateSettings } from '../../src/platform/storage';
import type { LocalScore, StoragePort } from '../../src/platform/storage';
const score: LocalScore = { alias: 'Pilot', score: 400, stage: 2, seed: 42, rules: 'm5-signature-1' };
class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
it('round trips settings and scores using only the project key', () => {
  const port = new MemoryStorage(); port.setItem('other-app', 'keep');
  const meta = new LocalMeta(() => port);
  expect(meta.data.settings).toEqual(defaultSettings()); expect(meta.memoryOnly).toBe(false);
  const settings = defaultSettings(); settings.music = 0; settings.effects.glow = true; settings.palette = 'contrast'; settings.motion = 'reduced'; settings.touch = 'buttons'; settings.autofire = settings.muted = true;
  meta.saveSettings(settings); meta.addScore(score);
  const restored = new LocalMeta(() => port);
  expect(restored.data).toEqual(meta.data); expect(restored.data.settings).not.toBe(settings);
  expect(port.getItem('other-app')).toBe('keep'); expect(port.values.size).toBe(2);
});
it('migrates v1 audio/effects with new accessible defaults and writes v3 with no crash records', () => {
  const port = new MemoryStorage(); port.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: { music: 0.2, effects: { glow: true } }, scores: [score] }));
  const meta = new LocalMeta(() => port);
  expect(meta.data.version).toBe(3); expect(meta.data.crashes).toEqual([]); expect(meta.data.settings.motion).toBe('system'); expect(meta.data.settings.music).toBe(0.2);
  expect(meta.data.settings.effects.glow).toBe(true); meta.saveSettings(meta.data.settings);
  expect(JSON.parse(port.getItem(STORAGE_KEY) ?? '').version).toBe(3);
});
it('rejects malformed, oversized, future schemas without overwriting them', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ version: 9, settings: {}, scores: [] }), JSON.stringify({ version: 2, settings: [], scores: [] }), JSON.stringify({ version: 2, settings: {}, scores: Array(101).fill(score) }), ' '.repeat(32769)]) {
    const port = new MemoryStorage(); port.setItem(STORAGE_KEY, raw);
    const meta = new LocalMeta(() => port); expect(meta.memoryOnly).toBe(true);
    meta.addScore(score); expect(meta.data.scores).toEqual([score]); expect(port.getItem(STORAGE_KEY)).toBe(raw);
  }
});
it('uses memory if access, read or quota fails while continuing to save locally', () => {
  const fail = (): never => { throw new Error('denied'); };
  for (const open of [fail, () => ({ getItem: fail, setItem: fail }), () => ({ getItem: () => null, setItem: fail })]) {
    const meta = new LocalMeta(open); meta.addScore(score); meta.saveSettings({ ...defaultSettings(), muted: true });
    expect(meta.memoryOnly).toBe(true); expect(meta.data.scores).toHaveLength(1); expect(meta.data.settings.muted).toBe(true);
  }
});
it('rejects nonfinite/out-of-range fields and never trusts persisted objects', () => {
  expect(validateSettings(null)).toEqual(defaultSettings());
  const settings = validateSettings({ master: Infinity, music: -1, sfx: '1', muted: 1, effects: { particles: false, low: 'true' }, palette: 'evil', motion: 'evil' });
  expect(settings.master).toBe(0.6); expect(settings.effects.particles).toBe(false); expect(settings.effects.low).toBe(false);
  for (const patch of [{ score: -1 }, { score: Infinity }, { stage: 0 }, { stage: 1.2 }, { seed: 0x100000000 }, { rules: '<img>' }, { alias: 'a'.repeat(129) }]) expect(validateScore({ ...score, ...patch })).toBeUndefined();
  expect(validateScore(null)).toBeUndefined();
  expect(decodeMeta(JSON.stringify({ version: 2, settings: {}, scores: [null, score, { ...score, score: -1 }] })).scores).toEqual([score]);
});
it('sanitizes bounded aliases and ranks top ten by score, stage, then insertion', () => {
  expect(sanitizeAlias(' <> ')).toBe('PILOT'); expect(sanitizeAlias(' AB_12- ! ')).toBe('AB_12-');
  expect(sanitizeAlias('<img src=x onerror=alert(1)>')).toBe('img srcx one');
  const records = Array.from({ length: 15 }, (_, index) => ({ ...score, alias: String(index), score: index * 100 }));
  const ranked = rankScores(records); expect(ranked).toHaveLength(10); expect(ranked[0]?.score).toBe(1400); expect(records[0]?.score).toBe(0);
  expect(rankScores([{ ...score, alias: 'A' }, { ...score, alias: 'B', stage: 3 }, { ...score, alias: 'C' }]).map(item => item.alias)).toEqual(['B', 'A', 'C']);
});

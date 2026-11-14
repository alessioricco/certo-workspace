import { expect, it } from 'vitest';
import { appendCrash, CRASH_LIMIT, crashRecord, describeError, formatCrashReport, redactMessage, validateCrash } from '../../src/platform/diagnostics';
import type { CrashRecord } from '../../src/platform/diagnostics';
import { LocalMeta, STORAGE_KEY } from '../../src/platform/storage';
import type { StoragePort } from '../../src/platform/storage';

const at = new Date('2026-11-14T19:00:00.000Z');
const crash = (message: string): CrashRecord => ({ at: at.toISOString(), scene: 'play', stage: 2, rules: 'm5-signature-1', message });
class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

it('removes URLs, file paths and control characters from crash messages', () => {
  expect(redactMessage('Failed https://example.test/app.js?token=abc')).toBe('Failed [url]');
  expect(redactMessage('boom at /assets/index-abc.js:12:3')).toBe('boom at [path]:12:3');
  expect(redactMessage('boom at C:\\Users\\pilot\\App\\bundle.js:12')).toBe('boom at [path]:12');
  expect(redactMessage('line\u0000one\u0007\n  two')).toBe('line one two');
  expect(redactMessage('x'.repeat(400))).toHaveLength(160);
});

it('describes errors without stack traces', () => {
  const error = new TypeError('bad state');
  expect(describeError(error)).toBe('TypeError: bad state');
  expect(describeError('plain text')).toBe('plain text');
  expect(describeError({ secret: 'value' })).toBe('Non-error value');
});

it('stores the scene, stage and rules context with a redacted message', () => {
  const record = crashRecord(new Error('see https://host.test/?alias=ACE'), { scene: 'play', stage: 4, rules: 'm5-signature-1' }, at);
  expect(record).toEqual({ at: '2026-11-14T19:00:00.000Z', scene: 'play', stage: 4, rules: 'm5-signature-1', message: 'Error: see [url]' });
});

it('keeps only the newest crash records', () => {
  let records: CrashRecord[] = [];
  for (let index = 0; index < CRASH_LIMIT + 3; index++) records = appendCrash(records, crash(`fault ${index}`));
  expect(records).toHaveLength(CRASH_LIMIT);
  expect(records[0]?.message).toBe('fault 3');
  expect(records.at(-1)?.message).toBe(`fault ${CRASH_LIMIT + 2}`);
});

it('accepts only well-formed stored crash records and re-redacts their text', () => {
  expect(validateCrash(crash('ok'))).toEqual(crash('ok'));
  expect(validateCrash(crash('leak https://a.test/x'))?.message).toBe('leak [url]');
  expect(validateCrash({ ...crash('ok'), at: 'yesterday' })).toBeUndefined();
  expect(validateCrash({ ...crash('ok'), scene: 'Play<script>' })).toBeUndefined();
  expect(validateCrash({ ...crash('ok'), stage: 1.5 })).toBeUndefined();
  expect(validateCrash({ ...crash('ok'), rules: 'a b' })).toBeUndefined();
  expect(validateCrash({ ...crash('ok'), message: 7 })).toBeUndefined();
  expect(validateCrash(null)).toBeUndefined();
});

it('exports a JSON report that contains only the stored fields', () => {
  const report = JSON.parse(formatCrashReport([crash('ok')])) as { application: string; crashes: CrashRecord[] };
  expect(report).toEqual({ application: 'latticewake', crashes: [crash('ok')] });
  expect(formatCrashReport([])).toContain('"crashes": []');
});

it('persists crash records under the single versioned key and reloads them after restart', () => {
  const port = new MemoryStorage();
  const meta = new LocalMeta(() => port);
  meta.addCrash(crash('first')); meta.addCrash(crash('second'));
  const restored = new LocalMeta(() => port);
  expect(restored.data.crashes.map(item => item.message)).toEqual(['first', 'second']);
  expect(JSON.parse(port.getItem(STORAGE_KEY) ?? '').version).toBe(3);
  restored.clearCrashes();
  expect(new LocalMeta(() => port).data.crashes).toEqual([]);
});

it('does not overwrite an oversized stored payload when a crash is recorded', () => {
  const port = new MemoryStorage();
  const raw = ' '.repeat(32769);
  port.setItem(STORAGE_KEY, raw);
  const meta = new LocalMeta(() => port);
  meta.addCrash(crash('lost in memory'));
  expect(meta.memoryOnly).toBe(true); expect(meta.data.crashes).toHaveLength(1);
  expect(port.getItem(STORAGE_KEY)).toBe(raw);
});

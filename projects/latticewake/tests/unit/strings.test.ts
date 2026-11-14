import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { EN, isStringKey, t } from '../../src/ui/strings';
it('provides every declared HTML text and accessible-name key', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(match => match[1] ?? '');
  expect(keys.length).toBeGreaterThan(60);
  for (const key of keys) { expect(isStringKey(key), key).toBe(true); if (isStringKey(key)) expect(t(key).trim(), key).not.toBe(''); }
  expect(isStringKey('toString')).toBe(false); expect(isStringKey('missing')).toBe(false);
});
it('formats all English templates without missing placeholders or HTML interpretation', () => {
  for (const key of Object.keys(EN)) {
    if (!isStringKey(key)) throw new Error(key);
    const values = Object.fromEntries([...EN[key].matchAll(/\{(\w+)\}/g)].map(match => [match[1], 0]));
    expect(t(key, values), key).not.toMatch(/\{\w+\}/);
  }
  expect(t('run_summary', { score: 0, stage: 1, seed: 0, rules: 'm5-signature-1' })).toBe('Score 0 · Stage 1 · Seed 0 · m5-signature-1');
  expect(t('score_row', { alias: '<b>hi</b>', score: 1, stage: 1, seed: 42, rules: 'v1' })).toContain('<b>hi</b>');
  expect(t('run_summary')).toContain('{score}');
});

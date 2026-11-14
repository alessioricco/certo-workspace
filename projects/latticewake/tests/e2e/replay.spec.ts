import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { canonicalReplay, CANONICAL_REPLAY_SHA256 } from '../replay/canonical';

test('replays the canonical seeded tape to the golden checksum in this browser engine', async ({ page }) => {
  // The unchanged rules module is bundled in memory for the page; no game build or test endpoint is involved.
  const result = await build({ configFile: false, logLevel: 'silent', build: {
    write: false, lib: { entry: resolve('tests/replay/canonical.ts'), formats: ['iife'], name: 'LatticewakeReplay' },
  } });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output)) throw new Error('Expected replay test bundle');
  const chunk = output.output.find(item => item.type === 'chunk'); if (!chunk || chunk.type !== 'chunk') throw new Error('Missing replay bundle');
  await page.setContent('<!doctype html><title>replay</title>');
  await page.addScriptTag({ content: chunk.code });
  const replay = await page.evaluate(() => (window as unknown as { LatticewakeReplay: { canonicalReplay(): string } }).LatticewakeReplay.canonicalReplay());
  expect(replay).toBe(canonicalReplay());
  expect(createHash('sha256').update(replay).digest('hex')).toBe(CANONICAL_REPLAY_SHA256);
});

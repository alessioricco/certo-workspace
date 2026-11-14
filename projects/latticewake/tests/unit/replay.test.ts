import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { canonicalReplay, CANONICAL_REPLAY_SHA256 } from '../replay/canonical';

it('replays the canonical seeded tape to an identical state in one process', () => {
  expect(canonicalReplay()).toBe(canonicalReplay());
});

it('matches the canonical seeded replay checksum', () => {
  expect(createHash('sha256').update(canonicalReplay()).digest('hex')).toBe(CANONICAL_REPLAY_SHA256);
});

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ENGINE_DIR = fileURLToPath(new URL('../../src/engine/', import.meta.url));

describe('engine boundaries', () => {
  const sources = readdirSync(ENGINE_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({ name, text: readFileSync(`${ENGINE_DIR}${name}`, 'utf8') }));

  it('finds the engine sources', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources.map((source) => [source.name, source.text] as const))(
    '%s does not use Three.js or the DOM',
    (_name, text) => {
      expect(text).not.toMatch(/from\s+['"]three/);
      expect(text).not.toMatch(/\b(document|window)\./);
    },
  );
});

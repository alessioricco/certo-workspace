import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inspectLock } from '../../scripts/check-licenses.mjs';
import { measureBuild } from '../../scripts/check-budget.mjs';

function lockWith(entry) {
  return {
    lockfileVersion: 3,
    packages: {
      '': { devDependencies: { example: '1.0.0' } },
      'node_modules/example': { version: '1.0.0', license: 'MIT', resolved: 'https://registry.npmjs.org/example/-/example-1.0.0.tgz', integrity: 'sha512-fixture', ...entry },
    },
  };
}

describe('locked dependency policy', () => {
  it('inventories allowed licenses, including the reviewed Blue Oak grant', () => {
    expect(inspectLock(lockWith({ license: 'BlueOak-1.0.0' }))).toEqual([{ name: 'example', version: '1.0.0', license: 'BlueOak-1.0.0' }]);
  });

  it.each(['GPL-3.0', 'MPL-2.0', 'UNKNOWN', undefined])('fails closed on %s license', license => {
    expect(() => inspectLock(lockWith({ license }))).toThrow('Unapproved license');
  });

  it('rejects foreign origins, missing integrity, and deprecated packages', () => {
    expect(() => inspectLock(lockWith({ resolved: 'https://registry.npmjs.org.evil.test/package' }))).toThrow('origin/integrity');
    expect(() => inspectLock(lockWith({ integrity: undefined }))).toThrow('origin/integrity');
    expect(() => inspectLock(lockWith({ deprecated: 'Unsupported' }))).toThrow('Deprecated');
  });

  it('rejects runtime dependencies and malformed or empty inventories', () => {
    const lock = lockWith({});
    lock.packages[''].dependencies = { runtime: '1.0.0' };
    expect(() => inspectLock(lock)).toThrow('Runtime dependencies');
    expect(() => inspectLock({ lockfileVersion: 2 })).toThrow('lockfile v3');
    expect(() => inspectLock({ lockfileVersion: 3, packages: { '': {} } })).toThrow('Empty');
    expect(() => inspectLock(lockWith({ version: undefined }))).toThrow('identity');
  });
});

describe('real build measurements', () => {
  async function withBuild(run) {
    const scratch = fileURLToPath(new URL('../../test-results/', import.meta.url));
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(join(scratch, 'latticewake-budget-'));
    try {
      await mkdir(join(root, 'assets'));
      await writeFile(join(root, 'index.html'), '<script src="./assets/app.js"></script>');
      await writeFile(join(root, 'assets/app.js'), 'document.title = "Latticewake";');
      await run(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  it('counts every file and both compression formats', async () => {
    await withBuild(async root => {
      const totals = await measureBuild(root);
      expect(totals.files).toBe(2);
      expect(totals.gzip).toBeGreaterThan(totals.javascriptGzip);
      expect(totals.brotli).toBeGreaterThan(0);
      expect(totals.raw).toBeGreaterThan(0);
    });
  });

  it('rejects missing entry points and symlinks outside the build', async () => {
    await withBuild(async root => {
      await expect(measureBuild(join(root, 'absent'))).rejects.toThrow();
      await symlink(join(root, 'index.html'), join(root, 'assets/linked.html'));
      await expect(measureBuild(root)).rejects.toThrow('symlinks');
    });
  });

  it('rejects an empty-JS build', async () => {
    await withBuild(async root => {
      await rm(join(root, 'assets/app.js'));
      await expect(measureBuild(root)).rejects.toThrow('No JavaScript');
    });
  });

  it('enforces the JavaScript and total asset gzip ceilings', async () => {
    await withBuild(async root => {
      await writeFile(join(root, 'assets/app.js'), randomBytes(130 * 1024));
      await expect(measureBuild(root)).rejects.toThrow('exceeds budget');
      await writeFile(join(root, 'assets/app.js'), 'void 0;');
      await writeFile(join(root, 'assets/large.bin'), randomBytes(260 * 1024));
      await expect(measureBuild(root)).rejects.toThrow('exceeds budget');
    });
  });
});

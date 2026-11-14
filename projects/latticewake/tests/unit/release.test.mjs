import { Buffer } from 'node:buffer';
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { generateAssets } from '../../scripts/generate-assets.mjs';
import { prepareRelease } from '../../scripts/prepare-release.mjs';

const scratch = fileURLToPath(new URL('../../test-results/', import.meta.url));
const roots = [];

async function releaseFixture(run) {
  await mkdir(scratch, { recursive: true });
  const root = await mkdtemp(join(scratch, 'latticewake-release-'));
  roots.push(root);
  const source = join(root, 'public');
  const dist = join(root, 'dist');
  const artifacts = join(root, 'release-artifacts');
  await generateAssets(source);
  await writeFile(join(source, 'manifest.webmanifest'), await readFile(new URL('../../public/manifest.webmanifest', import.meta.url)));
  await mkdir(dist, { recursive: true });
  await cp(source, dist, { recursive: true });
  await writeFile(join(dist, 'index.html'), '<!doctype html><script src="./app.js"></script>');
  await writeFile(join(dist, 'app.js'), 'document.title = "Latticewake";');
  return run({ root, source, dist, artifacts });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('production release artifacts', () => {
  it('generates original dimensioned icons and a hashed offline shell with valid compression', async () => {
    await releaseFixture(async ({ dist, artifacts }) => {
      const icons = await readdir(join(dist, 'icons'));
      expect(icons.sort()).toEqual(['apple-touch-icon.png', 'favicon-32.png', 'latticewake-192.png', 'latticewake-512-maskable.png', 'latticewake-512.png']);
      const icon = await readFile(join(dist, 'icons/latticewake-512-maskable.png'));
      expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(icon.readUInt32BE(16)).toBe(512);
      expect(icon.readUInt32BE(20)).toBe(512);

      const report = await prepareRelease(dist, artifacts);
      const worker = await readFile(join(dist, 'service-worker.js'), 'utf8');
      expect(report.version).toBe('1.0.0');
      expect(report.buildId).toMatch(/^[a-f0-9]{20}$/);
      expect(worker).toContain(`const BUILD_ID = '${report.buildId}'`);
      expect(worker).toContain('./index.html');
      expect(worker).toContain('./manifest.webmanifest');
      expect(worker).toContain('ACTIVATE_UPDATE');
      expect(worker).toContain('new URL(\'index.html\', scope)');
      expect(report.files.length).toBe(report.distFiles);

      for (const entry of report.files) {
        const original = await readFile(join(dist, entry.file));
        const target = join(artifacts, 'precompressed', entry.file);
        expect(gunzipSync(await readFile(`${target}.gz`))).toEqual(original);
        expect(brotliDecompressSync(await readFile(`${target}.br`))).toEqual(original);
      }
      const manifest = JSON.parse(await readFile(join(artifacts, 'release-manifest.json'), 'utf8'));
      expect(manifest).toEqual(report);
    });
  });

  it('refuses any output directory that is not inside the project root', async () => {
    await releaseFixture(async ({ dist }) => {
      const projectRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
      await expect(prepareRelease(dist, projectRoot)).rejects.toThrow('inside the project folder');
    });
  });
});

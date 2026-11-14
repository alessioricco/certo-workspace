import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

export async function measureBuild(directory) {
  const totals = { files: 0, raw: 0, gzip: 0, brotli: 0, javascriptGzip: 0 };
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error(`Build must not contain symlinks: ${path}`);
    if (stat.isDirectory()) {
      for (const name of await readdir(path)) await visit(join(path, name));
      return;
    }
    if (!stat.isFile()) throw new Error(`Unexpected build entry: ${path}`);
    const data = await readFile(path);
    const gzip = gzipSync(data, { level: 9 }).length;
    totals.files++;
    totals.raw += data.length;
    totals.gzip += gzip;
    totals.brotli += brotliCompressSync(data).length;
    if (path.endsWith('.js')) totals.javascriptGzip += gzip;
  }
  await readFile(join(directory, 'index.html'));
  await visit(directory);
  if (totals.javascriptGzip === 0) throw new Error('No JavaScript in build.');
  if (totals.javascriptGzip > 120 * 1024 || totals.gzip > 250 * 1024) {
    throw new Error(`Build exceeds budget: ${JSON.stringify(totals)}`);
  }
  return totals;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const totals = await measureBuild(fileURLToPath(new URL('../dist/', import.meta.url)));
  console.log('PASS build budget (bytes, each file compressed independently):', totals);
}

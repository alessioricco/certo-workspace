import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function listFiles(directory) {
  const result = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release build cannot contain symlinks: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) result.push(path);
      else throw new Error(`Unexpected release entry: ${path}`);
    }
  }
  await visit(directory);
  return result.sort();
}

function digest(data) { return createHash('sha256').update(data).digest('hex'); }

export async function prepareRelease(directory = resolve(root, 'dist'), artifacts = resolve(root, 'release-artifacts')) {
  const output = resolve(directory);
  const artifactRoot = resolve(artifacts);
  if (!output.startsWith(`${root}${sep}`) || !artifactRoot.startsWith(`${root}${sep}`)
    || output === artifactRoot || output.startsWith(`${artifactRoot}${sep}`) || artifactRoot.startsWith(`${output}${sep}`)) {
    throw new Error('Release outputs must be separate directories inside the project folder.');
  }
  await rm(join(output, 'service-worker.js'), { force: true });
  const packageData = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const files = await listFiles(output);
  if (!files.some(path => basename(path) === 'index.html')) throw new Error('Release build is missing index.html.');
  const assets = await Promise.all(files.map(async path => {
    const bytes = await readFile(path);
    return { path, name: relative(output, path).split(sep).join('/'), bytes, sha256: digest(bytes) };
  }));
  const paths = assets.map(entry => `./${entry.name}`);
  const template = await readFile(resolve(root, 'scripts/service-worker.template.js'), 'utf8');
  const workerSource = template.replace('const ASSETS = [];', `const ASSETS = ${JSON.stringify(paths)};`).replace('__BUILD_ID__', '');
  const buildId = digest(`${packageData.version}\n${assets.map(entry => `${entry.name}\0${entry.sha256}`).join('\n')}\n${workerSource}`).slice(0, 20);
  await writeFile(join(output, 'service-worker.js'), workerSource.replace("const BUILD_ID = '';", `const BUILD_ID = '${buildId}';`));

  await rm(artifactRoot, { recursive: true, force: true });
  const compressed = join(artifactRoot, 'precompressed');
  await mkdir(compressed, { recursive: true });
  const releaseFiles = await listFiles(output);
  const manifest = [];
  for (const path of releaseFiles) {
    const bytes = await readFile(path);
    const name = relative(output, path).split(sep).join('/');
    const gzip = gzipSync(bytes, { level: 9, mtime: 0 });
    const brotli = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
    const target = join(compressed, name);
    await mkdir(resolve(target, '..'), { recursive: true });
    await Promise.all([writeFile(`${target}.gz`, gzip), writeFile(`${target}.br`, brotli)]);
    manifest.push({ file: name, sha256: digest(bytes), bytes: bytes.length, gzip: gzip.length, brotli: brotli.length });
  }
  const report = {
    version: packageData.version,
    buildId,
    deployment: 'Upload only dist/ to an approved HTTPS static host. Generated sidecars are in release-artifacts/precompressed and must not be served without matching Content-Encoding headers.',
    files: manifest,
    distFiles: releaseFiles.length,
  };
  await writeFile(join(artifactRoot, 'release-manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await prepareRelease();
  const sidecars = await listFiles(resolve(root, 'release-artifacts/precompressed'));
  console.log(`PASS prepared ${report.distFiles} static files for v${report.version} (${report.buildId}); generated ${sidecars.length} gzip/Brotli sidecars.`);
}

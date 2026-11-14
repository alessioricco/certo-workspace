import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'BlueOak-1.0.0']);

export function inspectLock(lock) {
  if (lock.lockfileVersion !== 3 || !lock.packages?.['']) throw new Error('Expected npm lockfile v3.');
  if (Object.keys(lock.packages[''].dependencies ?? {}).length) throw new Error('Runtime dependencies require review.');
  const packages = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue;
    if (!allowed.has(entry.license)) throw new Error(`Unapproved license ${entry.license}: ${path}`);
    if (entry.deprecated) throw new Error(`Deprecated dependency: ${path}`);
    if (!entry.integrity || !entry.resolved?.startsWith('https://registry.npmjs.org/')) {
      throw new Error(`Unverified dependency origin/integrity: ${path}`);
    }
    const name = entry.name ?? path.split('node_modules/').at(-1);
    if (!name || !entry.version) throw new Error(`Missing package identity: ${path}`);
    packages.set(`${name}@${entry.version}`, { name, version: entry.version, license: entry.license });
  }
  if (packages.size === 0) throw new Error('Empty dependency inventory.');
  return [...packages.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
}

function notices(packages) {
  return '# Third-party notices\n\n'
    + 'Generated from `package-lock.json` by `node scripts/check-licenses.mjs --write`; checked for drift by `npm run check:licenses`.\n\n'
    + 'There are **no runtime npm dependencies**. The inventory includes all locked development packages, including platform-specific optional binaries. Their original copyright notices and complete license texts remain in each installed package; retain those files when redistributing tooling. This inventory is not a replacement for upstream licenses. Vite and other tools may bundle additional notices in their own LICENSE files. Browser test binaries are not distributed with the game.\n\n'
    + 'BlueOak-1.0.0 is an explicitly reviewed permissive license (ADR-014), not a copyleft exception. Read the [full license](https://blueoakcouncil.org/license/1.0.0). Other license texts: [MIT](https://opensource.org/license/mit), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), [BSD-2-Clause](https://opensource.org/license/bsd-2-clause), [BSD-3-Clause](https://opensource.org/license/bsd-3-clause), [ISC](https://opensource.org/license/isc-license-txt).\n\n'
    + '| Package | Version | License | Upstream source and notices |\n| --- | --- | --- | --- |\n'
    + packages.map(pkg => `| ${pkg.name} | ${pkg.version} | ${pkg.license} | [npm](https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}) |`).join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const packages = inspectLock(lock);
  const expected = notices(packages);
  const target = new URL('../THIRD_PARTY_NOTICES.md', import.meta.url);
  if (process.argv.includes('--write')) await writeFile(target, expected);
  else if (await readFile(target, 'utf8') !== expected) throw new Error('Notices out of date; regenerate and review.');
  console.log(`PASS licenses/origins: ${packages.length} distinct locked development packages; no runtime dependencies.`);
}

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const mime: Record<string, string> = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

test('offline PWA reloads and only applies a waiting update at the title menu', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service-worker lifecycle controls are Chromium-gated in this release test.');
  const root = resolve(dist);
  let serveChangedWorker = false;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const base = '/nested/latticewake/';
      if (!url.pathname.startsWith(base)) { response.writeHead(404).end(); return; }
      const relativePath = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
      const path = resolve(root, relativePath);
      const fileStat = await stat(path);
      if (!path.startsWith(`${root}${sep}`) || !fileStat.isFile()) { response.writeHead(404).end(); return; }
      let body = await readFile(path);
      if (relativePath === 'service-worker.js' && serveChangedWorker) {
        body = Buffer.from(body.toString('utf8').replace(/const BUILD_ID = '[^']+';/, "const BUILD_ID = 'upgrade-probe';"));
      }
      response.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to start local PWA test host.');
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/nested/latticewake/`);
    await expect(page.getByRole('status')).toContainText('Run ready');
    await expect(page.locator('#pwa-status')).toHaveText('Offline play ready on this device.');
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return Boolean(registration?.active && navigator.serviceWorker.controller);
    })).toBe(true);

    await page.route('**/*', route => route.abort('internetdisconnected'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Run ready');
    await expect(page.getByRole('button', { name: 'Start run' })).toBeVisible();

    await page.unrouteAll();
    await page.goto(`${origin}/nested/latticewake/`);
    serveChangedWorker = true;
    const update = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
      await new Promise<void>((resolveUpdate, reject) => {
        if (registration?.waiting) { resolveUpdate(); return; }
        const timer = setTimeout(() => reject(new Error('Service-worker update did not install.')), 10000);
        registration?.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => {
          if (registration.waiting) { clearTimeout(timer); resolveUpdate(); }
        }));
      });
      return Boolean(registration?.waiting);
    });
    expect(update).toBe(true);
    await page.getByRole('button', { name: 'Start run' }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
    await expect(page.getByRole('button', { name: 'Install update' })).toBeHidden();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('service-worker.js');
    await page.keyboard.press('Escape');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
    await page.getByRole('button', { name: 'Return to menu' }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
    const reload = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Install update' }).click();
    await reload;
    await expect(page.getByRole('status')).toContainText('Run ready');
  } finally {
    await context.close();
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  }
});

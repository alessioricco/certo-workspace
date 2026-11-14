import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type Fault = 'once' | 'always';

async function injectRendererFaults(page: Page): Promise<void> {
  // Failure boundary: a real drawImage call throws only when the test arms it, so recovery runs through the production frame loop.
  await page.addInitScript(() => {
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    const flag = window as unknown as { latticewakeFault?: Fault | undefined };
    CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
      const fault = flag.latticewakeFault;
      if (fault === 'once') flag.latticewakeFault = undefined;
      if (fault) throw new Error('Injected renderer fault at https://fault.test/app.js?alias=ACE');
      return Reflect.apply(drawImage, this, args);
    };
  });
}

async function arm(page: Page, fault: Fault): Promise<void> {
  await page.evaluate(value => { (window as unknown as { latticewakeFault?: string }).latticewakeFault = value; }, fault);
}

async function openDiagnostics(page: Page): Promise<void> {
  if (await page.locator('#diagnostics').getAttribute('open') === null) await page.locator('#diagnostics summary').click();
}

test('recovers from a renderer fault to the pause scene and keeps a redacted local record until cleared', async ({ page }) => {
  await injectRendererFaults(page);
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await arm(page, 'once');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#seed-note')).toContainText('Recovered from an unexpected error');
  await openDiagnostics(page);
  await expect(page.locator('#crash-count')).toHaveText('Crash records saved: 1 of 5.');
  const report = await page.locator('#crash-report').inputValue();
  expect(report).toContain('Injected renderer fault at [url]');
  expect(report).toContain('"scene": "play"');
  expect(report).not.toContain('https://');
  expect(report).not.toContain('alias=');
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await openDiagnostics(page);
  await page.getByRole('button', { name: 'Clear crash log', exact: true }).click();
  await expect(page.locator('#crash-count')).toHaveText('Crash records saved: 0 of 5.');
  await expect(page.getByRole('button', { name: 'Download report', exact: true })).toBeDisabled();
});

test('stops the loop with a notice after repeated frame failures instead of retrying forever', async ({ page }) => {
  await injectRendererFaults(page);
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await arm(page, 'always');
  await expect(page.locator('#seed-note')).toContainText('Repeated errors stopped the game loop', { timeout: 10000 });
  await openDiagnostics(page);
  await expect(page.locator('#crash-count')).toHaveText('Crash records saved: 5 of 5.');
});

test('records an uncaught page error with redacted text and downloads it as a JSON report', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new Error('probe https://probe.test/?alias=ACE') })));
  await openDiagnostics(page);
  await expect(page.locator('#crash-count')).toHaveText('Crash records saved: 1 of 5.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download report', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('latticewake-diagnostics.json');
  const saved = JSON.parse(readFileSync(await download.path(), 'utf8')) as { application: string; crashes: { message: string; scene: string }[] };
  expect(saved.application).toBe('latticewake');
  expect(saved.crashes).toHaveLength(1);
  expect(saved.crashes[0]?.message).toBe('Error: probe [url]');
  expect(saved.crashes[0]?.scene).toBe('menu');
});

test('keeps crash records after a reload because they live in the same local storage key', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { error: new Error('kept across reload') })));
  await page.reload();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await openDiagnostics(page);
  await expect(page.locator('#crash-count')).toHaveText('Crash records saved: 1 of 5.');
  await expect(page.locator('#crash-report')).toHaveValue(/kept across reload/);
});

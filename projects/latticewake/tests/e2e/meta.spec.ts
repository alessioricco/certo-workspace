import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function start(page: Page): Promise<void> {
  await page.goto('/?seed=42'); await page.getByRole('button', { name: 'Start run', exact: true }).click(); await page.keyboard.press('F3');
}
async function settings(page: Page): Promise<void> { await page.locator('#presentation summary').click(); }
async function raster(page: Page): Promise<string> { return page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL()); }
async function rules(page: Page): Promise<string> { return (await page.locator('#debug').textContent() ?? '').replace(/FPS [\d.]+/, 'FPS'); }

test('keyboard title, skippable tutorial, settings and pause have native focus and no accidental actions', async ({ page, browserName }) => {
  await page.goto('/?seed=42'); await expect(page.locator('#primary')).toBeFocused();
  await page.getByRole('button', { name: 'How to play' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('#help-close')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#help-close')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#help-open')).toBeFocused(); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.locator('#presentation summary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#presentation')).toHaveAttribute('open', '');
  if (browserName === 'webkit') await page.locator('#master-volume').focus(); // macOS Safari's default Tab order skips range inputs.
  else {
    await page.keyboard.press('Tab');
    if (browserName === 'firefox') await page.keyboard.press('Tab'); // Firefox makes the overflowing settings panel a keyboard stop first.
  }
  await expect(page.locator('#master-volume')).toBeFocused();
  await page.keyboard.press('End'); await expect(page.locator('output[for=master-volume]')).toHaveText('100%');
  await page.keyboard.press('Escape'); await expect(page.locator('#presentation')).not.toHaveAttribute('open', '');
  await page.locator('#primary').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await page.keyboard.press('Escape'); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await page.locator('#primary').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await expect(page.locator('#primary')).toBeFocused();
  if (browserName === 'webkit') await page.locator('#menu').focus(); // macOS Safari's default Tab order does not reach buttons.
  else await page.keyboard.press('Tab');
  await expect(page.locator('#menu')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
});

test('accessible palettes, reduced motion, buses and autofire persist without changing paused rules or unlocking audio', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    Object.defineProperty(window, 'audioCount', { value: { count: 0 } });
    window.AudioContext = class extends Native { constructor() { super(); (window as unknown as { audioCount: { count: number } }).audioCount.count++; } };
  });
  await start(page); await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#debug')).toContainText('Move 0 · fire 0');
  const before = await rules(page), original = await raster(page);
  await settings(page); await page.getByLabel('Colors', { exact: true }).selectOption('color-safe');
  expect(await raster(page)).not.toBe(original);
  await page.getByLabel('Colors', { exact: true }).selectOption('contrast');
  await expect(page.locator('#app')).toHaveAttribute('data-palette', 'contrast');
  expect(await raster(page)).not.toBe(original);
  await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
  await page.getByLabel('Touch movement', { exact: true }).selectOption('buttons');
  await page.getByLabel('Autofire during runs').check(); await page.getByLabel('Mute all audio').check();
  await page.getByRole('slider', { name: 'Music', exact: true }).focus(); await page.keyboard.press('Home');
  await page.getByLabel('Canvas glow').check();
  expect(await rules(page)).toBe(before);
  await page.reload(); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await settings(page); await expect(page.getByLabel('Colors', { exact: true })).toHaveValue('contrast');
  await expect(page.getByLabel('Motion', { exact: true })).toHaveValue('reduced');
  await expect(page.getByLabel('Autofire during runs')).toBeChecked(); await expect(page.getByLabel('Canvas glow')).toBeChecked();
  await expect(page.getByRole('slider', { name: 'Music', exact: true })).toHaveValue('0');
  expect(await page.evaluate(() => (window as unknown as { audioCount: { count: number } }).audioCount.count)).toBe(0);
  await settings(page); await page.locator('#primary').click(); await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toContainText('fire 1');
  await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await expect(page.locator('#debug')).toContainText('fire 0');
});

test('real all-lives-lost run saves exactly once, reloads scores, and abandoning cannot submit', async ({ page }) => {
  test.setTimeout(90000);
  await start(page); await page.keyboard.down('Space');
  await expect(page.getByRole('heading', { name: 'Game over', exact: true })).toBeVisible({ timeout: 65000 });
  await page.keyboard.up('Space'); await expect(page.locator('#run-summary')).toContainText('Seed 42 · m5-signature-1');
  const summary = await page.locator('#run-summary').textContent(); const score = Number(summary?.match(/Score (\d+)/)?.[1]); expect(score).toBeGreaterThan(0);
  await page.locator('#score-alias').fill('<b>ACE</b>'); await page.locator('#score-alias').press('Enter');
  await expect(page.locator('#score-save')).toBeDisabled(); await expect(page.locator('#score-feedback')).toContainText('One entry');
  await page.locator('#scores summary').click(); await expect(page.locator('#score-list li')).toHaveCount(1);
  await expect(page.locator('#score-list li')).toContainText(`bACEb — ${score} points`);
  await expect(page.locator('#score-list b')).toHaveCount(0);
  await page.reload(); await page.locator('#scores summary').click(); await expect(page.locator('#score-list li')).toHaveCount(1);
  await expect(page.locator('#score-list li')).toContainText('Seed 42 · m5-signature-1');
  await page.locator('#primary').click(); await page.getByRole('button', { name: 'End session', exact: true }).click();
  await expect(page.locator('#score-entry')).toBeHidden();
});

for (const failure of ['denied', 'corrupt', 'quota'] as const) {
  test(`storage ${failure} keeps settings and runs usable in memory`, async ({ page }) => {
    // Fault injection is confined to the optional native storage boundary.
    await page.addInitScript(mode => {
      if (mode === 'denied') Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('denied', 'SecurityError'); } });
      else if (mode === 'corrupt') localStorage.setItem('latticewake.meta', '{bad');
      else Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    }, failure);
    await page.goto('/?seed=42'); await settings(page); await page.getByLabel('Motion', { exact: true }).selectOption('reduced');
    await expect(page.locator('#storage-status')).toContainText('in memory'); await settings(page);
    await page.locator('#primary').click(); await page.keyboard.press('F3'); await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
    await expect(page.locator('#debug')).toContainText('Move 1 · fire 1');
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space'); await page.keyboard.press('Escape');
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  });
}

test('native multi-touch supports movement, fire, capture, cancellation, blur and rotation', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Multi-touch is driven through Chromium CDP touch emulation; other engines are not automated for multi-touch.');
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await start(page);
  const points = await Promise.all(['#drag-pad', '[data-touch=fire]', '[data-touch=capture]'].map(async selector => {
    const box = await page.locator(selector).boundingBox(); if (!box) throw new Error(`Missing ${selector}`); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }));
  const [drag, fire, capture] = points; if (!drag || !fire || !capture) throw new Error('Missing touch point');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...drag, id: 1 }, { ...fire, id: 2 }, { ...capture, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...drag, x: drag.x + 48, id: 1 }, { ...fire, id: 2 }, { ...capture, id: 3 }] });
  await expect(page.locator('#debug')).toContainText('Move 1 · fire 1'); await expect(page.locator('#debug')).toContainText('Capture presses 1');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#debug')).toContainText('Move 0 · fire 0');
  await settings(page); await page.getByLabel('Touch movement', { exact: true }).selectOption('buttons'); await settings(page);
  const left = await page.locator('[data-touch=left]').boundingBox(); if (!left) throw new Error('Missing left button');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: left.x + left.width / 2, y: left.y + left.height / 2, id: 4 }] });
  await expect(page.locator('#debug')).toContainText('Move -1 · fire 0');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await page.setViewportSize({ width: 844, height: 390 }); await page.locator('#primary').click();
  await expect(page.locator('#debug')).toContainText('Move 0 · fire 0');
  await expect(page.locator('#touch-controls')).toBeVisible();
  const canvas = await page.locator('canvas').boundingBox(); expect(canvas?.height).toBeGreaterThan(200);
  expect((canvas?.width ?? 0) / (canvas?.height ?? 1)).toBeCloseTo(360 / 640, 2);
  await cdp.detach();
});

test('standard controller menus, analog/dpad, held fire, capture and safe disconnect use the real action path', async ({ page }) => {
  // No physical controller is attached to CI; inject snapshots only at navigator.getGamepads.
  await page.addInitScript(() => {
    const device = { index: 0, mapping: 'standard', connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(window, 'controllerFixture', { value: { device, connected: true } });
    Object.defineProperty(navigator, 'getGamepads', { value: () => (window as unknown as { controllerFixture: { connected: boolean } }).controllerFixture.connected ? [device] : [] });
  });
  await page.goto('/?seed=42'); await expect(page.locator('#input-status')).toContainText('controller connected');
  const button = async (index: number, held = false): Promise<void> => {
    await page.evaluate(i => { const fixture = (window as unknown as { controllerFixture: { device: { buttons: { pressed: boolean; value: number }[] } } }).controllerFixture; fixture.device.buttons[i] = { pressed: true, value: 1 }; }, index);
    await page.waitForTimeout(80);
    if (!held) { await page.evaluate(i => { (window as unknown as { controllerFixture: { device: { buttons: { pressed: boolean; value: number }[] } } }).controllerFixture.device.buttons[i] = { pressed: false, value: 0 }; }, index); await page.waitForTimeout(80); }
  };
  await button(0); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play'); await page.keyboard.press('F3');
  await button(7, true); await button(15, true); await button(2);
  await expect(page.locator('#debug')).toContainText('Move 1 · fire 1'); await expect(page.locator('#debug')).toContainText('Capture presses 1');
  await button(9); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await button(0); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await expect(page.locator('#debug')).toContainText('Move 0 · fire 0');
  await page.evaluate(() => { (window as unknown as { controllerFixture: { connected: boolean } }).controllerFixture.connected = false; });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause'); await expect(page.locator('#input-status')).toContainText('disconnected');
  await page.evaluate(() => { (window as unknown as { controllerFixture: { connected: boolean } }).controllerFixture.connected = true; });
  await page.waitForTimeout(200); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await button(13); await expect(page.locator('#menu')).toBeFocused(); await button(0); await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
});

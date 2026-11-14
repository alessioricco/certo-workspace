import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
    });
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});

async function expectFittedCanvas(page: Page): Promise<void> {
  await expect(page.getByRole('status')).toHaveText('Run ready · Latticewake 1.0.0');
  const canvas = page.getByRole('img', { name: /Latticewake formation/ });
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const bounds = surface.getBoundingClientRect();
    const host = surface.parentElement?.getBoundingClientRect();
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio));
    return Boolean(host && bounds.width > 0 && bounds.height > 0
      && Math.abs(bounds.width / bounds.height - 360 / 640) < 0.001
      && bounds.left >= host.left - 1 && bounds.right <= host.right + 1
      && bounds.top >= host.top - 1 && bounds.bottom <= host.bottom + 1
      && surface.width === Math.round(bounds.width * dpr)
      && surface.height === Math.round(bounds.height * dpr));
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('boots a cached grid canvas and resizes portrait / landscape', async ({ page }, testInfo) => {
  const origins = new Set<string>();
  page.on('request', request => origins.add(new URL(request.url()).origin));
  await page.goto('/');
  await expectFittedCanvas(page);
  const pixel = await page.locator('canvas').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    return Array.from(canvas.getContext('2d')?.getImageData(Math.round(canvas.width * 5 / 360), Math.round(canvas.height * 5 / 640), 1, 1).data ?? []);
  });
  expect(pixel).toEqual([9, 19, 31, 255]);
  await testInfo.attach('foundation', { body: await page.screenshot(), contentType: 'image/png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await expectFittedCanvas(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await expectFittedCanvas(page);
  expect([...origins]).toEqual(['http://127.0.0.1:4183']);
});

test('boots all relative build assets beneath a nested deployment path', async ({ page }) => {
  const paths: string[] = [];
  page.on('request', request => paths.push(new URL(request.url()).pathname));
  await page.goto('http://127.0.0.1:4184/nested/latticewake/');
  await expectFittedCanvas(page);
  expect(paths.some(path => path.endsWith('.js'))).toBe(true);
  expect(paths.every(path => path.startsWith('/nested/latticewake/'))).toBe(true);
});

for (const failureCall of [1, 2, 3]) {
  test(`recovers from Canvas failure at creation ${failureCall} through keyboard retry`, async ({ page }) => {
    // Canvas denial cannot be induced natively; only one API call fails, then native rendering resumes.
    await page.addInitScript(failAt => {
      const original = HTMLCanvasElement.prototype.getContext;
      let calls = 0;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        writable: true,
        value: function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
          if (++calls !== failAt) return Reflect.apply(original, this, args);
          HTMLCanvasElement.prototype.getContext = original;
          return null;
        },
      });
    }, failureCall);
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('The canvas could not start.');
    const retry = page.getByRole('button', { name: 'Retry canvas' });
    await expect(retry).toBeFocused();
    await expect(page.locator('canvas')).toBeHidden();
    await page.keyboard.press('Enter');
    await expectFittedCanvas(page);
    await expect(retry).toBeHidden();
  });
}

test('keeps a useful fallback when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4183/');
    await expect(page.getByText('If this message remains, reconnect and reload. JavaScript and Canvas 2D must be enabled.')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Loading engine…');
    await expect(page.locator('canvas')).toBeHidden();
  } finally {
    await context.close();
  }
});

test('disposes RAF, keyboard, UI and viewport listeners when torn down', async ({ page }) => {
  await page.goto('/');
  await expectFittedCanvas(page);
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect.poll(() => ticks(page)).toBeGreaterThan(0);
  const originalWidth = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  const diagnostics = await page.locator('#debug').textContent();
  expect(await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', { code: 'ArrowLeft', cancelable: true });
    window.dispatchEvent(event);
    document.querySelector<HTMLButtonElement>('#debug-toggle')?.click();
    return event.defaultPrevented;
  })).toBe(false);
  await page.setViewportSize({ width: 1000, height: 400 });
  await page.waitForTimeout(400);
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width)).toBe(originalWidth);
  expect(await page.locator('#debug').textContent()).toBe(diagnostics);
  await expect(page.locator('#debug')).toBeHidden();
});

async function ticks(page: Page): Promise<number> {
  const text = await page.locator('#debug').textContent();
  return Number(text?.match(/Ticks (\d+)/)?.[1] ?? -1);
}

test('keyboard journey samples input, pauses without drift, ends, and resets', async ({ page }, testInfo) => {
  await page.goto('/?seed=0x2a');
  await expectFittedCanvas(page);
  await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('F3');
  const debug = page.locator('#debug');
  await expect(debug).toContainText('Seed 42');
  await expect.poll(() => ticks(page)).toBeGreaterThan(0);
  await page.keyboard.down('ArrowLeft');
  await page.keyboard.down('Space');
  await page.keyboard.down('KeyX');
  await expect(debug).toContainText('Move -1 · fire 1');
  await expect(debug).toContainText('Capture presses 1');
  await page.keyboard.down('ArrowRight');
  await expect(debug).toContainText('Move 0 · fire 1 · capture 0');
  await expect(debug).toContainText('Capture presses 1');
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyJ');
  await page.keyboard.down('KeyK');
  await expect(debug).toContainText('fire 1');
  await expect(debug).toContainText('Capture presses 1');
  await page.keyboard.up('KeyX');
  await page.keyboard.up('KeyK');
  await page.keyboard.down('KeyK');
  await expect(debug).toContainText('Capture presses 2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeFocused();
  await expect(debug).toContainText('Move 0 · fire 0 · capture 0');
  const paused = await ticks(page);
  await page.waitForTimeout(400);
  expect(await ticks(page)).toBe(paused);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyX', 'KeyK']) await page.keyboard.up(key);
  const resumed = await page.evaluate(async previous => {
    return new Promise<number>(resolve => {
      const observe = (): void => {
        const current = Number(document.querySelector('#debug')?.textContent?.match(/Ticks (\d+)/)?.[1] ?? -1);
        if (current > previous) resolve(current);
        else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
      document.querySelector<HTMLButtonElement>('#primary')?.click();
    });
  }, paused);
  expect(resumed).toBeGreaterThan(paused);
  expect(resumed).toBeLessThan(paused + 45);
  await page.keyboard.press('KeyG');
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
  await testInfo.attach('test-complete', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  await expect.poll(() => ticks(page)).toBeLessThan(30);
  await expect(debug).toContainText('Seed 42');
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeFocused();
});

test('button controls, focus loss, and cached-page return require explicit resume', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('button', { name: 'Debug / F3' }).click();
  await page.keyboard.down('KeyD');
  await expect(page.locator('#debug')).toContainText('Move 1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('status')).toContainText('Paused');
  await expect(page.locator('#debug')).toContainText('Move 0');
  const paused = await ticks(page);
  await page.waitForTimeout(350);
  expect(await ticks(page)).toBe(paused);
  await page.keyboard.up('KeyD');
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await expectFittedCanvas(page);
});

test('preserves native buttons and editable input behavior', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start run', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toContainText('fire 0');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Native input probe');
    document.body.append(input);
    input.focus();
  });
  await page.getByRole('textbox', { name: 'Native input probe' }).fill('abc');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('KeyP');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await expect(page.locator('#debug')).toContainText('Move 0');
  await page.getByRole('textbox', { name: 'Native input probe' }).evaluate(element => element.remove());
  await page.locator('canvas').focus();
  await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toBeHidden();
});

test('reduced motion freezes decorative parallax, not gameplay entries or fixed ticks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=0');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect.poll(() => ticks(page)).toBeGreaterThan(0);
  const before = await decorativeFrame(page);
  const movingFormation = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  const previousTicks = await ticks(page);
  await expect.poll(() => ticks(page)).toBeGreaterThan(previousTicks + 15);
  expect(await decorativeFrame(page)).toBe(before);
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).not.toBe(movingFormation);
  await expect(page.locator('#debug')).toContainText('Seed 0');
});

test('invalid URL seed gives feedback and starts with a generated uint32', async ({ page }) => {
  await page.goto('/?seed=%3Cscript%3E');
  await expect(page.locator('#seed-note')).toContainText('Invalid URL seed ignored');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toContainText('m5-signature-1');
  const text = await page.locator('#debug').textContent();
  const seed = Number(text?.match(/Seed (\d+)/)?.[1]);
  expect(seed).toBeGreaterThanOrEqual(0);
  expect(seed).toBeLessThanOrEqual(0xffffffff);
});

test('records local formation frame cadence without claiming device qualification', async ({ page }, testInfo) => {
  await page.goto('/?seed=1');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  const report = await page.evaluate(async () => {
    const timestamps: number[] = [];
    await new Promise<void>(resolve => {
      const sample = (time: number): void => {
        timestamps.push(time);
        if (timestamps.length < 121) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    const deltas = timestamps.slice(1).map((time, index) => time - (timestamps[index] ?? 0));
    const sorted = [...deltas].sort((a, b) => a - b);
    const mean = deltas.reduce((sum, time) => sum + time, 0) / deltas.length;
    return { frames: deltas.length, meanMs: mean, p95Ms: sorted[Math.floor(sorted.length * 0.95)], fps: 1000 / mean };
  });
  expect(report.frames).toBe(120);
  expect(report.meanMs).toBeGreaterThan(0);
  await testInfo.attach('local-frame-cadence', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});



test('renders player-controlled movement and freezes the canvas while paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  const canvas = page.locator('canvas');
  const shipX = (): Promise<number> => canvas.evaluate(element => {
    const surface = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = surface.width;
    readback.height = 1;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas context missing.');
    context.drawImage(surface, 0, Math.round(580 * surface.height / 640), surface.width, 1, 0, 0, surface.width, 1);
    const row = context.getImageData(0, 0, surface.width, 1).data;
    for (let x = 0; x < surface.width; x++) {
      if (row[x * 4] === 172 && row[x * 4 + 1] === 217 && row[x * 4 + 2] === 211) {
        return x * 360 / surface.width;
      }
    }
    throw new Error('Needle ship missing.');
  });
  const idleImage = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).not.toBe(idleImage);
  const initialX = await shipX();
  await page.keyboard.down('ArrowRight');
  await expect.poll(shipX).toBeGreaterThan(initialX + 10);
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  const pausedImage = await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(350);
  expect(await canvas.evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(pausedImage);
  const pausedX = await shipX();
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.down('ArrowRight');
  await expect.poll(shipX).toBeGreaterThan(pausedX + 10);
  await page.keyboard.up('ArrowRight');
});

async function needleX(page: Page): Promise<number> {
  return page.locator('canvas').evaluate(element => {
    const source = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = source.width; readback.height = 1;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    context.drawImage(source, 0, Math.round(source.height * 580 / 640), source.width, 1, 0, 0, source.width, 1);
    const pixels = context.getImageData(0, 0, source.width, 1).data;
    let total = 0;
    let count = 0;
    for (let x = 0; x < source.width; x++) {
      if (pixels[x * 4] === 172 && pixels[x * 4 + 1] === 217 && pixels[x * 4 + 2] === 211) { total += x; count++; }
    }
    if (count === 0) throw new Error('Needle missing');
    return total / count * 360 / source.width;
  });
}

async function decorativeFrame(page: Page): Promise<string> {
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    const bounds = canvas?.parentElement?.getBoundingClientRect();
    if (!canvas || !bounds) return false;
    const scale = Math.min(bounds.width / 360, bounds.height / 640);
    const dpr = Math.min(2, Math.max(1, devicePixelRatio));
    return canvas.width === Math.max(1, Math.round(360 * scale * dpr))
      && canvas.height === Math.max(1, Math.round(640 * scale * dpr));
  });
  return page.locator('canvas').evaluate(element => {
    const source = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = 360;
    readback.height = 180;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    context.drawImage(source, 0, source.height / 2, source.width, source.height * 180 / 640, 0, 0, 360, 180);
    return readback.toDataURL();
  });
}

async function diagnosticNumber(page: Page, pattern: RegExp): Promise<number> {
  return Number((await page.locator('#debug').textContent())?.match(pattern)?.[1] ?? -1);
}


async function pauseAtDiagnostic(page: Page, expression: string, resume = false): Promise<void> {
  await page.evaluate(async ({ pattern, resume }) => {
    const matches = new RegExp(pattern);
    await new Promise<void>(resolve => {
      const observe = (): void => {
        if (matches.test(document.querySelector('#debug')?.textContent ?? '')) {
          document.querySelector<HTMLButtonElement>('button[data-command="pause"]')?.click();
          resolve();
        } else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
      if (resume) document.querySelector<HTMLButtonElement>('#primary')?.click();
    });
  }, { pattern: expression, resume });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
}

test('holds against both bounds, renders shots, drains the pool and resets the range', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  for (const [key, edge] of [['ArrowLeft', 8], ['KeyD', 352]] as const) {
    await page.keyboard.down(key);
    await expect.poll(() => diagnosticNumber(page, /Player X ([\d.]+)/)).toBe(edge);
    await expect(page.locator('#debug')).toContainText('vx 0.00');
    await page.keyboard.up(key);
  }
  await page.keyboard.down('Space');
  await expect.poll(() => diagnosticNumber(page, /Shots (\d+)/)).toBeGreaterThan(5);
  await expect(page.locator('#range-stats')).toContainText(' / 128');
  const litShotPixels = await page.locator('canvas').evaluate(element => {
    const source = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = 360;
    readback.height = 480;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    context.drawImage(source, 0, 0, source.width, source.height * 480 / 640, 0, 0, 360, 480);
    const pixels = context.getImageData(0, 0, 360, 480).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 255 && pixels[index + 1] === 212 && pixels[index + 2] === 155) count++;
    }
    return count;
  });
  expect(litShotPixels).toBeGreaterThan(0);
  await testInfo.attach('m2-edge-fire', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#debug')).toContainText('Move 0 · fire 0 · capture 0');
  const pausedShots = await diagnosticNumber(page, /Shots (\d+)/);
  const pausedImage = await page.locator('canvas').evaluate(element => (element as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(350);
  expect(await diagnosticNumber(page, /Shots (\d+)/)).toBe(pausedShots);
  expect(await page.locator('canvas').evaluate(element => (element as HTMLCanvasElement).toDataURL())).toBe(pausedImage);
  await page.keyboard.up('Space');
  await page.keyboard.press('Enter');
  await expect.poll(() => diagnosticNumber(page, /bullets (\d+)/)).toBe(0);
  expect(await diagnosticNumber(page, /Shots (\d+)/)).toBe(pausedShots);
  await page.keyboard.press('KeyG');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'gameover');
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#debug')).toContainText('Player X 180.00 · vx 0.00');
  await expect(page.locator('#debug')).toContainText('Shots 0 · bullets 0 / 128 · peak 0');
  await expect(page.locator('#debug')).toContainText('Cooldown 0 · blocked volleys 0');
  await expect(page.locator('#debug')).toContainText('entities 25');
});

test('seeded parallax repeats on restart and another seed changes the layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  const first = await decorativeFrame(page);
  await page.keyboard.press('KeyG');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'gameover');
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  expect(await decorativeFrame(page)).toBe(first);
  await page.goto('/?seed=43');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  expect(await decorativeFrame(page)).not.toBe(first);
});

test('two-minute held-fire soak records the local desktop or phone-emulation baseline', async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await page.keyboard.down('Space');
  const report = await page.evaluate(async () => {
    const intervals: number[] = [];
    let previous = 0;
    let start = 0;
    await new Promise<void>(resolve => {
      const frame = (time: number): void => {
        if (!start) start = time;
        if (previous) intervals.push(time - previous);
        previous = time;
        if (time - start < 120_000) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const sorted = [...intervals].sort((a, b) => a - b);
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frames: intervals.length, elapsedMs: previous - start, meanMs: mean, fps: 1000 / mean,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      over33msPercent: intervals.filter(interval => interval > 33.3).length * 100 / intervals.length,
      usedJSHeapBytes: memory?.usedJSHeapSize ?? null,
      userAgent: navigator.userAgent, platform: navigator.platform,
      logicalCores: navigator.hardwareConcurrency,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      diagnostics: document.querySelector('#debug')?.textContent,
    };
  });
  await page.keyboard.up('Space');
  expect(report.elapsedMs).toBeGreaterThanOrEqual(120_000);
  expect(report.frames).toBeGreaterThan(0);
  await expect(page.locator('#debug')).toContainText('bullets 0 / 128 · peak 11');
  expect(await diagnosticNumber(page, /pickups (\d+)/)).toBe(2);
  await expect(page.locator('#debug')).toContainText('blocked volleys 0');
  const shots = await diagnosticNumber(page, /Shots (\d+)/);
  expect(shots).toBeGreaterThan(0);
  const tickCount = await ticks(page);
  expect(shots).toBeLessThanOrEqual(Math.ceil(tickCount / 9));
  expect(await diagnosticNumber(page, /Hostiles (\d+)/)).toBeLessThanOrEqual(128);
  await expect.poll(() => diagnosticNumber(page, /bullets (\d+)/)).toBe(0);
  await testInfo.attach('m5-two-minute-profile', {
    body: JSON.stringify({ ...report, browser: browser.version(), project: testInfo.project.name,
      scope: 'Local headless M5 stationary-fire run with authored pickups (may reach game over); not sustained late-stage or real-device qualification. Test RAF arrays add measurement overhead.' }, null, 2),
    contentType: 'application/json',
  });
});


test('renders three silhouettes, real HP damage, frozen score and fresh-run reset', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect.poll(() => ticks(page), { timeout: 10_000 }).toBeGreaterThan(280);
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  const colors = await page.locator('canvas').evaluate(element => {
    const source = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = 360; readback.height = 300;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    context.drawImage(source, 0, 0, source.width, source.height * 300 / 640, 0, 0, 360, 300);
    const pixels = context.getImageData(0, 0, 360, 300).data;
    const counts = [0, 0, 0];
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 140 && pixels[index + 1] === 230 && pixels[index + 2] === 218) counts[0] = (counts[0] ?? 0) + 1;
      if (pixels[index] === 209 && pixels[index + 1] === 188 && pixels[index + 2] === 245) counts[1] = (counts[1] ?? 0) + 1;
      if (pixels[index] === 255 && pixels[index + 1] === 212 && pixels[index + 2] === 155) counts[2] = (counts[2] ?? 0) + 1;
    }
    return counts;
  });
  for (const count of colors) expect(count).toBeGreaterThan(30);
  await testInfo.attach('m3-three-silhouettes', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.locator('canvas').evaluate(async element => {
    const canvas = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = 360; readback.height = 1;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    await new Promise<void>(resolve => {
      const observe = (): void => {
        context.drawImage(canvas, 0, Math.round(canvas.height * 580 / 640), canvas.width, 1, 0, 0, 360, 1);
        const pixels = context.getImageData(0, 0, 360, 1).data;
        let sum = 0; let count = 0;
        for (let x = 0; x < 360; x++) {
          if (pixels[x * 4] === 172 && pixels[x * 4 + 1] === 217 && pixels[x * 4 + 2] === 211) { sum += x; count++; }
        }
        if (count > 0 && sum / count > 230) {
          canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }));
          resolve();
        } else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
  });
  await expect.poll(() => diagnosticNumber(page, /vx ([\d.-]+)/)).toBe(0);
  const alignedX = await needleX(page);
  expect(alignedX).toBeGreaterThan(240);
  expect(alignedX).toBeLessThan(270);
  await page.locator('canvas').evaluate(async canvas => {
    const frames = (count: number): Promise<void> => new Promise(resolve => {
      const step = (): void => { if (--count === 0) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    await new Promise<void>(resolve => requestAnimationFrame(() => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      void frames(3).then(() => {
        canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
        resolve();
      });
    }));
  });
  await expect.poll(() => diagnosticNumber(page, /Shots (\d+)/)).toBe(1);
  await expect.poll(() => diagnosticNumber(page, /Hits (\d+)/), { timeout: 10_000 }).toBe(1);
  await expect.poll(() => diagnosticNumber(page, /damaged (\d+)/)).toBe(1);
  await expect(page.locator('#range-stats')).toContainText('Score 0 · cleared 0 / 24');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#debug')).toContainText('fire 0');
  const pausedStats = await page.locator('#range-stats').textContent();
  const pausedCanvas = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  const cuePixels = await page.locator('canvas').evaluate(element => {
    const source = element as HTMLCanvasElement;
    const readback = document.createElement('canvas');
    readback.width = 360; readback.height = 300;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    context.drawImage(source, 0, 0, source.width, source.height * 300 / 640, 0, 0, 360, 300);
    const pixels = context.getImageData(0, 0, 360, 300).data;
    let missingHP = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 52 && pixels[index + 1] === 70 && pixels[index + 2] === 75) missingHP++;
    }
    return missingHP;
  });
  expect(cuePixels).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(await page.locator('#range-stats').textContent()).toBe(pausedStats);
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(pausedCanvas);
  await testInfo.attach('m3-hp-damage', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Return to menu' }).click();
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#range-stats')).toContainText('Stage 1 · Lives 3 · Score 0 · cleared 0 / 24 · Shots 0 · active 0 / 128');
  await expect(page.locator('#debug')).toContainText('Enemies 24 / 48 · score 0 · kills 0 / 24');
  await expect(page.locator('#debug')).toContainText('Hits 0 · damaged 0');
  await expect(page.locator('#debug')).toContainText('Player X 180.00 · vx 0.00');
});

test('telegraphs a dive, fires distinct hostiles, safely respawns, loses three lives and restarts', async ({ page }, testInfo) => {
  test.setTimeout(75_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toBeVisible();
  await pauseAtDiagnostic(page, 'Divers 1 / 6 · launches 0');
  await expect(page.locator('#debug')).toContainText('launches 0');
  const warning = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await testInfo.attach('m4-warning-canvas', { body: Buffer.from(warning.split(',')[1] ?? '', 'base64'), contentType: 'image/png' });
  const paused = await ticks(page);
  await page.waitForTimeout(450);
  expect(await ticks(page)).toBe(paused);
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(warning);
  await testInfo.attach('m4-warning', { body: await page.screenshot(), contentType: 'image/png' });
  await pauseAtDiagnostic(page, 'Hostiles [1-9]', true);
  expect(await diagnosticNumber(page, /Hostiles (\d+)/)).toBeGreaterThan(0);
  await testInfo.attach('m4-hostile-dive', { body: await page.screenshot(), contentType: 'image/png' });
  await pauseAtDiagnostic(page, 'Respawn [1-9]', true);
  expect(await diagnosticNumber(page, /Respawn (\d+)/)).toBeGreaterThan(0);
  await expect(page.locator('#debug')).toContainText('lives 2');
  const deadTicks = await ticks(page);
  const deadStats = await page.locator('#range-stats').textContent();
  await page.waitForTimeout(350);
  expect(await ticks(page)).toBe(deadTicks);
  expect(await page.locator('#range-stats').textContent()).toBe(deadStats);
  await pauseAtDiagnostic(page, 'invulnerable [1-9]', true);
  expect(await diagnosticNumber(page, /invulnerable (\d+)/)).toBeGreaterThan(0);
  await expect(page.locator('#range-stats')).toContainText('Protected · steady ring');
  await expect(page.locator('#debug')).toContainText('Player X 180.00 · vx 0.00');
  const protectedTicks = await ticks(page);
  await page.waitForTimeout(350);
  expect(await ticks(page)).toBe(protectedTicks);
  const protectedCanvas = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await testInfo.attach('m4-protection-canvas', { body: Buffer.from(protectedCanvas.split(',')[1] ?? '', 'base64'), contentType: 'image/png' });
  await testInfo.attach('m4-safe-respawn', { body: await page.screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Game over', exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#range-stats')).toContainText('Lives 0');
  const ended = await ticks(page);
  await page.waitForTimeout(350);
  expect(await ticks(page)).toBe(ended);
  await testInfo.attach('m4-gameover', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Restart run', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#range-stats')).toContainText('Stage 1 · Lives 3 · Score 0');
  await expect(page.locator('#debug')).toContainText('Respawn 0 · invulnerable 0 · tally 0');
  await expect(page.locator('#debug')).toContainText('Hostiles 0 / 128 · peak 0 · deferred 0 · fired 0');
});

test('plays stages one through five with real controls, a safe bonus and optional boss capture', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await expect(page.locator('#debug')).toContainText('Stage 1');
  await page.keyboard.down('Space');
  const reached = new Set<number>();
  for (let turn = 0; turn < 65; turn++) {
    const stage = await diagnosticNumber(page, /Stage (\d+)/);
    reached.add(stage);
    if (stage === 4) break;
    await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
    const key = turn % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    await page.waitForTimeout(1333);
    await page.keyboard.up(key);
  }
  await page.keyboard.up('Space');
  expect([...reached]).toEqual([1, 2, 3, 4]);
  await expect(page.locator('#range-stats')).toContainText('Bonus');
  await expect(page.locator('#range-stats')).toContainText('no damage');
  await expect(page.locator('#debug')).toContainText('Hostiles 0 / 128');
  const lives = await diagnosticNumber(page, /lives (\d+)/);
  const score = await diagnosticNumber(page, /score (\d+)/);
  expect(score).toBeGreaterThanOrEqual(13920);
  await testInfo.attach('m4-bonus-stage', { body: await page.screenshot(), contentType: 'image/png' });
  await expect.poll(() => diagnosticNumber(page, /Stage (\d+)/), { timeout: 25000 }).toBe(5);
  expect(await diagnosticNumber(page, /lives (\d+)/)).toBe(lives);
  expect(await diagnosticNumber(page, /score (\d+)/)).toBeGreaterThanOrEqual(score);
  await page.keyboard.press('Escape');
  await expect(page.locator('#range-stats')).toContainText('Stage 5');
  await expect(page.locator('#range-stats')).toContainText('Meridian Engine');
  await expect(page.locator('#debug')).toContainText('Boss 1 · phase 1');
  await expect(page.locator('#debug')).toContainText('Enemies 0 / 48');
  await testInfo.attach('m5-meridian-engine', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  const bossJourney = await steerThroughBoss(page);
  expect(bossJourney.phases).toEqual([1, 2, 3]);
  expect(bossJourney.captures).toBeGreaterThan(0);
  expect(bossJourney.peakDrones).toBe(2);
  await expect(page.locator('#range-stats')).toContainText('Meridian Engine defeated');
  await testInfo.attach('m5-boss-clear', { body: await page.screenshot(), contentType: 'image/png' });
});


test('opens the real Echo Lattice, freezes its visible field and cooldown on pause, and resets on restart', async ({ page }, testInfo) => {
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3');
  await page.locator('canvas').evaluate(async canvas => {
    await new Promise<void>(resolve => {
      const observe = (): void => {
        if (/Echo field [1-9]/.test(document.querySelector('#debug')?.textContent ?? '')) {
          document.querySelector<HTMLButtonElement>('[data-command="pause"]')?.click();
          resolve();
        } else requestAnimationFrame(observe);
      };
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
      canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true }));
      requestAnimationFrame(observe);
    });
  });
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  expect(await diagnosticNumber(page, /Echo field (\d+)/)).toBeGreaterThan(0);
  expect(await diagnosticNumber(page, /recharge (\d+)/)).toBeGreaterThan(0);
  await expect(page.locator('#debug')).toContainText('Drones 0 / 0');
  const rules = (await page.locator('#debug').textContent())?.split('Echo field')[1];
  const frame = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(600);
  expect((await page.locator('#debug').textContent())?.split('Echo field')[1]).toBe(rules);
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).toBe(frame);
  await testInfo.attach('m5-echo-field', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
  await expect(page.locator('#debug')).toContainText('Echo field 0');
  const recharge = await diagnosticNumber(page, /recharge (\d+)/);
  await page.keyboard.press('KeyK');
  await expect(page.locator('#debug')).toContainText('Echo field 0');
  expect(await diagnosticNumber(page, /recharge (\d+)/)).toBeLessThanOrEqual(recharge);
  await page.keyboard.press('KeyG');
  await page.getByRole('button', { name: 'Restart run', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#debug')).toContainText('Echo field 0 · recharge 0 · captures 0');
  await expect(page.locator('#debug')).toContainText('Drones 0 / 0 · Ward 0 · Fan 0 · Overclock 0');
  await expect(page.locator('#debug')).toContainText('Drops 0 / 12 · pickups 0');
});


async function steerThroughBoss(page: Page, finishGate = false): Promise<{ phases: number[]; captures: number; peakDrones: number }> {
  return page.locator('canvas').evaluate(async (element, targetGate) => {
    const canvas = element as HTMLCanvasElement;
    const readback = document.createElement('canvas'); readback.width = 360; readback.height = 640;
    const context = readback.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Readback unavailable');
    const phases = new Set<number>(); let captures = 0; let peakDrones = 0; let held = ''; let frames = 0; let firing = true;
    let previousPlayerX = 180; let previousTime = 0;
    const key = (type: string, code: string): void => { canvas.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })); };
    key('keydown', 'Space');
    return new Promise((resolve, reject) => {
      const observe = (timestamp: number): void => {
        const debug = document.querySelector('#debug')?.textContent ?? '';
        const phase = Number(debug.match(/Boss 1 · phase (\d+)/)?.[1] ?? 0);
        if (phase) phases.add(phase);
        captures = Math.max(captures, Number(debug.match(/captures (\d+)/)?.[1] ?? 0));
        const drones = debug.match(/Drones (\d+) \/ (\d+)/);
        peakDrones = Math.max(peakDrones, Number(Number(drones?.[1]) > 0) + Number(Number(drones?.[2]) > 0));
        const shouldFire = phase !== 2 || peakDrones === 2;
        if (shouldFire !== firing) { key(shouldFire ? 'keydown' : 'keyup', 'Space'); firing = shouldFire; }
        if (document.querySelector('#range-stats')?.textContent?.includes('Meridian Engine defeated')) {
          key('keyup', 'Space'); if (held) key('keyup', held);
          document.querySelector<HTMLButtonElement>('[data-command="pause"]')?.click();
          resolve({ phases: [...phases], captures, peakDrones }); return;
        }
        if (document.querySelector('#app')?.getAttribute('data-scene') !== 'play' || frames++ > 3600) {
          key('keyup', 'Space'); if (held) key('keyup', held);
          reject(new Error(`Boss journey stopped: ${debug}`)); return;
        }
        context.drawImage(canvas, 0, 0, 360, 640);
        const pixels = context.getImageData(0, 0, 360, 640).data;
        let sum = 0; let count = 0;
        for (let x = 0; x < 360; x++) {
          const offset = (580 * 360 + x) * 4;
          if (Math.abs((pixels[offset] ?? 0) - 172) < 12 && Math.abs((pixels[offset + 1] ?? 0) - 217) < 12
            && Math.abs((pixels[offset + 2] ?? 0) - 211) < 12) { sum += x; count++; }
        }
        const playerX = count ? sum / count : Number(debug.match(/Player X ([\d.]+)/)?.[1] ?? 180);
        const hp = debug.match(/HP (\d+)\/(\d+)\/(\d+)/);
        // Phase two's center lane mixes ordinary shots and pulses: wait beside it, not in it.
        let desired = phase === 1 ? Number(hp?.[1]) > 0 ? 115 : 245 : phase === 2 && !(targetGate && peakDrones === 2) ? 218 : 180;
        const ready = /recharge 0 ·/.test(debug) && peakDrones < 2;
        let pulseX = -1; let pulseY = -1;
        for (let y = 420; y < 580; y++) for (let x = 12; x < 348; x++) {
          const offset = (y * 360 + x) * 4;
          if ((pixels[offset] ?? 0) > 210 && (pixels[offset + 2] ?? 0) > 210
            && (pixels[offset + 1] ?? 255) < 210 && (pixels[offset + 1] ?? 0) > 150) { pulseX = x; pulseY = y; }
        }
        const fieldOpen = /Echo field [1-9]/.test(debug);
        if ((ready || fieldOpen) && pulseX >= 0) desired = pulseX + (phase === 2 ? 26 : 0);
        if ((phase !== 2 || targetGate && peakDrones === 2) && !ready && !fieldOpen && pulseY > 455 && Math.abs(pulseX - playerX) < 40) desired = pulseX + (pulseX < 180 ? 60 : -60);
        const ivory = (x: number, y: number): boolean => {
          const offset = (y * 360 + x) * 4;
          return (pixels[offset] ?? 0) > 185 && (pixels[offset + 1] ?? 0) > 180 && (pixels[offset + 2] ?? 0) > 170
            && (pixels[offset] ?? 0) - (pixels[offset + 1] ?? 0) < 25;
        };
        if (phase !== 2 || targetGate && peakDrones === 2) for (let y = 455; y < 565; y++) for (let x = Math.max(4, Math.floor(playerX - 28)); x < Math.min(348, playerX + 28); x++) {
          if (ivory(x, y) && (ivory(x + 6, y) || ivory(x + 7, y) || ivory(x + 8, y))) desired = x + (x < 180 ? 60 : -60);
        }
        if (ready && pulseY > 535 && Math.abs(pulseX - playerX) < 34) { key('keydown', 'KeyX'); key('keyup', 'KeyX'); }
        const velocity = previousTime === 0 ? 0 : Math.max(-250, Math.min(250, (playerX - previousPlayerX) * 1000 / (timestamp - previousTime)));
        previousPlayerX = playerX; previousTime = timestamp;
        const stoppingX = playerX + velocity * Math.abs(velocity) / 3200;
        const direction = Math.abs(desired - stoppingX) < 6 ? '' : desired > stoppingX ? 'ArrowRight' : 'ArrowLeft';
        if (direction !== held) { if (held) key('keyup', held); if (direction) key('keydown', direction); held = direction; }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
  }, finishGate);
}

if (process.env.LATTICEWAKE_PROFILE === '1') {
  test('M6 ten-minute real-control combat and audio allocation profile', async ({ page, browser, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'The heap and allocation profile uses Chromium CDP.');
    test.setTimeout(800_000);
    await page.goto('/?seed=42');
    await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Audio enabled', exact: true })).toBeVisible();
    await page.locator('#presentation summary').click();
    await page.getByLabel('Canvas glow').check(); await page.getByLabel('Scanlines', { exact: true }).check();
    await page.locator('#presentation summary').click();
    await page.getByRole('button', { name: 'Start run', exact: true }).click(); await page.keyboard.press('F3');
    const client = await page.context().newCDPSession(page);
    await client.send('HeapProfiler.enable'); await client.send('Performance.enable');
    await client.send('HeapProfiler.startSampling', { samplingInterval: 32768 });
    await page.evaluate(() => {
      const field = window as unknown as { m6Profile: { intervals: number[]; running: boolean; from: number; last: number } };
      field.m6Profile = { intervals: [], running: true, from: performance.now() + 20000, last: 0 };
      const record = (now: number): void => {
        const profile = field.m6Profile;
        if (!profile.running) return;
        if (now >= profile.from && profile.last > 0 && profile.intervals.length < 45000) profile.intervals.push(now - profile.last);
        profile.last = now; requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    const start = Date.now(); let turn = 0; let bosses = 0; let restarts = 0; let warmHeap = 0;
    let warmMetrics: Record<string, number> = {};
    const samples: { elapsed: number; metrics: Record<string, number>; debug: string; audio: string }[] = [];
    const sample = async (): Promise<void> => {
      const metrics = await client.send('Performance.getMetrics');
      samples.push({ elapsed: Date.now() - start, metrics: Object.fromEntries(metrics.metrics.map(item => [item.name, item.value])),
        debug: await page.locator('#debug').textContent() ?? '', audio: await page.locator('#audio-meter').textContent() ?? '' });
    };
    await page.keyboard.down('Space');
    while (Date.now() - start < 620000) {
      const scene = await page.locator('#app').getAttribute('data-scene');
      const stage = await diagnosticNumber(page, /Stage (\d+)/);
      if (scene === 'gameover') {
        await page.keyboard.up('Space'); await page.getByRole('button', { name: 'Restart run', exact: true }).click();
        restarts++; await page.keyboard.down('Space');
      } else if (stage === 5) {
        await page.keyboard.up('Space');
        const journey = await steerThroughBoss(page, true);
        expect(journey.phases).toEqual([1, 2, 3]); bosses++;
        await page.getByRole('button', { name: 'Resume run', exact: true }).click();
        await page.getByRole('button', { name: 'End session', exact: true }).click();
        await page.getByRole('button', { name: 'Restart run', exact: true }).click();
        restarts++; await page.keyboard.down('Space');
      } else {
        const key = turn++ % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
        await page.keyboard.down(key); await page.waitForTimeout(1333); await page.keyboard.up(key);
      }
      if (Date.now() - start > 20000 && warmHeap === 0) {
        await client.send('HeapProfiler.collectGarbage');
        const heap = await client.send('Runtime.getHeapUsage'); warmHeap = heap.usedSize;
        const metrics = await client.send('Performance.getMetrics');
        warmMetrics = Object.fromEntries(metrics.metrics.map(item => [item.name, item.value]));
      }
      if (samples.length === 0 || Date.now() - start - (samples.at(-1)?.elapsed ?? 0) > 10000) await sample();
    }
    await page.keyboard.up('Space');
    if (await page.locator('#app').getAttribute('data-scene') === 'play') await page.getByRole('button', { name: 'Pause run', exact: true }).click();
    await expect(page.locator('#audio-meter')).toContainText('SFX 0 / 24 · music 0 / 8'); await sample();
    const frame = await page.evaluate(() => {
      const profile = (window as unknown as { m6Profile: { running: boolean; intervals: number[] } }).m6Profile;
      profile.running = false; const values = profile.intervals.sort((a, b) => a - b);
      return { count: values.length, fps: values.length * 1000 / values.reduce((sum, value) => sum + value, 0),
        p95: values[Math.floor(values.length * 0.95)], over33: values.filter(value => value > 33.3).length / values.length };
    });
    await client.send('HeapProfiler.collectGarbage'); const finalHeap = await client.send('Runtime.getHeapUsage');
    const metrics = await client.send('Performance.getMetrics');
    const finalMetrics = Object.fromEntries(metrics.metrics.map(item => [item.name, item.value]));
    const allocation = await client.send('HeapProfiler.stopSampling');
    const evidence = { scope: 'Local headless Chromium real-key stages 1–5, bonuses, repeated boss captures and restarts; 20s warmup then ≥10m combat. High decorative effects; driver/readback/profile allocations included. Not a cap-filled late-stage or hardware qualification.',
      browser: browser.version(), viewport: page.viewportSize(), platform: await page.evaluate(() => navigator.userAgent),
      duration: Date.now() - start, bosses, restarts, frame, warmHeap, finalHeap, warmMetrics, finalMetrics, samples };
    console.info('M6 combat profile', JSON.stringify({ ...evidence, samples: undefined }));
    await testInfo.attach('m6-combat-profile', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    await testInfo.attach('m6-allocation-sampling', { body: JSON.stringify(allocation), contentType: 'application/json' });
    expect(bosses).toBeGreaterThan(1); expect(frame.count).toBeGreaterThan(30000);
    expect(finalHeap.usedSize).toBeLessThan(64 * 1024 * 1024);
    expect(finalHeap.usedSize - warmHeap).toBeLessThan(10 * 1024 * 1024);
    for (const sample of samples) {
      const audio = sample.audio.match(/SFX (\d+) \/ 24 · music (\d+) \/ 8/);
      expect(Number(audio?.[1])).toBeLessThanOrEqual(24); expect(Number(audio?.[2])).toBeLessThanOrEqual(8);
      expect(Number(sample.audio.match(/nodes (\d+)/)?.[1])).toBeLessThanOrEqual(67);
      expect(Number(sample.audio.match(/buffers (\d+)/)?.[1])).toBe(21);
    }
  });
}

import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
import type { GameAudio } from '../../src/audio/audio';
import type { HitEvents } from '../../src/game/events';

declare global {
  interface Window {
    audioProbe: { contexts: AudioContext[]; gains: GainNode[]; sources: number; ended: number };
    AudioUnderTest: { GameAudio: typeof GameAudio };
    stressAudio: GameAudio;
  }
}
const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    await use(); expect(errors).toEqual([]);
  }, { auto: true }],
});
async function probe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.audioProbe = { contexts: [], gains: [], sources: 0, ended: 0 };
    window.AudioContext = class extends Native {
      constructor() { super(); window.audioProbe.contexts.push(this); }
      override createGain(): GainNode { const node = super.createGain(); window.audioProbe.gains.push(node); return node; }
      override createBufferSource(): AudioBufferSourceNode {
        const node = super.createBufferSource(); window.audioProbe.sources++;
        node.addEventListener('ended', () => { window.audioProbe.ended++; }, { once: true });
        return node;
      }
    };
  });
}
async function openSettings(page: Page): Promise<void> { await page.locator('#presentation summary').click(); }

test('native audio is gesture-only, buses ramp, mute drains voices and pause/background require explicit resume', async ({ page }) => {
  await probe(page); await page.goto('/?seed=42');
  await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(0);
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Audio enabled', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(1);
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3'); await page.keyboard.down('Space'); await page.waitForTimeout(1300); await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.audioProbe.sources)).toBeGreaterThan(5);
  await openSettings(page);
  await expect(page.locator('#audio-meter')).toContainText('Audio ready');
  await page.getByLabel('Mute all audio').check();
  await expect(page.locator('#audio-meter')).toContainText('SFX 0 / 24 · music 0 / 8');
  const sources = await page.evaluate(() => window.audioProbe.sources);
  await page.waitForTimeout(400); expect(await page.evaluate(() => window.audioProbe.sources)).toBe(sources);
  for (const [label, id, index] of [['Master', 'master-volume', 0], ['Music', 'music-volume', 1], ['SFX', 'sfx-volume', 2]] as const) {
    await page.getByRole('slider', { name: label, exact: true }).focus(); await page.keyboard.press('Home');
    await expect(page.locator(`output[for="${id}"]`)).toHaveText('0%');
    await expect.poll(() => page.evaluate(i => window.audioProbe.gains[i]?.gain.value, index)).toBeLessThan(0.001);
    await page.keyboard.press('End');
    await expect(page.locator(`output[for="${id}"]`)).toHaveText('100%');
  }
  await page.getByLabel('Mute all audio').uncheck();
  await expect.poll(() => page.evaluate(() => window.audioProbe.gains[0]?.gain.value)).toBeGreaterThan(0.99);
  await openSettings(page); await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await expect(page.locator('#audio-meter')).toContainText('Audio suspended · SFX 0 / 24 · music 0 / 8');
  const paused = await page.locator('#debug').textContent(); await page.waitForTimeout(300);
  expect((await page.locator('#debug').textContent())?.match(/Ticks (\d+)/)?.[1]).toBe(paused?.match(/Ticks (\d+)/)?.[1]);
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.locator('#audio-meter')).toContainText('Audio ready');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  await expect(page.locator('#audio-meter')).toContainText('Audio suspended');
  const stopped = await page.evaluate(() => window.audioProbe.sources);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.audioProbe.sources)).toBe(stopped);
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.locator('#audio-meter')).toContainText('Audio ready');
  await page.evaluate(() => window.audioProbe.contexts[0]?.suspend());
  await expect(page.getByRole('button', { name: 'Resume audio', exact: true })).toBeVisible();
  await page.waitForTimeout(250); expect(await page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('suspended');
  await page.getByRole('button', { name: 'Resume audio', exact: true }).click();
  await expect(page.locator('#audio-meter')).toContainText('Audio ready');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('closed');
});

for (const denial of ['missing', 'rejected', 'pending'] as const) {
  test(`audio ${denial} activation falls back silently without blocking controls`, async ({ page }) => {
    // Optional API failures cannot be requested from Chromium; inject only the failing native boundary.
    await page.addInitScript(mode => {
      if (mode === 'missing') Object.defineProperty(window, 'AudioContext', { value: undefined });
      else {
        AudioContext.prototype.resume = mode === 'rejected'
          ? () => Promise.reject(new DOMException('Activation denied', 'NotAllowedError')) : () => new Promise<void>(() => {});
      }
    }, denial);
    await page.goto('/?seed=42'); await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry audio', exact: true })).toBeVisible();
    await openSettings(page); await expect(page.locator('#audio-status')).toContainText('Silent play works'); await openSettings(page);
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await page.keyboard.press('F3'); await page.keyboard.down('Space');
    await expect(page.locator('#debug')).toContainText('fire 1');
    await page.keyboard.up('Space'); await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Resume run', exact: true })).toBeVisible();
  });
}

test('effect toggles redraw paused pixels but preserve rules and low/reduced effects retain gameplay cues', async ({ page }) => {
  await page.goto('/?seed=42'); await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('F3'); await page.waitForTimeout(500); await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'pause');
  const rules = (await page.locator('#debug').textContent())?.replace(/FPS [\d.]+/, 'FPS');
  const image = await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL());
  await openSettings(page); await page.getByLabel('Canvas glow').check(); await page.getByLabel('Scanlines', { exact: true }).check();
  expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())).not.toBe(image);
  await page.getByLabel('Low effects').check();
  await expect.poll(() => page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width / canvas.getBoundingClientRect().width)).toBeLessThan(1.26);
  await page.getByLabel('Fragments', { exact: true }).uncheck(); await page.getByLabel('Small impact shake').uncheck();
  await page.waitForTimeout(300);
  expect((await page.locator('#debug').textContent())?.replace(/FPS [\d.]+/, 'FPS')).toBe(rules);
  await page.getByLabel('Low effects').uncheck(); await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSettings(page); await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await page.keyboard.down('Space'); await expect(page.locator('#debug')).toContainText('fire 1'); await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'End session', exact: true }).click();
  await page.getByRole('button', { name: 'Restart run', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.locator('#debug')).toContainText('score 0');
});

test('real WebAudio adapter caps simultaneous voices, releases nodes and keeps cached buffers bounded', async ({ page }, testInfo) => {
  // Bundle the unchanged adapter for native API unit stress; no application state or production test hooks.
  const result = await build({ configFile: false, logLevel: 'silent', build: {
    write: false, lib: { entry: resolve('src/audio/audio.ts'), formats: ['iife'], name: 'AudioUnderTest' },
  } });
  const output = Array.isArray(result) ? result[0] : result;
  if (!output || !('output' in output)) throw new Error('Expected audio test bundle');
  const chunk = output.output.find(item => item.type === 'chunk'); if (!chunk || chunk.type !== 'chunk') throw new Error('Missing audio bundle');
  await page.goto('/'); await page.addScriptTag({ content: chunk.code });
  await page.evaluate(() => {
    const button = document.createElement('button'); button.textContent = 'Native adapter stress';
    button.onclick = () => { window.stressAudio = new window.AudioUnderTest.GameAudio(); void window.stressAudio.enable(); };
    document.body.append(button);
  });
  await page.getByRole('button', { name: 'Native adapter stress' }).click();
  await expect.poll(() => page.evaluate(() => window.stressAudio.status)).toBe('ready');
  const evidence = await page.evaluate(async () => {
    const audio = window.stressAudio; audio.reset(42); audio.setPlaying(true);
    const events = { count: 192, slots: Array.from({ length: 192 }, (_, id) => ({ kind: 'destroy', tick: 1, id, x: 0, y: 0 })) };
    audio.consume(events as unknown as HitEvents); audio.frame();
    const saturated = { sfx: audio.activeSfx, music: audio.activeMusic, dropped: audio.dropped, nodes: audio.nodes, buffers: audio.buffers };
    const deadline = performance.now() + 5000;
    while ((audio.activeSfx > 0 || audio.activeMusic > 0) && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const released = { sfx: audio.activeSfx, music: audio.activeMusic, nodes: audio.nodes };
    for (let run = 0; run < 20; run++) { audio.reset(run); audio.setMuted(run % 2 === 0); audio.setLevel('sfx', 0.4); }
    const buffers = audio.buffers; audio.dispose();
    return { saturated, released, buffers, disposed: { nodes: audio.nodes, buffers: audio.buffers } };
  });
  expect(evidence.saturated.sfx).toBe(24); expect(evidence.saturated.music).toBeGreaterThan(0);
  expect(evidence.saturated.music).toBeLessThanOrEqual(8); expect(evidence.saturated.dropped).toBe(168);
  expect(evidence.released).toEqual({ sfx: 0, music: 0, nodes: 35 });
  expect(evidence.buffers).toBe(evidence.saturated.buffers); expect(evidence.disposed).toEqual({ nodes: 0, buffers: 0 });
  await testInfo.attach('native-audio-capacity', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

for (const boundary of ['buffer', 'source', 'start'] as const) {
  test(`native ${boundary} failure releases the graph, keeps play live and retries cleanly`, async ({ page, browserName }) => {
    test.fixme(browserName === 'webkit', 'Open M8 defect: on WebKit the probe reads the stored context as running after the app-side close() resolves closed.');
    await probe(page);
    // Chromium has no deterministic resource-exhaustion switch; fail one native call then restore it.
    await page.addInitScript(failure => {
      if (failure === 'buffer') {
        const native = AudioContext.prototype.createBuffer; let calls = 0;
        AudioContext.prototype.createBuffer = function (...args) {
          if (++calls === 3) { AudioContext.prototype.createBuffer = native; throw new Error('Buffer allocation denied'); }
          return Reflect.apply(native, this, args);
        };
      } else if (failure === 'source') {
        const native = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
          AudioContext.prototype.createBufferSource = native; throw new Error('Source allocation denied');
        };
      } else {
        const native = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function () {
          AudioBufferSourceNode.prototype.start = native; throw new DOMException('Start denied', 'InvalidStateError');
        };
      }
    }, boundary);
    await page.goto('/?seed=42'); await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
    if (boundary !== 'buffer') await expect(page.getByRole('button', { name: 'Audio enabled', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start run', exact: true }).click(); await page.keyboard.press('F3');
    await expect(page.getByRole('button', { name: 'Retry audio', exact: true })).toBeVisible();
    await expect(page.locator('#audio-meter')).toContainText('nodes 0 · buffers 0');
    await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('closed');
    await page.keyboard.down('Space'); await expect(page.locator('#debug')).toContainText('fire 1'); await page.keyboard.up('Space');
    await page.getByRole('button', { name: 'Retry audio', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Audio enabled', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.audioProbe.contexts.length)).toBe(2);
    await expect(page.locator('#audio-meter')).toContainText('buffers 21');
  });
}

test('pending activation is cancelled on pause and teardown without a delayed unlock', async ({ page }) => {
  await probe(page);
  await page.addInitScript(() => { AudioContext.prototype.resume = () => new Promise<void>(() => {}); });
  await page.goto('/?seed=42'); await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enabling audio…', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume audio', exact: true })).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(page.getByRole('button', { name: 'Resume audio', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await expect.poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state)).toBe('closed');
});

test('keeps audio and effect controls usable above compact landscape pause panels', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 }); await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.keyboard.press('Escape'); await openSettings(page);
  await page.getByLabel('Canvas glow').check(); await openSettings(page);
  await expect(page.locator('.presentation-panel')).toBeHidden();
  await page.getByRole('button', { name: 'Enable audio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Audio enabled', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume run', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'play');
});

test('Enter and Space operate the native settings summary without starting or firing a run', async ({ page }) => {
  await page.goto('/?seed=42'); const summary = page.locator('#presentation summary');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#presentation')).toHaveAttribute('open', '');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.keyboard.press('Space');
  await expect(page.locator('#presentation')).not.toHaveAttribute('open');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
});

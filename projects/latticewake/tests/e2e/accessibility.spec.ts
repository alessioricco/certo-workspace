import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ContrastItem { text: string; ratio: number; required: number }

async function contrastReport(page: Page): Promise<ContrastItem[]> {
  // Translucent panels are composited over their ancestors; the canvas beneath them is not sampled, so this is an approximation.
  return page.evaluate(() => {
    interface Rgba { r: number; g: number; b: number; a: number }
    const parse = (value: string): Rgba => {
      const [r = 0, g = 0, b = 0, a = 1] = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r, g, b, a };
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => ({
      r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1,
    });
    const channel = (value: number): number => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: Rgba): number => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    const backdrop = (element: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color.a > 0) layers.push(color);
        if (color.a >= 1) break;
      }
      let result: Rgba = { r: 8, g: 13, b: 21, a: 1 };
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const visible = (element: Element): boolean => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const ownText = (element: Element): string => [...element.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? '').join('').trim();
    return [...document.querySelectorAll('#app *')]
      .filter(element => ownText(element) !== '' && visible(element) && !element.matches(':disabled'))
      .map(element => {
        const style = getComputedStyle(element);
        const foreground = over(parse(style.color), backdrop(element));
        const background = backdrop(element);
        const size = Number.parseFloat(style.fontSize);
        const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);
        const high = Math.max(luminance(foreground), luminance(background));
        const low = Math.min(luminance(foreground), luminance(background));
        return { text: ownText(element).slice(0, 48), ratio: (high + 0.05) / (low + 0.05), required: large ? 3 : 4.5 };
      });
  });
}

async function expectReadableText(page: Page, scene: string): Promise<void> {
  const report = await contrastReport(page);
  expect(report.length, scene).toBeGreaterThan(5);
  expect(report.filter(item => item.ratio < item.required), scene).toEqual([]);
}

test('keeps every visible text run above its WCAG contrast minimum in each palette and scene', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.locator('#diagnostics summary').click();
  await page.locator('#scores summary').click();
  await page.locator('#presentation summary').click();
  for (const palette of ['default', 'color-safe', 'contrast'] as const) {
    await page.selectOption('#palette', palette);
    await expectReadableText(page, `menu ${palette}`);
  }
  await page.selectOption('#palette', 'default');
  await page.locator('#presentation summary').click();
  await page.getByRole('button', { name: 'Start run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause run', exact: true }).click();
  await expectReadableText(page, 'pause');
});

test('names every visible control for assistive technology', async ({ page }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  await page.locator('#diagnostics summary').click();
  await page.locator('#presentation summary').click();
  const unnamed = await page.evaluate(() => {
    const nameOf = (element: HTMLElement): string => {
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) return labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      const label = element.getAttribute('aria-label');
      if (label) return label.trim();
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        const named = [...(element.labels ?? [])].map(item => item.textContent ?? '').join(' ').trim();
        if (named) return named;
      }
      return (element.textContent ?? '').trim();
    };
    return [...document.querySelectorAll<HTMLElement>('#app button, #app summary, #app input, #app select, #app textarea, #app canvas')]
      .filter(element => element.getClientRects().length > 0)
      .filter(element => nameOf(element) === '')
      .map(element => element.id || element.tagName);
  });
  expect(unnamed).toEqual([]);
});

test('shows a visible focus indicator on each keyboard stop of the title screen', async ({ page, browserName }) => {
  await page.goto('/?seed=42');
  await expect(page.locator('#app')).toHaveAttribute('data-scene', 'menu');
  const unfocused: string[] = [];
  const stops: string[] = [];
  for (let step = 0; step < 16; step++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement)) return undefined;
      const style = getComputedStyle(element);
      const outlined = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      return { name: element.id || element.tagName.toLowerCase(), outlined, focusVisible: element.matches(':focus-visible') };
    });
    if (!stop || stop.name === 'body') continue;
    stops.push(stop.name);
    if (!stop.outlined || !stop.focusVisible) unfocused.push(stop.name);
  }
  // macOS Safari's default Tab order reaches fewer title-screen controls; the minimum is lower there and recorded as a gap.
  expect(new Set(stops).size).toBeGreaterThan(browserName === 'webkit' ? 2 : 4);
  expect(unfocused).toEqual([]);
});

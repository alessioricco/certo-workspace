import { expect, test, type Page } from '@playwright/test';
import { allTickerPayloads, candleStream, tickerPayload } from '../src/test/fixtures';

// Service-boundary fixtures make outages and live transitions reproducible; the app and chart are real.
async function serveMarketData(page: Page, withStream = true) {
  await page.route('https://data-api.binance.vision/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('ticker')) await route.fulfill({ json: allTickerPayloads(Date.now()) });
    else {
      const end = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const candles = Array.from({ length: 100 }, (_, i) => {
        const price = 100 + Math.sin(i / 5) * 4 + i / 5;
        return [end - (99 - i) * 3_600_000, String(price), String(price + 3), String(price - 3), String(price + Math.sin(i)), String(50 + i)];
      });
      await route.fulfill({ json: candles });
    }
  });
  if (withStream) await page.routeWebSocket('wss://data-stream.binance.vision/**', () => {});
}

test('production dashboard renders real chart library, switches markets/intervals and supports watchlists', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await serveMarketData(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The market, in focus.' })).toBeVisible();
  await expect(page.getByRole('img', { name: /BTC\/USDT.*interactive candlestick/ })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('REST snapshot', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4H', exact: true }).click();
  await expect(page.getByRole('button', { name: '4H', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Select Ethereum' }).click();
  await expect(page.getByRole('region', { name: 'Ethereum market details' })).toBeVisible();
  await expect(page.getByRole('img', { name: /ETH\/USDT.*4H/ })).toBeVisible();
  await page.getByRole('button', { name: 'View data' }).click();
  await expect(page.getByRole('table', { name: /Latest 8 ETH/ })).toBeVisible();
  await expect(page.locator('#candle-data tbody tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Add Ethereum to watchlist' }).click();
  await page.getByRole('button', { name: /Watchlist 1/ }).click();
  await expect(page.getByRole('button', { name: 'Select Ethereum' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Select Bitcoin' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /Watchlist 1/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test('shows regional REST rejection instead of sample prices and recovers through retry', async ({ page }) => {
  await page.route('https://data-api.binance.vision/**', (route) => route.fulfill({ status: 451, json: { msg: 'Unavailable' } }));
  await page.routeWebSocket('wss://data-stream.binance.vision/**', () => {});
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chart data unavailable' })).toBeVisible();
  await expect(page.getByText('Data unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert').first()).toContainText('not accessible from this region or network');
  await expect(page.getByText('100.25', { exact: true })).toHaveCount(0);
  await page.unroute('https://data-api.binance.vision/**');
  await serveMarketData(page);
  await page.getByRole('button', { name: 'Refresh market data' }).click();
  await expect(page.getByRole('img', { name: /interactive candlestick/ })).toBeVisible();
});

test('labels offline cached data and remains usable on a narrow mobile viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveMarketData(page);
  await page.goto('/');
  await expect(page.getByRole('img', { name: /interactive candlestick/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.setOffline(true);
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  await expect(page.getByText('You’re offline. Displayed values are cached, not live.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh market data' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Search cryptocurrencies' }).fill('sol');
  await expect(page.getByRole('button', { name: 'Select Solana' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Offline', { exact: true })).toHaveCount(0);
});

test('shows loading and empty chart states without drawing fabricated candles', async ({ page }) => {
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  await page.route('https://data-api.binance.vision/**', async (route) => {
    if (route.request().url().includes('klines')) { await wait; await route.fulfill({ json: [] }); }
    else await route.fulfill({ json: allTickerPayloads(Date.now()) });
  });
  await page.routeWebSocket('wss://data-stream.binance.vision/**', () => {});
  await page.goto('/');
  await expect(page.getByText('Bringing the market into focus')).toBeVisible();
  release!();
  await expect(page.getByRole('heading', { name: 'No candles available' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('only declares live after fresh selected ticker and candle messages arrive', async ({ page }) => {
  await serveMarketData(page, false);
  let send: ((data: string) => void) | undefined;
  await page.routeWebSocket('wss://data-stream.binance.vision/**', (ws) => { send = (data) => ws.send(data); });
  await page.goto('/');
  await expect(page.getByRole('img', { name: /interactive candlestick/ })).toBeVisible();
  await expect(page.getByText('REST snapshot', { exact: true })).toBeVisible();
  const source = tickerPayload('BTCUSDT', Date.now());
  send!(JSON.stringify({ data: { e: '24hrTicker', s: source.symbol, c: source.lastPrice, P: source.priceChangePercent, h: source.highPrice, l: source.lowPrice, v: source.volume, q: source.quoteVolume, C: source.closeTime } }));
  await expect(page.getByText('Live market data', { exact: true })).toHaveCount(0);
  const candle = candleStream('BTCUSDT', '1h', Date.now());
  candle.data.k.t = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  send!(JSON.stringify(candle));
  await expect(page.getByText('Live market data', { exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(16_000);
  await expect(page.getByText('Live market data', { exact: true })).toHaveCount(0);
});

for (const status of [400, 429]) {
  test(`handles HTTP ${status} and pauses automatic REST retries`, async ({ page }) => {
    let requests = 0;
    await page.route('https://data-api.binance.vision/**', (route) => {
      requests++;
      return route.fulfill({ status, json: { code: status === 400 ? -1121 : -1003, msg: 'Service error' } });
    });
    await page.routeWebSocket('wss://data-stream.binance.vision/**', () => {});
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Chart data unavailable' })).toBeVisible();
    await expect(page.getByRole('alert').first()).toContainText(status === 429 ? 'rate-limited' : 'pair or interval is unavailable');
    expect(requests).toBe(2);
    await page.clock.install();
    await page.clock.fastForward(65_000);
    await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
    expect(requests).toBe(2);
    await expect(page.getByText('Live market data', { exact: true })).toHaveCount(0);
  });
}

test('rejects malformed successful responses instead of displaying NaN or zero prices', async ({ page }) => {
  await page.route('https://data-api.binance.vision/**', (route) => route.fulfill({ json: route.request().url().includes('klines') ? [[1234, 'NaN']] : allTickerPayloads(Date.now()).map((ticker) => ({ ...ticker, lastPrice: 'not-a-number' })) }));
  await page.routeWebSocket('wss://data-stream.binance.vision/**', () => {});
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chart data unavailable' })).toBeVisible();
  await expect(page.getByRole('alert').first()).toContainText('incomplete or invalid market data');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.selected-price')).not.toContainText('NaN');
  await expect(page.locator('.selected-price')).toContainText('—');
});

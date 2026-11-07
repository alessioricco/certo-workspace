import { describe, expect, it } from 'vitest';
import { MarketDataError, mergeCandle, numeric, parseKlines, parseStream, parseTicker, parseTickers } from './binance';
import { allTickerPayloads, candleStream, klinePayload, tickerPayload } from '../test/fixtures';

describe('Binance payload validation', () => {
  it('parses REST ticker strings and preserves the source timestamp', () => {
    expect(parseTicker(tickerPayload())).toEqual({ symbol: 'BTCUSDT', price: 100.25, change: 2.5, high: 110, low: 90, volume: 1200, quoteVolume: 120300, updatedAt: 1_794_041_344_010 });
  });
  it('parses all curated markets without filling missing values', () => {
    expect(Object.keys(parseTickers(allTickerPayloads()))).toHaveLength(8);
    expect(() => parseTickers(allTickerPayloads().slice(1))).toThrow(/unavailable or unsupported/);
    expect(() => parseTickers([...allTickerPayloads(), tickerPayload()])).toThrow(MarketDataError);
  });
  it.each([null, {}, [], { code: -1121, msg: 'Invalid symbol.' }])('rejects malformed ticker response %j', (value) => {
    expect(() => parseTicker(value)).toThrow(MarketDataError);
  });
  it.each(['', ' ', 'NaN', 'Infinity', null, true, '1x', [], Infinity, NaN])('rejects unsafe numeric field %j', (value) => {
    expect(() => numeric(value)).toThrow(MarketDataError);
  });
  it('rejects unsupported markets and impossible prices', () => {
    expect(() => parseTicker(tickerPayload('NOTUSDT'))).toThrow(/not supported/);
    expect(() => parseTicker({ ...tickerPayload(), lastPrice: '-1' })).toThrow(MarketDataError);
    expect(() => parseTicker({ ...tickerPayload(), lowPrice: '150' })).toThrow(MarketDataError);
    expect(() => parseTicker({ ...tickerPayload(), volume: '-1' })).toThrow(MarketDataError);
    expect(() => parseTicker({ ...tickerPayload(), closeTime: 1.5 })).toThrow(MarketDataError);
  });
  it('parses ordered OHLCV candles and converts milliseconds into seconds', () => {
    expect(parseKlines(klinePayload())[0]).toEqual({ time: 1_794_031_200, open: 100, high: 110, low: 90, close: 105, volume: 25 });
    expect(parseKlines([])).toEqual([]);
  });
  it('rejects duplicates, reversed candles, incomplete rows, and inconsistent OHLC', () => {
    const rows = klinePayload();
    for (const value of [[rows[0], rows[0]], [...rows].reverse(), [[100]], [[1_794_031_200_000, '100', '99', '90', '105', '1']], { candles: [] }]) {
      expect(() => parseKlines(value)).toThrow(MarketDataError);
    }
  });
  it('validates websocket candle symbol and interval before accepting it', () => {
    expect(parseStream(candleStream(), 'BTCUSDT', '1h')).toMatchObject({ kind: 'candle', candle: { close: 109, volume: 37 } });
    expect(() => parseStream(candleStream('ETHUSDT'), 'BTCUSDT', '1h')).toThrow(MarketDataError);
    expect(() => parseStream(candleStream('BTCUSDT', '4h'), 'BTCUSDT', '1h')).toThrow(MarketDataError);
    expect(() => parseStream({ data: { e: 'unknown' } }, 'BTCUSDT', '1h')).toThrow(MarketDataError);
  });
  it('parses ticker stream field names without assuming REST field names', () => {
    const value = { data: { e: '24hrTicker', s: 'ETHUSDT', c: '100', P: '-2', h: '110', l: '90', v: '2', q: '200', C: 1_794_041_344_010 } };
    expect(parseStream(value, 'BTCUSDT', '1h')).toMatchObject({ kind: 'ticker', ticker: { symbol: 'ETHUSDT', change: -2 } });
  });
});

describe('candle cache updates', () => {
  it('replaces the current candle and ignores old updates', () => {
    const candles = parseKlines(klinePayload());
    const candle = { ...candles[1], close: 109 };
    expect(mergeCandle(candles, candle)).toEqual([candles[0], candle]);
    expect(mergeCandle(candles, candles[0])).toBe(candles);
    expect(mergeCandle([], candle)).toEqual([]);
  });
  it('appends new candles and bounds the cache to 300', () => {
    const candle = parseKlines(klinePayload())[0];
    const candles = Array.from({ length: 300 }, (_, index) => ({ ...candle, time: candle.time + index * 3600 }));
    const next = { ...candle, time: candle.time + 300 * 3600 };
    const merged = mergeCandle(candles, next);
    expect(merged).toHaveLength(300);
    expect(merged[0]).toEqual(candles[1]);
    expect(merged.at(-1)).toEqual(next);
  });
});

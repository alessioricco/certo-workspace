export const COINS = [
  { symbol: 'BTCUSDT', ticker: 'BTC', name: 'Bitcoin', mark: '₿', color: '#f3aa45' },
  { symbol: 'ETHUSDT', ticker: 'ETH', name: 'Ethereum', mark: 'Ξ', color: '#a5b5eb' },
  { symbol: 'SOLUSDT', ticker: 'SOL', name: 'Solana', mark: '≋', color: '#a797ec' },
  { symbol: 'BNBUSDT', ticker: 'BNB', name: 'BNB', mark: '◇', color: '#e4c65f' },
  { symbol: 'XRPUSDT', ticker: 'XRP', name: 'XRP', mark: '×', color: '#bdc7d4' },
  { symbol: 'ADAUSDT', ticker: 'ADA', name: 'Cardano', mark: '⠿', color: '#649ceb' },
  { symbol: 'DOGEUSDT', ticker: 'DOGE', name: 'Dogecoin', mark: 'Ð', color: '#d2bd7a' },
  { symbol: 'AVAXUSDT', ticker: 'AVAX', name: 'Avalanche', mark: 'Λ', color: '#ec838a' },
] as const;
export type Coin = (typeof COINS)[number];
export type Symbol = Coin['symbol'];
export const INTERVALS = ['1h', '4h', '1d', '1w'] as const;
export type Interval = (typeof INTERVALS)[number];
export type Ticker = {
  symbol: Symbol; price: number; change: number; high: number; low: number;
  volume: number; quoteVolume: number; updatedAt: number;
};
export type Tickers = Partial<Record<Symbol, Ticker>>;
export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export const REST_URL = 'https://data-api.binance.vision';
export const STREAM_URL = 'wss://data-stream.binance.vision/stream';

export class MarketDataError extends Error {
  constructor(message: string, public readonly retryable = false, public readonly status?: number) {
    super(message);
    this.name = 'MarketDataError';
  }
}

function invalid(): never { throw new MarketDataError('Binance returned incomplete or invalid market data. Please refresh to try again.'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
export function numeric(value: unknown, min = -Infinity): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value))) return invalid();
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) return invalid();
  return number;
}
function timestamp(value: unknown): number {
  const time = numeric(value, 1);
  if (!Number.isSafeInteger(time)) return invalid();
  return time;
}
export function isSymbol(value: unknown): value is Symbol {
  return COINS.some((coin) => coin.symbol === value);
}
export function parseTicker(value: unknown, stream = false): Ticker {
  const row = record(value);
  const symbol = stream ? row.s : row.symbol;
  if (!isSymbol(symbol)) throw new MarketDataError('This pair is not supported. Choose a pair from the market list.');
  const ticker = {
    symbol,
    price: numeric(stream ? row.c : row.lastPrice, Number.MIN_VALUE),
    change: numeric(stream ? row.P : row.priceChangePercent),
    high: numeric(stream ? row.h : row.highPrice, Number.MIN_VALUE),
    low: numeric(stream ? row.l : row.lowPrice, Number.MIN_VALUE),
    volume: numeric(stream ? row.v : row.volume, 0),
    quoteVolume: numeric(stream ? row.q : row.quoteVolume, 0),
    updatedAt: timestamp(stream ? row.C : row.closeTime),
  };
  if (ticker.high < ticker.low || ticker.price > ticker.high || ticker.price < ticker.low) return invalid();
  return ticker;
}
export function parseTickers(value: unknown): Tickers {
  if (!Array.isArray(value)) return invalid();
  const result: Tickers = {};
  for (const row of value) {
    const ticker = parseTicker(row);
    if (result[ticker.symbol]) return invalid();
    result[ticker.symbol] = ticker;
  }
  if (COINS.some(({ symbol }) => !result[symbol])) {
    throw new MarketDataError('Binance did not return all requested pairs. A pair may be unavailable or unsupported.');
  }
  return result;
}
function validateCandle(candle: Candle): Candle {
  if (candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) return invalid();
  return candle;
}
export function parseKlines(value: unknown): Candle[] {
  if (!Array.isArray(value)) return invalid();
  const candles = value.map((row) => {
    if (!Array.isArray(row) || row.length < 6) return invalid();
    return validateCandle({ time: timestamp(row[0]) / 1000, open: numeric(row[1], Number.MIN_VALUE),
      high: numeric(row[2], Number.MIN_VALUE), low: numeric(row[3], Number.MIN_VALUE),
      close: numeric(row[4], Number.MIN_VALUE), volume: numeric(row[5], 0) });
  });
  for (let i = 0; i < candles.length; i++) {
    if (!Number.isInteger(candles[i].time) || (i > 0 && candles[i].time <= candles[i - 1].time)) return invalid();
  }
  return candles;
}
export type StreamUpdate = { kind: 'ticker'; ticker: Ticker } | { kind: 'candle'; candle: Candle; eventAt: number };
export function parseStream(value: unknown, symbol: Symbol, interval: Interval): StreamUpdate {
  const row = record(record(value).data);
  if (row.e === '24hrTicker') return { kind: 'ticker', ticker: parseTicker(row, true) };
  if (row.e !== 'kline' || row.s !== symbol) return invalid();
  const kline = record(row.k);
  if (kline.s !== symbol || kline.i !== interval) return invalid();
  const time = timestamp(kline.t) / 1000;
  if (!Number.isInteger(time)) return invalid();
  return { kind: 'candle', eventAt: timestamp(row.E), candle: validateCandle({ time,
    open: numeric(kline.o, Number.MIN_VALUE), high: numeric(kline.h, Number.MIN_VALUE),
    low: numeric(kline.l, Number.MIN_VALUE), close: numeric(kline.c, Number.MIN_VALUE), volume: numeric(kline.v, 0) }) };
}

async function request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const url = new URL(path, REST_URL);
  url.search = new URLSearchParams(params).toString();
  const timeout = AbortSignal.timeout(12_000);
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: 'omit' });
    if (!response.ok) {
      if (response.status === 451 || response.status === 403) throw new MarketDataError('Binance market data is not accessible from this region or network. Check local service availability; no data is being substituted.', false, response.status);
      if (response.status === 429 || response.status === 418) throw new MarketDataError('Binance has temporarily rate-limited this network. Automatic retries are paused; wait a few minutes before refreshing.', false, response.status);
      if (response.status === 400) throw new MarketDataError('This pair or interval is unavailable on Binance Spot. Try another market.', false, response.status);
      throw new MarketDataError(`Binance is unavailable (HTTP ${response.status}). Please try again shortly.`, response.status >= 500, response.status);
    }
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof MarketDataError) throw error;
    if (timeout.aborted) throw new MarketDataError('Binance took too long to respond. Check your connection and try again.', true);
    throw new MarketDataError('Unable to reach Binance. Check your connection; the service may be unavailable or restricted in your region.', true);
  }
}
export async function fetchTickers(signal?: AbortSignal): Promise<Tickers> {
  return parseTickers(await request('/api/v3/ticker/24hr', { symbols: JSON.stringify(COINS.map((coin) => coin.symbol)) }, signal));
}
export async function fetchCandles(symbol: Symbol, interval: Interval, signal?: AbortSignal): Promise<Candle[]> {
  if (!isSymbol(symbol) || !INTERVALS.includes(interval)) throw new MarketDataError('This pair or interval is not supported.');
  return parseKlines(await request('/api/v3/klines', { symbol, interval, limit: '300' }, signal));
}
export function mergeCandle(candles: Candle[], candle: Candle): Candle[] {
  const last = candles.at(-1);
  if (!last || candle.time < last.time) return candles;
  if (last.time === candle.time) return [...candles.slice(0, -1), candle];
  return [...candles.slice(-299), candle];
}

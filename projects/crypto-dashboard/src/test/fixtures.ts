import { COINS } from '../data/binance';

export function tickerPayload(symbol = 'BTCUSDT', time = 1_794_041_344_010) {
  return { symbol, lastPrice: '100.25', priceChangePercent: '2.50', highPrice: '110.00', lowPrice: '90.00', volume: '1200', quoteVolume: '120300', closeTime: time };
}
export function allTickerPayloads(time?: number) {
  return COINS.map((coin) => tickerPayload(coin.symbol, time));
}
export function klinePayload() {
  return [[1_794_031_200_000, '100', '110', '90', '105', '25'], [1_794_034_800_000, '105', '115', '95', '108', '35']];
}
export function candleStream(symbol = 'BTCUSDT', interval = '1h', eventAt = 1_794_041_344_010) {
  return { stream: `${symbol.toLowerCase()}@kline_${interval}`, data: { e: 'kline', E: eventAt, s: symbol, k: { s: symbol, i: interval, t: 1_794_034_800_000, o: '105', h: '115', l: '95', c: '109', v: '37' } } };
}

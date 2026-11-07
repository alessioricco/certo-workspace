import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCandles, fetchTickers, MarketDataError, mergeCandle, type Candle, type Interval, type Symbol, type Tickers } from '../data/binance';
import { connectMarketStream, type StreamState } from '../data/stream';
import { isFresh } from '../lib/format';

export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}
const retry = (count: number, error: Error) => count < 1 && error instanceof MarketDataError && error.retryable;
const canPoll = (error: Error | null) => !(error instanceof MarketDataError) || error.retryable;
export function useMarkets(symbol: Symbol, interval: Interval, now: number) {
  const client = useQueryClient();
  const online = useOnline();
  const [stream, setStream] = useState<{ state: StreamState; key: string; tickerAt?: number; candleAt?: number }>({ state: 'connecting', key: '' });
  const key = `${symbol}:${interval}`;
  const tickers = useQuery({ queryKey: ['tickers'], queryFn: ({ signal }) => fetchTickers(signal), retry,
    staleTime: 15_000, refetchInterval: (query) => canPoll(query.state.error) ? 30_000 : false,
    refetchOnWindowFocus: (query) => canPoll(query.state.error), refetchOnReconnect: (query) => canPoll(query.state.error) });
  const candles = useQuery({ queryKey: ['candles', symbol, interval], queryFn: ({ signal }) => fetchCandles(symbol, interval, signal), retry,
    staleTime: 30_000, refetchInterval: (query) => canPoll(query.state.error) ? 60_000 : false,
    refetchOnWindowFocus: (query) => canPoll(query.state.error), refetchOnReconnect: (query) => canPoll(query.state.error) });
  useEffect(() => {
    let hasConnected = false;
    return connectMarketStream(symbol, interval, (update) => {
      if (update.kind === 'ticker') {
        client.setQueryData<Tickers>(['tickers'], (old) => old ? {
          ...old, [update.ticker.symbol]: !old[update.ticker.symbol] || update.ticker.updatedAt >= old[update.ticker.symbol]!.updatedAt ? update.ticker : old[update.ticker.symbol],
        } : old);
        if (update.ticker.symbol === symbol) setStream((old) => ({ ...old, key, tickerAt: update.ticker.updatedAt }));
      } else {
        client.setQueryData<Candle[]>(['candles', symbol, interval], (old) => old?.length ? mergeCandle(old, update.candle) : old);
        setStream((old) => ({ ...old, key, candleAt: update.eventAt }));
      }
    }, (state) => {
      if (state === 'connected') {
        if (hasConnected && canPoll(client.getQueryState(['candles', symbol, interval])?.error ?? null)) {
          void client.invalidateQueries({ queryKey: ['candles', symbol, interval] });
        }
        hasConnected = true;
      }
      setStream((old) => state === 'connected' && old.key === key ? { ...old, state } : { state, key });
    });
  }, [client, symbol, interval, key]);
  const ticker = tickers.data?.[symbol];
  const live = online && !!candles.data?.length && !!ticker && !tickers.isError && !candles.isError && stream.key === key && stream.state === 'connected'
    && isFresh(stream.tickerAt, now, 15_000) && isFresh(stream.candleAt, now, 15_000);
  const refresh = () => { void tickers.refetch(); void candles.refetch(); };
  return { tickers, candles, ticker, live, online, streamState: stream.key === key ? stream.state : 'connecting' as StreamState, refresh,
    refreshing: tickers.isFetching || candles.isFetching };
}

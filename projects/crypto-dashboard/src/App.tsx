import { useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, ArrowUpRight as ExternalIcon, BarChart3, CandlestickChart, ChevronRight, CircleHelp, Clock3, Database, Globe2, Maximize2, RefreshCw, ShieldCheck, Star, Table2, TrendingUp, WifiOff } from 'lucide-react';
import { COINS, INTERVALS, isSymbol, type Interval, type Symbol } from './data/binance';
import { useClock, useMarkets } from './hooks/useMarkets';
import { formatCompact, formatPrice, formatTime, isFresh } from './lib/format';
import { Change, CoinIcon, ConnectionStatus, DataState } from './components/Primitives';
import { Watchlist } from './components/Watchlist';
import { PriceChart } from './components/PriceChart';

function initialFavorites(): Symbol[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('aperture-watchlist') ?? '[]');
    return Array.isArray(saved) ? [...new Set(saved.filter(isSymbol))] : [];
  } catch { return []; }
}

export default function App() {
  const [symbol, setSymbol] = useState<Symbol>('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('1h');
  const [favorites, setFavorites] = useState<Symbol[]>(initialFavorites);
  const [reset, setReset] = useState(0);
  const [showData, setShowData] = useState(false);
  const now = useClock();
  const markets = useMarkets(symbol, interval, now);
  const { tickers, ticker, candles, online, live } = markets;
  const coin = COINS.find((item) => item.symbol === symbol)!;
  const snapshotFresh = isFresh(ticker?.updatedAt, now);
  const status = !online ? 'offline' : tickers.isError ? 'error' : !ticker ? 'connecting' : !snapshotFresh ? 'stale' : live ? 'live' : 'snapshot';
  const values = Object.values(tickers.data ?? {});
  const advancing = values.filter((item) => item.change > 0).length;
  const declining = values.filter((item) => item.change < 0).length;
  const volume = values.length ? values.reduce((sum, item) => sum + item.quoteVolume, 0) : undefined;
  const leader = values.length ? values.reduce((best, item) => item.change > best.change ? item : best) : undefined;
  const leaderCoin = COINS.find((item) => item.symbol === leader?.symbol);
  const cached = !online || !snapshotFresh || tickers.isError;
  const lowToHigh = ticker && ticker.high > ticker.low ? ((ticker.price - ticker.low) / (ticker.high - ticker.low)) * 100 : undefined;
  useEffect(() => { try { localStorage.setItem('aperture-watchlist', JSON.stringify(favorites)); } catch { /* Watchlists still work when storage is unavailable. */ } }, [favorites]);
  function toggleFavorite(value: Symbol) {
    setFavorites((old) => old.includes(value) ? old.filter((item) => item !== value) : [...old, value]);
  }
  return <>
    <a href="#market-workspace" className="skip-link">Skip to market dashboard</a>
    <header className="app-header">
      <a href="#" className="brand" aria-label="Aperture home"><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25 16 6l9 19M11 19h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>aperture<span className="brand-dot">.</span></a>
      <nav className="header-nav" aria-label="Main navigation"><a className="active" href="#market-workspace"><BarChart3 size={15} /> Markets</a><a href="#about-data"><Database size={14} /> Data & sources</a></nav>
      <div className="header-right"><span className="header-clock"><Clock3 size={13} />{formatTime(now)} <small>UTC</small></span><ConnectionStatus state={status} /></div>
    </header>
    <main className="main-shell">
      <section className="page-heading"><div><div className="breadcrumb">WORKSPACE <ChevronRight size={11} /> CRYPTOCURRENCY</div><h1>The market, in focus<span>.</span></h1><p>A clear view of crypto. Real-time data, without the noise.</p></div><div className="heading-actions"><span className="spot-label"><span className="tiny-dot" />SPOT MARKETS</span><button className="button button-secondary refresh-button" onClick={markets.refresh} disabled={!online || markets.refreshing} aria-label="Refresh market data"><RefreshCw size={14} className={markets.refreshing ? 'loading-spin' : ''} />Refresh</button></div></section>
      <section className="overview-grid" aria-label="Tracked market overview">
        <div className="overview-card"><div className="overview-icon"><BarChart3 size={19} /></div><div className="overview-content"><span className="stat-label">Tracked 24h volume</span><div className="overview-value">{formatCompact(volume)} <small>USDT</small></div><span className="stat-note">Across {COINS.length} selected spot pairs</span></div><span className="card-corner">24H</span></div>
        <div className="overview-card breadth-card"><div className="overview-icon"><Activity size={19} /></div><div className="overview-content"><span className="stat-label">Market breadth</span><div className="breadth-value"><span className="text-positive"><ArrowUpRight size={16} />{values.length ? advancing : '—'} <small>up</small></span><span className="breadth-divider" /><span className="text-negative"><ArrowDownRight size={16} />{values.length ? declining : '—'} <small>down</small></span></div><div className="breadth-track" aria-label={values.length ? `${advancing} advancing, ${declining} declining out of ${values.length} assets` : 'Market breadth unavailable'}>{values.length > 0 && <><span style={{ width: `${advancing / values.length * 100}%` }} /><span style={{ width: `${declining / values.length * 100}%` }} /></>}</div></div><span className="card-corner">{COINS.length} ASSETS</span></div>
        <div className="overview-card"><div className="overview-icon"><TrendingUp size={19} /></div><div className="overview-content"><span className="stat-label">24h leader</span><div className="leader-value">{leaderCoin?.ticker ?? '—'}<Change value={leader?.change} badge /></div><span className="stat-note">{leaderCoin?.name ?? 'Waiting for market data'}{leaderCoin && ' · strongest tracked change'}</span></div><span className="card-corner">SPOT</span></div>
      </section>
      {(!online || (ticker && !live && !tickers.isError)) && <div className="connection-notice" role="status">{!online ? <WifiOff size={14} /> : <Clock3 size={14} />}<span>{!online ? 'You’re offline. Displayed values are cached, not live.' : !snapshotFresh ? 'Market data is delayed. Displayed prices are cached, not live.' : 'Showing a REST snapshot. Live stream is connecting or unavailable; prices refresh every 30 seconds.'}</span>{online && <span className="notice-time">As of {formatTime(ticker?.updatedAt)} UTC</span>}</div>}
      <div className="market-workspace" id="market-workspace">
        <Watchlist tickers={tickers.data} selected={symbol} onSelect={setSymbol} favorites={favorites} onFavorite={toggleFavorite} pending={tickers.isPending} error={tickers.error?.message} offline={!online} now={now} onRetry={() => void tickers.refetch()} />
        <section className="panel chart-panel" aria-label={`${coin.name} market details`}>
          <div className="coin-summary"><div className="selected-identity"><CoinIcon coin={coin} /><div><div className="pair-name"><h2>{coin.ticker}<span>/ USDT</span></h2><span className="outline-tag">SPOT</span></div><div className="coin-name">{coin.name}<span>·</span>Binance</div></div><button className={`icon-button summary-star ${favorites.includes(symbol) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(symbol)} aria-label={`${favorites.includes(symbol) ? 'Unstar' : 'Star'} selected market`} aria-pressed={favorites.includes(symbol)}><Star size={17} fill={favorites.includes(symbol) ? 'currentColor' : 'none'} /></button></div><div className="selected-price"><div>{tickers.isPending && !ticker && online ? <span className="skeleton skeleton-summary" /> : formatPrice(ticker?.price)}<small>USDT</small></div><span className="summary-change"><Change value={ticker?.change} badge /><span>{cached && ticker ? 'Cached · ' : ''}24h change</span></span></div></div>
          <dl className="coin-metrics"><div><dt>24h high <ArrowUpRight size={11} /></dt><dd>{formatPrice(ticker?.high)}<small>USDT</small></dd></div><div><dt>24h low <ArrowDownRight size={11} /></dt><dd>{formatPrice(ticker?.low)}<small>USDT</small></dd></div><div><dt>24h volume <span>{coin.ticker}</span></dt><dd>{formatCompact(ticker?.volume)}<small>{coin.ticker}</small></dd></div><div><dt>24h turnover</dt><dd>{formatCompact(ticker?.quoteVolume)}<small>USDT</small></dd></div></dl>
          <div className="chart-toolbar"><div className="chart-type"><CandlestickChart size={15} /><span>Price chart</span></div><div className="interval-group" aria-label="Chart interval">{INTERVALS.map((value) => <button key={value} aria-pressed={interval === value} className={interval === value ? 'active' : ''} onClick={() => setInterval(value)}>{value.toUpperCase()}</button>)}</div><span className="toolbar-divider" /><button className="icon-button fit-button" onClick={() => setReset((old) => old + 1)} disabled={!candles.data?.length} title="Fit all candles to view" aria-label="Fit chart to all data"><Maximize2 size={15} /></button></div>
          <div className="chart-area">
            {!online && !candles.data?.length ? <DataState kind="offline" title="You’re offline" message="Reconnect to load historical candles. No sample prices are shown." /> : candles.isPending ? <DataState kind="loading" title="Bringing the market into focus" message={`Loading ${coin.name} candles from Binance…`} /> : candles.isError && !candles.data?.length ? <DataState kind="error" title="Chart data unavailable" message={candles.error.message} onRetry={() => void candles.refetch()} /> : !candles.data?.length ? <DataState kind="empty" title="No candles available" message="Binance returned no candles for this market and interval. Try another interval." /> : <>
              {candles.isError && <div className="chart-error-note" role="alert">Chart refresh failed. Cached candles shown. {candles.error.message}</div>}
              <PriceChart key={`${symbol}:${interval}`} candles={candles.data} reset={reset} label={`${coin.ticker}/USDT · ${interval.toUpperCase()}`} />
            </>}
          </div>
          <div className="chart-footer"><span><span className={`status-dot ${live ? 'is-live' : ''}`} />{live ? 'Live' : candles.data?.length ? 'Snapshot' : 'Awaiting data'}<span className="footer-separator">·</span>UTC</span><span className="chart-hint">Scroll to zoom <span>·</span> Drag to explore</span><button onClick={() => setShowData(!showData)} aria-expanded={showData} aria-controls="candle-data"><Table2 size={12} />{showData ? 'Hide data' : 'View data'}</button></div>
          {showData && <div className="candle-table-wrap" id="candle-data"><table><caption>Latest 8 {coin.ticker}/USDT candles · prices in USDT · volume in {coin.ticker}</caption><thead><tr><th>Open time (UTC)</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>{candles.data?.slice(-8).reverse().map((candle) => <tr key={candle.time}><td>{new Date(candle.time * 1000).toISOString().replace('T', ' ').slice(0, 16)}</td><td>{formatPrice(candle.open)}</td><td>{formatPrice(candle.high)}</td><td>{formatPrice(candle.low)}</td><td className={candle.close >= candle.open ? 'text-positive' : 'text-negative'}>{formatPrice(candle.close)}</td><td>{formatCompact(candle.volume)}</td></tr>)}</tbody></table>{!candles.data?.length && <p className="table-empty">No candle data available.</p>}</div>}
        </section>
      </div>
      <section className="bottom-grid" aria-label="Market context">
        <div className="panel range-panel"><div><span className="eyebrow">PRICE CONTEXT</span><h2>24-hour range <span>{coin.ticker}/USDT</span></h2></div><div className="range-track">{lowToHigh !== undefined && <span style={{ left: `${Math.max(0, Math.min(100, lowToHigh))}%` }} />}</div><div className="range-labels"><span>{formatPrice(ticker?.low)} <small>LOW</small></span><span className="range-current">{formatPrice(ticker?.price)} <small>CURRENT</small></span><span>{formatPrice(ticker?.high)} <small>HIGH</small></span></div></div>
        <div className="panel info-panel" id="about-data"><span className="info-icon"><ShieldCheck size={22} /></span><div><h2>Just the data. Nothing between.</h2><p>Public Binance Spot market data. No accounts, no wallets, no trades. Built for a clearer perspective—not financial advice.</p><a href="https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md" target="_blank" rel="noreferrer">About the data source <ExternalIcon size={12} /></a></div></div>
      </section>
      <footer className="app-footer"><div><Globe2 size={12} /><span>Source: <a href="https://www.binance.com/en/markets" target="_blank" rel="noreferrer">Binance Spot</a></span><span className="footer-separator">/</span><span>Last updated: <time dateTime={ticker ? new Date(ticker.updatedAt).toISOString() : undefined}>{formatTime(ticker?.updatedAt)} UTC</time>{cached && ticker ? ' · cached' : ''}</span></div><div><span className="chart-credit">Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a></span><a className="help-link" href="#about-data" aria-label="About market data"><CircleHelp size={13} /></a></div></footer>
    </main>
  </>;
}

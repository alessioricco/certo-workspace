import { useState } from 'react';
import { Search, Star, X, ArrowUpDown } from 'lucide-react';
import { COINS, type Symbol, type Tickers } from '../data/binance';
import { formatCompact, formatPrice, isFresh } from '../lib/format';
import { Change, CoinIcon, DataState } from './Primitives';

export function Watchlist({ tickers, selected, onSelect, favorites, onFavorite, pending, error, offline, now, onRetry }: {
  tickers?: Tickers; selected: Symbol; onSelect: (symbol: Symbol) => void;
  favorites: Symbol[]; onFavorite: (symbol: Symbol) => void; pending: boolean; error?: string;
  offline: boolean; now: number; onRetry: () => void;
}) {
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState(false);
  const coins = COINS.filter((coin) => (!onlyFavorites || favorites.includes(coin.symbol)) && `${coin.name} ${coin.ticker} ${coin.symbol}`.toLowerCase().includes(search.toLowerCase().trim()));
  if (sort) coins.sort((a, b) => (tickers?.[b.symbol]?.change ?? -Infinity) - (tickers?.[a.symbol]?.change ?? -Infinity));
  return <aside className="panel watchlist" aria-labelledby="markets-heading">
    <div className="panel-heading"><div><span className="eyebrow">EXPLORE</span><h2 id="markets-heading">Markets <span className="count-badge">{COINS.length}</span></h2></div><span className="outline-tag">USDT</span></div>
    <div className="market-tabs" aria-label="Market list filter">
      <button className={!onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(false)} aria-pressed={!onlyFavorites}>All assets</button>
      <button className={onlyFavorites ? 'active' : ''} onClick={() => setOnlyFavorites(true)} aria-pressed={onlyFavorites}><Star size={13} /> Watchlist <span>{favorites.length}</span></button>
    </div>
    <div className="search-wrap"><Search size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets…" aria-label="Search cryptocurrencies" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div>
    <div className="market-columns"><span>Asset</span><span>Price / Vol. <small>USDT</small></span><button onClick={() => setSort(!sort)} aria-pressed={sort} aria-label="Sort markets by 24-hour change">24h <ArrowUpDown size={11} /></button></div>
    {error && <div className="list-notice" role="alert">{error}{tickers ? ' Showing cached values.' : ''}<button onClick={onRetry}>Retry</button></div>}
    {!coins.length ? <DataState kind="empty" title={search ? 'No assets found' : 'Your list, your focus'} message={search ? `No markets match “${search}”. Try a name or symbol.` : 'Star an asset to keep it in your watchlist.'} /> :
      <div className="market-rows">{coins.map((coin) => {
        const data = tickers?.[coin.symbol];
        const stale = !!data && (offline || !!error || !isFresh(data.updatedAt, now));
        return <div key={coin.symbol} className={`market-row ${selected === coin.symbol ? 'selected' : ''}`}>
          <button className={`favorite-button ${favorites.includes(coin.symbol) ? 'is-favorite' : ''}`} onClick={() => onFavorite(coin.symbol)} aria-label={`${favorites.includes(coin.symbol) ? 'Remove' : 'Add'} ${coin.name} ${favorites.includes(coin.symbol) ? 'from' : 'to'} watchlist`} aria-pressed={favorites.includes(coin.symbol)}><Star size={12} fill={favorites.includes(coin.symbol) ? 'currentColor' : 'none'} /></button>
          <button className="market-select" onClick={() => onSelect(coin.symbol)} aria-pressed={selected === coin.symbol} aria-label={`Select ${coin.name}`}>
            <div className="market-identity"><CoinIcon coin={coin} small /><div><strong>{coin.ticker}</strong><small>{coin.name}{stale ? ' · cached' : ''}</small></div></div>
            <div className={`market-price ${stale ? 'cached' : ''}`}><strong>{pending && !data && !error && !offline ? <span className="skeleton skeleton-price" /> : formatPrice(data?.price)}</strong><small>{formatCompact(data?.quoteVolume)}</small></div>
            <Change value={data?.change} />
          </button>
        </div>;
      })}</div>}
    {offline && <div className="list-notice" role="status">Offline. {tickers ? 'Cached prices are not live.' : 'Reconnect to load market prices.'}</div>}
    <div className="watchlist-footer"><span className="tiny-dot" />Binance Spot<span>Rolling 24h</span></div>
  </aside>;
}

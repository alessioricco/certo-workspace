import { AlertCircle, BarChart3, LoaderCircle, WifiOff, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { Coin } from '../data/binance';
import { changeClass, formatChange } from '../lib/format';

export function CoinIcon({ coin, small = false }: { coin: Coin; small?: boolean }) {
  return <span className={`coin-icon ${small ? 'coin-icon-small' : ''}`} style={{ color: coin.color, background: `${coin.color}15`, borderColor: `${coin.color}25` }} aria-hidden="true">{coin.mark}</span>;
}
export function Change({ value, badge = false }: { value?: number; badge?: boolean }) {
  const Icon = (value ?? 0) < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className={`change ${changeClass(value)} ${badge ? 'change-badge' : ''}`}>
    {value !== undefined && value !== 0 && <Icon size={13} aria-hidden="true" />}{formatChange(value)}
  </span>;
}
export function DataState({ kind, title, message, onRetry }: {
  kind: 'loading' | 'error' | 'offline' | 'empty'; title: string; message: string; onRetry?: () => void;
}) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'offline' ? WifiOff : kind === 'error' ? AlertCircle : BarChart3;
  return <div className={`data-state data-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className="state-icon"><Icon size={24} className={kind === 'loading' ? 'loading-spin' : ''} aria-hidden="true" /></span>
    <h3>{title}</h3><p>{message}</p>
    {onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}
  </div>;
}
export function ConnectionStatus({ state }: { state: 'live' | 'snapshot' | 'offline' | 'error' | 'connecting' | 'stale' }) {
  const labels = { live: 'Live market data', snapshot: 'REST snapshot', offline: 'Offline', error: 'Data unavailable', connecting: 'Connecting', stale: 'Delayed data' };
  return <span className={`connection-status connection-${state}`} role="status"><span className="status-dot" />{labels[state]}</span>;
}

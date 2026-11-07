import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { parseTickers, type Symbol } from '../data/binance';
import { allTickerPayloads } from '../test/fixtures';
import { Watchlist } from './Watchlist';
import { ConnectionStatus, DataState } from './Primitives';

const now = 1_794_041_344_010;
function Harness({ pending = false, error, offline = false, loaded = false }: { pending?: boolean; error?: string; offline?: boolean; loaded?: boolean }) {
  const [selected, setSelected] = useState<Symbol>('BTCUSDT');
  const [favorites, setFavorites] = useState<Symbol[]>([]);
  const [retries, setRetries] = useState(0);
  return <><Watchlist tickers={loaded ? parseTickers(allTickerPayloads(now)) : undefined} selected={selected} onSelect={setSelected} favorites={favorites} onFavorite={(symbol) => setFavorites((old) => old.includes(symbol) ? old.filter((item) => item !== symbol) : [...old, symbol])} pending={pending} error={error} offline={offline} now={now} onRetry={() => setRetries(retries + 1)} /><output aria-label="retries">{retries}</output></>;
}

describe('market list interactions and important states', () => {
  it('searches by name or symbol, selects markets, and shows an honest empty state', async () => {
    const user = userEvent.setup();
    render(<Harness loaded />);
    await user.type(screen.getByRole('textbox', { name: 'Search cryptocurrencies' }), 'ethereum');
    expect(screen.getByRole('button', { name: 'Select Ethereum' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Select Bitcoin' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select Ethereum' }));
    expect(screen.getByRole('button', { name: 'Select Ethereum' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.type(screen.getByRole('textbox'), 'not-a-coin');
    expect(screen.getByText('No assets found')).toBeVisible();
  });
  it('maintains a functional watchlist with keyboard-accessible native buttons', async () => {
    const user = userEvent.setup();
    render(<Harness loaded />);
    await user.click(screen.getByRole('button', { name: /Watchlist 0/ }));
    expect(screen.getByText('Your list, your focus')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'All assets' }));
    const star = screen.getByRole('button', { name: 'Add Bitcoin to watchlist' });
    star.focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: /Watchlist 1/ }));
    expect(screen.getByRole('button', { name: 'Select Bitcoin' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Select Ethereum' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Bitcoin from watchlist' }));
    expect(screen.getByText('Your list, your focus')).toBeVisible();
  });
  it('renders unavailable values as dashes, never made-up prices', () => {
    render(<Harness pending />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('100.25')).not.toBeInTheDocument();
  });
  it('shows the actual service error and a working retry action', async () => {
    const user = userEvent.setup();
    render(<Harness error="Region cannot access Binance" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Region cannot access Binance');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByLabelText('retries')).toHaveTextContent('1');
  });
  it('labels offline prices as cached, not live', () => {
    render(<Harness loaded offline />);
    expect(screen.getByText('Cached prices are not live.', { exact: false })).toBeVisible();
    expect(screen.getByText('Bitcoin · cached')).toBeInTheDocument();
  });
});

describe('chart and connection state components', () => {
  it.each(['loading', 'offline', 'empty', 'error'] as const)('renders a readable %s state', (kind) => {
    render(<DataState kind={kind} title={`Chart ${kind}`} message="No data has been substituted." />);
    expect(screen.getByRole(kind === 'error' ? 'alert' : 'status')).toHaveTextContent(`Chart ${kind}`);
    expect(screen.getByText('No data has been substituted.')).toBeVisible();
  });
  it.each([['live', 'Live market data'], ['snapshot', 'REST snapshot'], ['offline', 'Offline'], ['stale', 'Delayed data'], ['error', 'Data unavailable']] as const)('labels %s accurately', (state, label) => {
    render(<ConnectionStatus state={state} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
  });
});

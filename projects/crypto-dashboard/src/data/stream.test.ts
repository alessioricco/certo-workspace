import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMarketStream, type StreamState } from './stream';
import { candleStream } from '../test/fixtures';
import type { StreamUpdate } from './binance';

// Only the browser transport is replaced to deterministically exercise real reconnect/cleanup logic.
class TestSocket {
  static instances: TestSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { TestSocket.instances.push(this); }
  close() { this.closed = true; }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  TestSocket.instances = [];
  vi.stubGlobal('WebSocket', TestSocket);
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('websocket lifecycle', () => {
  it('subscribes once to curated tickers and the selected candle interval', () => {
    const updates: StreamUpdate[] = [];
    const states: StreamState[] = [];
    cleanup = connectMarketStream('BTCUSDT', '4h', (value) => updates.push(value), (value) => states.push(value));
    const socket = TestSocket.instances[0];
    expect(socket.url).toContain('btcusdt@kline_4h');
    expect(socket.url).toContain('adausdt@ticker');
    expect(states).toEqual(['connecting']);
    socket.onopen?.();
    expect(states).not.toContain('connected');
    socket.message(candleStream('BTCUSDT', '4h'));
    expect(updates).toHaveLength(1);
    expect(states.at(-1)).toBe('connected');
  });
  it('backs off without creating duplicate connections on repeated failures', () => {
    cleanup = connectMarketStream('BTCUSDT', '1h', () => {}, () => {});
    const first = TestSocket.instances[0];
    const fail = first.onerror!;
    fail(); fail();
    expect(first.closed).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(TestSocket.instances).toHaveLength(2);
    expect(TestSocket.instances.filter((socket) => !socket.closed)).toHaveLength(1);
    TestSocket.instances[1].onclose?.();
    vi.advanceTimersByTime(1800);
    expect(TestSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(800);
    expect(TestSocket.instances).toHaveLength(3);
  });
  it('closes and clears timers on unmount or symbol change', () => {
    const updates: StreamUpdate[] = [];
    cleanup = connectMarketStream('BTCUSDT', '1h', (value) => updates.push(value), () => {});
    const first = TestSocket.instances[0];
    first.onerror?.();
    cleanup();
    vi.advanceTimersByTime(120_000);
    expect(TestSocket.instances).toHaveLength(1);
    expect(first.onmessage).toBeNull();
    expect(first.closed).toBe(true);
    window.dispatchEvent(new Event('online'));
    expect(TestSocket.instances).toHaveLength(1);
  });
  it('closes on offline and opens only one socket when online again', () => {
    const states: StreamState[] = [];
    cleanup = connectMarketStream('SOLUSDT', '1d', () => {}, (value) => states.push(value));
    window.dispatchEvent(new Event('offline'));
    expect(states.at(-1)).toBe('offline');
    expect(TestSocket.instances[0].closed).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(TestSocket.instances).toHaveLength(1);
    window.dispatchEvent(new Event('online'));
    expect(TestSocket.instances).toHaveLength(2);
    expect(TestSocket.instances[1].url).toContain('solusdt@kline_1d');
  });
  it('reconnects on silent connections and rejects malformed messages', () => {
    const updates: StreamUpdate[] = [];
    const states: StreamState[] = [];
    cleanup = connectMarketStream('BTCUSDT', '1h', (value) => updates.push(value), (value) => states.push(value));
    TestSocket.instances[0].message({ data: {} });
    expect(states.at(-1)).toBe('invalid');
    expect(updates).toHaveLength(0);
    vi.advanceTimersByTime(1600);
    const silent = TestSocket.instances[1];
    vi.advanceTimersByTime(25_000);
    expect(silent.closed).toBe(true);
  });
});

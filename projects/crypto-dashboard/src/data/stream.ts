import { COINS, STREAM_URL, parseStream, type Interval, type Symbol, type StreamUpdate } from './binance';

export type StreamState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'invalid';
export function connectMarketStream(symbol: Symbol, interval: Interval, onUpdate: (update: StreamUpdate) => void, onState: (state: StreamState) => void): () => void {
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let failures = 0;
  let lastReceived = 0;
  const streams = [...COINS.map((coin) => `${coin.symbol.toLowerCase()}@ticker`), `${symbol.toLowerCase()}@kline_${interval}`];

  function disconnect() {
    if (watchdog) clearInterval(watchdog);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      socket = undefined;
    }
  }
  function scheduleReconnect() {
    disconnect();
    if (stopped || retryTimer) return;
    if (!navigator.onLine) { onState('offline'); return; }
    onState('reconnecting');
    const delay = Math.min(1000 * 2 ** Math.min(failures++, 5), 30_000) + Math.random() * 500;
    retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, delay);
  }
  function connect() {
    if (stopped) return;
    if (!navigator.onLine) { onState('offline'); return; }
    onState(failures ? 'reconnecting' : 'connecting');
    lastReceived = Date.now();
    let receivedValidData = false;
    try { socket = new WebSocket(`${STREAM_URL}?streams=${streams.join('/')}`); }
    catch { scheduleReconnect(); return; }
    socket.onopen = () => { lastReceived = Date.now(); };
    socket.onmessage = (event) => {
      if (stopped) return;
      try {
        const update = parseStream(JSON.parse(String(event.data)), symbol, interval);
        lastReceived = Date.now();
        failures = 0;
        onUpdate(update);
        if (!receivedValidData) {
          receivedValidData = true;
          onState('connected');
        }
      } catch {
        scheduleReconnect();
        onState('invalid');
      }
    };
    socket.onerror = scheduleReconnect;
    socket.onclose = scheduleReconnect;
    watchdog = setInterval(() => {
      if (Date.now() - lastReceived > 20_000) scheduleReconnect();
    }, 5000);
  }
  function offline() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    disconnect();
    onState('offline');
  }
  function online() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
    disconnect();
    connect();
  }
  window.addEventListener('offline', offline);
  window.addEventListener('online', online);
  connect();
  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    disconnect();
    window.removeEventListener('offline', offline);
    window.removeEventListener('online', online);
  };
}

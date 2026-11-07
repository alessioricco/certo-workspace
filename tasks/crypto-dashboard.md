Build a polished cryptocurrency market dashboard as a web app in this workspace.

The interface should feel like a modern professional trading dashboard, inspired by products such as TradingView, but use original branding, layout, and styling. Do not copy TradingView’s name, logo, assets, or exact design. This is a market-data viewer, not a trading app: do not add order placement, wallet connections, or financial advice.

## Stack
- Use Node.js with React, Vite, and TypeScript.
- Use Tailwind CSS for styling and shadcn/ui components where useful.
- Use TradingView Lightweight Charts for interactive price charts, including candlesticks and volume.
- Use TanStack Query for request caching, loading/error states, and refresh behavior.
- Use the browser’s native `fetch` and `WebSocket` APIs for market data; avoid adding a data-fetching library that duplicates TanStack Query.
- Before installing packages, inspect the existing project and verify the chosen libraries’ current APIs and compatibility. Keep dependencies focused.

## Market data
Use Binance’s public Spot market-data endpoints; the app must not require an API key:
- REST ticker data for current price and 24-hour statistics.
- REST klines data for historical chart candles.
- Binance’s public WebSocket streams for live ticker and candle updates, if available for the selected symbol and interval.

Support a curated set of common USDT pairs, such as BTC, ETH, SOL, BNB, XRP, and ADA. Clearly label prices as USDT. Show a useful error if the data service is unavailable, a pair is unsupported, or the user’s region cannot access the API. Do not substitute fabricated or hard-coded prices and do not present stale data as live.

## Dashboard
Create a responsive dashboard with:
- A header with original app branding and a market-data connection/status indicator.
- A searchable cryptocurrency list with symbol, name, current price, 24-hour percentage change, and 24-hour volume.
- A selected-coin summary with price, 24-hour change, high, low, and volume.
- An interactive candlestick chart with volume and selectable intervals (for example: 1h, 4h, 1d, 1w).
- Clear loading, empty, offline, and error states.
- Sensible number formatting, positive/negative color indicators, keyboard-accessible controls, and a layout that works on mobile and desktop.
- A visible data source and “last updated” time.

Use a consistent dark theme with readable contrast, restrained accent colors, and a clean information hierarchy. Avoid unnecessary animation and decorative elements that make prices or chart labels harder to read.

## Reliability and security
- Keep API calls in a small, clearly named data-access module.
- Validate and handle API responses rather than assuming they are well-formed.
- Clean up WebSocket connections when the selected coin or component changes; handle disconnects and reconnect safely without creating duplicate connections.
- Never add secrets or require users to provide an API key.
- Do not hide failures behind mock data or success-looking defaults.

## Verification
- Add or update tests for data parsing/formatting and important UI states using the project’s existing test setup. If there is no test setup, choose a lightweight one compatible with the stack.
- Ensure the project has working development and production-build scripts.
- Run the tests and production build, fix any failures, and report exactly what passed and any remaining limitations.
- Update the project README with setup/run instructions, the data source, and any API access or rate-limit limitations.
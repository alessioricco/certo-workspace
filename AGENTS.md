# Workspace conventions

- This is a shared Certo workspace, not a single application. Independent projects live under `projects/`; preserve the other projects and never modify `.certo/` run state.
- Asteroids lives in `projects/asteroids`, implementing `tasks/space-rocks.md` (the workspace has no `tasks/asteroids.md`). It uses dependency-free classic browser scripts: open `index.html` directly, and run `npm test` from that project with Node 18+. `game.js` is DOM-free, exports via CommonJS, and advances fixed 1/120-second simulation steps; `main.js` owns browser input and rendering.
- The cryptocurrency dashboard is `projects/crypto-dashboard` (Aperture Markets): React/TypeScript, Vite, Tailwind v4, TanStack Query v5, and Lightweight Charts v5 (`addSeries(CandlestickSeries)`, not the pre-v5 API).
- Dashboard commands run from that project directory: `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run test:e2e`. Chromium installation: `npx playwright install chromium`. Workspace verification must target that project explicitly because multiple Node projects exist.
- Dashboard market access belongs in `src/data/`. Only Binance public market-only REST/WS endpoints are used. Never insert fixture prices into production, hide errors, label old data live, or add trading/wallet/key functionality.
- Boundary fixtures live only in tests. Playwright runs the production preview; the chart's internal DOM includes an extra table, so target the accessible candle-data table by its caption/name or `#candle-data`.

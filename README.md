# Certo workspace

Made by `certo init`. Run every command below from this folder.

## Aperture cryptocurrency dashboard

The market-data web app lives in `projects/crypto-dashboard`. Requires Node.js **22.22+** and npm; no API key is needed.

```bash
cd projects/crypto-dashboard
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. For a production build and local preview, run from that project directory:

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **http://127.0.0.1:4173**. Run verification with:

```bash
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Aperture uses public Binance Spot REST and WebSocket data; regional restrictions, network failures, and rate limits are reported without fabricated price fallbacks. It is a data viewer, not a trading app. See the [project README](projects/crypto-dashboard/README.md) for data semantics, architecture, controls, and service limitations. Existing projects below are unchanged.

## 1. Check your settings

```bash
certo check
```

Your model settings are in the user settings file, `/Users/alessioricco/.config/certo/.env`. `certo check` shows where each
setting comes from, then makes one small call to your model and confirms it
can call tools, which Certo's agent needs. If it reports a problem, fix the
settings as it says and run it again. To switch provider later, comment out
the two active lines in that file and uncomment the two for the provider
you want.

## 2. Run a task

```bash
certo tasks/wordle.md --project wordle
```

A task is a plain text file saying what to build. Open `tasks/wordle.md`
to see one, then write your own the same way. The other samples:

- `tasks/hanoi.md`: the Tower of Hanoi in the terminal, in Python;
- `tasks/space-rocks.md`: a ship shooting space rocks, in the browser;
- `tasks/mazeman.md`: a maze chase with ghosts, in the browser;
- `tasks/invaders.md`: a cannon against a marching alien fleet, in the
  browser.

The browser games need Node 18 or newer, for their tests.

## 3. Find the result

Each project lands in its own folder under `projects/`, here
`projects/wordle/`. The last lines Certo prints are the verdict:

```
Verification: verified
```

`verified` means Certo re-ran the project's own tests itself, after the
agent said it was done, and they passed. Then play:

```bash
cd projects/wordle
python3 wordle.py
```

## Good to know

- **The model matters.** The same task can come out quite differently on
  different models: a smaller or local model may build a plainer game, or
  one whose tests fail. The verdict says whether the tests passed, not how
  polished the game is.
- **Cost.** A run with a cloud model (OpenAI, Anthropic, Gemini) uses your
  model credits. Certo prints the tokens used and the cost at the end of
  every run, under "Run summary".
- **Checking an existing repo.** `certo verify path/to/repo` runs Certo's
  verification (the project's own tests and build) with no agent and no
  model, so it costs nothing.
- **Ollama.** On a machine with less than 24 GB of GPU memory, Ollama's
  default context window is 4096 tokens. That's too short for an agent: the
  model loses the start of the task and wanders. Start the server with a
  larger one, for example `OLLAMA_CONTEXT_LENGTH=32768 ollama serve`, or
  move the context slider in the Ollama app's settings. `ollama ps` shows
  the context a loaded model got.

The full documentation: https://github.com/alessioricco/certo/blob/main/docs/README.md

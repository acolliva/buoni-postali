# Buoni postali

A local calculator and portfolio dashboard for Italian Buoni Fruttiferi Postali.

- **Portafoglio**: import your `.xlsx`, see each buono's net value today and at maturity, what has matured and stopped earning, what is close to prescription, and what yields less than a benchmark rate.
- **Calcolatore**: value of a single buono at any date, with its growth curve.
- **Rimborsati**: select buoni (or a whole group from the to-do list), mark them as redeemed on a date, and they drop out of the totals. Marks survive re-importing the spreadsheet.

Data stays at home. With the small home server running (for example on a Raspberry Pi, see [docs/deploy.md](docs/deploy.md)) it lives in `data/state.json` and is shared by every device on your network. Without it, the app falls back to the browser's own storage.

## Run

```sh
npm install
npm run dev      # http://localhost:5173 (uses the home server on :8080 if running)
npm test         # unit tests
npm run build    # static build in dist/
npm run serve    # home server: serves dist/ and stores data in data/ (port 8080)
```

## Spreadsheet format

One or more blocks, each starting with a header row containing at least `serie`, `sottoscritto` (or a similar spelling) and `valore`; `numero` is optional. Extra columns are ignored. A row containing only `Lire` marks the following blocks as lire; values of 50,000 or more are treated as lire anyway. Total rows such as `=SUM(...)` are skipped.

## How values are calculated

Each series is described in `src/domain/seriesData.ts`: duration, rate schedule (or official redemption table), capitalization, tax and prescription period. `src/domain/engine.ts` turns that into values:

- interest accrues on completed periods only, and stops at maturity;
- lire values are converted at 1,936.27 lire per euro;
- net value deducts the withholding tax on interest; stamp duty (imposta di bollo) is not included.

Series data and its sources are documented in `docs/series.md`. Values are estimates; check them against Poste Italiane before redeeming.

## Personal data

This repository is public. `*.xlsx`, `private/` and `data/` are git-ignored so your real portfolio never ends up in it.

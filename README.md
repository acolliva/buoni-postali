# Buoni postali

A local calculator and portfolio dashboard for Italian Buoni Fruttiferi Postali.

- **Portafoglio**: import your `.xlsx`, see each buono's net value today and at maturity, what has matured and stopped earning, what is close to prescription, and what yields less than a benchmark rate.
- **Calcolatore**: value of a single buono at any date, with its growth curve.

Everything runs in the browser. Imported data is kept only in the browser's local storage and never leaves your computer.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # static build in dist/
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

`*.xlsx` and `private/` are git-ignored so your real portfolio never ends up in the repository.

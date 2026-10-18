# Series rules and sources

Full per-series data with source URLs: [`series-sources.json`](series-sources.json). The app's data lives in `src/domain/seriesData.ts`, generated from it.

## Coverage

Every ordinary series from Q (July 1986) to the one on sale today has its rules in the app (160 series), so the calculator can find the series from the subscription date alone. The only uncovered dates are 24–30 June 1997, between the end of S and the start of T, which the sources don't settle.

- Q–X (1986–2000) and Y, Z (2000): 30-year series.
- A1–A9 (2000–2004) and B1–B99 (2004–2013): 20-year series, one per month for the B series.
- C01–C19 (2013–2016): 20-year series with irregular issue windows.
- TF120A + date (from 18/02/2016): the same ordinary product with new codes; TF120A250624 is on sale since 24/06/2025.

For 20-year series the app's formula reproduces the official 20-year redemption coefficient to 8 decimals wherever Poste publishes it (111 series; checked by `src/domain/seriesData.test.ts`). Series with medium confidence: C13, C16, TF120A160218, TF120A231005 — see `openQuestions` in [`series-sources-2.json`](series-sources-2.json). The data file is generated with `node scripts/generate-series.mjs`.

## How the app applies these rules
- Q, R, S, T and U compound net of tax; U is an assumption (see open questions).
- The Q tax bands for 1986–87 issues are not modelled: the app assumes 12.5% for every series.
- 30-year forms subscribed after their series closed are valued under the series in force on that date (e.g. a Q form from 16/11/1995 is valued as R), and the portfolio shows a note.
- Stamp duty is not deducted.

## 30-year lire series (Q to X): gross rates by holding period
| Series | Issued | Years 1-5 | 6-10 | 11-15 | 16-20 | 21-30 (simple interest) | Compounding | Confidence |
|---|---|---|---|---|---|---|---|---|
| Q | 01/07/86 - 31/10/95 | 8.00 | 9.00 | 10.50 | 12.00 | 12.00 | Net of tax | medium |
| R | 01/11/95 - 30/11/96 | 7.00 | 8.00 | 9.00 | 11.50 | 11.50 | Net of tax | high |
| S | 01/12/96 - 23/06/97 | 5.50 | 6.50 | 7.50 | 9.00 | 0.50 | Net of tax | high |
| T | 01/07/97 - 31/12/97 | 4.75 | 5.75 | 6.75 | 8.25 | 0.50 | Net (ambiguous) | medium |
| U | 01/01/98 - 09/12/98 | 4.25 | 4.75 | 5.50 | 6.50 | 0.50 | Not confirmed | medium |
| V | 10/12/98 - 01/03/99 | 3.50 | 4.15 | 4.75 | 6.00 | 0.50 | Gross of tax | high |
| W | 02/03/99 - 20/12/99 | 3.00 | 3.50 | 4.25 | 5.25 | 0.50 | Gross of tax | high |
| X | 21/12/99 - 04/03/00 | 3.25 | 4.00 | 4.75 | 5.75 | 0.50 | Gross of tax | high |

How these series accrue:
- Years 1-20: interest accrues for each completed bimester and is capitalized once a year.
- Years 21-30: simple interest, up to 31 December of the 30th calendar year after the year of issue.
- No interest is paid if the buono is redeemed within 12 months.

Withholding tax on Q depends on the issue date:
- Exempt if issued up to 20/09/86.
- 6.25% if issued from 21/09/86 to 31/08/87.
- 12.5% if issued after that.

Sources:
- Poste summary table for buoni issued up to 27/12/2000.
- Decrees: DM 13/06/1986 (Q), DM 13/10/1995 (R), DM 27/11/1996 (S), DM 23/06/1997 (T, and article 7 on net compounding), DM 07/12/1998 (V), DM 26/02/1999 (W), DM 16/12/1999 (X, the first with euro denominations).

## 20-year euro series (A8, A9, B1 to B99)
- Each series has a separate rate for each year from 1 to 20. Every requested series was taken from its own Foglio Informativo (Tabella A).
- Interest is calculated per bimester as simple interest, then compounded annually. Day count is 360/360.
- Compounding is gross of tax. The 12.5% tax is applied at redemption on the total interest.
- No interest is paid within 12 months, and none after the 20th anniversary.

Verified formula:
```
coef(m) = Π_{y < ⌊m/12⌋} (1 + r_y) × (1 + r_next × ⌊(m mod 12)/2⌋ / 6)     (0 interest if m < 12)
net     = 1 + (coef − 1) × 0.875
```
This formula reproduces the official Tabella B coefficients to 8 decimal places:
- Every point checked for B5, B98, B13 and A8.
- The 20-year coefficient of all 31 requested A and B series.

## Tax and stamp duty
- The tax rate is 12.5%. For Q, R and S, which are compounded net, the tax is effectively deducted each year. For later series it is deducted once at redemption.
- Stamp duty (imposta di bollo) is 0.20% per year. It applies only when the total value of the holder's buoni is over €5,000, and it is withheld at redemption.
- The yearly rates for 2012-2013 and the rules for paper buoni issued before 2009 come from secondary sources only (medium confidence).

## Maturity and prescription
- A buono stops earning interest from the day after maturity.
- The right to redeem lapses 10 years after maturity. Sources: DM 19/12/2000 article 8, DM 06/10/2004 article 6-ter, the Poste FAQ and notices.
- Once prescribed, neither capital nor interest is repaid.
- Example: a series R buono from 1996 matures 31/12/2026 and prescribes 31/12/2036. Poste lists R (1996), T (1997) and B15-B38 among the buoni now expiring.

## Converting lire
- 1 euro = 1,936.27 lire.
- No official rounding rule specific to buoni was found. Suggestion: keep full precision and round the final euro amount to the cent.

## Overprinted (stamped) buoni
Some old paper forms were stamped with a newer series and its rates:
- P forms issued from 01/07/86 count as Q and are stamped "Q/P".
- Q forms issued from 01/11/95 count as R and are stamped "R/Q".
- R forms issued from 01/12/96 count as S.

For Q/P buoni, where the stamp left out years 21-30, the ABF and the courts apply the amounts printed on the original form for those years (Cassazione SU 13979/2007). For forms printed as Q, the decree rates apply (Cassazione SU 3963/2019; ABF coordination panel decision 6142/2020).

## Poste API
- No API was found. Only the text of the page could be read, and it shows no script, API, JSON or iframe URLs.
- CDP's own calculator page says a new simulator is coming soon.
- Suggestion: use the formula. To check for a hidden endpoint, open the Poste page in a browser and look at the DevTools Network tab.

## Open questions
- Series U: the founding decree was not found, so gross vs net compounding is unknown.
- Series T: for individuals, gross vs net compounding is unclear.
- Years 21-30 of the 30-year series: the base for the simple interest is assumed to be the value at year 20. The decrees do not say this explicitly.
- Rounding: the exact rounding Poste applies is not known.

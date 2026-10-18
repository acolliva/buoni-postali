import { SERIES_RULES } from './seriesData'
import type { Currency } from './types'

export interface RateBracket {
  /** First holding year the rate applies to (1-based, inclusive). */
  fromYear: number
  /** Last holding year the rate applies to (inclusive). */
  toYear: number
  /** Gross annual rate in percent. */
  ratePct: number
}

/**
 * Rules of one series (or a group sharing identical rules).
 *
 * All supported series work the same way: interest accrues per completed
 * bimester (rate / 6) and is capitalized once a year for the first
 * `compoundYears` years; nothing is due within the first 12 months. The
 * 30-year lire series then earn simple interest on the year-20 value until
 * 31 December of the 30th calendar year after issue.
 */
export interface SeriesRule {
  codes: string[]
  label: string
  /** Currency the series was issued in (individual buoni may differ, e.g. X). */
  currency: Currency
  /** Issue window, ISO dates (inclusive). */
  issueFrom: string
  issueTo: string
  durationYears: 20 | 30
  /** "anniversary": n years from subscription; "endOfYear": 31/12 of issue year + n. */
  maturity: 'anniversary' | 'endOfYear'
  /** Years with annual capitalization; later years earn simple interest. */
  compoundYears: number
  rateSchedule: RateBracket[]
  /**
   * "gross": tax applied once at redemption on total interest.
   * "net": tax deducted at each capitalization (Q, R, S and, by inference, T, U).
   */
  taxMode: 'gross' | 'net'
  /** Withholding tax on interest, percent. */
  taxPct: number
  /** Years after maturity before the right to redeem lapses. */
  prescriptionYears: number
  confidence: 'alta' | 'media' | 'bassa'
  notes?: string
  sources: string[]
}

export const LIRE_PER_EURO = 1936.27

/** Series data with provenance; see docs/series.md. */
export { SERIES_RULES }

/** Normalise a code as written by users: "b 60" → "B60", "q/p" → "Q". */
export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '').split('/')[0]
}

export function findRule(code: string): SeriesRule | undefined {
  const c = normaliseCode(code)
  return SERIES_RULES.find((r) => r.codes.includes(c))
}

/**
 * The rule that governs a buono. Old 30-year paper forms issued after their
 * series closed count as the series in force on the subscription date (e.g.
 * Q forms from 1/11/1995 are series R, R forms from 1/12/1996 are series S).
 */
export function ruleFor(code: string, sottoscritto: string): { rule?: SeriesRule; reclassifiedFrom?: string } {
  const rule = findRule(code)
  if (!rule) return {}
  const inWindow = (r: SeriesRule) => sottoscritto >= r.issueFrom && sottoscritto <= r.issueTo
  if (inWindow(rule) || rule.durationYears !== 30 || sottoscritto < rule.issueTo) return { rule }
  const successor = SERIES_RULES.find((r) => r.durationYears === 30 && r !== rule && inWindow(r))
  return successor ? { rule: successor, reclassifiedFrom: rule.codes[0] } : { rule }
}

/** The ordinary series on sale on a given subscription date, if known. */
export function seriesForDate(sottoscritto: string): SeriesRule | undefined {
  return SERIES_RULES.find((r) => sottoscritto >= r.issueFrom && sottoscritto <= r.issueTo)
}

/** Lire were the default before the X series (21/12/1999); euro from then on. */
export const defaultCurrency = (sottoscritto: string): Currency => (sottoscritto < '1999-12-21' ? 'ITL' : 'EUR')

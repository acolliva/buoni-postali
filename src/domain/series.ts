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

export interface RedemptionPoint {
  /** Completed months since subscription. */
  afterMonths: number
  /** Gross redemption value per 100 of face value. */
  gross: number
}

export interface SeriesRule {
  /** Series codes this rule applies to, e.g. ["Q"] or ["B1", "B5"]. */
  codes: string[]
  label: string
  currency: Currency
  durationYears: number
  /**
   * How interest accrues when using a rate schedule:
   * - "annual": compounds once per completed year
   * - "bimestral": compounds every completed bimester at (1 + r)^(1/6)
   */
  capitalization: 'annual' | 'bimestral'
  rateSchedule: RateBracket[]
  /** Official redemption table; when present it takes precedence over rateSchedule. */
  redemptionTable?: RedemptionPoint[]
  /** Withholding tax on interest, percent. */
  taxPct: number
  /** Years after maturity before the right to redeem lapses. */
  prescriptionYears: number
  confidence: 'alta' | 'media' | 'bassa'
  notes?: string
  sources: string[]
}

export const LIRE_PER_EURO = 1936.27

/**
 * Series rules. Data is filled from official CDP / Poste / Gazzetta Ufficiale
 * sources; see docs/series.md for provenance and open questions.
 */
export { SERIES_RULES }

/** Normalise a code as written by users: "b 60" → "B60", "q/p" → "Q". */
export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, '').split('/')[0]
}

export function findRule(code: string): SeriesRule | undefined {
  const c = normaliseCode(code)
  return SERIES_RULES.find((r) => r.codes.includes(c))
}

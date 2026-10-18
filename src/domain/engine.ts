import { addMonths, addYears, completedMonths, daysBetween } from './dates'
import { findRule, LIRE_PER_EURO, type SeriesRule } from './series'
import type { Buono } from './types'

export interface Valuation {
  /** Gross value in euro. */
  gross: number
  /** Value net of withholding tax, in euro. */
  net: number
  /** Face value in euro. */
  nominaleEur: number
  tax: number
  /** Completed months counted for interest (capped at maturity). */
  monthsAccrued: number
}

const toEur = (amount: number, buono: Pick<Buono, 'valuta'>) =>
  buono.valuta === 'ITL' ? amount / LIRE_PER_EURO : amount

/** Gross value per 1 unit of face value after `months` completed months. */
export function grossFactor(rule: SeriesRule, months: number): number {
  const capped = Math.min(months, rule.durationYears * 12)

  if (rule.redemptionTable?.length) {
    let factor = 1
    for (const p of rule.redemptionTable) {
      if (p.afterMonths <= capped) factor = p.gross / 100
      else break
    }
    return factor
  }

  const rateForYear = (year: number) =>
    (rule.rateSchedule.find((b) => year >= b.fromYear && year <= b.toYear)?.ratePct ?? 0) / 100

  let factor = 1
  if (rule.capitalization === 'annual') {
    const years = Math.floor(capped / 12)
    for (let y = 1; y <= years; y++) factor *= 1 + rateForYear(y)
  } else {
    const bimesters = Math.floor(capped / 2)
    for (let b = 1; b <= bimesters; b++) {
      const year = Math.ceil(b / 6)
      factor *= Math.pow(1 + rateForYear(year), 1 / 6)
    }
  }
  return factor
}

export function valueAt(buono: Buono, rule: SeriesRule, date: string): Valuation {
  const months = completedMonths(buono.sottoscritto, date)
  const monthsAccrued = Math.min(months, rule.durationYears * 12)
  const grossNative = buono.nominale * grossFactor(rule, months)
  const gross = toEur(grossNative, buono)
  const nominaleEur = toEur(buono.nominale, buono)
  const tax = Math.max(0, gross - nominaleEur) * (rule.taxPct / 100)
  return { gross, net: gross - tax, nominaleEur, tax, monthsAccrued }
}

export type Status = 'in-corso' | 'in-scadenza' | 'scaduto' | 'prescrizione-vicina' | 'prescritto' | 'serie-sconosciuta'

export interface Assessment {
  buono: Buono
  rule?: SeriesRule
  status: Status
  maturity?: string
  prescription?: string
  now?: Valuation
  atMaturity?: Valuation
  /** Net yield of holding 12 more months, as a fraction (e.g. 0.021 = 2.1%). */
  nextYearYield?: number
  /** True when holding on yields less than the benchmark rate. */
  belowBenchmark: boolean
  daysToMaturity?: number
  daysToPrescription?: number
}

export interface AssessOptions {
  today: string
  /** Months before maturity that count as "in scadenza". */
  soonMonths: number
  /** Months before prescription that trigger an urgent warning. */
  prescriptionWarnMonths: number
  /** Benchmark net annual yield in percent (e.g. a new 4-year buono). */
  benchmarkPct: number
}

export function assess(buono: Buono, opts: AssessOptions): Assessment {
  const rule = findRule(buono.serie)
  if (!rule) return { buono, status: 'serie-sconosciuta', belowBenchmark: false }

  const maturity = addYears(buono.sottoscritto, rule.durationYears)
  const prescription = addYears(maturity, rule.prescriptionYears)
  const now = valueAt(buono, rule, opts.today)
  const atMaturity = valueAt(buono, rule, maturity)

  let status: Status
  if (opts.today >= prescription) status = 'prescritto'
  else if (opts.today >= addMonths(prescription, -opts.prescriptionWarnMonths)) status = 'prescrizione-vicina'
  else if (opts.today >= maturity) status = 'scaduto'
  else if (opts.today >= addMonths(maturity, -opts.soonMonths)) status = 'in-scadenza'
  else status = 'in-corso'

  let nextYearYield: number | undefined
  if (opts.today < maturity) {
    const later = valueAt(buono, rule, addMonths(opts.today, 12))
    nextYearYield = later.net / now.net - 1
  } else nextYearYield = 0

  return {
    buono,
    rule,
    status,
    maturity,
    prescription,
    now,
    atMaturity,
    nextYearYield,
    belowBenchmark: status === 'in-corso' && nextYearYield * 100 < opts.benchmarkPct,
    daysToMaturity: daysBetween(opts.today, maturity),
    daysToPrescription: daysBetween(opts.today, prescription),
  }
}

/** Value curve for charts: one point per year from subscription to maturity. */
export function curve(buono: Buono, rule: SeriesRule): { date: string; gross: number; net: number }[] {
  const points = []
  for (let y = 0; y <= rule.durationYears; y++) {
    const date = addYears(buono.sottoscritto, y)
    const v = valueAt(buono, rule, date)
    points.push({ date, gross: v.gross, net: v.net })
  }
  return points
}

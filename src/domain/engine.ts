import { addMonths, addYears, completedMonths, daysBetween } from './dates'
import { LIRE_PER_EURO, ruleFor, type SeriesRule } from './series'
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

export function maturityDate(rule: SeriesRule, sottoscritto: string): string {
  if (rule.maturity === 'endOfYear') return `${Number(sottoscritto.slice(0, 4)) + rule.durationYears}-12-31`
  return addYears(sottoscritto, rule.durationYears)
}

export const prescriptionDate = (rule: SeriesRule, sottoscritto: string) =>
  addYears(maturityDate(rule, sottoscritto), rule.prescriptionYears)

const rateForYear = (rule: SeriesRule, year: number) =>
  (rule.rateSchedule.find((b) => year >= b.fromYear && year <= b.toYear)?.ratePct ?? 0) / 100

/**
 * Value per 1 unit of face value after `months` completed months of accrual
 * (already capped at maturity). Returns gross and net factors.
 */
export function factors(rule: SeriesRule, months: number): { gross: number; net: number } {
  if (months < 12) return { gross: 1, net: 1 }
  const t = rule.taxPct / 100
  // In "net" mode each year's interest is taxed before it is capitalized.
  const k = rule.taxMode === 'net' ? 1 - t : 1

  const years = Math.floor(months / 12)
  const compounded = Math.min(years, rule.compoundYears)
  let v = 1
  for (let y = 1; y <= compounded; y++) v *= 1 + rateForYear(rule, y) * k

  if (years < rule.compoundYears) {
    const bimesters = Math.floor((months % 12) / 2)
    v *= 1 + (rateForYear(rule, years + 1) * k * bimesters) / 6
  } else {
    // Simple interest on the capitalized value, per completed bimester.
    const bimesters = Math.floor((months - rule.compoundYears * 12) / 2)
    v *= 1 + (rateForYear(rule, rule.compoundYears + 1) * k * bimesters) / 6
  }

  return rule.taxMode === 'net'
    ? { gross: 1 + (v - 1) / (1 - t), net: v }
    : { gross: v, net: 1 + (v - 1) * (1 - t) }
}

export function valueAt(buono: Buono, rule: SeriesRule, date: string): Valuation {
  const maturity = maturityDate(rule, buono.sottoscritto)
  const monthsAccrued = completedMonths(buono.sottoscritto, date < maturity ? date : maturity)
  const f = factors(rule, monthsAccrued)
  const nominaleEur = toEur(buono.nominale, buono)
  const gross = nominaleEur * f.gross
  const net = nominaleEur * f.net
  return { gross, net, nominaleEur, tax: gross - net, monthsAccrued }
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
  /** Subscription date falls outside the series' issue window. */
  outsideIssueWindow: boolean
  /** Series code on the form when the buono is valued under a later series. */
  reclassifiedFrom?: string
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
  const { rule, reclassifiedFrom } = ruleFor(buono.serie, buono.sottoscritto)
  if (!rule) return { buono, status: 'serie-sconosciuta', belowBenchmark: false, outsideIssueWindow: false }

  const maturity = maturityDate(rule, buono.sottoscritto)
  const prescription = prescriptionDate(rule, buono.sottoscritto)
  const now = valueAt(buono, rule, opts.today)
  const atMaturity = valueAt(buono, rule, maturity)

  let status: Status
  if (opts.today >= prescription) status = 'prescritto'
  else if (opts.today >= addMonths(prescription, -opts.prescriptionWarnMonths)) status = 'prescrizione-vicina'
  else if (opts.today > maturity) status = 'scaduto'
  else if (opts.today >= addMonths(maturity, -opts.soonMonths)) status = 'in-scadenza'
  else status = 'in-corso'

  let nextYearYield = 0
  if (opts.today < maturity) {
    const later = valueAt(buono, rule, addMonths(opts.today, 12))
    nextYearYield = later.net / now.net - 1
  }

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
    outsideIssueWindow: buono.sottoscritto < rule.issueFrom || buono.sottoscritto > rule.issueTo,
    reclassifiedFrom,
    daysToMaturity: daysBetween(opts.today, maturity),
    daysToPrescription: daysBetween(opts.today, prescription),
  }
}

/** Value curve for charts: one point per year from subscription to maturity. */
export function curve(buono: Buono, rule: SeriesRule): { date: string; gross: number; net: number }[] {
  const maturity = maturityDate(rule, buono.sottoscritto)
  const points = []
  for (let y = 0; ; y++) {
    const date = addYears(buono.sottoscritto, y)
    if (date >= maturity) break
    const v = valueAt(buono, rule, date)
    points.push({ date, gross: v.gross, net: v.net })
  }
  const v = valueAt(buono, rule, maturity)
  points.push({ date: maturity, gross: v.gross, net: v.net })
  return points
}

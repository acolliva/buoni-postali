import { addMonths, completedMonths } from './dates'
import { maturityDate, valueAt } from './engine'
import type { SeriesRule } from './series'
import type { Buono } from './types'

export interface Holding {
  buono: Buono
  rule: SeriesRule
}

export interface ItemPlan {
  holding: Holding
  maturity: string
  now: number
  atMaturity: number
  /** Best date to cash out: today, or right after a later interest credit. */
  bestDate: string
  /** Simple annual net rate earned by holding from today to maturity (0 if matured). */
  forwardSimple: number
}

export interface Analysis {
  today: string
  /** Comparison horizon: last maturity, or one year from today if later. */
  horizon: string
  horizonMonths: number
  benchmark: number
  nominalEur: number
  now: number
  atMaturity: number
  lastMaturity: string
  /** Net value 12 months from today / net value today − 1. */
  nextYearYield: number
  /** Simple annual net rate from today to the horizon, holding everything. */
  forwardSimple: number
  /** Net gain since subscription. */
  gain: number
  /** Annualised (compound) net return since subscription; single buono only. */
  sinceStartAnnual?: number
  /** Benchmark interest lost per month on matured buoni. */
  idleCostPerMonth: number
  maturedCount: number
  /**
   * Wealth at the horizon: cash everything now; hold (matured buoni stay idle,
   * running ones are cashed at maturity); or cash each one at its best date.
   * Money cashed out earns the benchmark until the horizon.
   */
  outcome: { cashNow: number; holdAll: number; best: number }
  items: ItemPlan[]
  /** Next date a bimester of interest is credited (single, still earning). */
  nextAccrual?: string
  /** Monthly net value from the first subscription to the horizon. */
  history: { date: string; value: number }[]
  /** Benchmark path from today: today's value growing at simple interest monthly. */
  benchmarkPath: { date: string; value: number }[]
  /** Net yield of each future 12-month window, for comparison with the benchmark. */
  years: { from: string; to: string; rate: number }[]
}

const net = (h: Holding, date: string) => valueAt(h.buono, h.rule, date).net

/**
 * Compare holding a set of buoni with cashing them out and putting the money
 * in an alternative paying `benchmarkPct` net per year, simple interest
 * credited monthly. Everything is measured at a common horizon.
 */
export function analyse(holdings: Holding[], today: string, benchmarkPct: number): Analysis {
  const r = benchmarkPct / 100
  const maturities = holdings.map((h) => maturityDate(h.rule, h.buono.sottoscritto))
  const lastMaturity = maturities.reduce((a, b) => (a > b ? a : b))
  const oneYear = addMonths(today, 12)
  const horizon = lastMaturity > oneYear ? lastMaturity : oneYear
  const K = completedMonths(today, horizon)
  const total = (date: string) => holdings.reduce((s, h) => s + net(h, date), 0)

  /** Wealth at the horizon if `h` is cashed out on `d` and the money earns the benchmark. */
  const wealthAt = (h: Holding, d: string) => net(h, d) * (1 + (r * completedMonths(d, horizon)) / 12)

  const items: ItemPlan[] = holdings.map((h, i) => {
    const maturity = maturities[i]
    const now = net(h, today)
    const atMaturity = net(h, maturity)
    // Candidate exits: today and every later bimester credit up to maturity.
    const candidates = [today]
    for (let j = 1; ; j++) {
      const d = addMonths(h.buono.sottoscritto, 2 * j)
      if (d > maturity || d > horizon) break
      if (d > today && j >= 6) candidates.push(d)
    }
    let bestDate = today
    let bestW = -Infinity
    for (const d of candidates) {
      const w = wealthAt(h, d)
      if (w > bestW + 1e-9) {
        bestW = w
        bestDate = d
      }
    }
    const yearsLeft = completedMonths(today, maturity) / 12
    return {
      holding: h,
      maturity,
      now,
      atMaturity,
      bestDate,
      forwardSimple: today < maturity && yearsLeft > 0 ? (atMaturity / now - 1) / yearsLeft : 0,
    }
  })

  const now = items.reduce((s, it) => s + it.now, 0)
  const atHorizon = total(horizon)
  const nominalEur = holdings.reduce((s, h) => s + valueAt(h.buono, h.rule, h.buono.sottoscritto).nominaleEur, 0)
  const matured = items.filter((it) => today > it.maturity)

  const first = holdings.map((h) => h.buono.sottoscritto).reduce((a, b) => (a < b ? a : b))
  const history = []
  for (let d = first; d <= horizon; d = addMonths(first, history.length)) history.push({ date: d, value: total(d) })
  if (history[history.length - 1].date !== horizon) history.push({ date: horizon, value: atHorizon })

  const benchmarkPath = []
  for (let k = 0; k <= K; k++) {
    const date = addMonths(today, k)
    benchmarkPath.push({ date, value: now * (1 + (r * k) / 12) })
  }

  const years = []
  for (let j = 0; j * 12 < K; j++) {
    const from = addMonths(today, j * 12)
    const to = addMonths(today, Math.min((j + 1) * 12, K))
    const span = completedMonths(from, to) / 12
    years.push({ from, to, rate: span > 0 ? (total(to) / total(from) - 1) / span : 0 })
  }

  let sinceStartAnnual: number | undefined
  let nextAccrual: string | undefined
  if (holdings.length === 1) {
    const h = holdings[0]
    const yrs = completedMonths(h.buono.sottoscritto, today < items[0].maturity ? today : items[0].maturity) / 12
    if (yrs >= 1) sinceStartAnnual = Math.pow(items[0].now / nominalEur, 1 / yrs) - 1
    if (today < items[0].maturity) {
      const m = completedMonths(h.buono.sottoscritto, today)
      const next = addMonths(h.buono.sottoscritto, Math.max(12, (Math.floor(m / 2) + 1) * 2))
      if (next <= items[0].maturity) nextAccrual = next
    }
  }

  return {
    today,
    horizon,
    horizonMonths: K,
    benchmark: r,
    nominalEur,
    now,
    atMaturity: items.reduce((s, it) => s + it.atMaturity, 0),
    lastMaturity,
    nextYearYield: now > 0 ? total(oneYear) / now - 1 : 0,
    forwardSimple: K > 0 && now > 0 ? (atHorizon / now - 1) / (K / 12) : 0,
    gain: now - nominalEur,
    sinceStartAnnual,
    idleCostPerMonth: matured.reduce((s, it) => s + it.now, 0) * (r / 12),
    maturedCount: matured.length,
    outcome: {
      cashNow: items.reduce((s, it) => s + wealthAt(it.holding, today), 0),
      // Holding: a matured buono stays idle; one still running is cashed at maturity.
      holdAll: items.reduce((s, it) => s + wealthAt(it.holding, it.maturity < today ? horizon : it.maturity), 0),
      best: items.reduce((s, it) => s + wealthAt(it.holding, it.bestDate), 0),
    },
    items,
    nextAccrual,
    history,
    benchmarkPath,
    years,
  }
}

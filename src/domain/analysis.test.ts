import { describe, expect, it } from 'vitest'
import { analyse, type Holding } from './analysis'
import { findRule } from './series'
import type { Buono } from './types'

const h = (b: Partial<Buono> & Pick<Buono, 'serie' | 'sottoscritto'>): Holding => ({
  buono: { id: b.serie + b.sottoscritto, nominale: 1000, valuta: 'EUR', ...b },
  rule: findRule(b.serie)!,
})

const today = '2026-10-18'

describe('analyse', () => {
  it('says to cash out a matured buono now and prices the wait', () => {
    const a = analyse([h({ serie: 'A8', sottoscritto: '2003-08-20' })], today, 2.5)
    expect(a.maturedCount).toBe(1)
    expect(a.items[0].bestDate).toBe(today)
    expect(a.nextYearYield).toBe(0)
    expect(a.idleCostPerMonth).toBeCloseTo((a.now * 0.025) / 12, 6)
    expect(a.outcome.best).toBeCloseTo(a.outcome.cashNow, 6)
    expect(a.outcome.cashNow).toBeGreaterThan(a.outcome.holdAll)
  })

  it('cashes out a buono earning 0.5% in years 21–30', () => {
    const a = analyse([h({ serie: 'W', sottoscritto: '1999-07-15' })], today, 2.5)
    expect(a.forwardSimple).toBeLessThan(0.01)
    expect(a.items[0].bestDate).toBe(today)
  })

  it('keeps a buono whose remaining yield beats the benchmark', () => {
    // B87 pays 6.5% gross in years 18–20.
    const a = analyse([h({ serie: 'B87', sottoscritto: '2012-01-09' })], today, 2.5)
    expect(a.forwardSimple).toBeGreaterThan(0.025)
    expect(a.items[0].bestDate).toBe(a.items[0].maturity)
    expect(a.outcome.best).toBeCloseTo(a.outcome.holdAll, 6)
  })

  it('never does worse than either pure strategy', () => {
    const a = analyse(
      [h({ serie: 'A8', sottoscritto: '2003-08-20' }), h({ serie: 'B87', sottoscritto: '2012-01-09' })],
      today,
      2.5,
    )
    expect(a.outcome.best).toBeGreaterThanOrEqual(a.outcome.cashNow - 1e-6)
    expect(a.outcome.best).toBeGreaterThanOrEqual(a.outcome.holdAll - 1e-6)
    expect(a.history[0].date).toBe('2003-08-20')
    expect(a.benchmarkPath[0].value).toBeCloseTo(a.now, 6)
  })

  it('finds the next bimester credit for a single buono', () => {
    const a = analyse([h({ serie: 'B99', sottoscritto: '2013-01-31' })], today, 2.5)
    expect(a.nextAccrual).toBe('2026-11-30')
  })
})

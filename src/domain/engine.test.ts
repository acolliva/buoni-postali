import { describe, expect, it } from 'vitest'
import { addMonths, completedMonths } from './dates'
import { assess, factors, maturityDate, prescriptionDate, valueAt } from './engine'
import { findRule, type SeriesRule } from './series'

const rule = (code: string): SeriesRule => {
  const r = findRule(code)
  if (!r) throw new Error(`missing ${code}`)
  return r
}

describe('dates', () => {
  it('counts completed months', () => {
    expect(completedMonths('2005-03-07', '2005-04-06')).toBe(0)
    expect(completedMonths('2005-03-07', '2005-04-07')).toBe(1)
    expect(completedMonths('2005-01-31', '2005-02-28')).toBe(1)
    expect(completedMonths('2010-01-01', '2009-01-01')).toBe(0)
  })
  it('clamps to month end', () => {
    expect(addMonths('2012-01-31', 1)).toBe('2012-02-29')
  })
})

describe('factors match official CDP coefficients', () => {
  // 20-year gross coefficients from each series' Foglio Informativo.
  it.each([
    ['A8', 240, 2.25290621],
    ['B1', 240, 2.22904855],
    ['B1', 24, 1.03632],
    ['A8', 12, 1.0175],
  ])('%s after %i months', (code, months, expected) => {
    expect(factors(rule(code), months).gross).toBeCloseTo(expected, 8)
  })

  it('pays nothing in the first 12 months', () => {
    expect(factors(rule('B5'), 11)).toEqual({ gross: 1, net: 1 })
  })

  it('accrues per completed bimester within the year', () => {
    const r = rule('A8') // year 2 rate 2%
    expect(factors(r, 13).gross).toBeCloseTo(1.0175, 10)
    expect(factors(r, 14).gross).toBeCloseTo(1.0175 * (1 + 0.02 / 6), 10)
  })

  it('net = 1 + interest × 0.875 for gross-capitalized series', () => {
    const f = factors(rule('B98'), 120)
    expect(f.net).toBeCloseTo(1 + (f.gross - 1) * 0.875, 12)
  })
})

describe('30-year lire series', () => {
  it('matures on 31 December of the 30th year and prescribes 10 years later', () => {
    expect(maturityDate(rule('R'), '1996-07-02')).toBe('2026-12-31')
    expect(prescriptionDate(rule('R'), '1996-07-02')).toBe('2036-12-31')
  })

  it('compounds net of tax for R', () => {
    const f = factors(rule('R'), 12)
    expect(f.net).toBeCloseTo(1 + 0.07 * 0.875, 10)
    expect(f.gross).toBeCloseTo(1.07, 10)
  })

  it('earns simple interest after year 20', () => {
    const r = rule('W') // gross mode, 0.5% simple in years 21-30
    const v20 = factors(r, 240).gross
    expect(factors(r, 252).gross).toBeCloseTo(v20 * 1.005, 10)
    expect(factors(r, 258).gross).toBeCloseTo(v20 * (1 + 0.005 * 9 / 6), 10)
  })

  it('stops accruing at maturity', () => {
    const b = { id: 'x', serie: 'S', sottoscritto: '1997-03-03', nominale: 1_000_000, valuta: 'ITL' as const }
    expect(valueAt(b, rule('S'), '2030-01-01').net).toBeCloseTo(valueAt(b, rule('S'), '2027-12-31').net, 10)
  })
})

describe('assess', () => {
  const opts = { today: '2026-10-18', soonMonths: 12, prescriptionWarnMonths: 24, benchmarkPct: 2.5 }

  it('flags matured buoni as no longer earning', () => {
    const a = assess({ id: 'a', serie: 'Q', sottoscritto: '1995-04-13', nominale: 1_000_000, valuta: 'ITL' }, opts)
    expect(a.maturity).toBe('2025-12-31')
    expect(a.status).toBe('scaduto')
    expect(a.nextYearYield).toBe(0)
  })

  it('flags buoni maturing within the window', () => {
    const a = assess({ id: 'b', serie: 'R', sottoscritto: '1996-02-27', nominale: 1_000_000, valuta: 'ITL' }, opts)
    expect(a.status).toBe('in-scadenza')
  })

  it('values late 30-year forms under the series in force', () => {
    const a = assess({ id: 'c', serie: 'Q', sottoscritto: '1995-11-16', nominale: 1_000_000, valuta: 'ITL' }, opts)
    expect(a.rule?.codes).toEqual(['R'])
    expect(a.reclassifiedFrom).toBe('Q')
    expect(a.outsideIssueWindow).toBe(false)
  })

  it('flags dates before a series opened', () => {
    const a = assess({ id: 'd', serie: 'B99', sottoscritto: '2010-01-01', nominale: 1000, valuta: 'EUR' }, opts)
    expect(a.outsideIssueWindow).toBe(true)
  })
})

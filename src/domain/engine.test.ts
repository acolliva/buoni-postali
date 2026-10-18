import { describe, expect, it } from 'vitest'
import { addMonths, completedMonths } from './dates'
import { grossFactor, valueAt } from './engine'
import type { SeriesRule } from './series'

const rule = (over: Partial<SeriesRule> = {}): SeriesRule => ({
  codes: ['T1'],
  label: 'Test',
  currency: 'EUR',
  durationYears: 10,
  capitalization: 'annual',
  rateSchedule: [
    { fromYear: 1, toYear: 5, ratePct: 2 },
    { fromYear: 6, toYear: 10, ratePct: 4 },
  ],
  taxPct: 12.5,
  prescriptionYears: 10,
  confidence: 'alta',
  sources: [],
  ...over,
})

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

describe('grossFactor', () => {
  it('compounds annually by bracket and stops at maturity', () => {
    const r = rule()
    expect(grossFactor(r, 11)).toBe(1)
    expect(grossFactor(r, 12)).toBeCloseTo(1.02)
    expect(grossFactor(r, 120)).toBeCloseTo(1.02 ** 5 * 1.04 ** 5)
    expect(grossFactor(r, 300)).toBeCloseTo(grossFactor(r, 120))
  })
  it('bimestral compounding matches annual on whole years', () => {
    const a = rule()
    const b = rule({ capitalization: 'bimestral' })
    expect(grossFactor(b, 24)).toBeCloseTo(grossFactor(a, 24))
    expect(grossFactor(b, 2)).toBeCloseTo(1.02 ** (1 / 6))
  })
  it('prefers a redemption table when present', () => {
    const r = rule({ redemptionTable: [{ afterMonths: 12, gross: 101.5 }, { afterMonths: 24, gross: 103.4 }] })
    expect(grossFactor(r, 18)).toBeCloseTo(1.015)
  })
})

describe('valueAt', () => {
  it('converts lire and applies tax on interest only', () => {
    const v = valueAt(
      { id: 'x', serie: 'T1', sottoscritto: '2000-01-01', nominale: 1936270, valuta: 'ITL' },
      rule(),
      '2001-01-01',
    )
    expect(v.nominaleEur).toBeCloseTo(1000)
    expect(v.gross).toBeCloseTo(1020)
    expect(v.net).toBeCloseTo(1020 - 20 * 0.125)
  })
})

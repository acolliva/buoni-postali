import { describe, expect, it } from 'vitest'
import sources2 from '../../docs/series-sources-2.json'
import { addMonths } from './dates'
import { factors } from './engine'
import { findRule, seriesForDate, SERIES_RULES } from './series'

describe('series data', () => {
  const official = (sources2.series as { codes: string[]; officialFinalCoefficient: number | null }[]).filter(
    (s) => s.officialFinalCoefficient,
  )

  it.each(official.map((s) => [s.codes[0], s.officialFinalCoefficient!]))(
    '%s reproduces the official 20-year coefficient',
    (code, coef) => {
      expect(factors(findRule(code)!, 240).gross).toBeCloseTo(coef, 7)
    },
  )

  it('has no overlapping issue windows', () => {
    const sorted = [...SERIES_RULES].sort((a, b) => (a.issueFrom < b.issueFrom ? -1 : 1))
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].issueFrom > sorted[i - 1].issueTo).toBe(true)
  })

  it('finds a series for every month from July 1986 to today', () => {
    const missing: string[] = []
    for (let d = '1986-07-01'; d <= '2026-10-18'; d = addMonths(d, 1)) {
      for (const day of ['01', '15', '28']) {
        const date = d.slice(0, 8) + day
        const knownGap = date >= '1997-06-24' && date <= '1997-06-30' // between S and T, unconfirmed
        if (!seriesForDate(date) && !knownGap) missing.push(date)
      }
    }
    expect(missing).toEqual([])
  })

  it('knows the series on sale today', () => {
    expect(seriesForDate('2026-10-18')?.codes[0]).toBe('TF120A250624')
  })
})

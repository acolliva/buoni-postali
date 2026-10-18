import { describe, expect, it } from 'vitest'
import { parseRows } from './parseRows'

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))
const formula = (f: string) => ({ formula: f })

// Synthetic fixture mirroring the layout of the user's sheet (no real data).
const rows = [
  [],
  [null, 'serie', 'numero', 'sottostritto', 'scadenza', 'valore', 'mese', 'anno'],
  [null, 'B10', 11111111, d(2010, 1, 31), formula('YEAR(D3)+20'), 1000, formula('MONTH(D3)'), formula('YEAR(D3)')],
  [null, 'X', null, d(2000, 2, 2), 2020, 500, null, null],
  [null, 'B10', 11111111, d(2010, 1, 31), 2030, 1000, null, null],
  [null, null, null, null, null, formula('SUM(F3:F5)'), null, null],
  [],
  [null, 'Lire'],
  [null, 'serie', 'numero', 'sottostritto', 'scadenza', 'valore'],
  [null, 'r', '01.234.567 05', d(1996, 1, 18), null, 1000000],
  [null, 'S', null, d(1997, 10, 1), null, 100000],
  [null, 'Q', null, '08/02/1994', null, '2.000.000'],
  [null, 'Q', null, null, null, 1000000],
]

describe('parseRows', () => {
  const { buoni, warnings } = parseRows(rows)

  it('reads every buono across euro and lire blocks', () => {
    expect(buoni.map((b) => b.serie)).toEqual(['B10', 'X', 'B10', 'R', 'S', 'Q'])
  })

  it('assigns currency from the Lire marker and from magnitude', () => {
    expect(buoni.map((b) => b.valuta)).toEqual(['EUR', 'EUR', 'EUR', 'ITL', 'ITL', 'ITL'])
  })

  it('parses dates, numbers and formatted strings', () => {
    expect(buoni[0]).toMatchObject({ sottoscritto: '2010-01-31', nominale: 1000, numero: '11111111' })
    expect(buoni[3]).toMatchObject({ numero: '01.234.567 05', nominale: 1_000_000 })
    expect(buoni[5]).toMatchObject({ sottoscritto: '1994-02-08', nominale: 2_000_000 })
  })

  it('warns about duplicates and incomplete rows', () => {
    expect(warnings.map((w) => w.row)).toEqual([5, 13])
    expect(warnings[0].message).toMatch(/duplicato/)
  })
})

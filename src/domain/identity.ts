import type { Buono } from './types'

/**
 * Give every buono an id derived from its own data, so that flags such as
 * "rimborsato" survive re-importing the spreadsheet. Identical rows (no
 * number, same series, date and value) are told apart by their order.
 */
export function withStableIds(buoni: Buono[]): Buono[] {
  const seen = new Map<string, number>()
  return buoni.map((b) => {
    const base = [b.serie, b.numero ?? '', b.sottoscritto, b.nominale, b.valuta].join('|')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...b, id: `${base}#${n}` }
  })
}

import type { Buono, Currency, ImportResult, ImportWarning } from '../domain/types'

/** A cell value as read from a spreadsheet (ExcelJS or similar). */
export type Cell = string | number | Date | null | undefined | { [k: string]: unknown }

type Field = 'serie' | 'numero' | 'sottoscritto' | 'valore' | 'nota'

const HEADER_MATCHERS: [Field, RegExp][] = [
  ['serie', /^serie$/i],
  ['numero', /^(numero|n\.?|num)$/i],
  // tolerant of typos such as "sottostritto"
  ['sottoscritto', /^(sotto|data)/i],
  ['valore', /^(valore|nominale|importo|taglio)/i],
  ['nota', /^(nota|note|intestatario)/i],
]

/** Above this face value a number is almost certainly lire, not euro. */
const LIRE_THRESHOLD = 50_000

function text(c: Cell): string {
  if (c == null) return ''
  if (c instanceof Date) return ''
  if (typeof c === 'object') {
    // ExcelJS rich text / formula / hyperlink cells
    const o = c as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('').trim()
    if (o.text != null) return String(o.text).trim()
    if (o.result != null) return String(o.result).trim()
    return ''
  }
  return String(c).trim()
}

function num(c: Cell): number | null {
  if (typeof c === 'number') return c
  if (c && typeof c === 'object' && !(c instanceof Date)) {
    const r = (c as Record<string, unknown>).result
    if (typeof r === 'number') return r
    // A formula without a cached result (e.g. =SUM()) is not a value
    return null
  }
  const s = text(c).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const pad = (n: number) => String(n).padStart(2, '0')

function toIso(d: Date): string {
  // ExcelJS returns dates as UTC midnight
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function date(c: Cell): string | null {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? null : toIso(c)
  if (typeof c === 'number' && c > 20000 && c < 80000) {
    // Excel serial date (1900 system)
    return toIso(new Date(Date.UTC(1899, 11, 30) + c * 86_400_000))
  }
  const s = text(c)
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

/**
 * Parse a sheet laid out as one or more blocks, each starting with a header
 * row (serie, numero, sottoscritto, …, valore). A row containing just "Lire"
 * switches the following blocks to lire; values above 50,000 are also treated
 * as lire. Total rows and formula-only columns are ignored.
 */
export function parseRows(rows: Cell[][]): ImportResult {
  const buoni: Buono[] = []
  const warnings: ImportWarning[] = []
  let cols: Partial<Record<Field, number>> | null = null
  let currencyHint: Currency | null = null
  const seen = new Map<string, number>()

  rows.forEach((row, i) => {
    const rowNo = i + 1
    const texts = row.map(text)

    if (texts.some((t) => /^lire$/i.test(t)) && texts.filter(Boolean).length === 1) {
      currencyHint = 'ITL'
      return
    }
    if (texts.some((t) => /^euro$/i.test(t)) && texts.filter(Boolean).length === 1) {
      currencyHint = 'EUR'
      return
    }

    const headerCols: Partial<Record<Field, number>> = {}
    texts.forEach((t, ci) => {
      for (const [field, re] of HEADER_MATCHERS) {
        if (re.test(t) && headerCols[field] == null) headerCols[field] = ci
      }
    })
    if (headerCols.serie != null && headerCols.valore != null && headerCols.sottoscritto != null) {
      cols = headerCols
      return
    }
    if (!cols) return

    const serie = text(row[cols.serie!]).toUpperCase()
    const valore = num(row[cols.valore!])
    const sottoscritto = date(row[cols.sottoscritto!])
    if (!serie && valore == null && !sottoscritto) return
    if (!serie) return // total row such as =SUM(...)

    if (!sottoscritto) {
      warnings.push({ row: rowNo, message: `Serie ${serie}: data di sottoscrizione mancante o non valida` })
      return
    }
    if (valore == null || valore <= 0) {
      warnings.push({ row: rowNo, message: `Serie ${serie}: valore nominale mancante` })
      return
    }

    const valuta: Currency = valore >= LIRE_THRESHOLD ? 'ITL' : (currencyHint ?? 'EUR')
    if (currencyHint === 'ITL' && valore < LIRE_THRESHOLD) {
      warnings.push({ row: rowNo, message: `Serie ${serie}: valore ${valore} basso per un buono in lire, verificare` })
    }

    const numero = cols.numero != null ? text(row[cols.numero]) || undefined : undefined
    const nota = cols.nota != null ? text(row[cols.nota]) || undefined : undefined

    if (numero) {
      const key = `${serie}|${numero}`
      const prev = seen.get(key)
      if (prev != null) {
        warnings.push({ row: rowNo, message: `Serie ${serie} n. ${numero} compare due volte (anche riga ${prev}): possibile duplicato` })
      } else seen.set(key, rowNo)
    }

    buoni.push({
      id: `r${rowNo}`,
      serie,
      numero,
      sottoscritto,
      nominale: valore,
      valuta,
      nota,
    })
  })

  return { buoni, warnings }
}

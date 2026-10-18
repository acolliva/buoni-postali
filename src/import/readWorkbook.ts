import type { ImportResult } from '../domain/types'
import { parseRows, type Cell } from './parseRows'

/** Read the first non-empty worksheet of an .xlsx file and parse its buoni. */
export async function readWorkbook(data: ArrayBuffer): Promise<ImportResult> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data)

  for (const ws of wb.worksheets) {
    const rows: Cell[][] = []
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values = row.values as Cell[] // 1-based, index 0 unused
      rows[rowNumber - 1] = values.slice(1)
    })
    for (let i = 0; i < rows.length; i++) rows[i] ??= []
    const result = parseRows(rows)
    if (result.buoni.length) return result
  }
  return { buoni: [], warnings: [{ row: 0, message: 'Nessun buono trovato nel file' }] }
}

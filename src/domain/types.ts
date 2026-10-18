export type Currency = 'EUR' | 'ITL'

/** A single buono as held by the user. */
export interface Buono {
  id: string
  serie: string
  numero?: string
  /** Subscription date, ISO yyyy-mm-dd. */
  sottoscritto: string
  /** Face value in the buono's original currency. */
  nominale: number
  valuta: Currency
  /** Free-text note (e.g. intestatario). */
  nota?: string
}

export interface ImportWarning {
  row: number
  message: string
}

export interface ImportResult {
  buoni: Buono[]
  warnings: ImportWarning[]
}

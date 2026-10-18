const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const eur0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const lire = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('it-IT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 })
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export const fmtEur = (n: number) => eur.format(n)
export const fmtEur0 = (n: number) => eur0.format(n)
export const fmtLire = (n: number) => `L. ${lire.format(n)}`
export const fmtPct = (n: number) => pct.format(n)
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso + 'T00:00:00Z'))
export const fmtMonth = (iso: string) => monthFmt.format(new Date(iso + 'T00:00:00Z'))

export function fmtDuration(days: number): string {
  const abs = Math.abs(days)
  if (abs < 60) return `${abs} giorni`
  if (abs < 730) return `${Math.round(abs / 30.44)} mesi`
  return `${(abs / 365.25).toFixed(1).replace('.', ',')} anni`
}

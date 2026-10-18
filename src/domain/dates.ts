/** Date helpers on ISO yyyy-mm-dd strings, all in UTC to avoid DST drift. */

export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toIso = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Add whole months, clamping to the end of the target month. */
export function addMonths(iso: string, months: number): string {
  const d = parseIso(iso)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const day = d.getUTCDate()
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return toIso(new Date(Date.UTC(y, m, Math.min(day, last))))
}

export const addYears = (iso: string, years: number) => addMonths(iso, years * 12)

/** Completed whole months from `from` to `to` (0 if `to` is before `from`). */
export function completedMonths(from: string, to: string): number {
  const a = parseIso(from)
  const b = parseIso(to)
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  if (addMonths(from, months) > to) months -= 1
  return Math.max(0, months)
}

export const daysBetween = (from: string, to: string) =>
  Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000)

import { useEffect, useState } from 'react'

/** State mirrored to localStorage. Data never leaves the browser. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [key, value])
  return [value, setValue] as const
}

export interface Settings {
  soonMonths: number
  prescriptionWarnMonths: number
  benchmarkPct: number
}

export const DEFAULT_SETTINGS: Settings = {
  soonMonths: 12,
  prescriptionWarnMonths: 24,
  benchmarkPct: 2.5,
}

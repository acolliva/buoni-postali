import { useCallback, useEffect, useRef, useState } from 'react'
import { withStableIds } from '../domain/identity'
import type { Buono } from '../domain/types'

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

export interface Rimborso {
  /** Redemption date, ISO. */
  data: string
  /** Estimated net amount at that date, in euro. */
  netto: number
}

export interface AppState {
  version: 1
  buoni: Buono[]
  settings: Settings
  /** Redeemed buoni, by buono id. */
  rimborsi: Record<string, Rimborso>
}

/** Where data is kept: on the home server (shared by all devices) or in this browser only. */
export type Backend = 'server' | 'browser'

const LOCAL_KEY = 'bp.state'
const EMPTY: AppState = { version: 1, buoni: [], settings: DEFAULT_SETTINGS, rimborsi: {} }

function normalise(s: Partial<AppState> | null | undefined): AppState {
  return {
    version: 1,
    buoni: withStableIds(s?.buoni ?? []),
    settings: { ...DEFAULT_SETTINGS, ...s?.settings },
    rimborsi: s?.rimborsi ?? {},
  }
}

function readLocal(): AppState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return normalise(JSON.parse(raw))
    // Migrate from the first version, which stored separate keys.
    const buoni = localStorage.getItem('bp.buoni')
    const settings = localStorage.getItem('bp.settings')
    if (buoni) return normalise({ buoni: JSON.parse(buoni), settings: settings ? JSON.parse(settings) : undefined })
  } catch {
    /* storage unavailable or corrupt */
  }
  return null
}

function writeLocal(state: AppState) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable: keep in memory */
  }
}

interface Remote {
  rev: number
  state: AppState | null
}

async function readServer(): Promise<Remote | 'unavailable'> {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return 'unavailable'
    const body = (await res.json()) as { rev: number; state: Partial<AppState> | null }
    return { rev: body.rev, state: body.state ? normalise(body.state) : null }
  } catch {
    return 'unavailable'
  }
}

/** Save on top of revision `rev`; the server refuses if someone saved in between. */
async function writeServer(state: AppState, rev: number): Promise<{ rev: number } | 'conflict' | 'error'> {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rev, state }),
    })
    if (res.status === 409) return 'conflict'
    if (!res.ok) return 'error'
    return (await res.json()) as { rev: number }
  } catch {
    return 'error'
  }
}

export type SaveProblem = null | 'error' | 'conflict'

/**
 * App state, loaded from the home server when one is running and from this
 * browser otherwise. Changes are saved automatically.
 */
export function useAppState() {
  const [state, setState] = useState<AppState | null>(null)
  const [backend, setBackend] = useState<Backend>('browser')
  const [saveProblem, setSaveProblem] = useState<SaveProblem>(null)
  const dirty = useRef(false)
  const rev = useRef(0)

  useEffect(() => {
    let cancelled = false
    readServer().then((remote) => {
      if (cancelled) return
      if (remote === 'unavailable') {
        setBackend('browser')
        setState(readLocal() ?? EMPTY)
        return
      }
      setBackend('server')
      rev.current = remote.rev
      if (remote.state) setState(remote.state)
      else {
        // Empty server: seed it with whatever this browser already has.
        const local = readLocal()
        setState(local ?? EMPTY)
        if (local) dirty.current = true
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state || !dirty.current) return
    writeLocal(state)
    if (backend !== 'server') return
    const t = setTimeout(() => {
      writeServer(state, rev.current).then((r) => {
        if (r === 'conflict' || r === 'error') setSaveProblem(r)
        else {
          rev.current = r.rev
          setSaveProblem(null)
        }
      })
    }, 400)
    return () => clearTimeout(t)
  }, [state, backend])

  const update = useCallback((fn: (s: AppState) => AppState) => {
    dirty.current = true
    setState((s) => fn(s ?? EMPTY))
  }, [])

  return { state, update, backend, saveProblem }
}

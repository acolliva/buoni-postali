import { useState } from 'react'
import { useAppState } from './state/store'
import { Analysis } from './views/Analysis'
import { Calculator } from './views/Calculator'
import { Portfolio } from './views/Portfolio'

type View = 'portafoglio' | 'calcolatore' | 'analisi'

const ANALYSIS_KEY = 'bp.analisi'

function readAnalysisIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(ANALYSIS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export default function App() {
  const store = useAppState()
  const [view, setView] = useState<View>(() => {
    const h = location.hash.slice(1)
    return h === 'calcolatore' || h === 'analisi' ? h : 'portafoglio'
  })
  const [analysisIds, setAnalysisIds] = useState<string[]>(readAnalysisIds)

  const go = (v: View) => {
    setView(v)
    history.replaceState(null, '', `#${v}`)
    window.scrollTo(0, 0)
  }

  const analyze = (ids: string[]) => {
    setAnalysisIds(ids)
    try {
      sessionStorage.setItem(ANALYSIS_KEY, JSON.stringify(ids))
    } catch {
      /* keep in memory */
    }
    go('analisi')
  }

  const { state, update } = store
  const ids = new Set(analysisIds)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Buoni postali</div>
        <nav className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={view !== 'calcolatore'} onClick={() => go('portafoglio')}>
            Portafoglio
          </button>
          <button className="tab" role="tab" aria-selected={view === 'calcolatore'} onClick={() => go('calcolatore')}>
            Calcolatore
          </button>
        </nav>
      </header>
      <main>
        {view === 'calcolatore' && <Calculator />}
        {view === 'portafoglio' && <Portfolio {...store} onAnalyze={analyze} />}
        {view === 'analisi' &&
          (state ? (
            <Analysis
              buoni={state.buoni.filter((b) => ids.has(b.id))}
              settings={state.settings}
              setSettings={(settings) => update((s) => ({ ...s, settings }))}
              onBack={() => go('portafoglio')}
            />
          ) : (
            <p className="muted">Caricamento dei dati…</p>
          ))}
      </main>
    </div>
  )
}

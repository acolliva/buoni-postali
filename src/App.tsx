import { useState } from 'react'
import { Calculator } from './views/Calculator'
import { Portfolio } from './views/Portfolio'

type View = 'portafoglio' | 'calcolatore'

export default function App() {
  const [view, setView] = useState<View>(() =>
    location.hash === '#calcolatore' ? 'calcolatore' : 'portafoglio',
  )
  const go = (v: View) => {
    setView(v)
    history.replaceState(null, '', `#${v}`)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">Buoni postali</div>
        <nav className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={view === 'portafoglio'} onClick={() => go('portafoglio')}>
            Portafoglio
          </button>
          <button className="tab" role="tab" aria-selected={view === 'calcolatore'} onClick={() => go('calcolatore')}>
            Calcolatore
          </button>
        </nav>
      </header>
      <main>{view === 'portafoglio' ? <Portfolio /> : <Calculator />}</main>
    </div>
  )
}

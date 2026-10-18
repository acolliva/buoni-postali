import { useState } from 'react'
import { addYears, todayIso } from '../domain/dates'
import { curve, valueAt } from '../domain/engine'
import { findRule, SERIES_RULES } from '../domain/series'
import type { Buono, Currency } from '../domain/types'
import { fmtDate, fmtEur, fmtEur0 } from '../format'

export function Calculator() {
  const [serie, setSerie] = useState(SERIES_RULES[0]?.codes[0] ?? '')
  const [sottoscritto, setSottoscritto] = useState('2005-03-07')
  const [nominale, setNominale] = useState(1000)
  const [target, setTarget] = useState(todayIso())

  const rule = findRule(serie)
  const valuta: Currency = rule?.currency ?? 'EUR'
  const buono: Buono = { id: 'calc', serie, sottoscritto, nominale, valuta }

  const result = (() => {
    if (!rule || !sottoscritto || !target || nominale <= 0) return null
    const maturity = addYears(sottoscritto, rule.durationYears)
    return {
      at: valueAt(buono, rule, target),
      atMaturity: valueAt(buono, rule, maturity),
      maturity,
      prescription: addYears(maturity, rule.prescriptionYears),
      points: curve(buono, rule),
    }
  })()

  const allCodes = SERIES_RULES.flatMap((r) => r.codes)

  return (
    <>
      <h1>Quanto vale un buono a una certa data.</h1>
      <p className="lede">Scegli la serie, la data di sottoscrizione e il taglio. Il valore è calcolato sui mesi interi trascorsi, fino alla scadenza.</p>

      <div className="calc">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="serie">Serie</label>
            <input id="serie" list="serie-list" value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} />
            <datalist id="serie-list">
              {allCodes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="sottoscritto">Data di sottoscrizione</label>
            <input id="sottoscritto" type="date" value={sottoscritto} onChange={(e) => setSottoscritto(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="nominale">Valore nominale ({valuta === 'ITL' ? 'lire' : 'euro'})</label>
            <input id="nominale" type="number" min={0} step={valuta === 'ITL' ? 50000 : 50} value={nominale} onChange={(e) => setNominale(Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="target">Valore al</label>
            <input id="target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </form>

        <div>
          {!rule && (
            <p className="note">
              {serie ? `La serie ${serie} non è ancora configurata.` : 'Inserisci una serie.'} Le serie disponibili sono:{' '}
              {allCodes.join(', ') || 'nessuna per ora'}.
            </p>
          )}
          {rule && result && (
            <>
              <div className="result-head">
                <span className="stamp big">{serie}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>{rule.label}</div>
                  <div className="muted small">
                    Durata {rule.durationYears} anni, scade il {fmtDate(result.maturity)}, si prescrive il {fmtDate(result.prescription)}
                  </div>
                </div>
              </div>
              <dl className="figures">
                <div>
                  <dt>Netto al {fmtDate(target)}</dt>
                  <dd>{fmtEur(result.at.net)}</dd>
                </div>
                <div>
                  <dt>Lordo</dt>
                  <dd>{fmtEur(result.at.gross)}</dd>
                </div>
                <div>
                  <dt>Ritenuta {String(rule.taxPct).replace('.', ',')}%</dt>
                  <dd>{fmtEur(result.at.tax)}</dd>
                </div>
                <div>
                  <dt>Netto a scadenza</dt>
                  <dd>{fmtEur(result.atMaturity.net)}</dd>
                </div>
              </dl>
              <GrowthChart points={result.points} marker={target} />
              <p className="note">
                Affidabilità dei dati della serie: {rule.confidence}.{rule.notes ? ` ${rule.notes}` : ''}
                {rule.sources.length > 0 && (
                  <>
                    {' '}Fonti:{' '}
                    {rule.sources.map((s, i) => (
                      <a key={s} href={s} target="_blank" rel="noreferrer">
                        [{i + 1}]
                      </a>
                    ))}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function GrowthChart({ points, marker }: { points: { date: string; net: number }[]; marker: string }) {
  const W = 640
  const H = 220
  const pad = { l: 64, r: 12, t: 12, b: 28 }
  const t0 = Date.parse(points[0].date)
  const t1 = Date.parse(points[points.length - 1].date)
  const vmin = points[0].net
  const vmax = Math.max(...points.map((p) => p.net))
  const x = (d: string) => pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - ((v - vmin) / (vmax - vmin || 1)) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.net).toFixed(1)}`).join('')
  const mt = Date.parse(marker)
  const showMarker = mt >= t0 && mt <= t1
  const step = Math.max(1, Math.round(points.length / 6))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Crescita del valore netto anno per anno" style={{ maxWidth: W, display: 'block', marginBottom: 20 }}>
      {[vmin, (vmin + vmax) / 2, vmax].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {fmtEur0(v)}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % step === 0 || i === points.length - 1 ? (
          <text key={p.date} x={x(p.date)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
            {p.date.slice(0, 4)}
          </text>
        ) : null,
      )}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {showMarker && (
        <line x1={x(marker)} x2={x(marker)} y1={pad.t} y2={H - pad.b} stroke="var(--soon)" strokeDasharray="4 3" strokeWidth="1.5" />
      )}
    </svg>
  )
}

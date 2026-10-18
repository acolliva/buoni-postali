import { useState } from 'react'
import { todayIso } from '../domain/dates'
import { curve, maturityDate, prescriptionDate, valueAt } from '../domain/engine'
import { defaultCurrency, normaliseCode, ruleFor, seriesForDate, SERIES_RULES } from '../domain/series'
import type { Buono, Currency } from '../domain/types'
import { fmtDate, fmtEur, fmtEur0 } from '../format'

type Tipologia = 'ordinario' | '3x4' | '18mesi' | 'indicizzato' | 'altro'

const TIPOLOGIE: { value: Tipologia; label: string; supported: boolean }[] = [
  { value: 'ordinario', label: 'Ordinario', supported: true },
  { value: '3x4', label: 'A 3 o 4 anni (3x2, 3x4, 4x4)', supported: false },
  { value: '18mesi', label: '18 mesi', supported: false },
  { value: 'indicizzato', label: 'Indicizzato all’inflazione', supported: false },
  { value: 'altro', label: 'Altri (Premia, Minori, Risparmiosemplice…)', supported: false },
]

export function Calculator() {
  const [tipologia, setTipologia] = useState<Tipologia>('ordinario')
  const [sottoscritto, setSottoscritto] = useState(todayIso())
  const [serieManual, setSerieManual] = useState<string | null>(null)
  const [nominale, setNominale] = useState(1000)
  const [target, setTarget] = useState(todayIso())
  const [valutaOverride, setValutaOverride] = useState<Currency | null>(null)

  const guessed = sottoscritto ? seriesForDate(sottoscritto) : undefined
  const resolved = serieManual ? ruleFor(serieManual, sottoscritto) : { rule: guessed }
  const rule = tipologia === 'ordinario' ? resolved.rule : undefined
  const serie = serieManual ?? guessed?.codes[0] ?? ''
  const valuta: Currency = valutaOverride ?? (sottoscritto ? defaultCurrency(sottoscritto) : 'EUR')
  const buono: Buono = { id: 'calc', serie, sottoscritto, nominale, valuta }

  // Keep the face value plausible when the currency flips between lire and euro.
  const fitNominale = (next: Currency) => {
    if (next === 'ITL' && nominale < 50_000) setNominale(1_000_000)
    if (next === 'EUR' && nominale >= 50_000) setNominale(1000)
  }

  const result = (() => {
    if (!rule || !sottoscritto || !target || nominale <= 0) return null
    const maturity = maturityDate(rule, sottoscritto)
    return {
      at: valueAt(buono, rule, target),
      atMaturity: valueAt(buono, rule, maturity),
      maturity,
      prescription: prescriptionDate(rule, sottoscritto),
      points: curve(buono, rule),
    }
  })()

  const allCodes = SERIES_RULES.flatMap((r) => r.codes)
  const supported = TIPOLOGIE.find((t) => t.value === tipologia)!.supported
  const shownCode = rule?.codes.includes(normaliseCode(serie)) ? normaliseCode(serie) : (rule?.codes[0] ?? serie)

  return (
    <>
      <h1>Quanto vale un buono a una certa data.</h1>
      <p className="lede">
        Indica tipologia, data di sottoscrizione e valore: la serie la ricavo dalla data. Il valore è calcolato sui mesi
        interi trascorsi, fino alla scadenza.
      </p>

      <div className="calc">
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="tipologia">Tipologia</label>
            <select id="tipologia" value={tipologia} onChange={(e) => setTipologia(e.target.value as Tipologia)}>
              {TIPOLOGIE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                  {t.supported ? '' : ' (non ancora supportato)'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sottoscritto">Data di sottoscrizione</label>
            <input id="sottoscritto" type="date" value={sottoscritto} onChange={(e) => {
                setSottoscritto(e.target.value)
                if (!valutaOverride && e.target.value) fitNominale(defaultCurrency(e.target.value))
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="serie">Serie</label>
            {serieManual === null ? (
              <div className="serie-auto">
                {guessed ? (
                  <>
                    <span className="stamp">{guessed.codes[0]}</span>
                    <span className="muted small">
                      {guessed.issueTo === '9999-12-31'
                        ? `in emissione dal ${fmtDate(guessed.issueFrom)}`
                        : `in emissione dal ${fmtDate(guessed.issueFrom)} al ${fmtDate(guessed.issueTo)}`}
                    </span>
                  </>
                ) : (
                  <span className="muted small">Nessuna serie nota per questa data</span>
                )}
                <button type="button" className="link small" onClick={() => setSerieManual(guessed?.codes[0] ?? '')}>
                  Indica la serie a mano
                </button>
              </div>
            ) : (
              <>
                <input
                  id="serie"
                  list="serie-list"
                  value={serieManual}
                  placeholder="es. B5, Q"
                  onChange={(e) => setSerieManual(e.target.value.toUpperCase())}
                />
                <datalist id="serie-list">
                  {allCodes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button type="button" className="link small" onClick={() => setSerieManual(null)}>
                  Ricava la serie dalla data
                </button>
              </>
            )}
          </div>
          <div className="field">
            <label htmlFor="valuta">Valuta del buono</label>
            <select id="valuta" value={valuta} onChange={(e) => {
                setValutaOverride(e.target.value as Currency)
                fitNominale(e.target.value as Currency)
              }}
            >
              <option value="EUR">Euro</option>
              <option value="ITL">Lire</option>
            </select>
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
          {!supported && (
            <p className="note">
              Per ora il calcolatore conosce solo i buoni ordinari. Le altre tipologie hanno regole diverse e le aggiungeremo più
              avanti.
            </p>
          )}
          {supported && !rule && (
            <p className="note">
              {serieManual
                ? `La serie ${serieManual} non è ancora nei dati.`
                : sottoscritto
                  ? `Non ho ancora i dati della serie ordinaria in emissione il ${fmtDate(sottoscritto)}.`
                  : 'Inserisci la data di sottoscrizione.'}{' '}
              Se conosci la serie scritta sul buono puoi indicarla a mano.
            </p>
          )}
          {supported && rule && resolved.reclassifiedFrom && (
            <p className="note">
              I moduli della serie {resolved.reclassifiedFrom} emessi in questa data valgono come serie {rule.codes[0]}: calcolo con
              le regole della serie {rule.codes[0]}.
            </p>
          )}
          {supported && rule && serieManual && guessed && !guessed.codes.includes(rule.codes[0]) && !resolved.reclassifiedFrom && (
            <p className="note">
              Attenzione: in quella data era in emissione la serie {guessed.codes[0]}, non la {rule.codes[0]}. Controlla serie e data
              sul buono.
            </p>
          )}
          {rule && result && (
            <>
              <div className="result-head">
                <span className="stamp big">{shownCode}</span>
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
              {target > result.maturity && (
                <p className="note">Alla data scelta il buono è già scaduto: il valore è fermo a quello della scadenza e non matura più interessi.</p>
              )}
              {result.at.monthsAccrued < 12 && (
                <p className="note">Nei primi 12 mesi il buono rimborsa solo il valore nominale, senza interessi.</p>
              )}
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
  const pad = { l: 64, r: 28, t: 12, b: 28 }
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
        (i % step === 0 && points.length - 1 - i >= step / 2) || i === points.length - 1 ? (
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

import { useMemo, useRef, useState } from 'react'
import { analyse, type Analysis as Result, type Holding } from '../domain/analysis'
import { todayIso } from '../domain/dates'
import { ruleFor } from '../domain/series'
import type { Buono } from '../domain/types'
import { fmtDate, fmtEur, fmtEur0, fmtLire, fmtMonth, fmtPct } from '../format'
import type { Settings } from '../state/store'

interface Props {
  buoni: Buono[]
  settings: Settings
  setSettings: (s: Settings) => void
  onBack: () => void
}

const pct = (n: number) => fmtPct(n)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function Analysis({ buoni, settings, setSettings, onBack }: Props) {
  const today = todayIso()
  const holdings: Holding[] = useMemo(
    () =>
      buoni.flatMap((b) => {
        const { rule } = ruleFor(b.serie, b.sottoscritto)
        return rule ? [{ buono: b, rule }] : []
      }),
    [buoni],
  )
  const a = useMemo(
    () => (holdings.length ? analyse(holdings, today, settings.benchmarkPct) : null),
    [holdings, today, settings.benchmarkPct],
  )

  if (!a) {
    return (
      <>
        <button className="link" onClick={onBack}>← Torna al portafoglio</button>
        <h1>Niente da analizzare.</h1>
        <p className="lede">Seleziona uno o più buoni nel portafoglio e scegli “Analizza”.</p>
      </>
    )
  }

  const single = holdings.length === 1 ? holdings[0].buono : null
  const series = [...new Set(holdings.map((h) => h.buono.serie))]
  const bench = settings.benchmarkPct
  const benchLabel = `${String(bench).replace('.', ',')}%`

  return (
    <>
      <button className="link" onClick={onBack}>← Torna al portafoglio</button>

      <div className="analysis-head">
        <div className="stamps">
          {series.slice(0, 8).map((s) => (
            <span key={s} className={`stamp${series.length === 1 ? ' big' : ''}`}>{s}</span>
          ))}
          {series.length > 8 && <span className="muted">+{series.length - 8}</span>}
        </div>
        <p className="muted">
          {single
            ? `${single.numero ? `N. ${single.numero}, s` : 'S'}ottoscritto il ${fmtDate(single.sottoscritto)}, nominale ${
                single.valuta === 'ITL' ? fmtLire(single.nominale) : fmtEur(single.nominale)
              }`
            : `${plural(holdings.length, 'buono', 'buoni')} selezionati, nominale ${fmtEur0(a.nominalEur)}`}
          {buoni.length > holdings.length && ` (${buoni.length - holdings.length} esclusi: serie non configurata)`}
        </p>
      </div>

      <Verdict a={a} benchLabel={benchLabel} single={!!single} />

      <div className="bench-row">
        <label htmlFor="bench">Confronto con un investimento al</label>
        <input
          id="bench"
          type="number"
          step={0.1}
          min={0}
          value={bench}
          onChange={(e) => setSettings({ ...settings, benchmarkPct: Number(e.target.value) })}
        />
        <span>% netto annuo, interesse semplice accreditato ogni mese.</span>
      </div>

      <dl className="figures">
        <div>
          <dt>Netto oggi</dt>
          <dd>{fmtEur(a.now)}</dd>
        </div>
        <div>
          <dt>Netto a scadenza{holdings.length > 1 ? ' (tutti)' : ''}</dt>
          <dd>{fmtEur(a.atMaturity)}</dd>
          <dd className="sub">
            {a.lastMaturity < today
              ? `${single ? 'scaduto' : 'tutti scaduti entro'} il ${fmtDate(a.lastMaturity)}`
              : `${single ? '' : 'entro '}il ${fmtDate(a.lastMaturity)}`}
          </dd>
        </div>
        <div>
          <dt>Rendimento da oggi a {fmtMonth(a.horizon)}</dt>
          <dd className={a.forwardSimple * 100 < bench ? 'bad' : 'good'}>{pct(a.forwardSimple)}</dd>
          <dd className="sub">semplice annuo netto, contro il {benchLabel}</dd>
        </div>
        <div>
          <dt>Rendimento prossimi 12 mesi</dt>
          <dd className={a.nextYearYield * 100 < bench ? 'bad' : 'good'}>{pct(a.nextYearYield)}</dd>
          <dd className="sub">netto</dd>
        </div>
        <div>
          <dt>Guadagno dalla sottoscrizione</dt>
          <dd>{fmtEur(a.gain)}</dd>
          <dd className="sub">
            {a.sinceStartAnnual != null ? `${pct(a.sinceStartAnnual)} annuo composto` : `${pct(a.gain / a.nominalEur)} sul nominale`}
          </dd>
        </div>
        {a.maturedCount > 0 && (
          <div>
            <dt>Costo dell’attesa</dt>
            <dd className="bad">{fmtEur(a.idleCostPerMonth)}</dd>
            <dd className="sub">al mese, su {plural(a.maturedCount, 'buono scaduto', 'buoni scaduti')} fermi</dd>
          </div>
        )}
        {a.nextAccrual && (
          <div>
            <dt>Prossimo accredito interessi</dt>
            <dd>{fmtDate(a.nextAccrual)}</dd>
            <dd className="sub">se incassi, fallo subito dopo questa data</dd>
          </div>
        )}
      </dl>

      <section>
        <h2>Valore nel tempo</h2>
        <p className="muted small">
          Valore netto dei buoni, e da oggi lo stesso importo investito al {benchLabel} semplice con accredito mensile.
        </p>
        <ValueChart a={a} benchLabel={benchLabel} />
      </section>

      <section>
        <h2>Quanto rende ogni anno da qui in avanti</h2>
        <p className="muted small">
          Rendimento netto di ciascun anno, calcolato sul valore all’inizio dell’anno. Sotto la linea, i soldi renderebbero di più
          altrove.
        </p>
        <YearsChart a={a} benchLabel={benchLabel} />
      </section>

      <Strategies a={a} benchLabel={benchLabel} />

      {holdings.length > 1 && <ItemsTable a={a} bench={bench} />}

      <p className="note">
        Imposta di bollo esclusa: si applica allo stesso modo ai buoni e a un conto deposito (0,20% annuo), quindi non cambia il
        confronto. Per l’alternativa conta il rendimento netto dopo le tasse: un conto deposito al {benchLabel} lordo rende circa il{' '}
        {String((bench * 0.74).toFixed(2)).replace('.', ',')}% netto.
      </p>
    </>
  )
}

function Verdict({ a, benchLabel, single }: { a: Result; benchLabel: string; single: boolean }) {
  const cashNow = a.items.filter((it) => it.bestDate === a.today)
  const hold = a.items.filter((it) => it.bestDate !== a.today)
  const extra = a.outcome.best - a.outcome.cashNow

  let tone: 'bad' | 'good' | 'mixed'
  let text: string
  if (a.maturedCount === a.items.length) {
    tone = 'bad'
    text = `${single ? 'È scaduto e non rende più nulla' : 'Sono tutti scaduti e non rendono più nulla'}: conviene incassare subito. Ogni mese di attesa costa circa ${fmtEur(a.idleCostPerMonth)} rispetto al ${benchLabel}.`
  } else if (!hold.length) {
    tone = 'bad'
    text = `Rend${single ? 'e' : 'ono'} meno del ${benchLabel}: conviene incassar${single ? 'lo' : 'li'} ora e spostare i soldi.`
  } else if (!cashNow.length) {
    const last = hold.map((it) => it.bestDate).reduce((x, y) => (x > y ? x : y))
    tone = 'good'
    text = `Rend${single ? 'e' : 'ono'} più del ${benchLabel}: conviene tener${single ? 'lo' : 'li'}${
      hold.every((it) => it.bestDate === it.maturity) ? ' fino alla scadenza' : ` fino al ${fmtDate(last)}`
    }. Rispetto a incassar${single ? 'lo' : 'li'} ora guadagni circa ${fmtEur0(extra)} in più.`
  } else {
    tone = 'mixed'
    text = `Conviene incassare ${plural(cashNow.length, 'buono', 'buoni')} ora e tenere gli altri ${hold.length} fino alla data indicata per ciascuno. Così a ${fmtMonth(a.horizon)} avresti circa ${fmtEur0(extra)} in più che incassando tutto subito.`
  }

  return (
    <div className={`verdict ${tone}`} role="status">
      <span className="verdict-label">{tone === 'good' ? 'Tienili' : tone === 'bad' ? 'Da spostare' : 'In parte'}</span>
      <p>{text}</p>
    </div>
  )
}

function Strategies({ a, benchLabel }: { a: Result; benchLabel: string }) {
  const rows = [
    { label: 'Incassa tutto oggi', note: `e investi al ${benchLabel}`, value: a.outcome.cashNow },
    {
      label: 'Tieni tutto',
      note: a.maturedCount ? 'gli scaduti restano fermi, gli altri fino a scadenza' : 'fino a scadenza, poi al ' + benchLabel,
      value: a.outcome.holdAll,
    },
    { label: 'Strategia migliore', note: 'ogni buono incassato alla data più conveniente', value: a.outcome.best },
  ]
  const max = Math.max(...rows.map((r) => r.value))
  return (
    <section>
      <h2>Quanto avresti a {fmtMonth(a.horizon)}</h2>
      <table className="strategies">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.value >= max - 0.005 ? 'best' : undefined}>
              <th scope="row">
                {r.label}
                <span className="muted small"> {r.note}</span>
              </th>
              <td className="num">{fmtEur(r.value)}</td>
              <td className="num muted">{r.value >= max - 0.005 ? 'il più alto' : `−${fmtEur(max - r.value)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ItemsTable({ a, bench }: { a: Result; bench: number }) {
  // Merge buoni that are identical for this purpose: same series, date and advice.
  const groups = new Map<string, { items: Result['items']; now: number }>()
  for (const it of a.items) {
    const key = [it.holding.buono.serie, it.holding.buono.sottoscritto, it.bestDate].join('|')
    const g = groups.get(key) ?? { items: [], now: 0 }
    g.items.push(it)
    g.now += it.now
    groups.set(key, g)
  }
  const rows = [...groups.values()].sort((x, y) => {
    const a1 = x.items[0]
    const b1 = y.items[0]
    return a1.bestDate < b1.bestDate ? -1 : a1.bestDate > b1.bestDate ? 1 : a1.maturity < b1.maturity ? -1 : 1
  })
  return (
    <section>
      <h2>Buono per buono</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Serie</th>
              <th className="num">Quanti</th>
              <th>Sottoscritto</th>
              <th className="num">Netto oggi</th>
              <th>Scadenza</th>
              <th className="num">Rendimento a scadenza</th>
              <th>Quando incassare</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ items, now }) => {
              const it = items[0]
              const matured = a.today > it.maturity
              return (
                <tr key={it.holding.buono.id}>
                  <td><span className="stamp">{it.holding.buono.serie}</span></td>
                  <td className="num">{items.length}</td>
                  <td>{fmtDate(it.holding.buono.sottoscritto)}</td>
                  <td className="num">{fmtEur(now)}</td>
                  <td>{fmtDate(it.maturity)}</td>
                  <td className={`num ${matured || it.forwardSimple * 100 < bench ? 'bad' : 'good'}`}>
                    {matured ? 'scaduto' : pct(it.forwardSimple)}
                  </td>
                  <td>{it.bestDate === a.today ? <strong>Ora</strong> : it.bestDate === it.maturity ? `A scadenza` : `Dopo il ${fmtDate(it.bestDate)}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ---------- charts ---------- */

const W = 760
const H = 280
const PAD = { l: 72, r: 16, t: 16, b: 30 }
const t = (d: string) => Date.parse(d + 'T00:00:00Z')

function useHover() {
  const [x, setX] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current
    if (!svg) return
    const box = svg.getBoundingClientRect()
    setX(((e.clientX - box.left) / box.width) * W)
  }
  return { x, ref, onMove, onLeave: () => setX(null) }
}

function ValueChart({ a, benchLabel }: { a: Result; benchLabel: string }) {
  const { x: hoverX, ref: svgRef, onMove, onLeave } = useHover()
  const t0 = t(a.history[0].date)
  const t1 = t(a.horizon)
  const vals = [...a.history.map((p) => p.value), ...a.benchmarkPath.map((p) => p.value)]
  const vmin = Math.min(...vals)
  const vmax = Math.max(...vals)
  const x = (d: string) => PAD.l + ((t(d) - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - ((v - vmin) / (vmax - vmin || 1)) * (H - PAD.t - PAD.b)
  // Step line: value only changes when interest is credited.
  const step = a.history
    .map((p, i) => (i === 0 ? `M${x(p.date)},${y(p.value)}` : `H${x(p.date)}V${y(p.value)}`))
    .join('')
  const bench = a.benchmarkPath.map((p, i) => `${i ? 'L' : 'M'}${x(p.date)},${y(p.value)}`).join('')

  const ticks = [vmin, (vmin + vmax) / 2, vmax]
  const y0 = new Date(t0).getUTCFullYear()
  const y1 = new Date(t1).getUTCFullYear()
  const every = Math.max(1, Math.ceil((y1 - y0) / 8))
  const years = []
  for (let yr = Math.ceil(y0 / every) * every; yr <= y1; yr += every) years.push(yr)

  // Hover: nearest month on each series.
  let tip: { date: string; value: number; bench?: number } | null = null
  if (hoverX != null && hoverX >= PAD.l) {
    const tt = t0 + ((hoverX - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0)
    const nearest = <P extends { date: string }>(ps: P[]) =>
      ps.reduce((best, p) => (Math.abs(t(p.date) - tt) < Math.abs(t(best.date) - tt) ? p : best))
    const h = nearest(a.history)
    const b = a.benchmarkPath.length && tt >= t(a.today) ? nearest(a.benchmarkPath) : undefined
    tip = { date: h.date, value: h.value, bench: b?.value }
  }

  return (
    <div className="chart">
      <div className="legend" aria-hidden="true">
        <span><i className="key s1" /> Buoni</span>
        <span><i className="key s2" /> Alternativa al {benchLabel}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Valore netto dei buoni nel tempo, da ${fmtEur0(a.history[0].value)} a ${fmtEur0(a.history[a.history.length - 1].value)}, confrontato con l'alternativa al ${benchLabel}`}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="tick">{fmtEur0(v)}</text>
          </g>
        ))}
        {years.map((yr) => {
          const d = `${yr}-01-01`
          if (t(d) < t0 || t(d) > t1) return null
          return <text key={yr} x={x(d)} y={H - 10} textAnchor="middle" className="tick">{yr}</text>
        })}
        <line x1={x(a.today)} x2={x(a.today)} y1={PAD.t} y2={H - PAD.b} className="today" />
        <text x={x(a.today) + 4} y={PAD.t + 10} className="tick">oggi</text>
        <path d={bench} className="line s2" />
        <path d={step} className="line s1" />
        {a.items.length === 1 && a.items[0].bestDate !== a.today && (
          <circle cx={x(a.items[0].bestDate)} cy={y(a.items[0].atMaturity)} r={5} className="dot s1" />
        )}
        {tip && <line x1={x(tip.date)} x2={x(tip.date)} y1={PAD.t} y2={H - PAD.b} className="crosshair" />}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: `${(x(tip.date) / W) * 100}%` }}>
          <div className="muted small">{fmtMonth(tip.date)}</div>
          <div><i className="key s1" /> <strong>{fmtEur(tip.value)}</strong> <span className="muted small">buoni</span></div>
          {tip.bench != null && (
            <div><i className="key s2" /> <strong>{fmtEur(tip.bench)}</strong> <span className="muted small">alternativa</span></div>
          )}
        </div>
      )}
      <details className="small">
        <summary>Mostra i dati</summary>
        <table className="data">
          <thead>
            <tr><th>Anno</th><th className="num">Buoni</th><th className="num">Alternativa</th></tr>
          </thead>
          <tbody>
            {a.history
              .filter((_, i) => i % 12 === 0 || i === a.history.length - 1)
              .map((p) => {
                const b = a.benchmarkPath.find((q) => q.date.slice(0, 7) === p.date.slice(0, 7))
                return (
                  <tr key={p.date}>
                    <td>{fmtMonth(p.date)}</td>
                    <td className="num">{fmtEur(p.value)}</td>
                    <td className="num">{b ? fmtEur(b.value) : '—'}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function YearsChart({ a, benchLabel }: { a: Result; benchLabel: string }) {
  const [active, setActive] = useState<number | null>(null)
  const H2 = 200
  const rates = a.years.map((y) => y.rate)
  const top = Math.max(a.benchmark * 1.4, ...rates, 0.01)
  const bw = (W - PAD.l - PAD.r) / Math.max(1, a.years.length)
  const y = (v: number) => H2 - PAD.b - (v / top) * (H2 - PAD.t - PAD.b)
  const ticks = [0, a.benchmark, top].filter((v, i, arr) => arr.indexOf(v) === i)

  if (!a.years.length) return null

  return (
    <div className="chart">
      <div className="legend" aria-hidden="true">
        <span><i className="key s1 box" /> Rendimento dei buoni nell’anno</span>
        <span><i className="key s2" /> {benchLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H2}`} width="100%" role="img" aria-label="Rendimento netto per anno da oggi alla scadenza, confrontato con l'alternativa">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="tick">{fmtPct(v)}</text>
          </g>
        ))}
        {a.years.map((yr, i) => {
          const h = Math.max(0, H2 - PAD.b - y(yr.rate))
          const bx = PAD.l + i * bw
          const w = Math.max(2, Math.min(48, bw - 4))
          const cx = bx + (bw - w) / 2
          return (
            <g
              key={yr.from}
              tabIndex={0}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect x={bx} y={PAD.t} width={bw} height={H2 - PAD.t - PAD.b} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${cx},${H2 - PAD.b}V${H2 - PAD.b - h + 4}a4,4 0 0 1 4,-4H${cx + w - 4}a4,4 0 0 1 4,4V${H2 - PAD.b}Z`}
                  className={`bar s1${active === i ? ' active' : ''}`}
                />
              )}
              {(a.years.length <= 12 || i % Math.ceil(a.years.length / 12) === 0) && (
                <text x={bx + bw / 2} y={H2 - 10} textAnchor="middle" className="tick">{yr.from.slice(0, 4)}</text>
              )}
            </g>
          )
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(a.benchmark)} y2={y(a.benchmark)} className="line s2" />
      </svg>
      {active != null && (
        <div className="tooltip" style={{ left: `${((PAD.l + (active + 0.5) * bw) / W) * 100}%` }}>
          <div className="muted small">{fmtDate(a.years[active].from)} – {fmtDate(a.years[active].to)}</div>
          <div><strong>{fmtPct(a.years[active].rate)}</strong> <span className="muted small">netto annuo</span></div>
        </div>
      )}
    </div>
  )
}

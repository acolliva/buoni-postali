import { useMemo, useRef, useState } from 'react'
import { todayIso } from '../domain/dates'
import { assess, type Assessment, type Status } from '../domain/engine'
import type { Buono, ImportWarning } from '../domain/types'
import { fmtDate, fmtEur, fmtEur0, fmtLire, fmtPct } from '../format'
import { readWorkbook } from '../import/readWorkbook'
import { DEFAULT_SETTINGS, useStored, type Settings } from '../state/storage'
import { MaturityStrip } from './MaturityStrip'

const STATUS_LABEL: Record<Status, string> = {
  'in-corso': 'In corso',
  'in-scadenza': 'In scadenza',
  scaduto: 'Scaduto, non rende',
  'prescrizione-vicina': 'Prescrizione vicina',
  prescritto: 'Prescritto',
  'serie-sconosciuta': 'Serie da configurare',
}

const STATUS_ORDER: Status[] = ['prescrizione-vicina', 'prescritto', 'scaduto', 'in-scadenza', 'in-corso', 'serie-sconosciuta']

interface Group {
  key: string
  items: Assessment[]
  first: Assessment
  net: number
}

function groupBySeries(list: Assessment[]): Group[] {
  const map = new Map<string, Assessment[]>()
  for (const a of list) map.set(a.buono.serie, [...(map.get(a.buono.serie) ?? []), a])
  return [...map.entries()]
    .map(([key, items]) => {
      items.sort((x, y) => (x.maturity! < y.maturity! ? -1 : 1))
      return { key, items, first: items[0], net: items.reduce((s, a) => s + (a.now?.net ?? 0), 0) }
    })
    .sort((x, y) => (x.first.maturity! < y.first.maturity! ? -1 : 1))
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function Portfolio() {
  const [buoni, setBuoni] = useStored<Buono[]>('bp.buoni', [])
  const [settings, setSettings] = useStored<Settings>('bp.settings', DEFAULT_SETTINGS)
  const [warnings, setWarnings] = useState<ImportWarning[]>([])
  const [error, setError] = useState<string | null>(null)
  const today = todayIso()

  const assessed = useMemo(
    () => buoni.map((b) => assess(b, { today, ...settings })),
    [buoni, settings, today],
  )

  async function importFile(file: File) {
    setError(null)
    try {
      const result = await readWorkbook(await file.arrayBuffer())
      if (!result.buoni.length) {
        setError('Nel file non c’è nessuna riga riconoscibile. Serve una riga di intestazione con serie, sottoscritto e valore.')
        return
      }
      setBuoni(result.buoni)
      setWarnings(result.warnings)
    } catch {
      setError('Il file non si apre come foglio Excel (.xlsx). Salvalo in formato .xlsx e riprova.')
    }
  }

  if (!buoni.length) return <ImportZone onFile={importFile} error={error} />

  const known = assessed.filter((a) => a.rule)
  const unknown = assessed.filter((a) => !a.rule)
  const totalNet = known.reduce((s, a) => s + (a.now?.net ?? 0), 0)
  const outside = known.filter((a) => a.outsideIssueWindow)
  const reclassified = known.filter((a) => a.reclassifiedFrom)
  const idle = known.filter((a) => a.status === 'scaduto' || a.status === 'prescrizione-vicina')
  const idleNet = idle.reduce((s, a) => s + (a.now?.net ?? 0), 0)

  return (
    <>
      <h1>
        Oggi {buoni.length === 1 ? 'il tuo buono vale' : `i tuoi ${buoni.length} buoni valgono`} circa{' '}
        <strong>{fmtEur0(totalNet)}</strong> netti.
        {idle.length > 0 && (
          <>
            {' '}
            {plural(idle.length, 'è scaduto', 'sono scaduti')} e non {idle.length === 1 ? 'rende' : 'rendono'} più:{' '}
            <strong>{fmtEur0(idleNet)}</strong> da incassare.
          </>
        )}
      </h1>
      <p className="lede">
        Valori calcolati al {fmtDate(today)} dalle regole di ogni serie, al netto della ritenuta del 12,5%. Imposta di
        bollo (0,20% annuo oltre 5.000 € di buoni) esclusa.
        {unknown.length > 0 && ` ${plural(unknown.length, 'buono ha', 'buoni hanno')} una serie non ancora configurata ed è esclusa dai totali.`}
      </p>

      {(warnings.length > 0 || outside.length > 0 || reclassified.length > 0) && (
        <div className="warnings" role="status">
          <strong>Da controllare nel file</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w.row + w.message}>
                Riga {w.row}: {w.message}
              </li>
            ))}
            {outside.map((a) => (
              <li key={a.buono.id}>
                Serie {a.buono.serie} sottoscritta il {fmtDate(a.buono.sottoscritto)}: fuori dal periodo di emissione della serie
                ({fmtDate(a.rule!.issueFrom)} – {fmtDate(a.rule!.issueTo)}). Controlla serie e data sul buono.
              </li>
            ))}
            {groupBySeries(reclassified).map((g) => {
              const dates = [...new Set(g.items.map((a) => fmtDate(a.buono.sottoscritto)))].join(', ')
              const to = g.first.rule!.codes[0]
              return (
                <li key={g.key}>
                  {plural(g.items.length, 'buono', 'buoni')} serie {g.key} sottoscritt{g.items.length === 1 ? 'o' : 'i'} il {dates}, dopo
                  la chiusura della serie: i moduli emessi dopo quella data valgono come serie {to}, quindi li calcolo con le regole
                  della serie {to}. Verifica il timbro sul buono.
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ActionList assessed={known} settings={settings} />

      <section>
        <h2>Quando scadono</h2>
        <p className="muted small">Valore netto a scadenza, per anno. Gli anni passati sono buoni scaduti ancora da incassare.</p>
        <MaturityStrip assessed={known} today={today} />
      </section>

      <BuoniTable assessed={assessed} />

      <section>
        <h2>Impostazioni</h2>
        <div className="filters">
          <SettingField label="In scadenza entro (mesi)" value={settings.soonMonths} onChange={(v) => setSettings({ ...settings, soonMonths: v })} />
          <SettingField label="Avviso prescrizione (mesi prima)" value={settings.prescriptionWarnMonths} onChange={(v) => setSettings({ ...settings, prescriptionWarnMonths: v })} />
          <SettingField label="Rendimento di confronto (% netto annuo)" step={0.1} value={settings.benchmarkPct} onChange={(v) => setSettings({ ...settings, benchmarkPct: v })} />
        </div>
        <div className="filters">
          <label className="btn ghost">
            Importa un altro file
            <input type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm('Rimuovere tutti i buoni da questo browser?')) {
                setBuoni([])
                setWarnings([])
              }
            }}
          >
            Rimuovi i dati
          </button>
        </div>
        {error && <p className="status scaduto">{error}</p>}
      </section>
    </>
  )
}

function SettingField(props: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  const id = props.label.replace(/\W+/g, '-')
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input id={id} type="number" min={0} step={props.step ?? 1} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </div>
  )
}

function ImportZone({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <h1>Carica il foglio dei tuoi buoni per vedere quanto valgono oggi e cosa incassare.</h1>
      <p className="lede">
        Serve un file .xlsx con una riga di intestazione che contenga serie, numero, sottoscritto e valore. I buoni in lire
        possono stare in un blocco separato preceduto dalla riga “Lire”. Il file resta sul tuo computer.
      </p>
      <div
        className={`drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
      >
        <p>Trascina qui il file, oppure</p>
        <button className="btn" onClick={() => input.current?.click()}>
          Scegli il file
        </button>
        <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {error && <p className="status scaduto">{error}</p>}
      </div>
    </>
  )
}

function ActionList({ assessed, settings }: { assessed: Assessment[]; settings: Settings }) {
  const pick = (f: (a: Assessment) => boolean) => groupBySeries(assessed.filter(f))
  const urgent = pick((a) => a.status === 'prescrizione-vicina' || a.status === 'prescritto')
  const late = pick((a) => a.status === 'scaduto')
  const soon = pick((a) => a.status === 'in-scadenza')
  const weak = pick((a) => a.belowBenchmark)

  if (!urgent.length && !late.length && !soon.length && !weak.length) {
    return (
      <section>
        <h2>Da fare</h2>
        <p className="muted">Niente da fare per ora: nessun buono è scaduto o in scadenza nei prossimi {settings.soonMonths} mesi.</p>
      </section>
    )
  }

  const range = (g: Group, key: 'maturity' | 'prescription') => {
    const dates = [...new Set(g.items.map((a) => a[key]!))].sort()
    return dates.length === 1 ? `il ${fmtDate(dates[0])}` : `tra il ${fmtDate(dates[0])} e il ${fmtDate(dates[dates.length - 1])}`
  }
  const one = (g: Group) => g.items.length === 1
  const bench = String(settings.benchmarkPct).replace('.', ',')

  return (
    <section>
      <h2>Da fare</h2>
      <ul className="actions">
        {urgent.map((g) => (
          <ActionRow key={'u' + g.key} g={g} tone="urgent">
            {g.first.status === 'prescritto'
              ? `Prescritt${one(g) ? 'o' : 'i'} ${range(g, 'prescription')}: verifica con Poste se è ancora possibile il rimborso.`
              : `Da incassare prima della prescrizione, ${range(g, 'prescription')}. Dopo non si recupera nulla, né capitale né interessi.`}
          </ActionRow>
        ))}
        {late.map((g) => (
          <ActionRow key={'l' + g.key} g={g} tone="late">
            {one(g) ? 'Scaduto' : 'Scaduti'} {range(g, 'maturity')}: non {one(g) ? 'matura' : 'maturano'} più interessi.
            {' '}Prescrizione {range(g, 'prescription')}.
          </ActionRow>
        ))}
        {soon.map((g) => (
          <ActionRow key={'s' + g.key} g={g} tone="soon">
            {one(g) ? 'Scade' : 'Scadono'} {range(g, 'maturity')}.
          </ActionRow>
        ))}
        {weak.map((g) => (
          <ActionRow key={'w' + g.key} g={g} tone="weak">
            Nei prossimi 12 mesi {one(g) ? 'rende' : 'rendono'} {fmtPct(g.first.nextYearYield!)} netto, meno del {bench}% di
            confronto. Scadenza {range(g, 'maturity')}.
          </ActionRow>
        ))}
      </ul>
    </section>
  )
}

function ActionRow({ g, tone, children }: { g: Group; tone: string; children: React.ReactNode }) {
  const b = g.first.buono
  const nominal = g.items.reduce((s, a) => s + a.buono.nominale, 0)
  const fmtNom = (n: number) => (b.valuta === 'ITL' ? fmtLire(n) : fmtEur0(n))
  const byDate = new Map<string, Assessment[]>()
  for (const a of g.items) byDate.set(a.buono.sottoscritto, [...(byDate.get(a.buono.sottoscritto) ?? []), a])
  return (
    <li className={`action ${tone}`}>
      <span className="stamp">{b.serie}</span>
      <div>
        <div>{children}</div>
        {g.items.length === 1 ? (
          <div className="muted small">
            1 buono sottoscritto il {fmtDate(b.sottoscritto)}, nominale {fmtNom(nominal)}
          </div>
        ) : (
          <details className="muted small">
            <summary>
              {g.items.length} buoni, nominale {fmtNom(nominal)}
            </summary>
            <ul className="detail-list">
              {[...byDate.entries()].map(([date, items]) => (
                <li key={date}>
                  {items.length} × sottoscritt{items.length === 1 ? 'o' : 'i'} il {fmtDate(date)}, nominale{' '}
                  {fmtNom(items.reduce((s, a) => s + a.buono.nominale, 0))}:{' '}
                  {fmtEur(items.reduce((s, a) => s + (a.now?.net ?? 0), 0))}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <span className="amount">{fmtEur(g.net)}</span>
    </li>
  )
}

type SortKey = 'serie' | 'sottoscritto' | 'maturity' | 'now' | 'atMaturity'

function BuoniTable({ assessed }: { assessed: Assessment[] }) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'maturity', dir: 1 })

  const counts = new Map<Status, number>()
  for (const a of assessed) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)

  const value = (a: Assessment): string | number => {
    switch (sort.key) {
      case 'serie': return a.buono.serie
      case 'sottoscritto': return a.buono.sottoscritto
      case 'maturity': return a.maturity ?? '9999'
      case 'now': return a.now?.net ?? -1
      case 'atMaturity': return a.atMaturity?.net ?? -1
    }
  }
  const rows = assessed
    .filter((a) => filter === 'all' || a.status === filter)
    .sort((x, y) => (value(x) < value(y) ? -sort.dir : value(x) > value(y) ? sort.dir : 0))

  const header = (key: SortKey, label: string, num = false) => (
    <th className={num ? 'num' : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => setSort({ key, dir: sort.key === key ? (-sort.dir as 1 | -1) : 1 })}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <section>
      <h2>Tutti i buoni</h2>
      <div className="filters" role="group" aria-label="Filtra per stato">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Tutti ({assessed.length})
        </button>
        {STATUS_ORDER.filter((s) => counts.get(s)).map((s) => (
          <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} ({counts.get(s)})
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {header('serie', 'Serie')}
              <th>Numero</th>
              {header('sottoscritto', 'Sottoscritto')}
              <th className="num">Nominale</th>
              {header('now', 'Netto oggi', true)}
              {header('maturity', 'Scadenza')}
              {header('atMaturity', 'Netto a scadenza', true)}
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.buono.id}>
                <td><span className="stamp">{a.buono.serie}</span></td>
                <td className="muted">{a.buono.numero ?? '—'}</td>
                <td>{fmtDate(a.buono.sottoscritto)}</td>
                <td className="num">{a.buono.valuta === 'ITL' ? fmtLire(a.buono.nominale) : fmtEur(a.buono.nominale)}</td>
                <td className="num">{a.now ? fmtEur(a.now.net) : '—'}</td>
                <td>{a.maturity ? fmtDate(a.maturity) : '—'}</td>
                <td className="num">{a.atMaturity ? fmtEur(a.atMaturity.net) : '—'}</td>
                <td><span className={`status ${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

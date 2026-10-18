import type { Assessment } from '../domain/engine'
import { fmtEur0 } from '../format'

/** One column per maturity year, height = net value at maturity. */
export function MaturityStrip({ assessed, today }: { assessed: Assessment[]; today: string }) {
  const byYear = new Map<number, number>()
  for (const a of assessed) {
    if (!a.maturity || !a.atMaturity || a.status === 'prescritto') continue
    const y = Number(a.maturity.slice(0, 4))
    byYear.set(y, (byYear.get(y) ?? 0) + a.atMaturity.net)
  }
  if (!byYear.size) return <p className="muted">Nessuna scadenza da mostrare.</p>

  const years = [...byYear.keys()]
  const from = Math.min(...years)
  const to = Math.max(...years)
  const thisYear = Number(today.slice(0, 4))
  const max = Math.max(...byYear.values())

  const colW = 44
  const h = 160
  const top = 22
  const width = (to - from + 1) * colW

  return (
    <div className="strip">
      <svg width={width} height={h + 40} role="img" aria-label="Valore netto a scadenza per anno">
        {Array.from({ length: to - from + 1 }, (_, i) => {
          const year = from + i
          const v = byYear.get(year) ?? 0
          const bh = v ? Math.max(3, (v / max) * (h - top)) : 0
          const x = i * colW
          const past = year < thisYear
          const current = year === thisYear
          const color = past ? 'var(--late)' : current ? 'var(--soon)' : 'var(--accent)'
          return (
            <g key={year}>
              <title>{`${year}: ${fmtEur0(v)}`}</title>
              {v > 0 && <rect x={x + 8} y={h - bh} width={colW - 16} height={bh} rx={2} fill={color} />}
              {v > 0 && (
                <text x={x + colW / 2} y={h - bh - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                  {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
                </text>
              )}
              <line x1={x} x2={x + colW} y1={h + 0.5} y2={h + 0.5} stroke="var(--rule)" />
              <text
                x={x + colW / 2}
                y={h + 18}
                textAnchor="middle"
                fontSize="11"
                fontWeight={current ? 700 : 400}
                fill={current ? 'var(--ink)' : 'var(--muted)'}
              >
                {`’${String(year).slice(2)}`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

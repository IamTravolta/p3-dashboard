'use client'

import { useState } from 'react'
import { Grid3x3, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface CorrelationData {
  tickers: string[]
  matrix:  number[][]
}

function cellStyle(val: number): React.CSSProperties {
  if (val >= 0.7)  return { background: 'var(--success-bg)', color: 'var(--success-text)' }
  if (val >= 0.4)  return { background: '#0d2b1a', color: 'var(--success-text)', opacity: 0.8 }
  if (val >= 0.1)  return { background: 'var(--surface)', color: 'var(--text-secondary)' }
  if (val >= -0.1) return { background: 'var(--bg)', color: 'var(--text-tertiary)' }
  if (val >= -0.4) return { background: '#1a0d0d', color: 'var(--danger-text)', opacity: 0.8 }
  if (val >= -0.7) return { background: 'var(--danger-bg)', color: 'var(--danger-text)' }
  return { background: '#4a1010', color: 'var(--danger-text)' }
}

export default function CorrelationsView() {
  const [data,    setData]    = useState<CorrelationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const positions  = useDashboardStore((s) => s.positions)
  const watchlist  = useDashboardStore((s) => s.watchlist)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const tickers = [
    ...positions.map((p) => p.ticker),
    ...watchlist.map((w) => w.ticker),
  ].filter(Boolean)

  const sectors = [...new Set(positions.map((p) => p.sector).filter(Boolean))]

  async function calculate() {
    if (!tickers.length) { setError('Add positions or watchlist items first.'); return }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('tickers', tickers.join(','))
      if (sectors.length) params.set('sectors', sectors.join(','))

      const res  = await fetch(`/api/railway/correlations?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)

      // Accept { tickers, matrix } or flat 2D array
      if (json.tickers && json.matrix) {
        setData(json)
      } else if (Array.isArray(json)) {
        setData({ tickers, matrix: json })
      } else {
        throw new Error('Unexpected response format.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to calculate correlations.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>⟡ Correlations Analysis</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.7 }}>Claude AI reasoning · news events → portfolio impact · 4 domains</div>
          </div>
          <button onClick={calculate} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Grid3x3 size={13} />
            {loading ? 'Calculating…' : 'Calculate'}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--purple-text)', lineHeight: 1.6 }}>System scans news in 4 domains (energy, commodities, tech, geopolitics), filters significant events and sends to Claude AI for reasoning.</div>
        </div>
      </div>

      {/* Backend not configured */}
      {!railwayUrl && (
        <div className="flex items-center gap-2 rounded-xl p-4 text-sm" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
          <AlertTriangle size={15} className="shrink-0" />
          Backend not configured — add your Railway URL in Settings.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="surface p-8 flex items-center justify-center">
          <div className="text-center">
            <Grid3x3 size={24} className="mx-auto mb-3 animate-pulse" style={{ color: 'var(--teal-text)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Computing correlation matrix…</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="surface p-10 text-center">
          <Grid3x3 size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No correlation data yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click &ldquo;Calculate&rdquo; to compute position correlations.</p>
        </div>
      )}

      {/* Legend + Matrix */}
      {!loading && data && (
        <>
          <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>Legend:</span>
            {[
              { label: 'Strong +', style: { background: 'var(--success-bg)', color: 'var(--success-text)' } },
              { label: 'Mild +',   style: { background: '#0d2b1a', color: 'var(--success-text)', opacity: 0.8 } },
              { label: 'Neutral',  style: { background: 'var(--surface)', color: 'var(--text-secondary)' } },
              { label: 'Mild −',   style: { background: '#1a0d0d', color: 'var(--danger-text)', opacity: 0.8 } },
              { label: 'Strong −', style: { background: 'var(--danger-bg)', color: 'var(--danger-text)' } },
            ].map((l) => (
              <span key={l.label} className="rounded px-2 py-0.5" style={l.style}>{l.label}</span>
            ))}
          </div>

          {/* Matrix */}
          <div className="overflow-auto surface">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr>
                  <th className="p-2 min-w-[60px]" style={{ borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', background: 'var(--bg)' }} />
                  {data.tickers.map((t) => (
                    <th key={t} className="p-2 font-semibold min-w-[64px] text-center" style={{ borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="p-2 font-semibold text-center" style={{ borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
                      {data.tickers[ri]}
                    </td>
                    {row.map((val, ci) => (
                      <td
                        key={ci}
                        className="p-2 text-center font-mono tabular-nums"
                        style={{ borderBottom: '0.5px solid var(--border)', borderRight: '0.5px solid var(--border)', ...cellStyle(val) }}
                        title={`${data.tickers[ri]} / ${data.tickers[ci]}: ${val.toFixed(3)}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Values range from −1 (perfectly inverse) to +1 (perfectly correlated). Diagonal is always 1.
          </p>
        </>
      )}
    </div>
  )
}

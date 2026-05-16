'use client'

import { useState } from 'react'
import { Grid3x3, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface CorrelationData {
  tickers: string[]
  matrix:  number[][]
}

function cellColor(val: number): string {
  if (val >= 0.7)  return 'bg-emerald-900 text-emerald-300'
  if (val >= 0.4)  return 'bg-emerald-950 text-emerald-400'
  if (val >= 0.1)  return 'bg-zinc-800 text-zinc-400'
  if (val >= -0.1) return 'bg-zinc-900 text-zinc-500'
  if (val >= -0.4) return 'bg-red-950 text-red-500'
  if (val >= -0.7) return 'bg-red-900/60 text-red-400'
  return 'bg-red-900 text-red-300'
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Correlations</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Understand how your positions move together</p>
        </div>
        <button
          onClick={calculate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Grid3x3 size={13} />
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </div>

      {/* Backend not configured */}
      {!railwayUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-800/50 bg-amber-900/20 p-4 text-sm text-amber-400">
          <AlertTriangle size={15} className="shrink-0" />
          Backend not configured — add your Railway URL in Settings.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 flex items-center justify-center">
          <div className="text-center">
            <Grid3x3 size={24} className="mx-auto mb-3 text-indigo-400 animate-pulse" />
            <p className="text-sm text-zinc-500">Computing correlation matrix…</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Grid3x3 size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No correlation data yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Click &ldquo;Calculate&rdquo; to compute position correlations.</p>
        </div>
      )}

      {/* Legend */}
      {!loading && data && (
        <>
          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500">
            <span>Legend:</span>
            {[
              { label: 'Strong +', cls: 'bg-emerald-900 text-emerald-300' },
              { label: 'Mild +',   cls: 'bg-emerald-950 text-emerald-400' },
              { label: 'Neutral',  cls: 'bg-zinc-800 text-zinc-400' },
              { label: 'Mild −',   cls: 'bg-red-950 text-red-500' },
              { label: 'Strong −', cls: 'bg-red-900 text-red-300' },
            ].map((l) => (
              <span key={l.label} className={`rounded px-2 py-0.5 ${l.cls}`}>{l.label}</span>
            ))}
          </div>

          {/* Matrix */}
          <div className="overflow-auto rounded-xl border border-zinc-800">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="p-2 bg-zinc-900/80 border-b border-r border-zinc-800 min-w-[60px]" />
                  {data.tickers.map((t) => (
                    <th key={t} className="p-2 bg-zinc-900/80 border-b border-r border-zinc-800 text-zinc-400 font-semibold min-w-[64px] text-center">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, ri) => (
                  <tr key={ri}>
                    <td className="p-2 bg-zinc-900/60 border-b border-r border-zinc-800 font-semibold text-zinc-300 text-center">
                      {data.tickers[ri]}
                    </td>
                    {row.map((val, ci) => (
                      <td
                        key={ci}
                        className={`p-2 border-b border-r border-zinc-800 text-center font-mono tabular-nums ${cellColor(val)}`}
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

          <p className="text-xs text-zinc-600">
            Values range from −1 (perfectly inverse) to +1 (perfectly correlated). Diagonal is always 1.
          </p>
        </>
      )}
    </div>
  )
}

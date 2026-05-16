'use client'

import { useState } from 'react'
import { Building2, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface Holder {
  name:  string
  pct:   number
  change: number
}

interface TickerSmartMoney {
  ticker:              string
  institutionalPct:    number
  netChange:           number
  signal:              'BUY' | 'NEUTRAL' | 'SELL'
  topHolders:          Holder[]
}

const signalStyles: Record<string, string> = {
  BUY:     'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50',
  NEUTRAL: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  SELL:    'bg-red-900/30 text-red-400 border border-red-800/50',
}

function overallSignal(rows: TickerSmartMoney[]): { label: string; color: string } {
  const buys  = rows.filter((r) => r.signal === 'BUY').length
  const sells = rows.filter((r) => r.signal === 'SELL').length
  if (buys > sells * 1.5) return { label: 'BULLISH', color: 'text-emerald-400' }
  if (sells > buys * 1.5) return { label: 'BEARISH', color: 'text-red-400' }
  return { label: 'NEUTRAL', color: 'text-zinc-400' }
}

export default function SmartMoneyView() {
  const [results, setResults] = useState<TickerSmartMoney[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const positions  = useDashboardStore((s) => s.positions)
  const watchlist  = useDashboardStore((s) => s.watchlist)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const tickers = [
    ...positions.map((p) => p.ticker),
    ...watchlist.map((w) => w.ticker),
  ].filter(Boolean).join(',')

  async function analyze() {
    if (!tickers) { setError('Add positions or watchlist items first.'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/railway/smartmoney/aggregate?tickers=${encodeURIComponent(tickers)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)
      setResults(Array.isArray(json) ? json : json.data ?? json.results ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch smart money data.')
    } finally {
      setLoading(false)
    }
  }

  const summary = results.length > 0 ? overallSignal(results) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Smart Money</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Institutional ownership and hedge fund activity</p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Building2 size={13} />
          {loading ? 'Analyzing…' : 'Analyze Smart Money'}
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-16 rounded bg-zinc-800" />
                <div className="h-5 w-14 rounded-full bg-zinc-800" />
              </div>
              <div className="h-3 w-full rounded bg-zinc-800/60" />
              <div className="h-3 w-3/4 rounded bg-zinc-800/60" />
              <div className="space-y-1.5 pt-2">
                {[0, 1, 2].map((j) => <div key={j} className="h-2.5 w-full rounded bg-zinc-800/40" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Building2 size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No smart money data loaded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Click &ldquo;Analyze Smart Money&rdquo; to fetch institutional activity.</p>
        </div>
      )}

      {/* Summary */}
      {!loading && summary && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex items-center gap-4">
          <Building2 size={18} className="text-indigo-400" />
          <div>
            <p className="text-xs text-zinc-500">Portfolio Smart Money Signal</p>
            <p className={`text-lg font-bold mt-0.5 ${summary.color}`}>{summary.label}</p>
          </div>
          <div className="ml-auto text-xs text-zinc-600">{results.length} tickers analyzed</div>
        </div>
      )}

      {/* Cards */}
      {!loading && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <div key={item.ticker} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">{item.ticker}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${signalStyles[item.signal] ?? signalStyles.NEUTRAL}`}>
                  {item.signal}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-zinc-800/50 p-2">
                  <p className="text-xs text-zinc-500">Inst. Ownership</p>
                  <p className="text-lg font-bold text-white mt-0.5">{item.institutionalPct?.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-2">
                  <p className="text-xs text-zinc-500">Net Change</p>
                  <p className={`text-lg font-bold mt-0.5 ${item.netChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.netChange >= 0 ? '+' : ''}{item.netChange?.toFixed(1)}%
                  </p>
                </div>
              </div>

              {item.topHolders?.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-2">Top Holders</p>
                  <div className="space-y-1.5">
                    {item.topHolders.slice(0, 4).map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 truncate max-w-[60%]">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300 font-mono">{h.pct?.toFixed(1)}%</span>
                          <span className={h.change >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {h.change >= 0 ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface Mover {
  ticker:   string
  name:     string
  weekPct:  number
  signal:   string
  category: string
}

function signalPill(signal: string) {
  const s = signal?.toUpperCase()
  if (s === 'STRONG_BUY' || s === 'BUY')   return 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
  if (s === 'STRONG_SELL' || s === 'SELL')  return 'bg-red-900/40 text-red-400 border border-red-800/50'
  return 'bg-zinc-800 text-zinc-400 border border-zinc-700'
}

export default function MomentumView() {
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers,  setLosers]  = useState<Mover[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const positions  = useDashboardStore((s) => s.positions)
  const watchlist  = useDashboardStore((s) => s.watchlist)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const myTickers = new Set([
    ...positions.map((p) => p.ticker),
    ...watchlist.map((w) => w.ticker),
  ])

  async function fetch_() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/railway/weekly-movers')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)

      const all: Mover[] = Array.isArray(json) ? json : json.movers ?? json.data ?? []
      const sorted = [...all].sort((a, b) => b.weekPct - a.weekPct)
      setGainers(sorted.filter((m) => m.weekPct >= 0).slice(0, 15))
      setLosers(sorted.filter((m) => m.weekPct < 0).reverse().slice(0, 15))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch momentum data.')
    } finally {
      setLoading(false)
    }
  }

  function MoverTable({ rows, title, positive }: { rows: Mover[]; title: string; positive: boolean }) {
    return (
      <div>
        <h3 className={`text-sm font-semibold mb-2 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{title}</h3>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {['Ticker', 'Name', 'Week %', 'Signal', 'Category'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const inPortfolio = myTickers.has(m.ticker)
                return (
                  <tr
                    key={i}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition ${inPortfolio ? 'bg-indigo-950/20' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{m.ticker}</span>
                        {inPortfolio && (
                          <span className="text-[10px] rounded-full px-1.5 py-px bg-indigo-900/50 text-indigo-400 border border-indigo-800/50">
                            MINE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 max-w-[160px] truncate">{m.name}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${m.weekPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.weekPct >= 0 ? '+' : ''}{m.weekPct?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${signalPill(m.signal)}`}>
                        {m.signal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{m.category}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Weekly Momentum</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Top movers and momentum signals</p>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <TrendingUp size={13} />
          {loading ? 'Fetching…' : 'Fetch Momentum'}
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
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="h-64 rounded-xl bg-zinc-800/40" />
          <div className="h-4 w-24 rounded bg-zinc-800" />
          <div className="h-64 rounded-xl bg-zinc-800/40" />
        </div>
      )}

      {/* Empty state */}
      {!loading && gainers.length === 0 && losers.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <TrendingUp size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No momentum data loaded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Click &ldquo;Fetch Momentum&rdquo; to see weekly top movers.
          </p>
          {myTickers.size > 0 && (
            <p className="text-xs text-indigo-500 mt-2">
              Your tickers will be highlighted <span className="bg-indigo-900/50 border border-indigo-800/50 rounded-full px-1.5 py-px text-indigo-400">MINE</span> in the results.
            </p>
          )}
        </div>
      )}

      {/* Tables */}
      {!loading && (gainers.length > 0 || losers.length > 0) && (
        <div className="space-y-6">
          {gainers.length > 0 && <MoverTable rows={gainers} title="Top Gainers" positive={true} />}
          {losers.length > 0  && <MoverTable rows={losers}  title="Top Losers"  positive={false} />}
        </div>
      )}
    </div>
  )
}

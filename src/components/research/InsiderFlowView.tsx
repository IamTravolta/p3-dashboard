'use client'

import { useState } from 'react'
import { Users, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface InsiderRow {
  ticker:       string
  insiderName:  string
  type:         'BUY' | 'SELL'
  shares:       number
  value:        number
  date:         string
  signal:       'BUY' | 'NEUTRAL' | 'SELL'
}

interface InsiderData {
  rows:            InsiderRow[]
  netBuyingM:      number
  buyCount:        number
  sellCount:       number
}

const signalPill: Record<string, string> = {
  BUY:     'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50',
  NEUTRAL: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  SELL:    'bg-red-900/40 text-red-400 border border-red-800/50',
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function InsiderFlowView() {
  const [data,    setData]    = useState<InsiderData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const positions  = useDashboardStore((s) => s.positions)
  const watchlist  = useDashboardStore((s) => s.watchlist)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const tickers = [
    ...positions.map((p) => p.ticker),
    ...watchlist.map((w) => w.ticker),
  ].filter(Boolean).join(',')

  async function fetch_() {
    if (!tickers) { setError('Add positions or watchlist items first.'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/railway/insider-flow?tickers=${encodeURIComponent(tickers)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)
      const rows: InsiderRow[] = Array.isArray(json) ? json : json.rows ?? json.data ?? []
      const buys  = rows.filter((r) => r.type === 'BUY')
      const sells = rows.filter((r) => r.type === 'SELL')
      const netBuyingM = (
        buys.reduce((s, r)  => s + (r.value ?? 0), 0) -
        sells.reduce((s, r) => s + (r.value ?? 0), 0)
      ) / 1_000_000
      setData({ rows, netBuyingM, buyCount: buys.length, sellCount: sells.length })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch insider data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Insider Flow</h2>
          <p className="text-xs text-zinc-500 mt-0.5">SEC Form 4 insider buying and selling activity</p>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Users size={13} />
          {loading ? 'Fetching…' : 'Fetch Insider Data'}
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
        <div className="animate-pulse space-y-3">
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 flex-1 rounded-xl bg-zinc-800/60" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-zinc-800/40" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Users size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No insider data loaded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Click &ldquo;Fetch Insider Data&rdquo; to pull SEC Form 4 filings.</p>
        </div>
      )}

      {/* Summary bar */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-500">Net Insider Buying</p>
              <p className={`text-2xl font-bold mt-1 ${data.netBuyingM >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.netBuyingM >= 0 ? '+' : ''}{data.netBuyingM.toFixed(1)}M
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-500">Buy Transactions</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingUp size={16} className="text-emerald-400" />
                <p className="text-2xl font-bold text-emerald-400">{data.buyCount}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs text-zinc-500">Sell Transactions</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingDown size={16} className="text-red-400" />
                <p className="text-2xl font-bold text-red-400">{data.sellCount}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          {data.rows.length > 0 ? (
            <div className="rounded-xl border border-zinc-800 overflow-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/80">
                    {['Ticker', 'Insider Name', 'Type', 'Shares', 'Value', 'Date', 'Signal'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                      <td className="px-4 py-3 font-semibold text-white">{row.ticker}</td>
                      <td className="px-4 py-3 text-zinc-300">{row.insiderName}</td>
                      <td className={`px-4 py-3 text-xs font-semibold ${row.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.type}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{row.shares?.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{fmt(row.value)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${signalPill[row.signal] ?? signalPill.NEUTRAL}`}>
                          {row.signal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
              No insider transactions found for your tickers.
            </div>
          )}
        </>
      )}
    </div>
  )
}

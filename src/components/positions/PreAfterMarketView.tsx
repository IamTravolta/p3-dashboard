'use client'

import { useEffect, useState } from 'react'
import { useDashboardStore } from '@/lib/store'

interface PremarketRow {
  symbol: string
  changesPercentage: number
  change: number
  price: number
}

export default function PreAfterMarketView() {
  const positions   = useDashboardStore((s) => s.positions)
  const watchlist   = useDashboardStore((s) => s.watchlist)
  const [data,    setData]    = useState<PremarketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [fmpMissing, setFmpMissing] = useState(false)

  useEffect(() => {
    const tickers = [
      ...new Set([
        ...positions.map((p) => p.ticker),
        ...watchlist.map((w) => w.ticker),
      ]),
    ]
    if (tickers.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setFmpMissing(false)

    fetch(`/api/premarket?tickers=${tickers.join(',')}`)
      .then(async (r) => {
        if (r.status === 503) {
          setFmpMissing(true)
          return
        }
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          setError(j.error ?? 'Failed to load pre/after-market data')
          return
        }
        const j = await r.json()
        setData(j.data ?? [])
      })
      .catch(() => setError('Network error — could not fetch pre/after-market data'))
      .finally(() => setLoading(false))
  }, [positions, watchlist])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Pre / After Market</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Extended hours price changes for your portfolio and watchlist
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <span className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-indigo-400 animate-spin" />
          Loading extended-hours data…
        </div>
      )}

      {fmpMissing && !loading && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/40 px-4 py-5">
          <p className="text-sm font-medium text-amber-300">FMP API key not configured</p>
          <p className="text-xs text-amber-600 mt-1">
            Pre/after-market data requires an FMP API key. Add <code className="text-amber-400">FMP_API_KEY</code> to your environment variables.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !fmpMissing && !error && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-sm text-zinc-500">No extended-hours data available</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add positions or watchlist items, then reload
          </p>
        </div>
      )}

      {!loading && !fmpMissing && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Ticker</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Change</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Chg %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {data.map((row) => {
                const up = row.changesPercentage >= 0
                return (
                  <tr key={row.symbol} className="hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{row.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">{row.price.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}{row.change.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}{row.changesPercentage.toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

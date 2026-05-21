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
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◇ Pre / After Market</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.85 }}>Extended hours price changes for your portfolio and watchlist</div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
          <span className="h-4 w-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          Loading extended-hours data…
        </div>
      )}

      {fmpMissing && !loading && (
        <div className="rounded-xl px-4 py-5" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>FMP API key not configured</p>
          <p className="text-xs mt-1" style={{ color: 'var(--warning-text)', opacity: 0.75 }}>
            Pre/after-market data requires an FMP API key. Add <code>FMP_API_KEY</code> to your environment variables.
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {error}
        </div>
      )}

      {!loading && !fmpMissing && !error && data.length === 0 && (
        <div className="rounded-xl py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No extended-hours data available</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Add positions or watchlist items, then reload
          </p>
        </div>
      )}

      {!loading && !fmpMissing && !error && data.length > 0 && (
        <div className="overflow-x-auto surface">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Ticker</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Change</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Chg %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const up = row.changesPercentage >= 0
                return (
                  <tr key={row.symbol} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{row.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{row.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: up ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {up ? '+' : ''}{row.change.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: up ? 'var(--success-text)' : 'var(--danger-text)' }}>
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

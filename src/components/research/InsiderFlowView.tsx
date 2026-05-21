'use client'
import { railwayFetch } from '@/lib/utils/railwayFetch'

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

const signalPillClass: Record<string, string> = {
  BUY:     'pill pill-success',
  NEUTRAL: 'pill pill-neutral',
  SELL:    'pill pill-danger',
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
      const res  = await railwayFetch(`/api/railway/insider-flow?tickers=${encodeURIComponent(tickers)}`)
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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--warning-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--warning-text)' }}>⚡ Insider Flow — last 30 days</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--warning-text)', opacity: 0.7 }}>Aggregate of all SEC Form 4 transactions (officers + directors + 10%-owners)</div>
          </div>
          <button onClick={fetch_} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Users size={13} />
            {loading ? 'Fetching…' : 'Fetch Insider Data'}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--warning-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--warning-text)', lineHeight: 1.6 }}>When management sells without a public trigger, they usually know something you don&apos;t. Bulk cluster sells (CEO + CFO + multiple directors) is a red flag.</div>
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
        <div className="animate-pulse space-y-3">
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 flex-1 rounded-xl" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
          <div className="h-64 rounded-xl" style={{ background: 'var(--surface)' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="surface p-10 text-center">
          <Users size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No insider data loaded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click &ldquo;Fetch Insider Data&rdquo; to pull SEC Form 4 filings.</p>
        </div>
      )}

      {/* Summary bar */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="kpi-card">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Net Insider Buying</p>
              <p className="text-2xl font-bold mt-1" style={{ color: data.netBuyingM >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {data.netBuyingM >= 0 ? '+' : ''}{data.netBuyingM.toFixed(1)}M
              </p>
            </div>
            <div className="kpi-card">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Buy Transactions</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingUp size={16} style={{ color: 'var(--success-text)' }} />
                <p className="text-2xl font-bold" style={{ color: 'var(--success-text)' }}>{data.buyCount}</p>
              </div>
            </div>
            <div className="kpi-card">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sell Transactions</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendingDown size={16} style={{ color: 'var(--danger-text)' }} />
                <p className="text-2xl font-bold" style={{ color: 'var(--danger-text)' }}>{data.sellCount}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          {data.rows.length > 0 ? (
            <div className="surface overflow-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                    {['Ticker', 'Insider Name', 'Type', 'Shares', 'Value', 'Date', 'Signal'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{row.ticker}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.insiderName}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: row.type === 'BUY' ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {row.type}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{row.shares?.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(row.value)}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={signalPillClass[row.signal] ?? signalPillClass.NEUTRAL}>
                          {row.signal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="surface p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No insider transactions found for your tickers.
            </div>
          )}
        </>
      )}
    </div>
  )
}

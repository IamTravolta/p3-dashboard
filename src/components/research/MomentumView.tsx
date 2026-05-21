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

function signalPillClass(signal: string) {
  const s = signal?.toUpperCase()
  if (s === 'STRONG_BUY' || s === 'BUY')   return 'pill pill-success'
  if (s === 'STRONG_SELL' || s === 'SELL')  return 'pill pill-danger'
  return 'pill pill-neutral'
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
        <h3 className="text-sm font-semibold mb-2" style={{ color: positive ? 'var(--success-text)' : 'var(--danger-text)' }}>{title}</h3>
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Ticker', 'Name', 'Week %', 'Signal', 'Category'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => {
                const inPortfolio = myTickers.has(m.ticker)
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)', background: inPortfolio ? 'rgba(91,141,238,0.05)' : undefined }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{m.ticker}</span>
                        {inPortfolio && <span className="pill pill-info">MINE</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }}>{m.name}</td>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: m.weekPct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {m.weekPct >= 0 ? '+' : ''}{m.weekPct?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={signalPillClass(m.signal)}>{m.signal}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.category}</td>
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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>🚀 Weekly Momentum Tracker</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Weekly scan of top gainers with fundamental check + cross-signal validation</div>
          </div>
          <button onClick={fetch_} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <TrendingUp size={13} />
            {loading ? 'Fetching…' : 'Fetch Momentum'}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>Filters top 25 gainers with market cap &gt;$2B. Per ticker: 1w/1m/3m return + volume ratio + cross-signals. Claude categorizes: 🟢 real candidates / 🟡 investigate / 🔴 FOMO.</div>
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
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded" style={{ background: 'var(--surface)' }} />
          <div className="h-64 rounded-xl" style={{ background: 'var(--surface)' }} />
          <div className="h-4 w-24 rounded" style={{ background: 'var(--surface)' }} />
          <div className="h-64 rounded-xl" style={{ background: 'var(--surface)' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && gainers.length === 0 && losers.length === 0 && !error && (
        <div className="surface p-10 text-center">
          <TrendingUp size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No momentum data loaded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Click &ldquo;Fetch Momentum&rdquo; to see weekly top movers.
          </p>
          {myTickers.size > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--primary)' }}>
              Your tickers will be highlighted <span className="pill pill-info">MINE</span> in the results.
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

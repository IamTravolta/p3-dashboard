'use client'
import { railwayFetch } from '@/lib/utils/railwayFetch'

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

const signalPillClass: Record<string, string> = {
  BUY:     'pill pill-success',
  NEUTRAL: 'pill pill-neutral',
  SELL:    'pill pill-danger',
}

function overallSignal(rows: TickerSmartMoney[]): { label: string; color: string } {
  const buys  = rows.filter((r) => r.signal === 'BUY').length
  const sells = rows.filter((r) => r.signal === 'SELL').length
  if (buys > sells * 1.5) return { label: 'BULLISH', color: 'var(--success-text)' }
  if (sells > buys * 1.5) return { label: 'BEARISH', color: 'var(--danger-text)' }
  return { label: 'NEUTRAL', color: 'var(--text-secondary)' }
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
      const res  = await railwayFetch(`/api/railway/smartmoney/aggregate?tickers=${encodeURIComponent(tickers)}`)
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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>💎 Smart Money</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.7 }}>Institutional ownership (13F filings) + insider flow combined in composite score</div>
          </div>
          <button onClick={analyze} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Building2 size={13} />
            {loading ? 'Analyzing…' : 'Analyze Smart Money'}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--purple-text)', lineHeight: 1.6 }}>Composite score (0-100) per ticker. Factors: # 13F filers change, total $ invested, share count shift, insider net flow. ≥75 = STRONG BUY, ≤25 = STRONG SELL.</div>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-16 rounded" style={{ background: 'var(--bg)' }} />
                <div className="h-5 w-14 rounded-full" style={{ background: 'var(--bg)' }} />
              </div>
              <div className="h-3 w-full rounded" style={{ background: 'var(--bg)' }} />
              <div className="h-3 w-3/4 rounded" style={{ background: 'var(--bg)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div className="surface p-10 text-center">
          <Building2 size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No smart money data loaded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click &ldquo;Analyze Smart Money&rdquo; to fetch institutional activity.</p>
        </div>
      )}

      {/* Summary */}
      {!loading && summary && (
        <div className="surface p-4 flex items-center gap-4">
          <Building2 size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Portfolio Smart Money Signal</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: summary.color }}>{summary.label}</p>
          </div>
          <div className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>{results.length} tickers analyzed</div>
        </div>
      )}

      {/* Cards */}
      {!loading && results.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <div key={item.ticker} className="surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{item.ticker}</span>
                <span className={signalPillClass[item.signal] ?? signalPillClass.NEUTRAL}>
                  {item.signal}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Inst. Ownership</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{item.institutionalPct?.toFixed(1)}%</p>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Net Change</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: item.netChange >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {item.netChange >= 0 ? '+' : ''}{item.netChange?.toFixed(1)}%
                  </p>
                </div>
              </div>

              {item.topHolders?.length > 0 && (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Top Holders</p>
                  <div className="space-y-1.5">
                    {item.topHolders.slice(0, 4).map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate max-w-[60%]" style={{ color: 'var(--text-secondary)' }}>{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{h.pct?.toFixed(1)}%</span>
                          <span style={{ color: h.change >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
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

'use client'

import { useState } from 'react'
import { Activity, AlertTriangle, Clock } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface PredictionMarket {
  event:       string
  probability: number
  sentiment:   'positive' | 'negative' | 'neutral'
  updatedAt:   string
}

function barStyle(sentiment: PredictionMarket['sentiment'], pct: number): React.CSSProperties {
  if (sentiment === 'positive') {
    return { background: pct >= 60 ? 'var(--success-text)' : pct >= 35 ? '#2d6a44' : 'var(--text-tertiary)' }
  }
  if (sentiment === 'negative') {
    return { background: pct >= 60 ? 'var(--danger-text)' : pct >= 35 ? '#7a2020' : 'var(--text-tertiary)' }
  }
  return { background: 'var(--text-secondary)' }
}

function textColor(sentiment: PredictionMarket['sentiment']): string {
  if (sentiment === 'positive') return 'var(--success-text)'
  if (sentiment === 'negative') return 'var(--danger-text)'
  return 'var(--text-secondary)'
}

function riskLabel(sentiment: PredictionMarket['sentiment'], pct: number): string {
  if (sentiment === 'negative' && pct >= 60) return 'High Risk'
  if (sentiment === 'negative' && pct >= 35) return 'Moderate Risk'
  if (sentiment === 'positive' && pct >= 60) return 'Tailwind'
  if (sentiment === 'positive' && pct >= 35) return 'Mild Tailwind'
  return 'Neutral'
}

export default function PredictionsView() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  async function fetch_() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/railway/prediction-markets')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)
      setMarkets(Array.isArray(json) ? json : json.markets ?? json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch prediction markets.')
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
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>🎯 Prediction Markets</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.85 }}>Live Polymarket odds for macro events</div>
          </div>
          <button onClick={fetch_} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Activity size={13} />
            {loading ? 'Fetching…' : 'Fetch Markets'}
          </button>
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
        <div className="grid gap-4 sm:grid-cols-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface p-5 space-y-3">
              <div className="h-4 w-3/4 rounded" style={{ background: 'var(--bg)' }} />
              <div className="h-8 w-20 rounded" style={{ background: 'var(--bg)' }} />
              <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg)' }} />
              <div className="h-3 w-1/2 rounded" style={{ background: 'var(--bg)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && markets.length === 0 && !error && (
        <div className="surface p-10 text-center">
          <Activity size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No prediction market data loaded yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click &ldquo;Fetch Markets&rdquo; to pull live Polymarket odds.</p>
        </div>
      )}

      {/* Cards */}
      {!loading && markets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {markets.map((m, i) => {
            const pct   = Math.round(Math.min(100, Math.max(0, m.probability * 100)))
            const color = textColor(m.sentiment)
            const bar   = barStyle(m.sentiment, pct)
            const label = riskLabel(m.sentiment, pct)
            return (
              <div key={i} className="surface p-5 space-y-3">
                <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{m.event}</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color }}>{pct}%</p>
                <div className="space-y-1">
                  <div className="progress-track w-full">
                    <div className="progress-fill rounded-full transition-all" style={{ width: `${pct}%`, ...bar }} />
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>{label}</span>
                    {m.updatedAt && (
                      <div className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(m.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

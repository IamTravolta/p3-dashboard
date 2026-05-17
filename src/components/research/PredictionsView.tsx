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

function barColor(sentiment: PredictionMarket['sentiment'], pct: number): string {
  if (sentiment === 'positive') {
    return pct >= 60 ? 'bg-emerald-500' : pct >= 35 ? 'bg-emerald-700' : 'bg-zinc-600'
  }
  if (sentiment === 'negative') {
    return pct >= 60 ? 'bg-red-500' : pct >= 35 ? 'bg-red-700' : 'bg-zinc-600'
  }
  return 'bg-zinc-500'
}

function textColor(sentiment: PredictionMarket['sentiment']): string {
  if (sentiment === 'positive') return 'text-emerald-400'
  if (sentiment === 'negative') return 'text-red-400'
  return 'text-zinc-400'
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Prediction Markets</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Live Polymarket odds for macro events</p>
        </div>
        <button
          onClick={fetch_}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Activity size={13} />
          {loading ? 'Fetching…' : 'Fetch Markets'}
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
        <div className="grid gap-4 sm:grid-cols-2 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <div className="h-4 w-3/4 rounded bg-zinc-800" />
              <div className="h-8 w-20 rounded bg-zinc-800" />
              <div className="h-2 w-full rounded-full bg-zinc-800" />
              <div className="h-3 w-1/2 rounded bg-zinc-800/60" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && markets.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Activity size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No prediction market data loaded yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Click &ldquo;Fetch Markets&rdquo; to pull live Polymarket odds.</p>
        </div>
      )}

      {/* Cards */}
      {!loading && markets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {markets.map((m, i) => {
            const pct    = Math.round(Math.min(100, Math.max(0, m.probability * 100)))
            const tColor = textColor(m.sentiment)
            const bar    = barColor(m.sentiment, pct)
            const label  = riskLabel(m.sentiment, pct)
            return (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
                <p className="text-sm font-medium text-zinc-200 leading-snug">{m.event}</p>
                <p className={`text-3xl font-bold tabular-nums ${tColor}`}>{pct}%</p>
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-zinc-800">
                    <div
                      className={`h-2 rounded-full transition-all ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
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

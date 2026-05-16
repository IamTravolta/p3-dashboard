'use client'

import { useState } from 'react'
import { FileText, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

type Trend = 'UP' | 'FLAT' | 'DOWN'

interface EarningsResult {
  ticker:      string
  healthScore: number
  revenueTrend: Trend
  epsTrend:    Trend
  keyPhrases:  string[]
}

const healthColor = (s: number) =>
  s >= 70 ? 'bg-emerald-500' : s >= 45 ? 'bg-amber-500' : 'bg-red-500'

const healthTextColor = (s: number) =>
  s >= 70 ? 'text-emerald-400' : s >= 45 ? 'text-amber-400' : 'text-red-400'

const trendIcon: Record<Trend, { icon: string; color: string }> = {
  UP:   { icon: '↑', color: 'text-emerald-400' },
  FLAT: { icon: '→', color: 'text-zinc-400' },
  DOWN: { icon: '↓', color: 'text-red-400' },
}

export default function EarningsView() {
  const [results,  setResults]  = useState<EarningsResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const positions  = useDashboardStore((s) => s.positions)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const tickers = positions.map((p) => p.ticker).filter(Boolean)

  function toggle(ticker: string) {
    setExpanded((prev) => ({ ...prev, [ticker]: !prev[ticker] }))
  }

  async function analyze() {
    if (!tickers.length) { setError('Add portfolio positions first.'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/railway/earnings-transcript/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Server error ${res.status}`)
      setResults(Array.isArray(json) ? json : json.results ?? json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Earnings analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Earnings Analysis</h2>
          <p className="text-xs text-zinc-500 mt-0.5">AI-powered earnings transcript analysis</p>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <FileText size={13} />
          {loading ? 'Analyzing…' : 'Analyze Earnings'}
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

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-16 rounded bg-zinc-800" />
                <div className="h-5 w-10 rounded bg-zinc-800" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800" />
              <div className="flex gap-4">
                <div className="h-4 w-20 rounded bg-zinc-800/60" />
                <div className="h-4 w-20 rounded bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <FileText size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No earnings data yet.</p>
          <p className="text-xs text-zinc-600 mt-1">Click &ldquo;Analyze Earnings&rdquo; to process your portfolio transcripts.</p>
        </div>
      )}

      {/* Results — collapsible cards */}
      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => {
            const isOpen  = !!expanded[r.ticker]
            const rev     = trendIcon[r.revenueTrend] ?? trendIcon.FLAT
            const eps     = trendIcon[r.epsTrend]     ?? trendIcon.FLAT
            return (
              <div key={r.ticker} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                {/* Summary row — always visible */}
                <button
                  onClick={() => toggle(r.ticker)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800/20 transition text-left"
                >
                  <span className="text-base font-bold text-white w-14 shrink-0">{r.ticker}</span>

                  {/* Health bar */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Health Score</span>
                      <span className={`text-xs font-bold ${healthTextColor(r.healthScore)}`}>{r.healthScore}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-1.5 rounded-full ${healthColor(r.healthScore)}`}
                        style={{ width: `${Math.min(100, r.healthScore)}%` }}
                      />
                    </div>
                  </div>

                  {/* Trend badges */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-center">
                      <div className="text-zinc-600">Rev</div>
                      <div className={`font-bold ${rev.color}`}>{rev.icon}</div>
                    </div>
                    <div className="text-xs text-center">
                      <div className="text-zinc-600">EPS</div>
                      <div className={`font-bold ${eps.color}`}>{eps.icon}</div>
                    </div>
                    <div className="text-zinc-600 ml-1">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-zinc-800 px-4 py-3">
                    {r.keyPhrases?.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 mb-2">Key Phrases from Transcript</p>
                        <ul className="space-y-1.5">
                          {r.keyPhrases.map((phrase, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                              <span className="text-indigo-500 shrink-0 mt-0.5">•</span>
                              {phrase}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600">No key phrases available.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

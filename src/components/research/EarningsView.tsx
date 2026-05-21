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

const healthBarColor = (s: number) =>
  s >= 70 ? 'var(--success-text)' : s >= 45 ? 'var(--warning-text)' : 'var(--danger-text)'

const trendIcon: Record<Trend, { icon: string; color: string }> = {
  UP:   { icon: '↑', color: 'var(--success-text)' },
  FLAT: { icon: '→', color: 'var(--text-secondary)' },
  DOWN: { icon: '↓', color: 'var(--danger-text)' },
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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>📄 Earnings Analysis</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.85 }}>AI-powered earnings transcript analysis</div>
          </div>
          <button onClick={analyze} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <FileText size={13} />
            {loading ? 'Analyzing…' : 'Analyze Earnings'}
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

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-5 w-16 rounded" style={{ background: 'var(--bg)' }} />
                <div className="h-5 w-10 rounded" style={{ background: 'var(--bg)' }} />
              </div>
              <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--bg)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && !error && (
        <div className="surface p-10 text-center">
          <FileText size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No earnings data yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click &ldquo;Analyze Earnings&rdquo; to process your portfolio transcripts.</p>
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
              <div key={r.ticker} className="surface overflow-hidden">
                {/* Summary row — always visible */}
                <button
                  onClick={() => toggle(r.ticker)}
                  className="w-full flex items-center gap-4 p-4 transition text-left"
                >
                  <span className="text-base font-bold w-14 shrink-0" style={{ color: 'var(--text-primary)' }}>{r.ticker}</span>

                  {/* Health bar */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Health Score</span>
                      <span className="text-xs font-bold" style={{ color: healthBarColor(r.healthScore) }}>{r.healthScore}</span>
                    </div>
                    <div className="progress-track w-full">
                      <div
                        className="progress-fill rounded-full"
                        style={{ width: `${Math.min(100, r.healthScore)}%`, background: healthBarColor(r.healthScore) }}
                      />
                    </div>
                  </div>

                  {/* Trend badges */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-xs text-center">
                      <div style={{ color: 'var(--text-tertiary)' }}>Rev</div>
                      <div className="font-bold" style={{ color: rev.color }}>{rev.icon}</div>
                    </div>
                    <div className="text-xs text-center">
                      <div style={{ color: 'var(--text-tertiary)' }}>EPS</div>
                      <div className="font-bold" style={{ color: eps.color }}>{eps.icon}</div>
                    </div>
                    <div style={{ color: 'var(--text-tertiary)' }} className="ml-1">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 py-3" style={{ borderTop: '0.5px solid var(--border)' }}>
                    {r.keyPhrases?.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Key Phrases from Transcript</p>
                        <ul className="space-y-1.5">
                          {r.keyPhrases.map((phrase, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                              <span className="shrink-0 mt-0.5" style={{ color: 'var(--primary)' }}>•</span>
                              {phrase}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No key phrases available.</p>
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

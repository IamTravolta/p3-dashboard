'use client'

import { useState } from 'react'
import { Lightbulb, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

interface TradeIdea {
  ticker: string
  ideaType: 'BUY' | 'WATCH' | 'AVOID'
  reasoning: string
  confidence: number
}

function SkeletonCard() {
  return (
    <div className="surface p-5 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded" style={{ background: 'var(--bg)' }} />
        <div className="h-5 w-16 rounded-full" style={{ background: 'var(--bg)' }} />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded" style={{ background: 'var(--bg)' }} />
        <div className="h-3 w-4/5 rounded" style={{ background: 'var(--bg)' }} />
        <div className="h-3 w-3/5 rounded" style={{ background: 'var(--bg)' }} />
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--bg)' }} />
    </div>
  )
}

const ideaTypePill: Record<TradeIdea['ideaType'], string> = {
  BUY:   'pill pill-success',
  WATCH: 'pill pill-yellow',
  AVOID: 'pill pill-danger',
}

const confidenceColor = (c: number) =>
  c >= 70 ? 'var(--success-text)' : c >= 45 ? 'var(--warning-text)' : 'var(--danger-text)'

export default function TradeIdeasView() {
  const [ideas,   setIdeas]   = useState<TradeIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const positions  = useDashboardStore((s) => s.positions)
  const watchlist  = useDashboardStore((s) => s.watchlist)
  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/railway/trade-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio:  positions.map((p) => p.ticker),
          watchlist:  watchlist.map((w) => w.ticker),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`)
      setIdeas(Array.isArray(data) ? data : data.ideas ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate ideas.')
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
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>💡 Trade Ideas</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.85 }}>AI-generated opportunities based on your portfolio and market conditions</div>
          </div>
          <button onClick={generate} disabled={loading} className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Lightbulb size={13} />
            Generate Ideas
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && !error && (
        <div className="surface p-10 text-center">
          <Lightbulb size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No ideas yet.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Click &ldquo;Generate Ideas&rdquo; to get AI-powered trade opportunities.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea, i) => (
            <div key={`${idea.ticker}-${i}`} className="surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{idea.ticker}</span>
                <span className={ideaTypePill[idea.ideaType]}>
                  {idea.ideaType}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{idea.reasoning}</p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Confidence</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{idea.confidence}%</span>
                </div>
                <div className="progress-track w-full">
                  <div
                    className="progress-fill rounded-full"
                    style={{ width: `${Math.min(100, idea.confidence)}%`, background: confidenceColor(idea.confidence) }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

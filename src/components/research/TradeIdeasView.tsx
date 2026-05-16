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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded bg-zinc-800" />
        <div className="h-5 w-16 rounded-full bg-zinc-800" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-zinc-800/60" />
        <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
        <div className="h-3 w-3/5 rounded bg-zinc-800/60" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-800" />
    </div>
  )
}

const ideaTypeStyles: Record<TradeIdea['ideaType'], string> = {
  BUY:   'bg-emerald-900/40 text-emerald-400 border-emerald-800/50',
  WATCH: 'bg-amber-900/40 text-amber-400 border-amber-800/50',
  AVOID: 'bg-red-900/40 text-red-400 border-red-800/50',
}

const confidenceColor = (c: number) =>
  c >= 70 ? 'bg-emerald-500' : c >= 45 ? 'bg-amber-500' : 'bg-red-500'

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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Trade Ideas</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            AI-generated opportunities based on your portfolio and market conditions
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Lightbulb size={13} />
          Generate Ideas
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && !error && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <Lightbulb size={28} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-sm text-zinc-500">No ideas yet.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Click &ldquo;Generate Ideas&rdquo; to get AI-powered trade opportunities.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea, i) => (
            <div key={`${idea.ticker}-${i}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">{idea.ticker}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ideaTypeStyles[idea.ideaType]}`}>
                  {idea.ideaType}
                </span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{idea.reasoning}</p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">Confidence</span>
                  <span className="text-xs font-mono text-zinc-400">{idea.confidence}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-1.5 rounded-full transition-all ${confidenceColor(idea.confidence)}`}
                    style={{ width: `${Math.min(100, idea.confidence)}%` }}
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

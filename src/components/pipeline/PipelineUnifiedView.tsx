'use client'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import TickerChip from '@/components/shared/TickerChip'

type Tier = 'HOT' | 'WARM' | 'COOL'

interface PipelineCard {
  ticker: string
  name?: string
  score?: number
  tier: Tier
  verdict?: string
  confidence?: number
  source: 'Watchlist' | 'Position'
}

function classifyWatchlistItem(
  ticker: string,
  name: string | null | undefined,
  score: number,
  cache?: { verdict?: { finalVerdict: string; confidence: number } }
): PipelineCard {
  const v = cache?.verdict
  let tier: Tier = 'COOL'
  if (v?.finalVerdict === 'BUY' && v.confidence > 0.7) tier = 'HOT'
  else if (score >= 7) tier = 'HOT'
  else if (v?.finalVerdict === 'BUY') tier = 'WARM'
  else if (score >= 5) tier = 'WARM'
  return {
    ticker,
    name: name ?? undefined,
    score,
    tier,
    verdict: v?.finalVerdict,
    confidence: v?.confidence,
    source: 'Watchlist',
  }
}

function TierBadge({ tier }: { tier: Tier }) {
  const styles: Record<Tier, string> = {
    HOT:  'bg-red-900/70 text-red-300 border-red-700',
    WARM: 'bg-amber-900/70 text-amber-300 border-amber-700',
    COOL: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[tier]}`}>
      {tier}
    </span>
  )
}

function VerdictPill({ verdict }: { verdict?: string }) {
  if (!verdict) return null
  const colors: Record<string, string> = {
    BUY:  'bg-emerald-900/60 text-emerald-300',
    SELL: 'bg-red-900/60 text-red-300',
    HOLD: 'bg-zinc-800 text-zinc-400',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors[verdict] ?? colors.HOLD}`}>
      {verdict}
    </span>
  )
}

function PipelineCard({ card }: { card: PipelineCard }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2 hover:border-zinc-700 transition">
      <div className="flex items-center justify-between gap-2">
        <TickerChip ticker={card.ticker} />
        <TierBadge tier={card.tier} />
      </div>
      {card.name && (
        <p className="text-xs text-zinc-500 truncate">{card.name}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {card.verdict && <VerdictPill verdict={card.verdict} />}
        {card.confidence !== undefined && (
          <span className="text-[10px] text-zinc-500">{(card.confidence * 100).toFixed(0)}% conf</span>
        )}
        <span className="ml-auto text-[10px] text-zinc-600">{card.source}</span>
      </div>
    </div>
  )
}

function TierColumn({ tier, cards }: { tier: Tier; cards: PipelineCard[] }) {
  const headers: Record<Tier, { label: string; color: string }> = {
    HOT:  { label: 'HOT', color: 'text-red-400' },
    WARM: { label: 'WARM', color: 'text-amber-400' },
    COOL: { label: 'COOL', color: 'text-zinc-500' },
  }
  const { label, color } = headers[tier]
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${color} mb-1`}>
        {label}
        <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
          {cards.length}
        </span>
      </div>
      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">
          None
        </div>
      ) : (
        cards.map((c) => <PipelineCard key={`${c.ticker}-${c.source}`} card={c} />)
      )}
    </div>
  )
}

export default function PipelineUnifiedView() {
  const watchlist   = useDashboardStore((s) => s.watchlist)
  const positions   = useDashboardStore((s) => s.positions)
  const signalCache = useDashboardStore((s) => s.signalCache)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const cards: PipelineCard[] = watchlist.map((w) =>
    classifyWatchlistItem(w.ticker, w.name, w.score, signalCache[w.ticker])
  )

  // Add flagged positions as HOT/WARM
  for (const p of positions) {
    const cache = signalCache[p.ticker]
    const v = cache?.verdict
    if (!v) continue
    if (v.finalVerdict === 'SELL' || (v.finalVerdict === 'HOLD' && v.confidence < 0.4)) {
      const alreadyIn = cards.some((c) => c.ticker === p.ticker)
      if (!alreadyIn) {
        cards.push({
          ticker: p.ticker,
          name: undefined,
          tier: v.finalVerdict === 'SELL' ? 'HOT' : 'WARM',
          verdict: v.finalVerdict,
          confidence: v.confidence,
          source: 'Position',
        })
      }
    }
  }

  const hot  = cards.filter((c) => c.tier === 'HOT')
  const warm = cards.filter((c) => c.tier === 'WARM')
  const cool = cards.filter((c) => c.tier === 'COOL')

  const isEmpty = cards.length === 0

  async function runBulkAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/analyze/bulk', { method: 'POST' })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        setError(j.error ?? 'Analysis failed')
      }
    } catch {
      setError('Network error — could not reach analysis service')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Pipeline</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Unified view of watchlist and positions ranked by signal strength
          </p>
        </div>
        <button
          onClick={runBulkAnalysis}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition"
        >
          {loading ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analysing…
            </>
          ) : (
            'Run Full Analysis'
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center">
          <p className="text-sm text-zinc-400 font-medium">No pipeline items yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add tickers to your Watchlist, then click <strong className="text-zinc-400">Run Full Analysis</strong>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TierColumn tier="HOT"  cards={hot}  />
          <TierColumn tier="WARM" cards={warm} />
          <TierColumn tier="COOL" cards={cool} />
        </div>
      )}
    </div>
  )
}

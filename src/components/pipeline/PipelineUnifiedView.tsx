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

const TIER_STYLES: Record<Tier, { pillStyle: React.CSSProperties; headerColor: string }> = {
  HOT:  { pillStyle: { background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-text)' }, headerColor: 'var(--danger-text)' },
  WARM: { pillStyle: { background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-text)' }, headerColor: 'var(--warning-text)' },
  COOL: { pillStyle: { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }, headerColor: 'var(--text-secondary)' },
}

function TierBadge({ tier }: { tier: Tier }) {
  const { pillStyle } = TIER_STYLES[tier]
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={pillStyle}>
      {tier}
    </span>
  )
}

function VerdictPill({ verdict }: { verdict?: string }) {
  if (!verdict) return null
  const v = verdict.toUpperCase()
  const pillClass = v === 'BUY' ? 'pill pill-success' : v === 'SELL' ? 'pill pill-danger' : 'pill pill-neutral'
  return <span className={`${pillClass} text-[10px]`}>{verdict}</span>
}

function PipelineCardItem({ card }: { card: PipelineCard }) {
  return (
    <div className="surface p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <TickerChip ticker={card.ticker} />
        <TierBadge tier={card.tier} />
      </div>
      {card.name && (
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{card.name}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {card.verdict && <VerdictPill verdict={card.verdict} />}
        {card.confidence !== undefined && (
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{(card.confidence * 100).toFixed(0)}% conf</span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{card.source}</span>
      </div>
    </div>
  )
}

function TierColumn({ tier, cards }: { tier: Tier; cards: PipelineCard[] }) {
  const { headerColor } = TIER_STYLES[tier]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1" style={{ color: headerColor }}>
        {tier}
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
          {cards.length}
        </span>
      </div>
      {cards.length === 0 ? (
        <div className="surface p-4 text-center text-xs" style={{ border: '1px dashed var(--border)', color: 'var(--text-tertiary)' }}>
          None
        </div>
      ) : (
        cards.map((c) => <PipelineCardItem key={`${c.ticker}-${c.source}`} card={c} />)
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
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>★ Pipeline · Unified View</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>All opportunities sorted by signal strength: HOT / WARM / COOL</div>
          </div>
          <button
            onClick={runBulkAnalysis}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Analysing…
              </>
            ) : (
              'Run Full Analysis'
            )}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>Three sources combined per candidate: Watchlist (your triggers), Trade Ideas (Claude proactive), SP500 Discovery (screener + Claude eval).</div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {error}
        </div>
      )}

      {isEmpty ? (
        <div className="surface py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No pipeline items yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Add tickers to your Watchlist, then click <strong style={{ color: 'var(--text-secondary)' }}>Run Full Analysis</strong>
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

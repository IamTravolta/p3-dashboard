'use client'

import { useDashboardStore } from '@/lib/store'
import TickerChip from '@/components/shared/TickerChip'
import type { Position } from '@/lib/types/database'

function isFlagged(
  p: Position,
  cache?: { verdict?: { finalVerdict: string; confidence: number; reasoning?: string } }
): boolean {
  if (!cache?.verdict) {
    // No signal — flag if score is low
    const score = calcScore(p.factorScores)
    return score < 4
  }
  const { finalVerdict, confidence } = cache.verdict
  if (finalVerdict === 'SELL') return true
  if (finalVerdict === 'HOLD' && confidence < 0.4) return true
  return false
}

function calcScore(fs: { q: number; g: number; v: number; m: number; s: number }): number {
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return <span className="pill pill-neutral">No Signal</span>
  const pillMap: Record<string, string> = {
    BUY:  'pill pill-success',
    SELL: 'pill pill-danger',
    HOLD: 'pill pill-neutral',
  }
  return (
    <span className={pillMap[verdict] ?? pillMap.HOLD}>
      {verdict}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100)
  const color = score >= 7 ? 'var(--success-text)' : score >= 5 ? 'var(--warning-text)' : 'var(--danger-text)'
  return (
    <div className="flex items-center gap-2">
      <div className="progress-track flex-1">
        <div className="progress-fill rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-6" style={{ color: 'var(--text-secondary)' }}>{score.toFixed(1)}</span>
    </div>
  )
}

export default function WatchToSellView() {
  const positions   = useDashboardStore((s) => s.positions)
  const signalCache = useDashboardStore((s) => s.signalCache)
  const prices      = useDashboardStore((s) => s.prices)

  const flagged = positions.filter((p) => isFlagged(p, signalCache[p.ticker]))

  if (flagged.length === 0) {
    return (
      <div className="space-y-4">
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--danger-text)' }}>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--danger-text)' }}>⚠ Watch to Sell</h1>
          <div className="text-xs mt-1" style={{ color: 'var(--danger-text)', opacity: 0.85 }}>Positions flagged for exit review</div>
        </div>
        <div className="rounded-xl py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No positions flagged for exit</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Positions with SELL verdicts, low-confidence HOLDs, or scores below 4 will appear here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--danger-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--danger-text)' }}>⚠ Watch to Sell</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--danger-text)', opacity: 0.85 }}>
          {flagged.length} position{flagged.length !== 1 ? 's' : ''} flagged for exit review
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--danger-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--danger-text)', lineHeight: 1.6 }}>
            Positions with SELL verdicts, low-confidence HOLDs, or factor scores below 4 are listed here for your review.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {flagged.map((p) => {
          const cache   = signalCache[p.ticker]
          const verdict = cache?.verdict
          const score   = calcScore(p.factorScores)
          const currentPrice = prices[p.ticker] ?? p.currentPrice
          const pnl    = (currentPrice - p.avgBuyPrice) * p.shares
          const pnlPct = p.avgBuyPrice > 0 ? ((currentPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0

          return (
            <div key={p.id} className="surface p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <TickerChip ticker={p.ticker} />
                  <div className="flex items-center gap-2">
                    <VerdictBadge verdict={verdict?.finalVerdict} />
                    {verdict?.confidence !== undefined && (
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {(verdict.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: pnl >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{p.shares} shares @ {p.avgBuyPrice.toFixed(2)}</p>
                </div>
              </div>

              <ScoreBar score={score} />

              {verdict?.reasoning && (
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{verdict.reasoning}</p>
              )}

              <button onClick={() => {}} className="btn">
                Review Position
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  if (!verdict) return <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">No Signal</span>
  const colors: Record<string, string> = {
    BUY:  'bg-emerald-900/70 text-emerald-300',
    SELL: 'bg-red-900/70 text-red-300',
    HOLD: 'bg-zinc-800 text-zinc-400',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors[verdict] ?? colors.HOLD}`}>
      {verdict}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, (score / 10) * 100)
  const color = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-400 w-6">{score.toFixed(1)}</span>
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
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center">
        <p className="text-sm text-zinc-400 font-medium">No positions flagged for exit</p>
        <p className="text-xs text-zinc-600 mt-1">
          Positions with SELL verdicts, low-confidence HOLDs, or scores below 4 will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Watch to Sell</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          {flagged.length} position{flagged.length !== 1 ? 's' : ''} flagged for exit review
        </p>
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
            <div
              key={p.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <TickerChip ticker={p.ticker} />
                  <div className="flex items-center gap-2">
                    <VerdictBadge verdict={verdict?.finalVerdict} />
                    {verdict?.confidence !== undefined && (
                      <span className="text-[10px] text-zinc-500">
                        {(verdict.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                  </p>
                  <p className="text-[11px] text-zinc-500">{p.shares} shares @ {p.avgBuyPrice.toFixed(2)}</p>
                </div>
              </div>

              <ScoreBar score={score} />

              {verdict?.reasoning && (
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{verdict.reasoning}</p>
              )}

              <button
                onClick={() => {}}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Review Position
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

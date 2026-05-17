'use client'

import { useState } from 'react'
import { usePositions, usePrices, useStats, useDashboardStore } from '@/lib/store'
import type { Position, FactorScores } from '@/lib/types/database'
import SellPositionModal from './SellPositionModal'

// ── Analysis types ─────────────────────────────────────────────────────────────

interface PositionAnalysisResult {
  ticker?:      string
  verdict?: {
    verdict?:      string
    finalVerdict?: string
    confidence:    number
    score?:        number
    reasoning?:    string
  }
  speculation?: { score: number; label: string }
  error?:       string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeScore(fs: FactorScores): number {
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

function convictionLabel(level: number): string {
  if (level >= 5) return 'Very High'
  if (level >= 4) return 'High'
  if (level >= 3) return 'Medium'
  if (level >= 2) return 'Low'
  return 'Very Low'
}

function convictionColor(level: number): string {
  if (level >= 5) return 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
  if (level >= 4) return 'bg-blue-900/60 text-blue-300 border-blue-700'
  if (level >= 3) return 'bg-yellow-900/60 text-yellow-300 border-yellow-700'
  if (level >= 2) return 'bg-orange-900/60 text-orange-300 border-orange-700'
  return 'bg-red-900/60 text-red-300 border-red-700'
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-emerald-400'
  if (pnl < 0) return 'text-red-400'
  return 'text-zinc-400'
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FactorBars({ scores }: { scores: FactorScores }) {
  const factors: { key: keyof FactorScores; label: string }[] = [
    { key: 'q', label: 'Quality' },
    { key: 'g', label: 'Growth' },
    { key: 'v', label: 'Valuation' },
    { key: 'm', label: 'Momentum' },
    { key: 's', label: 'Sentiment' },
  ]

  return (
    <div className="space-y-2">
      {factors.map(({ key, label }) => {
        const val = scores[key]
        const pct = Math.min((val / 10) * 100, 100)
        const barColor =
          val >= 7 ? 'bg-emerald-500' : val >= 5 ? 'bg-yellow-500' : 'bg-red-500'
        const textColor =
          val >= 7 ? 'text-emerald-400' : val >= 5 ? 'text-yellow-400' : 'text-red-400'

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 w-20 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-mono font-semibold w-8 text-right ${textColor}`}>
              {val.toFixed(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RailwaySignals() {
  const signals = ['Council', 'Insider', 'Smart Money', 'TA']
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {signals.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 text-xs text-zinc-500"
          >
            <span className="font-mono font-semibold">–</span>
            {s}
          </span>
        ))}
      </div>
      <p className="text-xs text-zinc-600 italic">
        Connect Railway backend in Settings to enable AI analysis
      </p>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function PositionDetail({
  position,
  onDelete,
}: {
  position: Position
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const removePosition = useDashboardStore((s) => s.removePosition)

  async function handleDelete() {
    setDeleting(true)
    try {
      const resp = await fetch(`/api/positions/${position.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Delete failed')
      removePosition(position.id)
      onDelete(position.id)
    } catch (err) {
      console.error('Delete position error:', err)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4 space-y-5">
      {/* Factor bars */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Factor Scores
        </h4>
        <FactorBars scores={position.factorScores} />
      </div>

      {/* Thesis */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
          Investment Thesis
        </h4>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {position.thesis || (
            <span className="italic text-zinc-600">No thesis recorded</span>
          )}
        </p>
      </div>

      {/* Notes */}
      {position.notes && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
            Notes
          </h4>
          <p className="text-sm text-zinc-400 leading-relaxed">{position.notes}</p>
        </div>
      )}

      {/* Railway signals */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          AI Signals
        </h4>
        <RailwaySignals />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => console.log('Edit position:', position.id)}
          className="rounded-md px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
        >
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md px-3 py-1.5 text-xs font-medium bg-red-900/70 text-red-300 hover:bg-red-800 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-red-400 transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main row ───────────────────────────────────────────────────────────────────

function PositionAnalysisResult({ result }: { result: PositionAnalysisResult }) {
  if (result.error) {
    return (
      <div className="mt-2 rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
        ⚠ {result.error}
      </div>
    )
  }

  const verdict      = result.verdict
  const verdictLabel = verdict?.verdict ?? verdict?.finalVerdict ?? 'HOLD'
  const verdictColor = verdictLabel === 'BUY'
    ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
    : verdictLabel === 'SELL'
    ? 'text-red-400 bg-red-900/30 border-red-800'
    : 'text-yellow-400 bg-yellow-900/30 border-yellow-800'

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {verdict && (
        <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${verdictColor}`}>
          {verdictLabel}
          <span className="font-normal opacity-75">{(verdict.confidence * 100).toFixed(0)}% conf</span>
          {verdict.score != null && (
            <span className="font-normal opacity-75">· {verdict.score.toFixed(1)}/10</span>
          )}
        </div>
      )}
      {result.speculation && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
          Speculation: <span className="font-medium text-white">{result.speculation.score}/10</span>
          {' · '}{result.speculation.label}
        </div>
      )}
    </div>
  )
}

function PositionRow({
  position,
  totalPortfolioValue,
}: {
  position: Position
  totalPortfolioValue: number
}) {
  const prices = usePrices()
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing]       = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<PositionAnalysisResult | null>(null)
  const [sellOpen, setSellOpen] = useState(false)

  async function runAnalysis() {
    setAnalyzing(position.id)
    try {
      const resp = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ticker:      position.ticker,
          exchange:    position.exchange,
          sector:      position.sector,
          name:        position.name,
          position_id: position.id,
        }),
      })
      const data = await resp.json() as PositionAnalysisResult & { error?: string }
      if (data.error) {
        setAnalysisResult({ error: data.error })
      } else {
        setAnalysisResult(data)
      }
    } catch {
      setAnalysisResult({ error: 'Analysis failed' })
    } finally {
      setAnalyzing(null)
    }
  }

  const livePrice = prices[position.ticker] ?? position.currentPrice
  const value = livePrice * position.shares
  const cost = position.avgBuyPrice * position.shares
  const pnl = value - cost
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
  const weight = totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0
  const score = computeScore(position.factorScores)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition hover:border-zinc-700">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ticker + Exchange + Name */}
        <div className="w-28 shrink-0">
          <span className="font-mono font-bold text-white text-sm">{position.ticker}</span>
          <div className="text-xs text-zinc-500">{position.exchange}</div>
          <div className="hidden sm:block text-xs text-zinc-600 truncate max-w-[108px]">
            {position.name}
          </div>
        </div>

        {/* Shares */}
        <div className="hidden md:block w-16 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Shares</div>
          <div className="text-sm font-mono text-zinc-300">{fmt(position.shares, 0)}</div>
        </div>

        {/* Avg Buy */}
        <div className="hidden md:block w-20 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Avg Buy</div>
          <div className="text-sm font-mono text-zinc-300">${fmt(position.avgBuyPrice)}</div>
        </div>

        {/* Live Price */}
        <div className="w-20 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Price</div>
          <div className="text-sm font-mono text-white">${fmt(livePrice)}</div>
        </div>

        {/* Value */}
        <div className="hidden sm:block w-24 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Value</div>
          <div className="text-sm font-mono text-white">{fmtCurrency(value)}</div>
        </div>

        {/* P&L */}
        <div className="w-24 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">P&amp;L</div>
          <div className={`text-sm font-mono font-semibold ${pnlColor(pnl)}`}>
            {pnl >= 0 ? '+' : ''}{fmtCurrency(pnl)}
          </div>
          <div className={`text-xs ${pnlColor(pnlPct)}`}>
            {pnlPct >= 0 ? '+' : ''}{fmt(pnlPct, 1)}%
          </div>
        </div>

        {/* Weight */}
        <div className="hidden lg:block w-16 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Weight</div>
          <div className="text-sm font-mono text-zinc-300">{fmt(weight, 1)}%</div>
        </div>

        {/* Score */}
        <div className="hidden sm:block w-16 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Score</div>
          <div className={`text-sm font-mono font-semibold ${scoreColor(score)}`}>
            {fmt(score, 2)}
          </div>
        </div>

        {/* Conviction */}
        <div className="hidden lg:block w-20 shrink-0 text-right">
          <div className="text-xs text-zinc-500 mb-0.5">Conviction</div>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${convictionColor(position.conviction)}`}
          >
            {convictionLabel(position.conviction)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="ml-auto shrink-0 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); runAnalysis() }}
            disabled={analyzing === position.id}
            className="rounded px-2 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-40 transition whitespace-nowrap"
          >
            {analyzing === position.id ? 'Running…' : 'Analyse'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSellOpen(true) }}
            className="rounded px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-900/30 transition whitespace-nowrap"
          >
            Sell
          </button>
        </div>

        {sellOpen && (
          <SellPositionModal
            open={sellOpen}
            onClose={() => setSellOpen(false)}
            position={position}
          />
        )}

        {/* Expand chevron */}
        <div className="shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4">
          <PositionDetail
            position={position}
            onDelete={() => setExpanded(false)}
          />
          {analysisResult && <PositionAnalysisResult result={analysisResult} />}
        </div>
      )}

      {/* Inline analysis result when not expanded */}
      {!expanded && analysisResult && (
        <div className="px-4 pb-3">
          <PositionAnalysisResult result={analysisResult} />
        </div>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function MyPositionsView() {
  const positions = usePositions()
  const stats = useStats()

  const totalPortfolioValue = stats?.totalValue ?? 0

  if (positions.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white">My Positions</h2>
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <p className="text-3xl mb-3">📊</p>
          <h3 className="text-base font-semibold text-white mb-1">No positions yet</h3>
          <p className="text-sm text-zinc-500">
            Add your first position using the Portfolio Overview panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          My Positions{' '}
          <span className="text-zinc-500 font-normal ml-1">({positions.length})</span>
        </h2>
        {stats && (
          <span className="text-xs text-zinc-500">
            Total value:{' '}
            <span className="text-zinc-300 font-mono">
              {fmtCurrency(stats.totalValue)}
            </span>
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-zinc-600 uppercase tracking-wide">
        <div className="w-28 shrink-0">Ticker</div>
        <div className="hidden md:block w-16 shrink-0 text-right">Shares</div>
        <div className="hidden md:block w-20 shrink-0 text-right">Avg</div>
        <div className="w-20 shrink-0 text-right">Price</div>
        <div className="hidden sm:block w-24 shrink-0 text-right">Value</div>
        <div className="w-24 shrink-0 text-right">P&amp;L</div>
        <div className="hidden lg:block w-16 shrink-0 text-right">Weight</div>
        <div className="hidden sm:block w-16 shrink-0 text-right">Score</div>
        <div className="hidden lg:block w-20 shrink-0 text-right">Conviction</div>
        <div className="ml-auto w-7 shrink-0" />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {positions.map((pos) => (
          <PositionRow
            key={pos.id}
            position={pos}
            totalPortfolioValue={totalPortfolioValue}
          />
        ))}
      </div>
    </div>
  )
}

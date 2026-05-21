'use client'

import { useState } from 'react'
import { usePositions, usePrices, useStats, useDashboardStore } from '@/lib/store'
import type { Position, FactorScores } from '@/lib/types/database'
import { computeQuickProTrader } from '@/lib/utils/quickProTrader'
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

function convictionPillClass(level: number): string {
  if (level >= 5) return 'pill pill-success'
  if (level >= 4) return 'pill pill-info'
  if (level >= 3) return 'pill pill-yellow'
  if (level >= 2) return 'pill pill-warning'
  return 'pill pill-danger'
}

function scoreColor(score: number): string {
  if (score >= 7) return 'var(--success-text)'
  if (score >= 5) return 'var(--yellow-text)'
  return 'var(--danger-text)'
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return 'var(--success-text)'
  if (pnl < 0) return 'var(--danger-text)'
  return 'var(--text-secondary)'
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
          val >= 7 ? 'var(--success-text)' : val >= 5 ? 'var(--yellow-text)' : 'var(--danger-text)'

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs w-20 shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <div className="progress-track flex-1">
              <div
                className="progress-fill rounded-full"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            <span className="text-xs font-mono font-semibold w-8 text-right" style={{ color: barColor }}>
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
          <span key={s} className="pill pill-neutral inline-flex items-center gap-1.5">
            <span className="font-mono font-semibold">–</span>
            {s}
          </span>
        ))}
      </div>
      <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
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
    <div className="mt-4 pt-4 space-y-5" style={{ borderTop: '0.5px solid var(--border)' }}>
      {/* Factor bars */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Factor Scores
        </h4>
        <FactorBars scores={position.factorScores} />
      </div>

      {/* Thesis */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Investment Thesis
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {position.thesis || (
            <span className="italic" style={{ color: 'var(--text-tertiary)' }}>No thesis recorded</span>
          )}
        </p>
      </div>

      {/* Notes */}
      {position.notes && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Notes
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{position.notes}</p>
        </div>
      )}

      {/* Railway signals */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
          AI Signals
        </h4>
        <RailwaySignals />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => console.log('Edit position:', position.id)}
          className="btn"
        >
          Edit
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn btn-danger disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs transition"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs transition"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Position Action Panel ──────────────────────────────────────────────────────
function PositionActionPanel({ position }: { position: Position }) {
  const prices     = usePrices()
  const positions  = useDashboardStore(s => s.positions)
  const watchlist  = useDashboardStore(s => s.watchlist)
  const signalCache = useDashboardStore(s => s.signalCache)

  const livePrice = prices[position.ticker] ?? position.currentPrice
  const verdict   = signalCache[position.ticker]?.verdict ?? null
  const q = computeQuickProTrader(position.ticker, livePrice, positions, watchlist, prices, verdict)

  const stopLoss   = livePrice * 0.85        // hard stop-loss at -15%
  const trimZone   = position.avgBuyPrice * 1.75  // trim zone at +75% from avg buy
  const pnlPct     = ((livePrice - position.avgBuyPrice) / position.avgBuyPrice) * 100

  return (
    <div className="mt-3 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        Position Action Panel
      </h4>

      {/* Stop loss + Trim zone + Kelly */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded p-2.5" style={{ background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger-text)' }}>
          <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--danger-text)' }}>Hard Stop-loss</div>
          <div className="text-sm font-mono font-bold" style={{ color: 'var(--danger-text)' }}>
            €{stopLoss.toFixed(2)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>−15% from avg buy</div>
        </div>

        <div className="rounded p-2.5" style={{ background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning-text)' }}>
          <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--warning-text)' }}>Trim Zone</div>
          <div className="text-sm font-mono font-bold" style={{ color: 'var(--warning-text)' }}>
            €{trimZone.toFixed(2)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>+75% from avg buy</div>
        </div>

        <div className="rounded p-2.5" style={{ background: pnlPct >= 75 ? 'var(--success-bg)' : pnlPct <= -15 ? 'var(--danger-bg)' : 'var(--info-bg)', borderLeft: `3px solid ${pnlPct >= 75 ? 'var(--success-text)' : pnlPct <= -15 ? 'var(--danger-text)' : 'var(--info-text)'}` }}>
          <div className="text-xs font-semibold mb-0.5" style={{ color: pnlPct >= 75 ? 'var(--success-text)' : pnlPct <= -15 ? 'var(--danger-text)' : 'var(--info-text)' }}>Status</div>
          <div className="text-sm font-mono font-bold" style={{ color: pnlPct >= 75 ? 'var(--success-text)' : pnlPct <= -15 ? 'var(--danger-text)' : 'var(--info-text)' }}>
            {pnlPct >= 75 ? '↑ TRIM ZONE' : pnlPct <= -15 ? '↓ STOP LOSS' : '● HOLD RANGE'}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}% vs avg
          </div>
        </div>
      </div>

      {/* Quick Pro Trader recommendation */}
      {q && (
        <div className="rounded p-3" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
          <div className="flex justify-between items-start mb-1.5">
            <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>⚡ Quick Pro Trader</div>
            <span
              className="pill text-xs"
              style={{
                background: q.action === 'EXIT' ? 'var(--danger-bg)' : q.action === 'TRIM' ? 'var(--warning-bg)' : q.action.includes('BUY') ? 'var(--success-bg)' : 'var(--info-bg)',
                color: q.action === 'EXIT' ? 'var(--danger-text)' : q.action === 'TRIM' ? 'var(--warning-text)' : q.action.includes('BUY') ? 'var(--success-text)' : 'var(--info-text)',
              }}
            >
              {q.action} · {q.confidence}%
            </span>
          </div>
          <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q.one_liner}</div>
          {q.action === 'TRIM' && q.trim_shares && (
            <div className="rounded p-1.5 text-xs font-semibold" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              📤 Sell {q.trim_shares} shares (~€{q.trim_eur?.toLocaleString('nl-NL')}) · keep {q.keep_shares}
            </div>
          )}
          {q.action === 'EXIT' && q.trim_shares && (
            <div className="rounded p-1.5 text-xs font-semibold" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
              📤 Sell ALL {q.trim_shares} shares (~€{q.trim_eur?.toLocaleString('nl-NL')})
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            <span>Stop: €{q.stop_loss}</span>
            <span>TP1: €{q.take_profit_1}</span>
            <span>R/R: {q.risk_reward_ratio}x</span>
            <span>Size: {q.position_size_pct}%</span>
          </div>
        </div>
      )}

      {/* Factor breakdown */}
      <div>
        <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Factor Scores</div>
        <FactorBars scores={position.factorScores} />
      </div>
    </div>
  )
}

// ── Main row ───────────────────────────────────────────────────────────────────

function PositionAnalysisResult({ result }: { result: PositionAnalysisResult }) {
  if (result.error) {
    return (
      <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-text)', color: 'var(--danger-text)' }}>
        ⚠ {result.error}
      </div>
    )
  }

  const verdict      = result.verdict
  const verdictLabel = verdict?.verdict ?? verdict?.finalVerdict ?? 'HOLD'
  const pillClass = verdictLabel === 'BUY' ? 'pill pill-success' : verdictLabel === 'SELL' ? 'pill pill-danger' : 'pill pill-yellow'

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {verdict && (
        <span className={`${pillClass} inline-flex items-center gap-1.5`}>
          {verdictLabel}
          <span className="font-normal opacity-75">{(verdict.confidence * 100).toFixed(0)}% conf</span>
          {verdict.score != null && (
            <span className="font-normal opacity-75">· {verdict.score.toFixed(1)}/10</span>
          )}
        </span>
      )}
      {result.speculation && (
        <span className="pill pill-neutral">
          Speculation: <span className="font-medium">{result.speculation.score}/10</span>
          {' · '}{result.speculation.label}
        </span>
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
    <div className="surface overflow-hidden transition" style={{ borderRadius: 12 }}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ticker + Exchange + Name */}
        <div className="w-28 shrink-0">
          <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{position.ticker}</span>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{position.exchange}</div>
          <div className="hidden sm:block text-xs truncate max-w-[108px]" style={{ color: 'var(--text-tertiary)' }}>
            {position.name}
          </div>
        </div>

        {/* Shares */}
        <div className="hidden md:block w-16 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Shares</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(position.shares, 0)}</div>
        </div>

        {/* Avg Buy */}
        <div className="hidden md:block w-20 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Avg Buy</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>${fmt(position.avgBuyPrice)}</div>
        </div>

        {/* Live Price */}
        <div className="w-20 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Price</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>${fmt(livePrice)}</div>
        </div>

        {/* Value */}
        <div className="hidden sm:block w-24 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Value</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(value)}</div>
        </div>

        {/* P&L */}
        <div className="w-24 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>P&amp;L</div>
          <div className="text-sm font-mono font-semibold" style={{ color: pnlColor(pnl) }}>
            {pnl >= 0 ? '+' : ''}{fmtCurrency(pnl)}
          </div>
          <div className="text-xs" style={{ color: pnlColor(pnlPct) }}>
            {pnlPct >= 0 ? '+' : ''}{fmt(pnlPct, 1)}%
          </div>
        </div>

        {/* Weight */}
        <div className="hidden lg:block w-16 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Weight</div>
          <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{fmt(weight, 1)}%</div>
        </div>

        {/* Score */}
        <div className="hidden sm:block w-16 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Score</div>
          <div className="text-sm font-mono font-semibold" style={{ color: scoreColor(score) }}>
            {fmt(score, 2)}
          </div>
        </div>

        {/* Conviction */}
        <div className="hidden lg:block w-20 shrink-0 text-right">
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Conviction</div>
          <span className={convictionPillClass(position.conviction)}>
            {convictionLabel(position.conviction)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="ml-auto shrink-0 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); runAnalysis() }}
            disabled={analyzing === position.id}
            className="rounded px-2 py-1 text-[11px] font-medium disabled:opacity-40 transition whitespace-nowrap"
            style={{ color: 'var(--primary)' }}
          >
            {analyzing === position.id ? 'Running…' : 'Analyse'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setSellOpen(true) }}
            className="rounded px-2 py-1 text-[11px] font-medium transition whitespace-nowrap"
            style={{ color: 'var(--danger-text)' }}
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
            className="flex h-7 w-7 items-center justify-center rounded-md transition"
            style={{ color: 'var(--text-secondary)' }}
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
          <PositionActionPanel position={position} />
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
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◇ Positions · Unified Verdict</h1>
              <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>All positions with council + sizing + sell signals combined</div>
            </div>
          </div>
          <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>Per position: Council verdict (HOLD/TRIM/EXIT), Sell trigger (score-based), Kelly sizing (ADD/HOLD/TRIM). Highest urgency wins.</div>
          </div>
        </div>
        <div className="rounded-xl py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-3xl mb-3">📊</p>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No positions yet</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add your first position using the Portfolio Overview panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◇ Positions · Unified Verdict</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>All positions with council + sizing + sell signals combined</div>
          </div>
          {stats && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Total value:{' '}
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {fmtCurrency(stats.totalValue)}
              </span>
            </span>
          )}
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>Per position: Council verdict (HOLD/TRIM/EXIT), Sell trigger (score-based), Kelly sizing (ADD/HOLD/TRIM). Highest urgency wins.</div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
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

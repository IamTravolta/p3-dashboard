'use client'

import { useState, useEffect } from 'react'
import PortfolioOverview from './PortfolioOverview'
import { useDashboardStore, usePositions, useWatchlist, usePrices, useSettings, useCash } from '@/lib/store'
import type { Database } from '@/lib/types/database'
import type { Position, FactorScores } from '@/lib/types/database'

type PositionRow = Database['public']['Tables']['positions']['Row']

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcScore(fs: FactorScores): number {
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

function tileStyles(score: number): { bg: string; pillStyle: React.CSSProperties } {
  if (score >= 7) return { bg: 'var(--success-bg)',  pillStyle: { background: 'rgba(125,216,159,0.15)', color: 'var(--success-text)' } }
  if (score >= 5) return { bg: 'var(--yellow-bg)',   pillStyle: { background: 'rgba(240,209,74,0.15)', color: 'var(--yellow-text)' } }
  return              { bg: 'var(--danger-bg)',   pillStyle: { background: 'rgba(248,113,113,0.15)', color: 'var(--danger-text)' } }
}

function barStyleColor(current: number, cap: number): string {
  const ratio = current / cap
  if (ratio >= 1)    return 'var(--danger-text)'
  if (ratio >= 0.80) return 'var(--warning-text)'
  return 'var(--success-text)'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionBanners({ positions, watchlist }: { positions: Position[]; watchlist: { ticker: string; score: number }[] }) {
  const readyCount    = watchlist.filter(w => w.score >= 7).length
  const attentionCount = positions.filter(p => calcScore(p.factorScores) < 4).length

  if (readyCount === 0 && attentionCount === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {readyCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ border: '1px solid var(--success-text)', background: 'var(--success-bg)' }}>
          <span className="text-lg" aria-hidden style={{ color: 'var(--success-text)' }}>✓</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--success-text)' }}>
              {readyCount} watchlist {readyCount === 1 ? 'item' : 'items'} ready to act on
            </p>
            <p className="text-xs" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Score ≥ 7 — conditions met for entry consideration</p>
          </div>
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(125,216,159,0.15)', color: 'var(--success-text)' }}>
            {readyCount}
          </span>
        </div>
      )}
      {attentionCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
          <span className="text-lg" aria-hidden style={{ color: 'var(--warning-text)' }}>!</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>
              {attentionCount} position{attentionCount === 1 ? '' : 's'} need attention
            </p>
            <p className="text-xs" style={{ color: 'var(--warning-text)', opacity: 0.7 }}>Score &lt; 4 — consider reviewing thesis or trimming</p>
          </div>
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(251,146,60,0.15)', color: 'var(--warning-text)' }}>
            {attentionCount}
          </span>
        </div>
      )}
    </div>
  )
}

function PositionHeatmap({ positions, prices }: { positions: Position[]; prices: Record<string, number> }) {
  const setActiveTicker = useDashboardStore(s => s.setActiveTicker)
  const setActiveGroup  = useDashboardStore(s => s.setActiveGroup)

  if (positions.length === 0) {
    return (
      <div className="surface p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No positions to display
      </div>
    )
  }

  const totalValue = positions.reduce((sum, p) => {
    const price = prices[p.ticker] ?? p.currentPrice
    return sum + price * p.shares
  }, 0)

  return (
    <div className="surface p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Position Heatmap</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {positions.map(p => {
          const livePrice = prices[p.ticker] ?? p.currentPrice
          const value     = livePrice * p.shares
          const pnlPct    = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
          const score     = calcScore(p.factorScores)
          const { bg, pillStyle } = tileStyles(score)
          const positive  = pnlPct >= 0
          const weightPct = totalValue > 0 ? (value / totalValue) * 100 : 0

          return (
            <button
              key={p.id}
              onClick={() => {
                setActiveTicker(p.ticker)
                setActiveGroup('portfolio', 'positions')
              }}
              className="rounded-lg p-3 text-left transition focus:outline-none"
              style={{ background: bg, border: '0.5px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{p.ticker}</span>
                <span className="rounded-full px-1.5 py-0.5 text-xs font-semibold" style={pillStyle}>
                  {score.toFixed(1)}
                </span>
              </div>
              <p className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                €{value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs font-medium tabular-nums mt-0.5" style={{ color: positive ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {positive ? '+' : ''}{pnlPct.toFixed(1)}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{weightPct.toFixed(1)}% of ptf</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CapStatusBar({ label, current, cap }: { label: string; current: number; cap: number }) {
  const pct   = Math.min(current / cap * 100, 100)
  const color = barStyleColor(current, cap)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="tabular-nums font-medium" style={{ color }}>
          {current.toFixed(1)}% / {cap}%
        </span>
      </div>
      <div className="progress-track w-full">
        <div
          className="progress-fill rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {/* cap marker line */}
      <div className="relative h-0">
        <div
          className="absolute top-[-10px] w-px h-3"
          style={{ left: `${Math.min(cap / cap * 100, 100)}%`, background: 'var(--text-tertiary)' }}
          title={`Cap: ${cap}%`}
        />
      </div>
    </div>
  )
}

function CapStatusBars({
  positions, prices, cash, settings,
}: {
  positions: Position[]
  prices: Record<string, number>
  cash: number
  settings: { caps: { singleName: number; sector: number; USD: number; cash: number } }
}) {
  // Total portfolio value including cash
  const totalInvested = positions.reduce((sum, p) => {
    const price = prices[p.ticker] ?? p.currentPrice
    return sum + price * p.shares
  }, 0)
  const totalWithCash = totalInvested + cash

  // Single-name: largest position as % of total invested (excl. cash)
  let maxSingle = 0
  for (const p of positions) {
    const price = prices[p.ticker] ?? p.currentPrice
    const val   = price * p.shares
    const pct   = totalInvested > 0 ? (val / totalInvested) * 100 : 0
    if (pct > maxSingle) maxSingle = pct
  }

  // Sector: largest sector as % of total invested
  const sectorTotals: Record<string, number> = {}
  for (const p of positions) {
    const price = prices[p.ticker] ?? p.currentPrice
    const val   = price * p.shares
    sectorTotals[p.sector] = (sectorTotals[p.sector] ?? 0) + val
  }
  const maxSector = totalInvested > 0
    ? Math.max(0, ...Object.values(sectorTotals).map(v => (v / totalInvested) * 100))
    : 0

  // USD exposure: positions where exchange includes NASDAQ or NYSE
  const usdValue = positions
    .filter(p => /NASDAQ|NYSE/i.test(p.exchange))
    .reduce((sum, p) => {
      const price = prices[p.ticker] ?? p.currentPrice
      return sum + price * p.shares
    }, 0)
  const usdPct = totalInvested > 0 ? (usdValue / totalInvested) * 100 : 0

  // Cash %
  const cashPct = totalWithCash > 0 ? (cash / totalWithCash) * 100 : 0

  const bars = [
    { label: 'Single Name',   current: maxSingle, cap: settings.caps.singleName },
    { label: 'Sector',        current: maxSector, cap: settings.caps.sector     },
    { label: 'USD Exposure',  current: usdPct,    cap: settings.caps.USD        },
    { label: 'Cash',          current: cashPct,   cap: settings.caps.cash       },
  ]

  return (
    <div className="surface p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide mb-4" style={{ color: 'var(--text-secondary)' }}>Cap Status</h3>
      <div className="space-y-4">
        {bars.map(b => (
          <CapStatusBar key={b.label} {...b} />
        ))}
      </div>
    </div>
  )
}

// ── Verdict detail panel ───────────────────────────────────────────────────────

interface VerdictData {
  ticker:        string
  final_verdict: string
  confidence:    number
  reasoning?:    string
  logged_at:     string
  outcomes?:     Array<{
    days_since:       number
    price_change_pct: number
    outcome:          string
  }>
}

function verdictBadgeStyle(verdict: string): React.CSSProperties {
  if (verdict === 'BUY')  return { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)' }
  if (verdict === 'SELL') return { background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-text)' }
  return { background: 'var(--yellow-bg)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-text)' }
}

function outcomeColor(outcome: string): string {
  if (outcome === 'correct')     return 'var(--success-text)'
  if (outcome === 'wrong')       return 'var(--danger-text)'
  if (outcome === 'missed_gain') return 'var(--warning-text)'
  return 'var(--text-secondary)'
}

function TickerDetailPanel({ ticker }: { ticker: string }) {
  const setActiveTicker = useDashboardStore((s) => s.setActiveTicker)
  const [data,    setData]    = useState<VerdictData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/verdict?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setData(j.latest ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load verdict'))
      .finally(() => setLoading(false))
  }, [ticker])

  return (
    <div className="surface p-5 space-y-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{ticker}</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Latest verdict</span>
        </div>
        <button
          onClick={() => setActiveTicker(null)}
          className="rounded-md p-1.5 transition"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading && (
        <p className="text-sm animate-pulse" style={{ color: 'var(--text-secondary)' }}>Loading verdict…</p>
      )}

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }}>{error}</p>
      )}

      {!loading && !error && !data && (
        <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>No verdict on record for {ticker}.</p>
      )}

      {data && (
        <div className="space-y-4">
          {/* Verdict badge + confidence */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold" style={verdictBadgeStyle(data.final_verdict)}>
              {data.final_verdict}
            </span>
            <div className="flex flex-col">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Confidence</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {(data.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex flex-col ml-auto text-right">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Logged</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {new Date(data.logged_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Reasoning */}
          {data.reasoning && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>Reasoning</h4>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.reasoning}</p>
            </div>
          )}

          {/* Outcome history */}
          {data.outcomes && data.outcomes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>Outcome history</h4>
              <div className="flex flex-wrap gap-2">
                {data.outcomes.map((o) => (
                  <div
                    key={o.days_since}
                    className="rounded-lg px-3 py-2 text-center min-w-[72px]"
                    style={{ border: '0.5px solid var(--border)', background: 'var(--bg)' }}
                  >
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{o.days_since}d</div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: o.price_change_pct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {o.price_change_pct >= 0 ? '+' : ''}{o.price_change_pct.toFixed(1)}%
                    </div>
                    <div className="text-xs capitalize" style={{ color: outcomeColor(o.outcome) }}>{o.outcome}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PortfolioOverviewExtendedProps {
  initialPositions: PositionRow[]
}

export default function PortfolioOverviewExtended({ initialPositions }: PortfolioOverviewExtendedProps) {
  const positions    = usePositions()
  const watchlist    = useWatchlist()
  const prices       = usePrices()
  const cash         = useCash()
  const settings     = useSettings()
  const activeTicker = useDashboardStore((s) => s.activeTicker)

  return (
    <div className="space-y-5">
      {/* Existing portfolio overview */}
      <PortfolioOverview initialPositions={initialPositions} />

      {/* ── Extended sections ── */}
      <div className="space-y-4">
        {/* Action Banners — above the heatmap */}
        <ActionBanners positions={positions} watchlist={watchlist} />

        {/* Position Heatmap */}
        <PositionHeatmap positions={positions} prices={prices} />

        {/* Active ticker verdict panel — slides in below heatmap */}
        {activeTicker && (
          <TickerDetailPanel ticker={activeTicker} />
        )}

        {/* Cap Status Bars */}
        <CapStatusBars
          positions={positions}
          prices={prices}
          cash={cash}
          settings={settings}
        />
      </div>
    </div>
  )
}

'use client'

import PortfolioOverview from './PortfolioOverview'
import { useDashboardStore, usePositions, useWatchlist, usePrices, useSettings, useCash } from '@/lib/store'
import type { Database } from '@/lib/types/database'
import type { Position, FactorScores } from '@/lib/types/database'

type PositionRow = Database['public']['Tables']['positions']['Row']

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcScore(fs: FactorScores): number {
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

function tileColors(score: number): { bg: string; pill: string } {
  if (score >= 7) return { bg: 'bg-emerald-950/50', pill: 'bg-emerald-900/80 text-emerald-300' }
  if (score >= 5) return { bg: 'bg-yellow-950/50',  pill: 'bg-yellow-900/80 text-yellow-300'  }
  return              { bg: 'bg-red-950/50',         pill: 'bg-red-900/80 text-red-300'        }
}

function barColor(current: number, cap: number): string {
  const ratio = current / cap
  if (ratio >= 1)    return 'bg-red-500'
  if (ratio >= 0.80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function barTextColor(current: number, cap: number): string {
  const ratio = current / cap
  if (ratio >= 1)    return 'text-red-400'
  if (ratio >= 0.80) return 'text-amber-400'
  return 'text-emerald-400'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActionBanners({ positions, watchlist }: { positions: Position[]; watchlist: { ticker: string; score: number }[] }) {
  const readyCount    = watchlist.filter(w => w.score >= 7).length
  const attentionCount = positions.filter(p => calcScore(p.factorScores) < 4).length

  if (readyCount === 0 && attentionCount === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-4">
      {readyCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-4 py-3">
          <span className="text-emerald-400 text-lg" aria-hidden>✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              {readyCount} watchlist {readyCount === 1 ? 'item' : 'items'} ready to act on
            </p>
            <p className="text-xs text-emerald-600">Score ≥ 7 — conditions met for entry consideration</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-900/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            {readyCount}
          </span>
        </div>
      )}
      {attentionCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-800/60 bg-amber-950/40 px-4 py-3">
          <span className="text-amber-400 text-lg" aria-hidden>!</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">
              {attentionCount} position{attentionCount === 1 ? '' : 's'} need attention
            </p>
            <p className="text-xs text-amber-600">Score &lt; 4 — consider reviewing thesis or trimming</p>
          </div>
          <span className="ml-auto rounded-full bg-amber-900/60 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-500">
        No positions to display
      </div>
    )
  }

  const totalValue = positions.reduce((sum, p) => {
    const price = prices[p.ticker] ?? p.currentPrice
    return sum + price * p.shares
  }, 0)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Position Heatmap</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {positions.map(p => {
          const livePrice = prices[p.ticker] ?? p.currentPrice
          const value     = livePrice * p.shares
          const pnlPct    = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
          const score     = calcScore(p.factorScores)
          const { bg, pill } = tileColors(score)
          const positive  = pnlPct >= 0
          const weightPct = totalValue > 0 ? (value / totalValue) * 100 : 0

          return (
            <button
              key={p.id}
              onClick={() => {
                setActiveTicker(p.ticker)
                setActiveGroup('portfolio', 'positions')
              }}
              className={`${bg} rounded-lg border border-zinc-800/60 p-3 text-left transition hover:border-zinc-600 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono text-sm font-bold text-white">{p.ticker}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${pill}`}>
                  {score.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-zinc-400 tabular-nums">
                €{value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs font-medium tabular-nums mt-0.5 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}{pnlPct.toFixed(1)}%
              </p>
              <p className="text-xs text-zinc-600 mt-1">{weightPct.toFixed(1)}% of ptf</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CapStatusBar({ label, current, cap }: { label: string; current: number; cap: number }) {
  const pct   = Math.min(current / cap * 100, 100)
  const color = barColor(current, cap)
  const text  = barTextColor(current, cap)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={`tabular-nums font-medium ${text}`}>
          {current.toFixed(1)}% / {cap}%
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* cap marker line */}
      <div className="relative h-0">
        <div
          className="absolute top-[-10px] w-px h-3 bg-zinc-500"
          style={{ left: `${Math.min(cap / cap * 100, 100)}%` }}
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">Cap Status</h3>
      <div className="space-y-4">
        {bars.map(b => (
          <CapStatusBar key={b.label} {...b} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PortfolioOverviewExtendedProps {
  initialPositions: PositionRow[]
}

export default function PortfolioOverviewExtended({ initialPositions }: PortfolioOverviewExtendedProps) {
  const positions = usePositions()
  const watchlist = useWatchlist()
  const prices    = usePrices()
  const cash      = useCash()
  const settings  = useSettings()

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

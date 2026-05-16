'use client'

import { usePositions, usePrices, useStats, useSettings, useCash } from '@/lib/store'
import type { Position } from '@/lib/types/database'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

type SizingStatus = 'OVERSIZED' | 'OPTIMAL' | 'UNDERSIZED'

function getStatus(current: number, maxCap: number): SizingStatus {
  if (current > maxCap) return 'OVERSIZED'
  if (current < maxCap * 0.4) return 'UNDERSIZED'
  return 'OPTIMAL'
}

function statusPill(status: SizingStatus) {
  const styles: Record<SizingStatus, string> = {
    OVERSIZED:  'bg-red-900/60 text-red-300 border border-red-700',
    OPTIMAL:    'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
    UNDERSIZED: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

function suggestedAction(status: SizingStatus, current: number, maxCap: number): string {
  if (status === 'OVERSIZED') {
    const excess = current - maxCap
    return `Trim ~${fmt(excess, 1)}% to reach cap`
  }
  if (status === 'UNDERSIZED') {
    const room = maxCap * 0.7 - current
    return room > 0 ? `Room to add ~${fmt(room, 1)}%` : 'Consider adding'
  }
  return 'Hold — within optimal range'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SizingRow({
  position,
  currentWeight,
  maxCap,
}: {
  position: Position
  currentWeight: number
  maxCap: number
}) {
  const status = getStatus(currentWeight, maxCap)

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition">
      <td className="px-4 py-3">
        <div className="font-mono font-bold text-white text-sm">{position.ticker}</div>
        <div className="text-xs text-zinc-500">{position.name}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-mono text-zinc-200">{fmt(currentWeight, 1)}%</div>
        <div className="mt-1 h-1 w-20 ml-auto bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              status === 'OVERSIZED' ? 'bg-red-500' :
              status === 'OPTIMAL'   ? 'bg-emerald-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${Math.min((currentWeight / maxCap) * 100, 100)}%` }}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-mono text-zinc-400">{fmt(maxCap, 0)}%</span>
      </td>
      <td className="px-4 py-3 text-center">
        {statusPill(status)}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-400">
        {suggestedAction(status, currentWeight, maxCap)}
      </td>
    </tr>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function SizingView() {
  const positions = usePositions()
  const prices    = usePrices()
  const stats     = useStats()
  const settings  = useSettings()
  const cash      = useCash()

  const totalValue = stats?.totalValue ?? 0
  const maxSinglePct = settings.caps.singleName // e.g. 15

  // Build enriched rows
  const rows = positions.map((pos) => {
    const livePrice = prices[pos.ticker] ?? pos.currentPrice
    const value = livePrice * pos.shares
    const weight = totalValue > 0 ? (value / totalValue) * 100 : 0
    return { position: pos, value, weight }
  })

  const oversized  = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'OVERSIZED').length
  const undersized = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'UNDERSIZED').length
  const optimal    = rows.filter((r) => getStatus(r.weight, maxSinglePct) === 'OPTIMAL').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-white">Position Sizing</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Review position weights vs your concentration caps and identify rebalancing opportunities.
        </p>
      </div>

      {/* Settings panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="text-xs text-zinc-500 mb-1">Total Portfolio</div>
          <div className="text-base font-mono font-semibold text-white">
            {fmtCurrency(totalValue)}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="text-xs text-zinc-500 mb-1">Cash Available</div>
          <div className="text-base font-mono font-semibold text-white">
            {fmtCurrency(cash)}
          </div>
          {totalValue + cash > 0 && (
            <div className="text-xs text-zinc-600 mt-0.5">
              {fmt(((cash) / (totalValue + cash)) * 100, 1)}% of total
            </div>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="text-xs text-zinc-500 mb-1">Max Single Name</div>
          <div className="text-base font-mono font-semibold text-white">{maxSinglePct}%</div>
          <div className="text-xs text-zinc-600 mt-0.5">per settings</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <div className="text-xs text-zinc-500 mb-1">Max Sector</div>
          <div className="text-base font-mono font-semibold text-white">{settings.caps.sector}%</div>
          <div className="text-xs text-zinc-600 mt-0.5">per settings</div>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-red-900/20 border border-red-800 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs text-red-300">{oversized} Oversized</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-emerald-900/20 border border-emerald-800 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-emerald-300">{optimal} Optimal</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-yellow-900/20 border border-yellow-800 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="text-xs text-yellow-300">{undersized} Undersized</span>
        </div>
      </div>

      {/* Table */}
      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-12 text-center">
          <p className="text-zinc-500 text-sm">No positions to size.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Ticker
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Current Weight
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Max Cap
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Suggested Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.weight - a.weight)
                .map(({ position, weight }) => (
                  <SizingRow
                    key={position.id}
                    position={position}
                    currentWeight={weight}
                    maxCap={maxSinglePct}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Kelly Criterion placeholder */}
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🧮</div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Kelly Criterion Sizing</h3>
            <p className="text-xs text-zinc-500 leading-relaxed mb-3">
              AI-powered optimal position sizing based on your historical win rates, conviction
              scores, and correlation matrix. Uses the Kelly formula adjusted for your risk
              tolerance.
            </p>
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-500">
              POST /api/railway/position-sizing
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Connect Railway backend in Settings to enable AI-powered sizing recommendations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

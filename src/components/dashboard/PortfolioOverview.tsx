'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Database } from '@/lib/types/database'

type PositionRow = Database['public']['Tables']['positions']['Row']

interface PortfolioOverviewProps {
  initialPositions: PositionRow[]
}

// Map a Supabase row to the app-level Position shape
function rowToPosition(row: PositionRow) {
  const fs = row.factor_scores as { q?: number; g?: number; v?: number; m?: number; s?: number }
  return {
    id:           row.id,
    ticker:       row.ticker,
    name:         row.name,
    exchange:     row.exchange,
    sector:       row.sector,
    subIndustry:  row.sub_industry ?? '',
    shares:       row.shares,
    avgBuyPrice:  row.avg_buy_price,
    currentPrice: row.current_price,
    currency:     row.currency,
    factorScores: {
      q: fs.q ?? 0,
      g: fs.g ?? 0,
      v: fs.v ?? 0,
      m: fs.m ?? 0,
      s: fs.s ?? 0,
    },
    conviction: row.conviction,
    thesis:     row.thesis ?? '',
    notes:      row.notes  ?? '',
    addedDate:  row.added_at,
  }
}

export default function PortfolioOverview({ initialPositions }: PortfolioOverviewProps) {
  const positions    = useDashboardStore((s) => s.positions)
  const setPositions = useDashboardStore((s) => s.setPositions)
  const stats        = useDashboardStore((s) => s.stats)
  const activeTab    = useDashboardStore((s) => s.activeTab)

  // Seed store from server-side data on first mount
  useEffect(() => {
    if (initialPositions.length > 0 && positions.length === 0) {
      setPositions(initialPositions.map(rowToPosition))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (activeTab !== 'portfolio') return null

  const totalValue   = stats?.totalValue   ?? 0
  const totalPnL     = stats?.totalPnL     ?? 0
  const totalPnLPct  = stats?.totalPnLPct  ?? 0
  const isPnLPositive = totalPnL >= 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Portfolio Value" value={`€${totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`} />
        <StatCard
          label="Total P&L"
          value={`${isPnLPositive ? '+' : ''}€${totalPnL.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`}
          valueClass={isPnLPositive ? 'text-emerald-400' : 'text-red-400'}
          sub={`${isPnLPositive ? '+' : ''}${totalPnLPct.toFixed(2)}%`}
        />
        <StatCard label="Positions" value={String(positions.length)} />
        <StatCard label="Cash Buffer" value={`€${(stats?.cashBuffer ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`} sub={`${(stats?.cashPct ?? 0).toFixed(1)}%`} />
      </div>

      {/* Positions table */}
      {positions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3 hidden sm:table-cell">Name</th>
                <th className="px-4 py-3 text-right">Shares</th>
                <th className="px-4 py-3 text-right">Avg Buy</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Conviction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {positions.map((p) => {
                const value = p.currentPrice * p.shares
                const pnl   = (p.currentPrice - p.avgBuyPrice) * p.shares
                const pnlPct = p.avgBuyPrice > 0
                  ? ((p.currentPrice - p.avgBuyPrice) / p.avgBuyPrice) * 100
                  : 0
                const positive = pnl >= 0

                return (
                  <tr key={p.id} className="group hover:bg-zinc-800/30 transition cursor-pointer">
                    <td className="px-4 py-3 font-mono font-semibold text-white">
                      {p.ticker}
                      <div className="text-xs text-zinc-500 font-normal">{p.exchange}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 hidden sm:table-cell max-w-[160px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{p.shares.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">€{p.avgBuyPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white font-medium">€{p.currentPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">€{value.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {positive ? '+' : ''}{pnlPct.toFixed(1)}%
                      <div className="text-xs opacity-75">{positive ? '+' : ''}€{pnl.toFixed(0)}</div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <ConvictionBadge level={p.conviction} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function ConvictionBadge({ level }: { level: number }) {
  const colors = ['', 'bg-red-900 text-red-300', 'bg-orange-900 text-orange-300', 'bg-yellow-900 text-yellow-300', 'bg-emerald-900 text-emerald-300', 'bg-indigo-900 text-indigo-300']
  const labels = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High']
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colors[level] ?? ''}`}>
      {labels[level] ?? level}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
      <p className="text-3xl mb-3">📭</p>
      <h3 className="text-base font-semibold text-white mb-1">No positions yet</h3>
      <p className="text-sm text-zinc-500">
        Add your first position or{' '}
        <a href="/migrate" className="text-indigo-400 hover:underline">
          import from your existing dashboard
        </a>
        .
      </p>
    </div>
  )
}

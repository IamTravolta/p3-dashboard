'use client'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { usePortfolioData } from '@/hooks/usePortfolioData'
import AddPositionModal from '@/components/portfolio/AddPositionModal'
import type { Database } from '@/lib/types/database'
import type { Position, FactorScores } from '@/lib/types/database'

type PositionRow = Database['public']['Tables']['positions']['Row']

interface PortfolioOverviewProps {
  initialPositions: PositionRow[]
}

export default function PortfolioOverview({ initialPositions }: PortfolioOverviewProps) {
  const positions      = useDashboardStore((s) => s.positions)
  const setPositions   = useDashboardStore((s) => s.setPositions)
  const removePosition = useDashboardStore((s) => s.removePosition)
  const prices         = useDashboardStore((s) => s.prices)
  const stats          = useDashboardStore((s) => s.stats)
  const activeTab      = useDashboardStore((s) => s.activeTab)
  const isLoading      = useDashboardStore((s) => s.isLoading)
  const isSyncing      = useDashboardStore((s) => s.isSyncing)

  const [modalOpen, setModalOpen]         = useState(false)
  const [editTarget, setEditTarget]       = useState<{ id: string; data: Omit<Database['public']['Tables']['positions']['Insert'], 'user_id'> & { factor_scores: FactorScores } } | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting]           = useState(false)

  // Seed store from server-side data on first mount (avoids loading flash)
  const initialized = positions.length > 0
  if (!initialized && initialPositions.length > 0) {
    setPositions(initialPositions.map(rowToPosition))
  }

  // Start live price refresh loop
  const { loadPositions } = usePortfolioData()

  if (activeTab !== 'portfolio') return null

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalValue  = stats?.totalValue   ?? 0
  const totalPnL    = stats?.totalPnL     ?? 0
  const totalPnLPct = stats?.totalPnLPct  ?? 0
  const isPos       = totalPnL >= 0

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openEdit(p: Position) {
    setEditTarget({
      id: p.id,
      data: {
        ticker:        p.ticker,
        name:          p.name,
        exchange:      p.exchange,
        sector:        p.sector,
        sub_industry:  p.subIndustry || null,
        shares:        p.shares,
        avg_buy_price: p.avgBuyPrice,
        current_price: p.currentPrice,
        currency:      p.currency,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        factor_scores: p.factorScores as any,
        conviction:    p.conviction,
        thesis:        p.thesis || null,
        notes:         p.notes  || null,
        added_at:      p.addedDate,
      },
    })
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const resp = await fetch(`/api/positions/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Delete failed')
      removePosition(id)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Portfolio Value"
          value={`€${totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`} />
        <StatCard
          label="Total P&L"
          value={`${isPos ? '+' : ''}€${Math.abs(totalPnL).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`}
          valueClass={isPos ? 'text-emerald-400' : 'text-red-400'}
          sub={`${isPos ? '+' : ''}${totalPnLPct.toFixed(2)}%`}
        />
        <StatCard label="Positions" value={String(positions.length)} />
        <StatCard label="Cash Buffer"
          value={`€${(stats?.cashBuffer ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`}
          sub={`${(stats?.cashPct ?? 0).toFixed(1)}%`} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Positions</h2>
          {isSyncing && (
            <span className="text-xs text-indigo-400 flex items-center gap-1">
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
              </svg>
              Updating prices…
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadPositions()}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            + Add position
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : positions.length === 0 ? (
        <EmptyState onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3 hidden sm:table-cell">Name</th>
                <th className="px-4 py-3 text-right">Shares</th>
                <th className="px-4 py-3 text-right">Avg Buy</th>
                <th className="px-4 py-3 text-right">Live Price</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">P&L</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Conviction</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Score</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {positions.map((p) => {
                const livePrice  = prices[p.ticker] ?? p.currentPrice
                const value      = livePrice * p.shares
                const pnl        = (livePrice - p.avgBuyPrice) * p.shares
                const pnlPct     = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
                const positive   = pnl >= 0
                const hasLive    = !!prices[p.ticker]
                const score      = calcScore(p.factorScores)

                return (
                  <tr key={p.id} className="group hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-white">{p.ticker}</span>
                      <div className="text-xs text-zinc-500">{p.exchange}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 hidden sm:table-cell max-w-[160px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">{p.shares.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">€{p.avgBuyPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={`font-semibold ${hasLive ? 'text-white' : 'text-zinc-500'}`}>
                        €{livePrice.toFixed(2)}
                      </span>
                      {hasLive && <div className="text-xs text-emerald-500/70">live</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">
                      €{value.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {positive ? '+' : ''}{pnlPct.toFixed(1)}%
                      <div className="text-xs opacity-75">{positive ? '+' : ''}€{Math.abs(pnl).toFixed(0)}</div>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <ConvictionBadge level={p.conviction} />
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <ScoreBadge score={score} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
                        >
                          Edit
                        </button>
                        {deleteConfirm === p.id ? (
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting}
                            className="rounded px-2 py-1 text-xs bg-red-900/50 text-red-300 hover:bg-red-800 transition"
                          >
                            {deleting ? '…' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-700 hover:text-red-400 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sector breakdown (mini) */}
      {positions.length > 0 && (
        <SectorBreakdown positions={positions} prices={prices} />
      )}

      {/* Add/Edit modal */}
      <AddPositionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined) }}
        editPosition={editTarget}
      />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowToPosition(row: PositionRow): Position {
  const fs = (row.factor_scores ?? {}) as { q?: number; g?: number; v?: number; m?: number; s?: number }
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
    factorScores: { q: fs.q ?? 0, g: fs.g ?? 0, v: fs.v ?? 0, m: fs.m ?? 0, s: fs.s ?? 0 },
    conviction:   row.conviction,
    thesis:       row.thesis  ?? '',
    notes:        row.notes   ?? '',
    addedDate:    row.added_at,
  }
}

function calcScore(fs: FactorScores): number {
  return (fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueClass = 'text-white' }: {
  label: string; value: string; sub?: string; valueClass?: string
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
  const colors = ['', 'bg-red-900/50 text-red-300', 'bg-orange-900/50 text-orange-300',
    'bg-yellow-900/50 text-yellow-300', 'bg-emerald-900/50 text-emerald-300', 'bg-indigo-900/50 text-indigo-300']
  const labels = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High']
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${colors[level] ?? ''}`}>
      {labels[level] ?? level}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`font-mono text-sm font-semibold ${color}`}>{score.toFixed(1)}</span>
}

function SectorBreakdown({ positions, prices }: { positions: Position[]; prices: Record<string, number> }) {
  const sectors: Record<string, number> = {}
  let total = 0
  for (const p of positions) {
    const price = prices[p.ticker] ?? p.currentPrice
    const val = price * p.shares
    sectors[p.sector] = (sectors[p.sector] ?? 0) + val
    total += val
  }

  const sorted = Object.entries(sectors).sort((a, b) => b[1] - a[1])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Sector breakdown</h3>
      <div className="space-y-2">
        {sorted.map(([sector, val]) => {
          const pct = total > 0 ? (val / total) * 100 : 0
          return (
            <div key={sector} className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 w-40 truncate shrink-0">{sector}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs tabular-nums text-zinc-400 w-10 text-right">{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-zinc-800 rounded w-16" />
          <div className="h-4 bg-zinc-800 rounded flex-1" />
          <div className="h-4 bg-zinc-800 rounded w-20" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
      <p className="text-3xl mb-3">📭</p>
      <h3 className="text-base font-semibold text-white mb-1">No positions yet</h3>
      <p className="text-sm text-zinc-500 mb-4">
        Add your first position or{' '}
        <a href="/migrate" className="text-indigo-400 hover:underline">import from your existing dashboard</a>.
      </p>
      <button
        onClick={onAdd}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
      >
        + Add first position
      </button>
    </div>
  )
}

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
      {/* Section header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◇ Portfolio Overview</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>Portfolio positions with live prices and factor scores</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>Live prices refresh every 60s. Factor scores (Q/G/V/M/S) drive conviction. Click any row to drill down.</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Portfolio Value"
          value={`€${totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`} />
        <StatCard
          label="Total P&L"
          value={`${isPos ? '+' : ''}€${Math.abs(totalPnL).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`}
          color={isPos ? 'var(--success-text)' : 'var(--danger-text)'}
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
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Positions</h2>
          {isSyncing && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--primary)' }}>
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
            className="btn rounded-md px-3 py-1.5 text-xs"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
            className="btn btn-primary rounded-md px-3 py-1.5 text-xs font-semibold"
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
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide" style={{ borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>
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
            <tbody>
              {positions.map((p) => {
                const livePrice  = prices[p.ticker] ?? p.currentPrice
                const value      = livePrice * p.shares
                const pnl        = (livePrice - p.avgBuyPrice) * p.shares
                const pnlPct     = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
                const positive   = pnl >= 0
                const hasLive    = !!prices[p.ticker]
                const score      = calcScore(p.factorScores)

                return (
                  <tr key={p.id} className="group transition" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{p.ticker}</span>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{p.exchange}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell max-w-[160px] truncate" style={{ color: 'var(--text-secondary)' }}>{p.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{p.shares.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>€{p.avgBuyPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold" style={{ color: hasLive ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        €{livePrice.toFixed(2)}
                      </span>
                      {hasLive && <div className="text-xs" style={{ color: 'var(--success-text)', opacity: 0.7 }}>live</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      €{value.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: positive ? 'var(--success-text)' : 'var(--danger-text)' }}>
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
                          className="rounded px-2 py-1 text-xs transition"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Edit
                        </button>
                        {deleteConfirm === p.id ? (
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting}
                            className="rounded px-2 py-1 text-xs transition"
                            style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                          >
                            {deleting ? '…' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="rounded px-2 py-1 text-xs transition"
                            style={{ color: 'var(--text-tertiary)' }}
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

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="kpi-card">
      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function ConvictionBadge({ level }: { level: number }) {
  const styleMap: Record<number, React.CSSProperties> = {
    1: { background: 'var(--danger-bg)', color: 'var(--danger-text)' },
    2: { background: 'var(--warning-bg)', color: 'var(--warning-text)' },
    3: { background: 'var(--yellow-bg)', color: 'var(--yellow-text)' },
    4: { background: 'var(--success-bg)', color: 'var(--success-text)' },
    5: { background: 'var(--info-bg)', color: 'var(--info-text)' },
  }
  const labels = ['', 'Very Low', 'Low', 'Medium', 'High', 'Very High']
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style={styleMap[level] ?? {}}>
      {labels[level] ?? level}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? 'var(--success-text)' : score >= 5 ? 'var(--yellow-text)' : 'var(--danger-text)'
  return <span className="font-mono text-sm font-semibold" style={{ color }}>{score.toFixed(1)}</span>
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
    <div className="surface p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Sector breakdown</h3>
      <div className="space-y-2">
        {sorted.map(([sector, val]) => {
          const pct = total > 0 ? (val / total) * 100 : 0
          return (
            <div key={sector} className="flex items-center gap-3">
              <span className="text-xs w-40 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>{sector}</span>
              <div className="progress-track flex-1">
                <div className="progress-fill rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
              </div>
              <span className="text-xs tabular-nums w-10 text-right" style={{ color: 'var(--text-secondary)' }}>{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="surface p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 rounded w-16" style={{ background: 'var(--bg)' }} />
          <div className="h-4 rounded flex-1" style={{ background: 'var(--bg)' }} />
          <div className="h-4 rounded w-20" style={{ background: 'var(--bg)' }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="surface py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
      <p className="text-3xl mb-3">📭</p>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No positions yet</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Add your first position or{' '}
        <a href="/migrate" style={{ color: 'var(--primary)' }} className="hover:underline">import from your existing dashboard</a>.
      </p>
      <button
        onClick={onAdd}
        className="btn btn-primary"
      >
        + Add first position
      </button>
    </div>
  )
}

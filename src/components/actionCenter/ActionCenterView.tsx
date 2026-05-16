'use client'

import { useState, useEffect } from 'react'
import { usePositions, useWatchlist, usePrices, useRailwayUrl } from '@/lib/store'
import type { Position, WatchlistItem } from '@/lib/types/database'
import type { FactorScores } from '@/lib/types/database'

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcScore(fs: FactorScores): number {
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

// ── Alert types ────────────────────────────────────────────────────────────────

type AlertTier = 'ACTION' | 'INVESTIGATE' | 'MONITOR'

interface ComputedAlert {
  id: string
  tier: AlertTier
  ticker: string
  message: string
  detail: string
  isPosition: boolean
}

function buildComputedAlerts(
  positions: Position[],
  watchlist: WatchlistItem[],
  prices: Record<string, number>
): ComputedAlert[] {
  const alerts: ComputedAlert[] = []

  for (const p of positions) {
    const livePrice = prices[p.ticker] ?? p.currentPrice
    const pnlPct    = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
    const score     = calcScore(p.factorScores)

    // ACTION: score < 4 OR P&L < -20%
    if (score < 4 || pnlPct < -20) {
      const reasons: string[] = []
      if (score < 4)      reasons.push(`Score ${score.toFixed(1)} — very low conviction`)
      if (pnlPct < -20)   reasons.push(`P&L ${pnlPct.toFixed(1)}% — significant drawdown`)
      alerts.push({
        id:         `action-pos-${p.id}`,
        tier:       'ACTION',
        ticker:     p.ticker,
        message:    reasons[0],
        detail:     `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%  ·  Score ${score.toFixed(1)}`,
        isPosition: true,
      })
      continue
    }

    // INVESTIGATE: score 4–5.9 OR P&L < -10%
    if ((score >= 4 && score < 6) || pnlPct < -10) {
      const reasons: string[] = []
      if (score >= 4 && score < 6) reasons.push(`Score ${score.toFixed(1)} — moderate conviction`)
      if (pnlPct < -10)            reasons.push(`P&L ${pnlPct.toFixed(1)}% — approaching threshold`)
      alerts.push({
        id:         `investigate-pos-${p.id}`,
        tier:       'INVESTIGATE',
        ticker:     p.ticker,
        message:    reasons[0],
        detail:     `P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%  ·  Score ${score.toFixed(1)}`,
        isPosition: true,
      })
      continue
    }
  }

  // MONITOR: watchlist items with score >= 7
  for (const w of watchlist) {
    if (w.score >= 7) {
      alerts.push({
        id:         `monitor-wl-${w.id}`,
        tier:       'MONITOR',
        ticker:     w.ticker,
        message:    `Score ${w.score.toFixed(1)} — entry conditions met`,
        detail:     `${w.name}  ·  Score ${w.score.toFixed(1)}`,
        isPosition: false,
      })
    }
  }

  return alerts
}

// ── Tier config ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<AlertTier, {
  label: string
  pillClass: string
  borderClass: string
  headerClass: string
  iconLabel: string
}> = {
  ACTION: {
    label:       'ACTION NEEDED',
    pillClass:   'bg-red-900/70 text-red-300',
    borderClass: 'border-l-red-500',
    headerClass: 'text-red-400',
    iconLabel:   '!',
  },
  INVESTIGATE: {
    label:       'INVESTIGATE',
    pillClass:   'bg-amber-900/70 text-amber-300',
    borderClass: 'border-l-amber-500',
    headerClass: 'text-amber-400',
    iconLabel:   '?',
  },
  MONITOR: {
    label:       'MONITOR',
    pillClass:   'bg-indigo-900/70 text-indigo-300',
    borderClass: 'border-l-indigo-500',
    headerClass: 'text-indigo-400',
    iconLabel:   '~',
  },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TierHeader({ tier, count }: { tier: AlertTier; count: number }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${cfg.pillClass}`}>
        {cfg.iconLabel}
      </span>
      <h3 className={`text-xs font-bold uppercase tracking-widest ${cfg.headerClass}`}>
        {cfg.label}
      </h3>
      {count > 0 && (
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.pillClass}`}>
          {count}
        </span>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: ComputedAlert }) {
  const cfg = TIER_CONFIG[alert.tier]

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900 border-l-4 ${cfg.borderClass} px-4 py-3 flex items-start gap-3`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-bold text-white">{alert.ticker}</span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cfg.pillClass}`}>
            {alert.isPosition ? 'Position' : 'Watchlist'}
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-snug">{alert.message}</p>
        <p className="text-xs text-zinc-500 mt-1 tabular-nums">{alert.detail}</p>
      </div>
    </div>
  )
}

function EmptyState({ tier }: { tier: AlertTier }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <p className={`text-sm text-zinc-600 italic px-1`}>
      All clear — no {cfg.label.toLowerCase()} items
    </p>
  )
}

function TierSection({ tier, alerts }: { tier: AlertTier; alerts: ComputedAlert[] }) {
  return (
    <section>
      <TierHeader tier={tier} count={alerts.length} />
      {alerts.length === 0 ? (
        <EmptyState tier={tier} />
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </section>
  )
}

type EarningsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { status: 'success'; items: any[] }

function EarningsSection({ tickers, railwayConfigured }: { tickers: string[]; railwayConfigured: boolean }) {
  const [state, setState] = useState<EarningsState>({ status: 'idle' })

  useEffect(() => {
    if (!railwayConfigured || tickers.length === 0) return

    setState({ status: 'loading' })
    fetch(`/api/railway/earnings?tickers=${encodeURIComponent(tickers.join(','))}`)
      .then(async (resp) => {
        const json = await resp.json()
        if (!resp.ok) {
          setState({ status: 'error', message: json.error ?? `HTTP ${resp.status}` })
          return
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any = json
        const items = Array.isArray(raw) ? raw : Array.isArray(raw?.earnings) ? raw.earnings : Array.isArray(raw?.data) ? raw.data : []
        setState({ status: 'success', items })
      })
      .catch((err) => {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Fetch failed' })
      })
  }, [tickers.join(','), railwayConfigured]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Earnings This Week
        </h3>
      </div>

      {!railwayConfigured ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500 mb-1">Connect Railway to see earnings calendar</p>
        </div>
      ) : tickers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">Add positions to track their earnings</p>
        </div>
      ) : state.status === 'loading' ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">Loading earnings…</p>
        </div>
      ) : state.status === 'error' ? (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-xs text-red-400">
          {state.message}
        </div>
      ) : state.status === 'success' && state.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center">
          <p className="text-sm text-zinc-500">No upcoming earnings found for your positions.</p>
        </div>
      ) : state.status === 'success' ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {state.items.map((item: any, i: number) => {
            const ticker     = item.ticker      ?? item.symbol    ?? '—'
            const date       = item.date        ?? item.report_date ?? item.earnings_date ?? null
            const epsEst     = item.eps_estimate ?? item.eps       ?? item.estimate       ?? null
            const importance = item.importance  ?? item.priority  ?? null

            return (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 flex items-center gap-3"
              >
                <span className="font-mono text-sm font-bold text-white w-16 shrink-0">{ticker}</span>
                <div className="flex-1 min-w-0">
                  {date && (
                    <p className="text-xs font-mono text-zinc-400">{new Date(date).toLocaleDateString()}</p>
                  )}
                  {epsEst != null && (
                    <p className="text-xs text-zinc-500">EPS est: <span className="text-zinc-300">{epsEst}</span></p>
                  )}
                </div>
                {importance && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    String(importance).toLowerCase() === 'high'
                      ? 'bg-red-900/50 text-red-300'
                      : String(importance).toLowerCase() === 'medium'
                      ? 'bg-amber-900/50 text-amber-300'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {importance}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function ActionCenterView() {
  const positions  = usePositions()
  const watchlist  = useWatchlist()
  const prices     = usePrices()
  const railwayUrl = useRailwayUrl()

  const allAlerts = buildComputedAlerts(positions, watchlist, prices)
  const tickers   = positions.map((p) => p.ticker)

  const actionAlerts      = allAlerts.filter(a => a.tier === 'ACTION')
  const investigateAlerts = allAlerts.filter(a => a.tier === 'INVESTIGATE')
  const monitorAlerts     = allAlerts.filter(a => a.tier === 'MONITOR')

  const totalCount = allAlerts.length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Action Center</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Prioritized alerts for your portfolio</p>
        </div>
        {totalCount > 0 && (
          <span className="rounded-full bg-red-900/50 border border-red-800/60 px-2.5 py-1 text-xs font-semibold text-red-300">
            {totalCount} active
          </span>
        )}
      </div>

      {/* Alert tiers */}
      <div className="space-y-8">
        <TierSection tier="ACTION"      alerts={actionAlerts}      />
        <TierSection tier="INVESTIGATE" alerts={investigateAlerts} />
        <TierSection tier="MONITOR"     alerts={monitorAlerts}     />
      </div>

      {/* Earnings */}
      <EarningsSection tickers={tickers} railwayConfigured={Boolean(railwayUrl)} />
    </div>
  )
}

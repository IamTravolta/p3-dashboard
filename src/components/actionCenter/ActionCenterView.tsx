'use client'

/**
 * Action Center — volledig herbouwde intelligence hub
 * Mirrors the HTML reference: Risk banner · Command Center · Alerts · Briefing
 * · Earnings Calendar · Today's Signals
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useDashboardStore, usePrices, usePositions, useWatchlist, useCash, useStats, useSignalCache } from '@/lib/store'
import { railwayFetch } from '@/lib/utils/railwayFetch'
import type { Position, WatchlistItem } from '@/lib/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return `€${Math.round(n).toLocaleString('nl-NL')}` }

function calcScore(p: { factorScores: { q: number; g: number; v: number; m: number; s: number } }) {
  const f = p.factorScores
  return f.q * 0.25 + f.g * 0.25 + f.v * 0.20 + f.m * 0.15 + f.s * 0.15
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)    return `${sec}s geleden`
  if (sec < 3600)  return `${Math.floor(sec / 60)}m geleden`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h geleden`
  return new Date(iso).toLocaleDateString('nl-NL')
}

// ── Risk level ─────────────────────────────────────────────────────────────────

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

function calcRiskLevel(
  positions: Position[],
  prices: Record<string, number>,
  cashPct: number,
  totalValue: number,
): { level: RiskLevel; breaches: Array<{ ticker: string; pct: number; cap: number }> } {
  const singleNameCap = 12
  const breaches: Array<{ ticker: string; pct: number; cap: number }> = []

  for (const p of positions) {
    const val = (prices[p.ticker] ?? p.currentPrice) * p.shares
    const pct = totalValue > 0 ? (val / totalValue) * 100 : 0
    if (pct > singleNameCap) breaches.push({ ticker: p.ticker, pct, cap: singleNameCap })
  }

  let level: RiskLevel = 'LOW'
  if (breaches.some(b => b.pct > 20) || cashPct < 2)       level = 'CRITICAL'
  else if (breaches.some(b => b.pct > 15) || cashPct < 5)  level = 'HIGH'
  else if (breaches.length > 0)                             level = 'MEDIUM'

  return { level, breaches }
}

const RISK_STYLE: Record<RiskLevel, { border: string; bg: string; text: string; pill: string }> = {
  CRITICAL: { border: 'var(--danger-text)',  bg: 'rgba(248,113,113,0.1)', text: 'var(--danger-text)',  pill: 'pill-danger'  },
  HIGH:     { border: 'var(--warning-text)', bg: 'rgba(251,146,60,0.1)',  text: 'var(--warning-text)', pill: 'pill-warning' },
  MEDIUM:   { border: 'var(--yellow-text)',  bg: 'rgba(240,209,74,0.08)', text: 'var(--yellow-text)',  pill: 'pill-yellow'  },
  LOW:      { border: 'var(--success-text)', bg: 'rgba(125,216,159,0.08)',text: 'var(--success-text)', pill: 'pill-success' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RiskBanner({ positions, prices, cashPct, totalValue, cash }: {
  positions: Position[]
  prices: Record<string, number>
  cashPct: number
  totalValue: number
  cash: number
}) {
  const [showBreaches, setShowBreaches] = useState(false)
  const { level, breaches } = calcRiskLevel(positions, prices, cashPct, totalValue)
  const s = RISK_STYLE[level]

  const totalWithCash = totalValue + cash
  const dayChange = useDashboardStore((s) => s.stats?.dayChange ?? 0)
  const dayChangePct = useDashboardStore((s) => s.stats?.dayChangePct ?? 0)

  return (
    <div className="rounded-lg p-3" style={{ border: `1px solid ${s.border}`, background: s.bg }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: s.text }}>
            {level === 'CRITICAL' ? '🔴' : level === 'HIGH' ? '🟠' : level === 'MEDIUM' ? '🟡' : '🟢'} Risk Level: {level}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Portfolio {fmt(totalWithCash)} · {positions.length} posities · Cash {cashPct.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>
            Val(1d): <span style={{ color: dayChange >= 0 ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
              {fmt(dayChange)} ({dayChange >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
            </span>
          </span>
        </div>
      </div>
      {breaches.length > 0 && (
        <button
          onClick={() => setShowBreaches(v => !v)}
          className="mt-2 text-xs"
          style={{ color: s.text, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          📊 {breaches.length} cap-breach{breaches.length > 1 ? 'es' : ''} {showBreaches ? '▲' : '▼'}
        </button>
      )}
      {showBreaches && breaches.length > 0 && (
        <div className="mt-2 space-y-1">
          {breaches.map((b) => (
            <div key={b.ticker} className="text-xs flex gap-2" style={{ color: s.text }}>
              <span className="font-mono font-bold">{b.ticker}</span>
              <span>≥ {b.pct.toFixed(1)}% van portfolio (max {b.cap}%)</span>
            </div>
          ))}
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Klik op een ticker → opent Per-Ticker analyse + Pro Trader Lens</p>
        </div>
      )}
    </div>
  )
}

// ── Command Center ─────────────────────────────────────────────────────────────

function CommandCenter({ positions, watchlist, prices, totalValue }: {
  positions: Position[]
  watchlist: WatchlistItem[]
  prices: Record<string, number>
  totalValue: number
}) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  // Categorise positions
  const verkopen  = positions.filter(p => calcScore(p) < 40)
  const afbouwen  = positions.filter(p => {
    const score = calcScore(p)
    const pnl = p.avgBuyPrice > 0 ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100 : 0
    return score >= 40 && score < 55 && pnl > 30
  })
  const kopenList = watchlist.filter(w => calcScore(w) >= 70)
  const onderzoek = positions.filter(p => {
    const score = calcScore(p)
    const pnl = p.avgBuyPrice > 0 ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100 : 0
    return score >= 55 && score < 70 && pnl < -10
  })

  const l1Count = verkopen.length + afbouwen.length
  const l2Count = onderzoek.length
  const l3Count = kopenList.length
  const hasUrgent = l1Count > 0

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--primary)' }}>⚡ Command Center</h2>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {dateStr} · Portfolio {fmt(totalValue)} · {positions.length} posities
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span style={{ color: l1Count > 0 ? 'var(--danger-text)' : 'var(--text-tertiary)' }}>
            {l1Count} L1 (actie)
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ color: l2Count > 0 ? 'var(--warning-text)' : 'var(--text-tertiary)' }}>
            {l2Count} L2 (monitor)
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ color: l3Count > 0 ? 'var(--info-text)' : 'var(--text-tertiary)' }}>
            {l3Count} L3 (info)
          </span>
        </div>
      </div>

      {/* Status banner */}
      {hasUrgent ? (
        <div className="rounded px-3 py-2 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(248,113,113,0.1)', border: '0.5px solid var(--danger-text)' }}>
          <span className="text-xs font-bold" style={{ color: 'var(--danger-text)' }}>🚨 {l1Count} urgente {l1Count === 1 ? 'actie' : 'acties'} vereist — controleer onmiddellijk</span>
        </div>
      ) : (
        <div className="rounded px-3 py-2 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(125,216,159,0.08)', border: '0.5px solid var(--success-text)' }}>
          <span className="text-xs font-bold" style={{ color: 'var(--success-text)' }}>✅ Geen urgent acties vandaag — rust pakken</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Geen positie met L1 conviction. Doe niets, kijk markt.</span>
        </div>
      )}

      {/* 4-quadrant grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* VERKOPEN */}
        <QuadrantBox
          label="VERKOPEN"
          count={verkopen.length}
          color="var(--danger-text)"
          bg="rgba(248,113,113,0.06)"
          emptyText="Geen verkoop-signalen vandaag"
          items={verkopen.map(p => ({ ticker: p.ticker, detail: `Score ${calcScore(p).toFixed(0)}` }))}
        />
        {/* AFBOUWEN */}
        <QuadrantBox
          label="AFBOUWEN"
          count={afbouwen.length}
          color="var(--warning-text)"
          bg="rgba(251,146,60,0.06)"
          emptyText="Geen trim-signalen"
          items={afbouwen.map(p => {
            const pnl = p.avgBuyPrice > 0 ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100 : 0
            return { ticker: p.ticker, detail: `+${pnl.toFixed(0)}% · score ${calcScore(p).toFixed(0)}` }
          })}
        />
        {/* KOPEN / WATCHLIST */}
        <QuadrantBox
          label="KOPEN / WATCHLIST"
          count={kopenList.length}
          color="var(--success-text)"
          bg="rgba(125,216,159,0.06)"
          emptyText="Geen koop-signalen"
          items={kopenList.map(w => ({ ticker: w.ticker, detail: `Score ${calcScore(w).toFixed(0)}` }))}
        />
        {/* ONDERZOEKEN */}
        <QuadrantBox
          label="ONDERZOEKEN"
          count={onderzoek.length}
          color="var(--yellow-text)"
          bg="rgba(240,209,74,0.06)"
          emptyText="Geen conflicterende signalen"
          items={onderzoek.map(p => {
            const pnl = p.avgBuyPrice > 0 ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100 : 0
            return { ticker: p.ticker, detail: `${pnl.toFixed(0)}% · score ${calcScore(p).toFixed(0)}` }
          })}
        />
      </div>
    </div>
  )
}

function QuadrantBox({ label, count, color, bg, emptyText, items }: {
  label: string
  count: number
  color: string
  bg: string
  emptyText: string
  items: Array<{ ticker: string; detail: string }>
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: bg, border: `0.5px solid ${color}20` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <span className="text-xs font-mono font-bold rounded-full px-2 py-0.5"
          style={{ background: count > 0 ? color : 'var(--surface)', color: count > 0 ? '#000' : 'var(--text-tertiary)' }}>
          {count}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.ticker} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold" style={{ color }}>{item.ticker}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Risk Alerts ────────────────────────────────────────────────────────────────

function RiskAlerts({ positions, prices, totalValue }: {
  positions: Position[]
  prices: Record<string, number>
  totalValue: number
}) {
  const { breaches } = calcRiskLevel(positions, prices, 0, totalValue)
  if (breaches.length === 0) return null

  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: 'var(--warning-text)' }}>⚠ RISK ALERTS ({breaches.length})</h3>
        <span className="text-xs" style={{ color: 'var(--warning-text)', opacity: 0.7 }}>Cap breaches</span>
      </div>
      <div className="space-y-1.5">
        {breaches
          .sort((a, b) => b.pct - a.pct)
          .map((b) => (
            <div key={b.ticker} className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold w-16 shrink-0" style={{ color: 'var(--warning-text)' }}>{b.ticker}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.min((b.pct / 30) * 100, 100)}%`,
                  background: b.pct > 20 ? 'var(--danger-text)' : 'var(--warning-text)',
                }} />
              </div>
              <span className="text-xs font-mono shrink-0" style={{ color: b.pct > 20 ? 'var(--danger-text)' : 'var(--warning-text)' }}>
                {b.pct.toFixed(1)}% <span style={{ color: 'var(--text-tertiary)' }}>(max {b.cap}%)</span>
              </span>
            </div>
          ))}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
        Klik op een ticker → opent Per-Ticker analyse + Pro Trader Lens
      </p>
    </div>
  )
}

// ── Urgent Sell Alerts ─────────────────────────────────────────────────────────

interface TickerExtra {
  netSynthese:   number | null   // smart money net institutional change %
  groteSale:     number | null   // largest insider sell in $M
  negCount:      number          // number of negative signals found
}

function UrgentSellAlerts({ positions, prices }: {
  positions: Position[]
  prices: Record<string, number>
}) {
  const signalCache = useDashboardStore((s) => s.signalCache)
  const [extras, setExtras] = useState<Record<string, TickerExtra>>({})

  const urgentSells = positions
    .filter((p) => {
      const score = calcScore(p)
      const pnl = p.avgBuyPrice > 0
        ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100
        : 0
      const cachedVerdict = signalCache[p.ticker]?.verdict?.finalVerdict
      return score < 45 || pnl < -15 || cachedVerdict === 'VERKOPEN'
    })

  // Fetch enrichment data for each urgent position (smart money + insider)
  useEffect(() => {
    if (urgentSells.length === 0) return
    urgentSells.forEach((p) => {
      if (extras[p.ticker]) return  // already fetched

      const smPromise = railwayFetch(`/api/railway/smart-money?tickers=${encodeURIComponent(p.ticker)}`)
        .then(async (r) => {
          if (!r.ok) return null
          const j = await r.json()
          const row = (j.data ?? j.results ?? []).find((x: { ticker?: string }) => x.ticker === p.ticker)
          return row?.netChange as number | null ?? null
        })
        .catch(() => null)

      const insiderPromise = fetch(`/api/insider?ticker=${encodeURIComponent(p.ticker)}`)
        .then(async (r) => {
          if (!r.ok) return null
          const j = await r.json()
          const sells = (j.transactions ?? []) as Array<{ transactionType: string; totalValue: number | null }>
          const maxSell = sells
            .filter((t) => t.transactionType === 'sell' && t.totalValue)
            .reduce((best, t) => (t.totalValue! > best ? t.totalValue! : best), 0)
          return maxSell > 0 ? maxSell : null
        })
        .catch(() => null)

      Promise.all([smPromise, insiderPromise]).then(([netSynthese, groteSaleVal]) => {
        // Count negative signals for the header
        const score = calcScore(p)
        const pnl = p.avgBuyPrice > 0 ? ((prices[p.ticker] ?? p.currentPrice) - p.avgBuyPrice) / p.avgBuyPrice * 100 : 0
        let negCount = 0
        if (score < 45)      negCount++
        if (pnl < -15)       negCount++
        if (netSynthese != null && netSynthese < 0) negCount++
        if (groteSaleVal != null)                   negCount++

        setExtras((prev) => ({
          ...prev,
          [p.ticker]: {
            netSynthese,
            groteSale: groteSaleVal != null ? groteSaleVal / 1_000_000 : null,  // convert to $M
            negCount: Math.max(negCount, 1),
          },
        }))
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentSells.length])

  if (urgentSells.length === 0) return null

  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--danger-text)', background: 'rgba(248,113,113,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: 'var(--danger-text)' }}>⚠ URGENTE SELL ALERTS</h3>
        <span className="text-xs font-semibold rounded-full px-2 py-0.5"
          style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {urgentSells.length} {urgentSells.length === 1 ? 'positie' : 'posities'}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Deze posities hebben meerdere negatieve signalen tegelijk. Het systeem verkoopt nooit voor je. Direct controleren en zelf beslissen.
      </p>
      <div className="space-y-2">
        {urgentSells.map((p) => {
          const score    = calcScore(p)
          const livePrice = prices[p.ticker] ?? p.currentPrice
          const pnl      = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
          const cached   = signalCache[p.ticker]
          const ex       = extras[p.ticker]
          const negCount = ex?.negCount ?? (score < 45 ? 2 : 1)

          return (
            <div key={p.ticker} className="rounded p-3"
              style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid var(--danger-text)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span style={{ color: 'var(--warning-text)', fontSize: 13 }}>⚠</span>
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--danger-text)' }}>{p.ticker}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>· {p.name}:</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--danger-text)' }}>
                      {negCount} negatieve {negCount === 1 ? 'signaal' : 'signalen'} tegelijk
                    </span>
                  </div>
                  <div className="space-y-0.5 ml-1">
                    {/* Score signal */}
                    {score < 45 && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>• score {score.toFixed(0)}/100</div>
                    )}
                    {/* P&L signal */}
                    {pnl < -15 && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>• verlies {pnl.toFixed(1)}%</div>
                    )}
                    {/* Net synthese from smart money */}
                    {ex?.netSynthese != null && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        • net synthese {ex.netSynthese > 0 ? '+' : ''}{ex.netSynthese.toFixed(0)}
                      </div>
                    )}
                    {/* Largest insider sell */}
                    {ex?.groteSale != null && ex.groteSale > 0 && (
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        • grote verkoop ${ex.groteSale.toFixed(1)}M
                      </div>
                    )}
                    {/* Cached verdict */}
                    {cached?.verdict && cached.verdict.finalVerdict !== 'HOLD' && (
                      <div className="text-xs" style={{ color: 'var(--danger-text)' }}>
                        • verdict: {cached.verdict.finalVerdict}
                        {cached.verdict.confidence != null && ` (${cached.verdict.confidence}% conf.)`}
                      </div>
                    )}
                  </div>
                </div>
                <span className="pill pill-danger shrink-0" style={{ fontSize: 10 }}>Verkooprisico</span>
              </div>
              <p className="text-xs mt-2 font-medium" style={{ color: 'var(--danger-text)' }}>
                → Direct controleren — verkopen, gedeelte verkopen of stop loss aanscherpen
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Today's Signals ────────────────────────────────────────────────────────────

interface SignalItem {
  ticker:    string
  type:      string
  title:     string
  detail:    string
  action:    'Verkooprisico' | 'Vasthouden' | 'Kans' | 'Aandacht'
  severity:  'danger' | 'success' | 'info' | 'warning'
}

function TodaysSignals({ positions, prices }: {
  positions: Position[]
  prices:    Record<string, number>
}) {
  const [signals,   setSignals]   = useState<SignalItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [showAll,   setShowAll]   = useState(false)
  const signalCache = useDashboardStore((s) => s.signalCache)

  // Build signals from available cache + local computations
  useEffect(() => {
    const items: SignalItem[] = []
    for (const p of positions) {
      const score    = calcScore(p)
      const livePrice = prices[p.ticker] ?? p.currentPrice
      const pnl       = p.avgBuyPrice > 0 ? ((livePrice - p.avgBuyPrice) / p.avgBuyPrice) * 100 : 0
      const cached    = signalCache[p.ticker]
      const verdict   = cached?.verdict?.finalVerdict

      if (verdict === 'VERKOPEN' || score < 40) {
        items.push({
          ticker: p.ticker, type: 'Score Alert',
          title: `Zwak score ${score.toFixed(0)} op ${p.ticker}`,
          detail: `Score onder verkoopdrempel. P&L: ${pnl.toFixed(1)}%. Directe evaluatie nodig.`,
          action: 'Verkooprisico', severity: 'danger',
        })
      } else if (pnl > 75 || verdict === 'AFBOUWEN') {
        items.push({
          ticker: p.ticker, type: 'Trim Alert',
          title: `${p.ticker} in trim-zone (+${pnl.toFixed(0)}%)`,
          detail: `Positie sterk gestegen. Overweeg gedeeltelijk verkopen om winst veilig te stellen.`,
          action: 'Verkooprisico', severity: 'warning',
        })
      } else if (score >= 70 && pnl > 0) {
        items.push({
          ticker: p.ticker, type: 'Positief',
          title: `Sterke positie ${p.ticker} — score ${score.toFixed(0)}`,
          detail: `Thesis intact. ${pnl.toFixed(1)}% rendement. Bijkopen onder buy zone overwegen.`,
          action: 'Vasthouden', severity: 'success',
        })
      }
    }

    // Supplement with railway signal data if available
    setSignals(items)
  }, [positions, prices, signalCache])

  // Also try to fetch from railway
  useEffect(() => {
    if (positions.length === 0) return
    const tickers = positions.map(p => p.ticker).join(',')
    setLoading(true)
    railwayFetch(`/api/railway/signals/today?tickers=${encodeURIComponent(tickers)}`)
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        const railwaySignals: SignalItem[] = (j.signals ?? []).map((s: {
          ticker?: string; type?: string; title?: string; detail?: string; action?: string; severity?: string
        }) => ({
          ticker:   s.ticker   ?? '',
          type:     s.type     ?? 'Signaal',
          title:    s.title    ?? '',
          detail:   s.detail   ?? '',
          action:   (s.action  ?? 'Aandacht') as SignalItem['action'],
          severity: (s.severity ?? 'info')    as SignalItem['severity'],
        }))
        if (railwaySignals.length > 0) setSignals(railwaySignals)
      })
      .catch(() => {/* silent — use local signals */})
      .finally(() => setLoading(false))
  }, [positions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (signals.length === 0 && !loading) return null

  const shown = showAll ? signals : signals.slice(0, 5)

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--info-text)' }}>◆ Vandaag de belangrijkste signalen</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Wat speelt er en wat kun je overwegen. Het systeem koopt of verkoopt nooit voor je. Jij beslist altijd zelf.
          </p>
        </div>
        {signals.length > 0 && (
          <span className="pill pill-info" style={{ fontSize: 10 }}>{signals.length} signalen actief</span>
        )}
      </div>

      {loading && signals.length === 0 && (
        <div className="flex items-center gap-2 py-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="h-3 w-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          Signalen ophalen…
        </div>
      )}

      <div className="space-y-2">
        {shown.map((sig, i) => {
          const border = sig.severity === 'danger' ? 'var(--danger-text)'
            : sig.severity === 'warning' ? 'var(--warning-text)'
            : sig.severity === 'success' ? 'var(--success-text)'
            : 'var(--info-text)'
          const bg = sig.severity === 'danger' ? 'rgba(248,113,113,0.06)'
            : sig.severity === 'warning' ? 'rgba(251,146,60,0.06)'
            : sig.severity === 'success' ? 'rgba(125,216,159,0.06)'
            : 'rgba(96,165,250,0.06)'
          const badgeClass = `pill pill-${sig.severity}`

          return (
            <div key={i} className="rounded-lg p-3" style={{ border: `0.5px solid ${border}`, background: bg }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono font-bold text-xs" style={{ color: border }}>{sig.ticker}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{sig.title}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sig.detail}</p>
                </div>
                <span className={`${badgeClass} shrink-0`} style={{ fontSize: 10 }}>{sig.action}</span>
              </div>
            </div>
          )
        })}
      </div>

      {signals.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-xs"
          style={{ color: 'var(--info-text)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {showAll ? '▲ Minder tonen' : `▼ Toon alle ${signals.length} signalen`}
        </button>
      )}
    </div>
  )
}

// ── Earnings Calendar ──────────────────────────────────────────────────────────

interface EarningsEvent {
  date:        string
  ticker:      string
  name:        string
  epsEst:      number | null
  epsActual:   number | null
  conclusion:  string
  context:     string
  timing:      string
}

function EarningsCalendar({ positions, watchlist }: { positions: Position[]; watchlist: WatchlistItem[] }) {
  const [events,   setEvents]   = useState<EarningsEvent[]>([])
  const [loading,  setLoading]  = useState(false)
  const [showAll,  setShowAll]  = useState(false)

  useEffect(() => {
    if (positions.length === 0) return
    const allTickers = [
      ...positions.map(p => p.ticker),
      ...watchlist.map(w => w.ticker),
    ]
    const tickers = [...new Set(allTickers)].join(',')
    setLoading(true)
    railwayFetch(`/api/railway/earnings-calendar?tickers=${encodeURIComponent(tickers)}&days=60`)
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        setEvents(j.events ?? j.data ?? [])
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false))
  }, [positions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (events.length === 0 && !loading) return null

  const shown = showAll ? events : events.slice(0, 5)

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--yellow-text)' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold" style={{ color: 'var(--yellow-text)' }}>⊙ Earnings Calendar 60 dagen</h3>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {events.filter(e => positions.some(p => p.ticker === e.ticker)).length} portfolio · {events.filter(e => watchlist.some(w => w.ticker === e.ticker)).length} watchlist
        </span>
      </div>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Aankomende rapportages voor jouw portfolio, watchlist en Top 25 picks. Pre-earnings cooldown bij &lt; 5 dagen voorkomt impulsief kopen.{' '}
        <strong style={{ color: 'var(--text-primary)' }}>Per stock: historische earnings-reactie (laatste 10 keer) + Play/No Play conclusie + verkoop-trigger prijzen.</strong>{' '}
        Klik open voor volledig plan met 1d/3d/5d post-earnings beweging, risico-score en strategie.
      </p>
      {loading && events.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="h-3 w-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--yellow-text)' }} />
          Earnings calendar ophalen…
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Datum', 'Naam', 'EPS est.', 'Conclusie', 'Context', 'Timing'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{e.date}</td>
                    <td className="px-3 py-2.5 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{e.ticker}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {e.epsEst != null ? `$${e.epsEst.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="pill pill-info" style={{ fontSize: 9 }}>{e.conclusion}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-xs" style={{ color: 'var(--text-secondary)' }}>{e.context}</td>
                    <td className="px-3 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{e.timing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {events.length > 5 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="mt-2 text-xs"
              style={{ color: 'var(--yellow-text)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showAll ? '▲ Minder tonen' : `▼ Toon overige ${events.length - 5} earnings`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Briefing strip ─────────────────────────────────────────────────────────────

function DailyBriefingStrip() {
  const [text,    setText]    = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/briefing')
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        setText(j.briefing?.content ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (!text)   return null

  // Show first 3 sentences only
  const preview = text.split(/[.!?]/).filter(Boolean).slice(0, 3).join('. ') + '.'

  return (
    <div className="rounded-lg p-4" style={{ background: 'rgba(139,92,246,0.08)', border: '0.5px solid rgba(139,92,246,0.4)' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold" style={{ color: 'rgba(167,139,250,1)' }}>★ Daily AI Briefing</h3>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Gegenereerd op basis van vandaag&apos;s signalen</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(221,214,254,0.85)' }}>{preview}</p>
    </div>
  )
}

// ── Learning Engine banner ─────────────────────────────────────────────────────

function LearningEngineBanner() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/verdicts')
      .then(async (r) => {
        if (!r.ok) return
        const j = await r.json()
        const rows = j.data ?? j.verdicts ?? []
        setCount(rows.length)
      })
      .catch(() => {})
  }, [])

  if (count === null) return null

  return (
    <div className="rounded px-3 py-2 text-xs" style={{ background: 'rgba(125,216,159,0.06)', border: '0.5px solid var(--success-text)' }}>
      <span style={{ color: 'var(--success-text)' }}>🎓 Learning Engine actief: </span>
      <span style={{ color: 'var(--text-secondary)' }}>
        {count} verdicts gelogd voor evaluatie. Eerste reliability-scores beschikbaar na 30 dagen.
      </span>
    </div>
  )
}

// ── Collapsible "Toon alle details" wrapper ────────────────────────────────────

function DetailsSection({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="surface" style={{ borderLeft: '4px solid var(--border)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          📋 {open ? 'Verberg' : 'Toon'} alle details + oude banners
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function ActionCenterView() {
  const positions = usePositions()
  const watchlist = useWatchlist()
  const prices    = usePrices()
  const cash      = useCash()
  const stats     = useStats()

  const totalValue    = stats?.totalValue ?? 0
  const totalWithCash = totalValue + cash
  const cashPct       = totalWithCash > 0 ? (cash / totalWithCash) * 100 : 0

  // Summary chips
  const { breaches } = calcRiskLevel(positions, prices, cashPct, totalValue)
  const aandacht = positions.filter(p => calcScore(p) < 55).length + breaches.length
  const positief = positions.filter(p => calcScore(p) >= 70).length
  const kans     = watchlist.filter(w => calcScore(w) >= 70).length

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◆ Action Center</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>
              Dagelijkse signalen die om jouw aandacht vragen, in simpele taal
            </div>
          </div>
          {/* Summary chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {aandacht > 0 && <span className="pill pill-warning">{aandacht} aandacht</span>}
            {positief > 0 && <span className="pill pill-success">{positief} positief</span>}
            {kans > 0     && <span className="pill pill-info">{kans} kans</span>}
          </div>
        </div>
      </div>

      {/* Risk banner */}
      {positions.length > 0 && (
        <RiskBanner positions={positions} prices={prices} cashPct={cashPct} totalValue={totalValue} cash={cash} />
      )}

      {/* Command Center */}
      {positions.length > 0 && (
        <CommandCenter positions={positions} watchlist={watchlist} prices={prices} totalValue={totalValue} />
      )}

      {/* Risk Alerts */}
      {positions.length > 0 && (
        <RiskAlerts positions={positions} prices={prices} totalValue={totalValue} />
      )}

      {/* Collapsible details section */}
      <DetailsSection>
        {/* Learning Engine */}
        <LearningEngineBanner />

        {/* Daily Briefing strip */}
        <DailyBriefingStrip />

        {/* Urgent Sell Alerts */}
        {positions.length > 0 && (
          <UrgentSellAlerts positions={positions} prices={prices} />
        )}

        {/* Earnings Calendar */}
        {positions.length > 0 && (
          <EarningsCalendar positions={positions} watchlist={watchlist} />
        )}
      </DetailsSection>

      {/* Today's Signals — always visible */}
      {positions.length > 0 && (
        <TodaysSignals positions={positions} prices={prices} />
      )}

      {/* Empty state */}
      {positions.length === 0 && (
        <div className="surface py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-3xl mb-3">◆</p>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Geen posities gevonden</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Voeg posities toe aan je portfolio om de Action Center te activeren.</p>
        </div>
      )}
    </div>
  )
}

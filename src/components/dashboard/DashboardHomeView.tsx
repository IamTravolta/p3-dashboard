'use client'

import { useDashboardStore } from '@/lib/store'
import type { Position, WatchlistItem } from '@/lib/types/database'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return `€${Math.round(value).toLocaleString('nl-NL')}`
}

function calcScore(p: { factorScores: { q: number; g: number; v: number; m: number; s: number } }): number {
  const fs = p.factorScores
  return fs.q * 0.25 + fs.g * 0.25 + fs.v * 0.20 + fs.m * 0.15 + fs.s * 0.15
}

// ── HeatmapTile ───────────────────────────────────────────────────────────────

function HeatmapTile({
  position,
  price,
  portfolioPct,
}: {
  position: Position
  price: number
  portfolioPct: number
}) {
  const score = calcScore(position)
  const pnlPct = position.avgBuyPrice > 0
    ? ((price - position.avgBuyPrice) / position.avgBuyPrice) * 100
    : 0

  let bgColor = 'rgba(248,113,113,0.12)'
  let borderColor = 'rgba(248,113,113,0.4)'
  let scoreColor = 'var(--danger-text)'

  if (score >= 70) {
    bgColor = 'rgba(125,216,159,0.12)'
    borderColor = 'rgba(125,216,159,0.4)'
    scoreColor = 'var(--success-text)'
  } else if (score >= 55) {
    bgColor = 'rgba(240,209,74,0.12)'
    borderColor = 'rgba(240,209,74,0.4)'
    scoreColor = 'var(--yellow-text)'
  } else if (score >= 40) {
    bgColor = 'rgba(251,146,60,0.12)'
    borderColor = 'rgba(251,146,60,0.4)'
    scoreColor = 'var(--warning-text)'
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        border: `0.5px solid ${borderColor}`,
        borderRadius: 6,
        cursor: 'pointer',
        background: bgColor,
        transition: 'all 0.15s',
      }}
    >
      <div className="flex justify-between items-start">
        <span className="font-mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          {position.ticker}
        </span>
        <span className="text-xs font-semibold" style={{ color: scoreColor }}>
          {score.toFixed(0)}
        </span>
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
        €{price.toFixed(2)}
      </div>
      <div
        className="text-xs font-medium"
        style={{ color: pnlPct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
      >
        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
        {portfolioPct.toFixed(1)}% of ptf
      </div>
    </div>
  )
}

// ── CapBar ────────────────────────────────────────────────────────────────────

function CapBar({
  label,
  current,
  cap,
  isMin,
}: {
  label: string
  current: number
  cap: number
  isMin?: boolean
}) {
  const fillWidth = Math.min((current / cap) * 100, 100)
  const isOver = isMin ? current < cap : current > cap
  const isNear = isMin ? current < cap * 1.2 : current > cap * 0.8
  const fillColor = isOver
    ? 'var(--danger-text)'
    : isNear
    ? 'var(--warning-text)'
    : 'var(--success-text)'

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span
          style={{
            color: isOver ? 'var(--danger-text)' : 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {current.toFixed(1)}% / {cap}%
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${fillWidth}%`, background: fillColor }} />
      </div>
    </div>
  )
}

// ── WatchlistPreview ──────────────────────────────────────────────────────────

function WatchlistPreview({ watchlist }: { watchlist: WatchlistItem[] }) {
  if (watchlist.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
        Add stocks to your watchlist in Pipeline → Watchlist
      </p>
    )
  }

  const sorted = [...watchlist]
    .map((item) => ({ ...item, computedScore: calcScore(item) }))
    .sort((a, b) => b.computedScore - a.computedScore)
    .slice(0, 3)

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-mono font-semibold text-xs shrink-0 rounded px-1.5 py-0.5"
              style={{ background: 'var(--bg)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}
            >
              {item.ticker}
            </span>
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {item.name}
            </span>
          </div>
          <span
            className="text-xs font-semibold shrink-0 rounded px-1.5 py-0.5"
            style={{
              background: item.computedScore >= 70
                ? 'rgba(125,216,159,0.12)'
                : item.computedScore >= 55
                ? 'rgba(240,209,74,0.12)'
                : 'rgba(248,113,113,0.12)',
              color: item.computedScore >= 70
                ? 'var(--success-text)'
                : item.computedScore >= 55
                ? 'var(--yellow-text)'
                : 'var(--danger-text)',
            }}
          >
            {item.computedScore.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── WatchToSellPreview ────────────────────────────────────────────────────────

function WatchToSellPreview({ positions, prices }: { positions: Position[]; prices: Record<string, number> }) {
  const weak = positions
    .map((p) => ({ ...p, computedScore: calcScore(p) }))
    .filter((p) => p.computedScore < 55)
    .sort((a, b) => a.computedScore - b.computedScore)

  if (weak.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
        No positions on Watch to Sell list.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {weak.slice(0, 5).map((p) => {
        const price = prices[p.ticker] ?? p.currentPrice
        const pnlPct = p.avgBuyPrice > 0
          ? ((price - p.avgBuyPrice) / p.avgBuyPrice) * 100
          : 0
        const status =
          p.computedScore < 40 ? 'SELL' : 'WATCH'
        return (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="font-mono font-semibold text-xs shrink-0 rounded px-1.5 py-0.5"
                style={{ background: 'var(--bg)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)' }}
              >
                {p.ticker}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: pnlPct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
              >
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-semibold" style={{ color: 'var(--danger-text)' }}>
                {p.computedScore.toFixed(0)}
              </span>
              <span
                className="text-xs font-semibold rounded px-1.5 py-0.5"
                style={{
                  background: status === 'SELL' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                  color: status === 'SELL' ? 'var(--danger-text)' : 'var(--warning-text)',
                }}
              >
                {status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardHomeView() {
  const positions    = useDashboardStore((s) => s.positions)
  const watchlist    = useDashboardStore((s) => s.watchlist)
  const prices       = useDashboardStore((s) => s.prices)
  const cash         = useDashboardStore((s) => s.cash)
  const computeStats = useDashboardStore((s) => s.computeStats)
  const setActiveGroup  = useDashboardStore((s) => s.setActiveGroup)
  const setActiveSubTab = useDashboardStore((s) => s.setActiveSubTab)

  // Recompute stats on mount so KPIs are correct after page reload
  // (stats is not persisted, so it starts null after localStorage rehydration)
  const statsComputed = useDashboardStore((s) => s.stats)
  if (!statsComputed && positions.length > 0) computeStats()

  // ── KPI derivations — computed directly from positions+prices ─────────────
  // (avoids dependency on potentially-null stats after hydration)

  const totalPortfolioValue = positions.reduce(
    (sum, p) => sum + (prices[p.ticker] ?? p.currentPrice) * p.shares,
    0,
  )
  const totalCost = positions.reduce(
    (sum, p) => sum + p.avgBuyPrice * p.shares,
    0,
  )
  const totalValue   = totalPortfolioValue
  const totalPnL     = totalPortfolioValue - totalCost
  const totalPnLPct  = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const cashBuffer   = cash
  const totalWithCash = totalPortfolioValue + cash
  const cashPct      = totalWithCash > 0 ? (cash / totalWithCash) * 100 : 0

  // Single name
  const singleNamePct =
    positions.length > 0
      ? Math.max(
          ...positions.map(
            (p) => (((prices[p.ticker] ?? p.currentPrice) * p.shares) / (totalPortfolioValue || 1)) * 100,
          ),
        )
      : 0
  const singleNameCap = 12

  // Sector concentration
  const sectorTotals: Record<string, number> = {}
  positions.forEach((p) => {
    const val = (prices[p.ticker] ?? p.currentPrice) * p.shares
    sectorTotals[p.sector] = (sectorTotals[p.sector] ?? 0) + val
  })
  const maxSectorPct =
    totalPortfolioValue > 0
      ? Math.max(...Object.values(sectorTotals).map((v) => (v / totalPortfolioValue) * 100), 0)
      : 0
  const sectorCap = 25

  // USD exposure
  const usdValue = positions
    .filter((p) => p.currency !== 'EUR')
    .reduce((s, p) => s + (prices[p.ticker] ?? p.currentPrice) * p.shares, 0)
  const usdPct = totalPortfolioValue > 0 ? (usdValue / totalPortfolioValue) * 100 : 0
  const usdCap = 75

  // Cash
  const cashCap = 20

  // Top sector label
  const topSectorEntry = Object.entries(sectorTotals).sort((a, b) => b[1] - a[1])[0]
  const topSectorLabel = topSectorEntry?.[0] ?? 'N/A'

  const capItems = [
    { label: 'Single name', current: singleNamePct, cap: singleNameCap },
    { label: `Sector ${topSectorLabel}`, current: maxSectorPct, cap: sectorCap },
    { label: 'USD exposure', current: usdPct, cap: usdCap },
    { label: 'Cash (min)', current: cashPct, cap: cashCap, isMin: true },
  ]

  // ── Risk items ─────────────────────────────────────────────────────────────

  interface RiskBreach {
    title:        string
    explanation:  string
    action:       string
    actionDetail: string
    severity:     'HIGH' | 'MEDIUM' | 'LOW'
  }
  const riskItems: RiskBreach[] = []
  const portfolioTotal = totalPortfolioValue + cash   // includes cash buffer

  // ── 1. Single-name breaches: one card per position over cap ────────────────
  positions.forEach((p) => {
    const livePrice = prices[p.ticker] ?? p.currentPrice
    const posValue  = livePrice * p.shares
    const posWeight = portfolioTotal > 0 ? (posValue / portfolioTotal) * 100 : 0
    if (posWeight > singleNameCap) {
      const overPct      = posWeight - singleNameCap
      const sharesToSell = Math.ceil((overPct / 100 * portfolioTotal) / livePrice)
      const eurFreed     = sharesToSell * livePrice
      riskItems.push({
        title:        `${p.ticker} at ${posWeight.toFixed(1)}% > cap ${singleNameCap}%`,
        explanation:  `Single-name cap exceeded by ${overPct.toFixed(1)} percentage points. Concentration risk on one position.`,
        action:       `Trim ${sharesToSell} ${p.ticker} shares to come within cap`,
        actionDetail: `At €${livePrice.toFixed(2)} per share = €${eurFreed.toFixed(0)} cash freed`,
        severity:     overPct > singleNameCap * 0.5 ? 'HIGH' : 'MEDIUM',
      })
    }
  })

  // ── 2. Sector breaches: one card per sector over cap ───────────────────────
  Object.entries(sectorTotals).forEach(([sec, secVal]) => {
    const secPct  = portfolioTotal > 0 ? (secVal / portfolioTotal) * 100 : 0
    if (secPct > sectorCap) {
      const overPct      = secPct - sectorCap
      const eurOver      = portfolioTotal * overPct / 100
      const inSector     = [...positions]
        .filter((p) => p.sector === sec)
        .sort((a, b) => {
          const wa = (prices[a.ticker] ?? a.currentPrice) * a.shares
          const wb = (prices[b.ticker] ?? b.currentPrice) * b.shares
          return wa - wb  // weakest (smallest) first for trimming suggestion
        })
      const weakTickers  = inSector.slice(0, 3).map((p) => p.ticker).join(', ')
      const topTicker    = [...inSector].reverse()[0]?.ticker ?? ''
      riskItems.push({
        title:        `Sector ${sec} at ${secPct.toFixed(1)}% > cap ${sectorCap}%`,
        explanation:  `Sector concentration exceeded by ${overPct.toFixed(1)} pp. A single sector shock hits your full portfolio.`,
        action:       `Reduce by €${eurOver.toFixed(0)} (${overPct.toFixed(1)}pp). Trim weakest in sector first: ${weakTickers}`,
        actionDetail: `Or partially sell ${topTicker} to bring sector back within cap`,
        severity:     overPct > 20 ? 'HIGH' : 'MEDIUM',
      })
    }
  })

  // ── 3. USD exposure breach ─────────────────────────────────────────────────
  if (usdPct > usdCap) {
    const overPct   = usdPct - usdCap
    const eurToShift = portfolioTotal * overPct / 100
    riskItems.push({
      title:        `USD exposure ${usdPct.toFixed(1)}% > cap ${usdCap}%`,
      explanation:  `Too much USD exposure means EUR strengthening directly impacts your portfolio without any change in the stock thesis.`,
      action:       `Shift ~€${eurToShift.toFixed(0)} to EUR-denominated alternatives`,
      actionDetail: `EU equivalents: ASML for semis, SAP/DSY for software, NESN for consumer staples`,
      severity:     overPct > 15 ? 'HIGH' : 'MEDIUM',
    })
  }

  // ── 4. Cash too low ────────────────────────────────────────────────────────
  if (cashPct < 5) {
    const eurNeeded = portfolioTotal * 0.05 - cash
    // Find winners (biggest gainers) to suggest trimming
    const winners = [...positions]
      .map((p) => {
        const lp = prices[p.ticker] ?? p.currentPrice
        return { ticker: p.ticker, gainPct: ((lp / p.avgBuyPrice) - 1) * 100 }
      })
      .filter((p) => p.gainPct > 15)
      .sort((a, b) => b.gainPct - a.gainPct)
      .slice(0, 3)
      .map((p) => `${p.ticker} +${p.gainPct.toFixed(0)}%`)
      .join(', ')
    riskItems.push({
      title:        `Cash at ${cashPct.toFixed(1)}% < min 5%`,
      explanation:  `Too little dry powder for opportunistic entry on corrections or crashes.`,
      action:       `Trim winners${winners ? ` (${winners})` : ''} to build €${eurNeeded.toFixed(0)} cash`,
      actionDetail: `At 5% cash minimum you need €${(portfolioTotal * 0.05).toFixed(0)} total — currently €${cash.toFixed(0)}`,
      severity:     'LOW',
    })
  }

  return (
    <div className="space-y-4">

      {/* ── A: KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {/* Portfoliowaarde */}
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Portfoliowaarde</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {formatEur(totalValue)}
          </div>
        </div>

        {/* Totale P&L */}
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Totale P&amp;L</div>
          <div
            className="text-xl font-bold mt-1"
            style={{ color: totalPnL >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
          >
            {totalPnL >= 0 ? '+' : ''}{formatEur(totalPnL)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(1)}% since purchase
          </div>
        </div>

        {/* Posities */}
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Posities</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {positions.length}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Sweet spot 12–20
          </div>
        </div>

        {/* Cash */}
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cash</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {formatEur(cashBuffer)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            {cashPct.toFixed(1)}% of total
          </div>
        </div>
      </div>

      {/* ── A2: Macro Regime Banner ────────────────────────────────────────── */}
      <div className="rounded p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--info-bg)', border: '0.5px solid var(--border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--info-text)' }}>🌐 Macro Regime</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Connect je Railway backend en sync om live macro-regime data te laden (Fed stance, earnings season, volatility index).
        </span>
        <span className="pill pill-info" style={{ fontSize: 10, marginLeft: 'auto' }}>Pending sync</span>
      </div>

      {/* ── B: Heatmap ────────────────────────────────────────────────────── */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--info-text)' }}>
              ◇ Positions
            </h2>
            <span className="pill pill-success" style={{ fontSize: 10 }}>⚡ Live mode on</span>
          </div>
          {/* Color legend */}
          <div
            className="text-xs flex items-center gap-3 flex-wrap"
            style={{ color: 'var(--info-text)', opacity: 0.7 }}
          >
            <span className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success-text)', display: 'inline-block' }} />
              70+ hold
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--yellow-text)', display: 'inline-block' }} />
              55–69 watch
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning-text)', display: 'inline-block' }} />
              40–54 trim
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger-text)', display: 'inline-block' }} />
              &lt;40 sell
            </span>
          </div>
        </div>

        {/* Info banner */}
        <div className="rounded p-2.5 mb-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>
            Per tile: <strong>▲/▼ %</strong> = live price change. <strong>Score</strong> = weighted factor score (Q/G/V/M/S). Color = score band.
          </div>
        </div>

        {/* Heatmap grid */}
        {positions.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            No positions yet. Add positions in Portfolio → Positions.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {positions.map((p) => {
              const price = prices[p.ticker] ?? p.currentPrice
              const posValue = price * p.shares
              const portfolioPct = totalPortfolioValue > 0
                ? (posValue / totalPortfolioValue) * 100
                : 0
              return (
                <HeatmapTile
                  key={p.id}
                  position={p}
                  price={price}
                  portfolioPct={portfolioPct}
                />
              )
            })}
          </div>
        )}

        {/* Collapsible legenda — mirrors HTML #heatmap-legenda */}
        {positions.length > 0 && (
          <details className="mt-3" style={{ border: '0.5px solid var(--border)', borderRadius: 6 }}>
            <summary
              className="px-3 py-2 text-xs font-semibold cursor-pointer select-none"
              style={{ color: 'var(--text-secondary)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>📖 Score legenda — wat betekenen Q / G / V / M / S?</span>
              <span style={{ color: 'var(--text-tertiary)' }}>⌄</span>
            </summary>
            <div className="px-3 py-3" style={{ borderTop: '0.5px solid var(--border)' }}>
              <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <div>De <strong style={{ color: 'var(--text-primary)' }}>Score</strong> van 0–100 is een gemiddelde van 5 factoren. Dezelfde 85 kan een groei-aandeel zijn of een waarde-aandeel — kijk altijd naar de breakdown.</div>
                <div><strong style={{ color: 'var(--success-text)' }}>Q (Quality, 0–100):</strong> hoe sterk staat het bedrijf financieel? Hoge marges, lage schuld, hoog ROIC. Hoog = veilig bedrijf.</div>
                <div><strong style={{ color: 'var(--info-text)' }}>G (Growth, 0–100):</strong> hoe snel groeit het bedrijf? Omzet- en winstgroei. Hoog = snel groeiend (zoals NVDA).</div>
                <div><strong style={{ color: 'var(--yellow-text)' }}>V (Value, 0–100):</strong> hoe goedkoop is het aandeel t.o.v. fundamentele waarde? Lage P/E etc. Hoog = goedkoop geprijsd.</div>
                <div><strong style={{ color: 'var(--primary)' }}>M (Momentum, 0–100):</strong> zit de koers in een opwaartse trend? Hoog = stijgend, actief gekocht.</div>
                <div><strong style={{ color: 'var(--purple-text)' }}>S (Sentiment, 0–100):</strong> wat is de mediaperceptie? Analist-upgrades, positief nieuws. Hoog = goed verhaal.</div>
                <div className="mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  <em>Voorbeeld: Q 90 + V 40 = sterk bedrijf maar duur. Q 50 + V 95 = goedkoop maar wankel. Beide kunnen 70 totaalscore zijn maar zijn totaal ander type investering.</em>
                </div>
              </div>
            </div>
          </details>
        )}
      </div>

      {/* ── C: Cap-status ─────────────────────────────────────────────────── */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--warning-text)' }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>
            ⚠ Cap-status
          </h2>
          <span className="text-xs" style={{ color: 'var(--warning-text)', opacity: 0.7 }}>
            Your risk caps from settings
          </span>
        </div>
        <div className="rounded p-2.5 mb-3" style={{ background: 'var(--warning-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--warning-text)', lineHeight: 1.6 }}>
            How close you are to your hard limits for single name, sector, and cash. Above 80% turns amber, above 100% red.
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {capItems.map((cap) => (
            <CapBar key={cap.label} {...cap} />
          ))}
        </div>
      </div>

      {/* ── D: Risk Mitigation Center ──────────────────────────────────────── */}
      {riskItems.length === 0 ? (
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--success-text)' }}>
              ✓ Risk Mitigation
            </h2>
            <span className="text-xs" style={{ color: 'var(--success-text)', opacity: 0.7 }}>
              Geen cap-breaches
            </span>
          </div>
          <div className="rounded p-2.5" style={{ background: 'var(--success-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>
              Alle risk caps binnen grenzen. Portfolio is gedisciplineerd.
            </div>
          </div>
        </div>
      ) : (
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--warning-text)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>
              ⚠ Risk Mitigation Center
            </h2>
            <span className="pill pill-warning" style={{ fontSize: 10 }}>
              {riskItems.length} cap-breach{riskItems.length > 1 ? 'es' : ''}
            </span>
          </div>
          <div className="rounded p-2.5 mb-3" style={{ background: 'var(--warning-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--warning-text)', lineHeight: 1.6 }}>
              Posities of allocaties die buiten je risk caps vallen. Per breach een concrete actie met aantal aandelen of euro&apos;s. Geen automatische uitvoering — jij beslist.
            </div>
          </div>
          <div className="space-y-2">
            {riskItems.map((item, i) => {
              const sev = item.severity === 'HIGH' ? 'danger' : item.severity === 'MEDIUM' ? 'warning' : 'yellow'
              const sevLabel = item.severity === 'HIGH' ? 'HOOG' : item.severity === 'MEDIUM' ? 'MEDIUM' : 'LAAG'
              return (
                <div
                  key={i}
                  className="rounded p-3"
                  style={{
                    background:  `var(--${sev}-bg)`,
                    borderLeft:  `3px solid var(--${sev}-text)`,
                  }}
                >
                  {/* Header row */}
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 13, fontWeight: 600, color: `var(--${sev}-text)` }}>
                        {item.title}
                      </div>
                      <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {item.explanation}
                      </div>
                    </div>
                    <span className={`pill pill-${sev}`} style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                      {sevLabel}
                    </span>
                  </div>
                  {/* Concrete action box */}
                  <div className="rounded p-2 mt-2" style={{ background: 'var(--surface)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                      Concrete actie
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: `var(--${sev}-text)` }}>
                      → {item.action}
                    </div>
                    <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item.actionDetail}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── E: Bottom two-column preview ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top Stocks to Watch */}
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--info-text)' }}>
              ◆ Top Stocks to Watch
            </h2>
            <button
              className="btn"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                minHeight: 22,
                background: 'var(--info-bg)',
                color: 'var(--info-text)',
                borderColor: 'var(--info-text)',
              }}
              onClick={() => {
                setActiveGroup('pipeline')
                setActiveSubTab('watchlist')
              }}
            >
              View all →
            </button>
          </div>
          <div className="rounded p-2.5 mb-3" style={{ background: 'var(--info-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>
              Stocks you&apos;re following. Top 3 by score.
            </div>
          </div>
          <WatchlistPreview watchlist={watchlist} />
        </div>

        {/* Top Watch to Sell */}
        <div className="surface p-4" style={{ borderLeft: '4px solid var(--danger-text)' }}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--danger-text)' }}>
              ↓ Top Watch to Sell
            </h2>
            <button
              className="btn"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                minHeight: 22,
                background: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                borderColor: 'var(--danger-text)',
              }}
              onClick={() => {
                setActiveGroup('portfolio')
                setActiveSubTab('positions')
              }}
            >
              View all →
            </button>
          </div>
          <div className="rounded p-2.5 mb-3" style={{ background: 'var(--danger-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--danger-text)', lineHeight: 1.6 }}>
              Positions with weakening profile. Early warning before hard stop-loss.
            </div>
          </div>
          <WatchToSellPreview positions={positions} prices={prices} />
        </div>
      </div>
    </div>
  )
}

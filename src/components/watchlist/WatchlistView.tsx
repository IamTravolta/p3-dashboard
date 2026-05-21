'use client'

import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import { useWatchlistData } from '@/hooks/useWatchlistData'
import AddWatchlistModal from './AddWatchlistModal'
import type { WatchlistItem, FactorScores } from '@/lib/types/database'

export default function WatchlistView() {
  const watchlist           = useDashboardStore((s) => s.watchlist)
  const removeWatchlistItem = useDashboardStore((s) => s.removeWatchlistItem)
  const prices              = useDashboardStore((s) => s.prices)
  const railwayUrl          = useDashboardStore((s) => s.railwayUrl)
  const signalCache         = useDashboardStore((s) => s.signalCache)
  const setSignalCache      = useDashboardStore((s) => s.setSignalCache)

  const [modalOpen,     setModalOpen]     = useState(false)
  const [editTarget,    setEditTarget]    = useState<Parameters<typeof AddWatchlistModal>[0]['editItem']>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [analyzing,     setAnalyzing]     = useState<string | null>(null)
  const [signalResults, setSignalResults] = useState<Record<string, SignalResult>>({})
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({})

  // Initialise signalResults from the store cache on mount so results survive tab switches
  useEffect(() => {
    const fromCache: Record<string, SignalResult> = {}
    for (const [ticker, cached] of Object.entries(signalCache)) {
      if (cached && typeof cached === 'object' && 'verdict' in cached) {
        fromCache[ticker] = cached as unknown as SignalResult
      }
    }
    if (Object.keys(fromCache).length > 0) {
      setSignalResults((prev) => ({ ...fromCache, ...prev }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { loadWatchlist } = useWatchlistData()

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function openEdit(item: WatchlistItem) {
    setEditTarget({
      id: item.id,
      data: {
        ticker:        item.ticker,
        name:          item.name,
        exchange:      item.exchange,
        sector:        item.sector,
        sub_industry:  item.subIndustry || null,
        current_price: item.currentPrice,
        score:         item.score,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        factor_scores: item.factorScores as any,
        reason:        item.reason || null,
        price_trigger: item.priceTrigger,
        score_trigger: item.scoreTrigger,
        conviction:    item.conviction,
        expiry_date:   item.expiryDate,
        added_at:      item.addedDate,
      },
    })
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const resp = await fetch(`/api/watchlist/${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Delete failed')
      removeWatchlistItem(id)
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  async function runAnalysis(item: WatchlistItem) {
    setAnalyzing(item.ticker)
    if (!expanded[item.id]) setExpanded((prev) => ({ ...prev, [item.id]: true }))
    try {
      const resp = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ticker:       item.ticker,
          exchange:     item.exchange,
          sector:       item.sector,
          name:         item.name,
          reason:       item.reason || undefined,
          watchlist_id: item.id,
        }),
      })
      const data = await resp.json() as SignalResult & { error?: string }
      if (data.error) {
        setSignalResults((r) => ({ ...r, [item.ticker]: { error: data.error! } }))
      } else {
        setSignalResults((r) => ({ ...r, [item.ticker]: data }))
        setSignalCache(item.ticker, {
          signals:    (data.signals ?? []).reduce<Record<string, unknown>>((acc, sig, i) => {
            acc[sig.module_name ?? `signal_${i}`] = sig
            return acc
          }, {}),
          fetchedAt:  Date.now(),
          verdict:    data.verdict
            ? {
                finalVerdict: data.verdict.verdict ?? data.verdict.finalVerdict ?? 'HOLD',
                confidence:   data.verdict.confidence,
                reasoning:    data.verdict.reasoning,
              }
            : undefined,
          ...(data.speculation ? { speculation: data.speculation } : {}),
        } as Parameters<typeof setSignalCache>[1])
      }
    } catch {
      setSignalResults((r) => ({ ...r, [item.ticker]: { error: 'Analysis failed' } }))
    } finally {
      setAnalyzing(null)
    }
  }

  const sorted = [...watchlist].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Watchlist</h2>
          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
            {watchlist.length}
          </span>
          {!railwayUrl && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>· Connect Railway in Settings for live signals</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadWatchlist()} className="btn rounded-md px-3 py-1.5 text-xs">
            ↻ Refresh
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
            className="btn btn-primary rounded-md px-3 py-1.5 text-xs font-semibold"
          >
            + Add ticker
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <EmptyState onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="surface overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_80px_64px_90px_auto] gap-x-2 px-4 py-2" style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg)' }}>
            {['Ticker', 'Price', 'Target', 'Score', 'Conv.', 'Actions'].map((h, i) => (
              <span key={h} className={`text-xs font-medium ${i > 0 && i < 5 ? 'text-right' : i === 5 ? 'text-right pr-2' : ''}`} style={{ color: 'var(--text-tertiary)' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div>
            {sorted.map((item) => {
              const livePrice      = prices[item.ticker] ?? item.currentPrice
              const priceTriggered = item.priceTrigger != null && livePrice <= item.priceTrigger
              const scoreTriggered = item.scoreTrigger != null && item.score >= item.scoreTrigger
              const triggered      = priceTriggered || scoreTriggered
              const isExpired      = item.expiryDate ? new Date(item.expiryDate) < new Date() : false
              const isOpen         = expanded[item.id] ?? false
              const result         = signalResults[item.ticker]

              const scoreColor = item.score >= 7
                ? 'var(--success-text)'
                : item.score >= 5
                ? 'var(--yellow-text)'
                : 'var(--text-secondary)'

              return (
                <div key={item.id} style={{ opacity: isExpired ? 0.5 : 1, borderBottom: '0.5px solid var(--border)' }}>
                  {/* Main row */}
                  <div
                    className="group grid grid-cols-[1fr_80px_80px_64px_90px_auto] gap-x-2 items-center px-4 py-3 cursor-pointer transition"
                    style={triggered ? { background: 'rgba(125,216,159,0.04)' } : {}}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {/* Ticker + name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{isOpen ? '▾' : '▸'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.ticker}</span>
                          {item.score >= 7 && (
                            <span className="text-[10px] rounded px-1.5 py-px font-semibold leading-none" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)' }}>
                              KLAAR
                            </span>
                          )}
                          {triggered && (
                            <span className="text-[10px] rounded px-1.5 py-px font-medium leading-none" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                              🔔
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {item.name || item.exchange}
                        </p>
                      </div>
                    </div>

                    {/* Live price */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: priceTriggered ? 'var(--success-text)' : 'var(--text-primary)' }}>
                        {livePrice > 0 ? `€${livePrice.toFixed(2)}` : '—'}
                      </p>
                      {prices[item.ticker] && (
                        <p className="text-[10px] leading-none" style={{ color: 'var(--text-tertiary)' }}>live</p>
                      )}
                    </div>

                    {/* Price trigger */}
                    <div className="text-right">
                      <p className="text-sm tabular-nums" style={{ color: priceTriggered ? 'var(--success-text)' : 'var(--text-tertiary)', fontWeight: priceTriggered ? 600 : 400 }}>
                        {item.priceTrigger != null ? `€${item.priceTrigger.toFixed(2)}` : '—'}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: scoreColor }}>
                        {item.score > 0 ? item.score.toFixed(1) : '—'}
                      </p>
                    </div>

                    {/* Conviction */}
                    <div className="flex justify-end">
                      <ConvictionBadge level={item.conviction} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end pl-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => runAnalysis(item)}
                        disabled={analyzing === item.ticker}
                        className="rounded px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 whitespace-nowrap"
                        style={{ color: 'var(--primary)' }}
                      >
                        {analyzing === item.ticker ? 'Running…' : 'Analyse'}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded px-2 py-1 text-[11px] font-medium transition"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      {deleteConfirm === item.id ? (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting}
                          className="rounded px-2 py-1 text-[11px] font-medium transition"
                          style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                        >
                          {deleting ? '…' : 'Sure?'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="rounded px-2 py-1 text-[11px] font-medium transition"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isOpen && (
                    <div className="px-4 sm:px-6 py-4 space-y-4" style={{ borderTop: '0.5px solid var(--border)', background: 'var(--bg)' }}>

                      {/* Thesis */}
                      {item.reason && (
                        <p className="text-xs leading-relaxed pl-3" style={{ color: 'var(--text-primary)', borderLeft: '2px solid var(--primary)' }}>
                          {item.reason}
                        </p>
                      )}

                      {/* Two-column layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Factor scores</p>
                          <FactorBar scores={item.factorScores} />
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Details</p>
                          <div className="flex flex-wrap gap-2">
                            {item.sector && <MetaPill label="Sector" value={item.sector} />}
                            {item.exchange && <MetaPill label="Exchange" value={item.exchange} />}
                            {item.scoreTrigger != null && <MetaPill label="Score trigger" value={String(item.scoreTrigger)} />}
                            {item.priceTrigger != null && <MetaPill label="Price trigger" value={`€${item.priceTrigger}`} />}
                            {item.expiryDate && (
                              <MetaPill
                                label="Expires"
                                value={new Date(item.expiryDate).toLocaleDateString()}
                                highlight={isExpired ? 'red' : undefined}
                              />
                            )}
                            {item.addedDate && <MetaPill label="Added" value={new Date(item.addedDate).toLocaleDateString()} />}
                          </div>
                        </div>
                      </div>

                      {/* Analyse CTA */}
                      {!result && !analyzing && (
                        <button
                          onClick={() => runAnalysis(item)}
                          className="btn w-full sm:w-auto"
                          style={{ border: '1px solid var(--primary)', color: 'var(--primary)' }}
                        >
                          Run signal analysis
                        </button>
                      )}

                      {/* Running indicator */}
                      {analyzing === item.ticker && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
                          Running analysis…
                        </div>
                      )}

                      {/* Signal result */}
                      {result && <SignalResultPanel result={result} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AddWatchlistModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined) }}
        editItem={editTarget}
      />
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SignalModule {
  value:        string
  confidence:   number
  reasoning?:   string
  module_name?: string
}

interface SignalResult {
  ticker?:      string
  signals?:     SignalModule[]
  verdict?: {
    verdict?:        string
    finalVerdict?:   string
    final_verdict?:  string
    confidence:      number
    score?:          number
    reasoning?:      string
    earningsWarning?: boolean
    macroRegime?:    string
  }
  speculation?: { score: number; label: string }
  fundamentals?: {
    earningsDate?:     string | null
    daysToEarnings?:   number | null
    earningsTime?:     string | null
    surpriseHistory?:  Array<{ date: string; beat: boolean; epsMiss: number }>
    peRatio?:          number | null
    evToEbitda?:       number | null
    revenueGrowthYoY?: number | null
    netMargin?:        number | null
    analystConsensus?: string | null
    analystTarget?:    number | null
    estimateRevisions?: string | null
  }
  macro?: {
    regime?:        string
    regimeSummary?: string
    vix?:           number | null
    yieldSpread?:   number | null
    creditSpread?:  number | null
  }
  insider?: {
    netBuySignal?: string
    summary?:      string
    transactions?: Array<{ filedAt: string; insiderName: string; insiderTitle: string; transactionType: string; shares: number; totalValue: number | null }>
  }
  price?:       number
  error?:       string
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConvictionBadge({ level }: { level: number }) {
  const style: React.CSSProperties =
    level >= 5 ? { color: 'var(--success-text)', background: 'var(--success-bg)', border: '1px solid var(--success-text)' } :
    level >= 4 ? { color: 'var(--info-text)', background: 'var(--info-bg)', border: '1px solid var(--info-text)' } :
    level >= 3 ? { color: 'var(--yellow-text)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-text)' } :
                 { color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)' }
  const label =
    level >= 5 ? 'Max' : level >= 4 ? 'High' : level >= 3 ? 'Med' : 'Low'
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={style}>
      {label}
    </span>
  )
}

function FactorBar({ scores }: { scores: FactorScores }) {
  const labels: Record<keyof FactorScores, string> = { q: 'Quality', g: 'Growth', v: 'Value', m: 'Momentum', s: 'Safety' }
  return (
    <div className="space-y-1.5">
      {(Object.keys(labels) as (keyof FactorScores)[]).map((k) => {
        const val   = scores[k] ?? 0
        const pct   = Math.min((val / 10) * 100, 100)
        const color = val >= 7 ? 'var(--success-text)' : val >= 5 ? 'var(--yellow-text)' : val > 0 ? 'var(--danger-text)' : 'var(--text-tertiary)'
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] w-16 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{labels[k]}</span>
            <div className="progress-track flex-1">
              <div className="progress-fill rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[10px] tabular-nums w-5 text-right" style={{ color: 'var(--text-secondary)' }}>{val > 0 ? val.toFixed(0) : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}

function MetaPill({ label, value, highlight }: {
  label: string; value: string; highlight?: 'red' | 'green'
}) {
  const valueColor = highlight === 'red' ? 'var(--danger-text)' : highlight === 'green' ? 'var(--success-text)' : 'var(--text-primary)'
  return (
    <div className="flex items-center gap-1 rounded-md px-2.5 py-1" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="text-[10px] font-semibold" style={{ color: valueColor }}>{value}</span>
    </div>
  )
}

function SignalResultPanel({ result }: { result: SignalResult }) {
  if (result.error) {
    return (
      <div className="rounded-lg px-3 py-2 text-xs" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
        ⚠ {result.error}
      </div>
    )
  }

  const signalList   = Array.isArray(result.signals) ? result.signals : []
  const verdict      = result.verdict
  const verdictLabel = verdict?.final_verdict ?? verdict?.verdict ?? verdict?.finalVerdict ?? 'HOLD'
  const f            = result.fundamentals
  const m            = result.macro
  const ins          = result.insider

  const verdictStyle: React.CSSProperties = verdictLabel === 'BUY'
    ? { color: 'var(--success-text)', background: 'var(--success-bg)', border: '1px solid var(--success-text)' }
    : verdictLabel === 'SELL'
    ? { color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }
    : { color: 'var(--yellow-text)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-text)' }

  function macroStyle(regime: string | undefined): React.CSSProperties {
    if (regime === 'risk-on')  return { color: 'var(--success-text)', background: 'var(--success-bg)', border: '1px solid var(--success-text)' }
    if (regime === 'cautious') return { color: 'var(--yellow-text)', background: 'var(--yellow-bg)', border: '1px solid var(--yellow-text)' }
    if (regime === 'risk-off') return { color: 'var(--warning-text)', background: 'var(--warning-bg)', border: '1px solid var(--warning-text)' }
    if (regime === 'crisis')   return { color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }
    return { color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)' }
  }

  function insiderStyle(signal: string | undefined): React.CSSProperties {
    if (signal === 'strong-buy' || signal === 'buy') return { color: 'var(--success-text)', background: 'var(--success-bg)', border: '1px solid var(--success-text)' }
    if (signal === 'sell') return { color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }
    return { color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)' }
  }

  return (
    <div className="space-y-3 pt-3" style={{ borderTop: '0.5px solid var(--border)' }}>

      {/* Verdict row */}
      {verdict && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold" style={verdictStyle}>
            {verdictLabel}
            <span className="text-xs font-normal opacity-75">{(verdict.confidence * 100).toFixed(0)}% conf</span>
            {verdict.score != null && (
              <span className="text-xs font-normal opacity-75">· {verdict.score.toFixed(1)}/10</span>
            )}
          </div>

          {m?.regime && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold" style={macroStyle(m.regime)}>
              Macro: {m.regime}
            </span>
          )}

          {ins?.netBuySignal && ins.netBuySignal !== 'unknown' && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold" style={insiderStyle(ins.netBuySignal)}>
              Insider: {ins.netBuySignal.replace('-', ' ')}
            </span>
          )}

          {verdict.earningsWarning && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              ⚠ Earnings {f?.daysToEarnings != null ? `in ${f.daysToEarnings}d` : 'soon'}
            </span>
          )}

          {result.speculation && (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold" style={{ border: '1px solid var(--yellow-text)', background: 'var(--yellow-bg)', color: 'var(--yellow-text)' }}>
              Spec: {result.speculation.score}/10 · {result.speculation.label}
            </span>
          )}
        </div>
      )}

      {/* Reasoning */}
      {verdict?.reasoning && (
        <p className="text-xs leading-relaxed line-clamp-4" style={{ color: 'var(--text-secondary)' }}>{verdict.reasoning}</p>
      )}

      {/* Fundamentals strip */}
      {f && (
        <div className="flex flex-wrap gap-1.5">
          {f.peRatio != null && <MetaPill label="P/E" value={`${f.peRatio.toFixed(1)}×`} />}
          {f.evToEbitda != null && <MetaPill label="EV/EBITDA" value={`${f.evToEbitda.toFixed(1)}×`} />}
          {f.revenueGrowthYoY != null && <MetaPill label="Rev growth" value={`${(f.revenueGrowthYoY * 100).toFixed(1)}%`} highlight={f.revenueGrowthYoY > 0 ? 'green' : 'red'} />}
          {f.netMargin != null && <MetaPill label="Net margin" value={`${(f.netMargin * 100).toFixed(1)}%`} />}
          {f.analystConsensus && <MetaPill label="Analyst" value={f.analystConsensus} />}
          {f.analystTarget != null && <MetaPill label="Target" value={`$${f.analystTarget.toFixed(0)}`} highlight="green" />}
          {f.estimateRevisions && (
            <MetaPill
              label="Estimates"
              value={`↑ ${f.estimateRevisions}`.replace('↑ up', '↑ rising').replace('↑ down', '↓ falling').replace('↑ flat', '→ flat')}
              highlight={f.estimateRevisions === 'up' ? 'green' : f.estimateRevisions === 'down' ? 'red' : undefined}
            />
          )}
          {f.daysToEarnings != null && (
            <MetaPill label="Earnings" value={`${f.daysToEarnings}d`} highlight={f.daysToEarnings <= 14 ? 'red' : undefined} />
          )}
        </div>
      )}

      {/* Earnings surprise history */}
      {f?.surpriseHistory && f.surpriseHistory.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Earnings history</p>
          <div className="flex gap-1.5 flex-wrap">
            {f.surpriseHistory.map((s) => (
              <div
                key={s.date}
                className="rounded px-2 py-1 text-[10px] font-semibold"
                style={s.beat
                  ? { color: 'var(--success-text)', background: 'var(--success-bg)', border: '1px solid var(--success-text)' }
                  : { color: 'var(--danger-text)', background: 'var(--danger-bg)', border: '1px solid var(--danger-text)' }}
              >
                {s.date.slice(0, 7)} {s.beat ? '▲' : '▼'} {s.beat ? '+' : ''}{s.epsMiss.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro detail */}
      {m && (
        <div className="rounded-lg px-3 py-2 space-y-1" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Macro context</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.regimeSummary}</p>
        </div>
      )}

      {/* Insider detail */}
      {ins && ins.transactions && ins.transactions.length > 0 && (
        <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Insider activity (90 days)</p>
          {ins.transactions.slice(0, 3).map((t, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className="font-semibold" style={{ color: t.transactionType === 'buy' ? 'var(--success-text)' : t.transactionType === 'sell' ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                {t.transactionType.toUpperCase()}
              </span>
              <span className="truncate mx-2 max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>{t.insiderName}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{t.shares.toLocaleString()} shs</span>
              {t.totalValue != null && (
                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>${(t.totalValue / 1000).toFixed(0)}k</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Signal modules */}
      {signalList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {signalList.map((sig, i) => (
            <div key={i} className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface)' }}>
              <p className="text-[10px] capitalize leading-none" style={{ color: 'var(--text-tertiary)' }}>
                {(sig.module_name ?? `Signal ${i + 1}`).replace(/_/g, ' ')}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: sig.value === 'BULLISH' ? 'var(--success-text)' : sig.value === 'BEARISH' ? 'var(--danger-text)' : 'var(--yellow-text)' }}>
                {sig.value}{' '}
                <span className="font-normal text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  ({(sig.confidence * 100).toFixed(0)}%)
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="surface py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
      <p className="text-3xl mb-3">👁</p>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Nothing on watchlist</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Add tickers you&apos;re monitoring. Set price or score triggers to get alerts.
      </p>
      <button onClick={onAdd} className="btn btn-primary">
        + Add first ticker
      </button>
    </div>
  )
}

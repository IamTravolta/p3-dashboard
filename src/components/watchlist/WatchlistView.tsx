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
        // Persist result in store cache so it survives tab switches
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
          <h2 className="text-sm font-semibold text-white">
            Watchlist
          </h2>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {watchlist.length}
          </span>
          {!railwayUrl && (
            <span className="text-xs text-zinc-600">· Connect Railway in Settings for live signals</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadWatchlist()}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            ↻ Refresh
          </button>
          <button
            onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            + Add ticker
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <EmptyState onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_80px_64px_90px_auto] gap-x-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
            <span className="text-xs text-zinc-600 font-medium">Ticker</span>
            <span className="text-xs text-zinc-600 font-medium text-right">Price</span>
            <span className="text-xs text-zinc-600 font-medium text-right">Target</span>
            <span className="text-xs text-zinc-600 font-medium text-right">Score</span>
            <span className="text-xs text-zinc-600 font-medium text-right">Conv.</span>
            <span className="text-xs text-zinc-600 font-medium text-right pr-2">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-zinc-800/70">
            {sorted.map((item) => {
              const livePrice      = prices[item.ticker] ?? item.currentPrice
              const priceTriggered = item.priceTrigger != null && livePrice <= item.priceTrigger
              const scoreTriggered = item.scoreTrigger != null && item.score >= item.scoreTrigger
              const triggered      = priceTriggered || scoreTriggered
              const isExpired      = item.expiryDate ? new Date(item.expiryDate) < new Date() : false
              const isOpen         = expanded[item.id] ?? false
              const result         = signalResults[item.ticker]

              const scoreColor = item.score >= 7
                ? 'text-emerald-400'
                : item.score >= 5
                ? 'text-yellow-400'
                : 'text-zinc-400'

              return (
                <div key={item.id} className={isExpired ? 'opacity-50' : ''}>
                  {/* Main row */}
                  <div
                    className={`
                      group grid grid-cols-[1fr_80px_80px_64px_90px_auto] gap-x-2 items-center
                      px-4 py-3 cursor-pointer transition
                      ${triggered ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'hover:bg-zinc-800/40'}
                    `}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {/* Ticker + name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-zinc-600 w-3 shrink-0">{isOpen ? '▾' : '▸'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-white text-sm">{item.ticker}</span>
                          {item.score >= 7 && (
                            <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 rounded px-1.5 py-px font-semibold leading-none">
                              KLAAR
                            </span>
                          )}
                          {triggered && (
                            <span className="text-[10px] bg-emerald-900/50 text-emerald-300 rounded px-1.5 py-px font-medium leading-none">
                              🔔
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate leading-tight mt-0.5">
                          {item.name || item.exchange}
                        </p>
                      </div>
                    </div>

                    {/* Live price */}
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${priceTriggered ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {livePrice > 0 ? `€${livePrice.toFixed(2)}` : '—'}
                      </p>
                      {prices[item.ticker] && (
                        <p className="text-[10px] text-zinc-600 leading-none">live</p>
                      )}
                    </div>

                    {/* Price trigger */}
                    <div className="text-right">
                      <p className={`text-sm tabular-nums ${priceTriggered ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}>
                        {item.priceTrigger != null ? `€${item.priceTrigger.toFixed(2)}` : '—'}
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${scoreColor}`}>
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
                        className="rounded px-2 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-40 transition whitespace-nowrap"
                      >
                        {analyzing === item.ticker ? 'Running…' : 'Analyse'}
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition"
                      >
                        Edit
                      </button>
                      {deleteConfirm === item.id ? (
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting}
                          className="rounded px-2 py-1 text-[11px] font-medium bg-red-900/50 text-red-300 hover:bg-red-800 transition"
                        >
                          {deleting ? '…' : 'Sure?'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-red-400 hover:bg-red-900/20 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isOpen && (
                    <div className="border-t border-zinc-800/60 bg-zinc-900/30 px-4 sm:px-6 py-4 space-y-4">

                      {/* Thesis */}
                      {item.reason && (
                        <p className="text-xs text-zinc-300 leading-relaxed border-l-2 border-indigo-700 pl-3">
                          {item.reason}
                        </p>
                      )}

                      {/* Two-column layout: factors left, metadata right */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Factor scores — horizontal bars */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Factor scores</p>
                          <FactorBar scores={item.factorScores} />
                        </div>

                        {/* Metadata pills */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Details</p>
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
                          className="w-full sm:w-auto rounded-lg border border-indigo-800/60 bg-indigo-900/30 px-4 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-800/50 transition"
                        >
                          Run signal analysis
                        </button>
                      )}

                      {/* Running indicator */}
                      {analyzing === item.ticker && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
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
    verdict?:      string
    finalVerdict?: string
    confidence:    number
    score?:        number
    reasoning?:    string
  }
  speculation?: { score: number; label: string }
  price?:       number
  error?:       string
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConvictionBadge({ level }: { level: number }) {
  const config =
    level >= 5 ? { label: 'Max',  cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50' } :
    level >= 4 ? { label: 'High', cls: 'text-indigo-400  bg-indigo-900/30  border-indigo-800/50'  } :
    level >= 3 ? { label: 'Med',  cls: 'text-yellow-400  bg-yellow-900/30  border-yellow-800/50'  } :
                 { label: 'Low',  cls: 'text-zinc-400    bg-zinc-800/60    border-zinc-700/50'    }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${config.cls}`}>
      {config.label}
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
        const color = val >= 7 ? 'bg-emerald-500' : val >= 5 ? 'bg-yellow-500' : val > 0 ? 'bg-red-400' : 'bg-zinc-700'
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-16 shrink-0">{labels[k]}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-zinc-400 w-5 text-right">{val > 0 ? val.toFixed(0) : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}

function MetaPill({ label, value, highlight }: {
  label: string; value: string; highlight?: 'red' | 'green'
}) {
  const valueClass = highlight === 'red' ? 'text-red-400' : highlight === 'green' ? 'text-emerald-400' : 'text-zinc-200'
  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1">
      <span className="text-[10px] text-zinc-600">{label}</span>
      <span className={`text-[10px] font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}

function SignalResultPanel({ result }: { result: SignalResult }) {
  if (result.error) {
    return (
      <div className="rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
        ⚠ {result.error}
      </div>
    )
  }

  const signalList   = Array.isArray(result.signals) ? result.signals : []
  const verdict      = result.verdict
  const verdictLabel = verdict?.verdict ?? verdict?.finalVerdict ?? 'HOLD'

  const verdictColor = verdictLabel === 'BUY'
    ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
    : verdictLabel === 'SELL'
    ? 'text-red-400 bg-red-900/30 border-red-800'
    : 'text-yellow-400 bg-yellow-900/30 border-yellow-800'

  return (
    <div className="space-y-3 border-t border-zinc-800 pt-3">
      {verdict && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${verdictColor}`}>
            {verdictLabel}
            <span className="text-xs font-normal opacity-75">{(verdict.confidence * 100).toFixed(0)}% conf</span>
            {verdict.score != null && (
              <span className="text-xs font-normal opacity-75">· {verdict.score.toFixed(1)}/10</span>
            )}
          </div>
          {result.speculation && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-amber-800/50 bg-amber-900/20 px-2.5 py-1 text-xs font-medium text-amber-300">
              <span className="text-zinc-400 font-normal">Speculation:</span>
              {' '}{result.speculation.score}/10
              <span className="text-amber-400/70">·</span>
              {result.speculation.label}
            </div>
          )}
        </div>
      )}
      {verdict?.reasoning && (
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{verdict.reasoning}</p>
      )}
      {signalList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {signalList.map((sig, i) => (
            <div key={i} className="rounded-lg bg-zinc-800/50 px-2.5 py-2">
              <p className="text-[10px] text-zinc-500 capitalize leading-none">
                {(sig.module_name ?? `Signal ${i + 1}`).replace(/_/g, ' ')}
              </p>
              <p className={`text-xs font-semibold mt-1 ${
                sig.value === 'BULLISH' ? 'text-emerald-400' :
                sig.value === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {sig.value}{' '}
                <span className="text-zinc-500 font-normal text-[10px]">
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
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
      <p className="text-3xl mb-3">👁</p>
      <h3 className="text-base font-semibold text-white mb-1">Nothing on watchlist</h3>
      <p className="text-sm text-zinc-500 mb-4">
        Add tickers you&apos;re monitoring. Set price or score triggers to get alerts.
      </p>
      <button
        onClick={onAdd}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
      >
        + Add first ticker
      </button>
    </div>
  )
}

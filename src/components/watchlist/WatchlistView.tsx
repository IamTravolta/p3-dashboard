'use client'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { useWatchlistData } from '@/hooks/useWatchlistData'
import AddWatchlistModal from './AddWatchlistModal'
import type { WatchlistItem, FactorScores } from '@/lib/types/database'

export default function WatchlistView() {
  const watchlist          = useDashboardStore((s) => s.watchlist)
  const removeWatchlistItem = useDashboardStore((s) => s.removeWatchlistItem)
  const prices             = useDashboardStore((s) => s.prices)
  const activeTab          = useDashboardStore((s) => s.activeTab)

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Parameters<typeof AddWatchlistModal>[0]['editItem']>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [analyzing,    setAnalyzing]    = useState<string | null>(null)
  const [signalResults, setSignalResults] = useState<Record<string, SignalResult>>({})

  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  const { loadWatchlist } = useWatchlistData()

  if (activeTab !== 'watchlist') return null

  // ── Handlers ───────────────────────────────────────────────────────────────
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
      }
    } catch {
      setSignalResults((r) => ({ ...r, [item.ticker]: { error: 'Analysis failed' } }))
    } finally {
      setAnalyzing(null)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const sorted = [...watchlist].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-5">
      {/* Railway note */}
      {!railwayUrl && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-500 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0" />
          Connect Railway backend in Settings to enable live trigger signals
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Watchlist <span className="text-zinc-500 font-normal ml-1">({watchlist.length})</span>
        </h2>
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
        <div className="space-y-3">
          {sorted.map((item) => {
            const livePrice = prices[item.ticker] ?? item.currentPrice
            const priceTriggered = item.priceTrigger != null && livePrice <= item.priceTrigger
            const scoreTriggered = item.scoreTrigger != null && item.score >= item.scoreTrigger
            const triggered = priceTriggered || scoreTriggered
            const result    = signalResults[item.ticker]
            const isExpired = item.expiryDate ? new Date(item.expiryDate) < new Date() : false

            return (
              <div
                key={item.id}
                className={`
                  group rounded-xl border bg-zinc-900 p-4 transition
                  ${triggered ? 'border-emerald-700 shadow-sm shadow-emerald-900/30' : 'border-zinc-800'}
                  ${isExpired ? 'opacity-60' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Ticker block */}
                  <div className="min-w-[80px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white text-base">{item.ticker}</span>
                      {item.score >= 7 && (
                        <span className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800 rounded-full px-2 py-0.5 font-semibold">
                          KLAAR
                        </span>
                      )}
                      {triggered && (
                        <span className="text-xs bg-emerald-900/50 text-emerald-300 rounded px-1.5 py-0.5 font-medium animate-pulse">
                          🔔 Alert
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-xs bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5">Expired</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">{item.exchange}</div>
                    <div className="text-xs text-zinc-600 truncate max-w-[120px]">{item.name}</div>
                  </div>

                  {/* Price + P/T */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metric
                      label="Live price"
                      value={`€${livePrice.toFixed(2)}`}
                      sub={prices[item.ticker] ? 'live' : 'cached'}
                      valueClass={priceTriggered ? 'text-emerald-400' : 'text-white'}
                    />
                    <Metric
                      label="Price trigger"
                      value={item.priceTrigger != null ? `€${item.priceTrigger.toFixed(2)}` : '—'}
                      valueClass={priceTriggered ? 'text-emerald-400' : 'text-zinc-400'}
                    />
                    <Metric
                      label="Score"
                      value={item.score.toFixed(2)}
                      sub="/ 10"
                      valueClass={item.score >= 7 ? 'text-emerald-400' : item.score >= 5 ? 'text-yellow-400' : 'text-red-400'}
                    />
                    <Metric
                      label="Score trigger"
                      value={item.scoreTrigger != null ? String(item.scoreTrigger) : '—'}
                      valueClass={scoreTriggered ? 'text-emerald-400' : 'text-zinc-400'}
                    />
                  </div>

                  {/* Conviction */}
                  <div className="hidden sm:flex flex-col items-center gap-1">
                    <span className="text-xs text-zinc-500">Conviction</span>
                    <ConvictionDots level={item.conviction} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 items-end">
                    <button
                      onClick={() => runAnalysis(item)}
                      disabled={analyzing === item.ticker}
                      className="rounded px-2.5 py-1 text-xs font-medium bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800 disabled:opacity-50 transition whitespace-nowrap"
                    >
                      {analyzing === item.ticker ? '⏳ Analyzing…' : '🔬 Run analysis'}
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(item)} className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white transition">Edit</button>
                      {deleteConfirm === item.id ? (
                        <button onClick={() => handleDelete(item.id)} disabled={deleting} className="rounded px-2 py-0.5 text-xs bg-red-900/50 text-red-300 hover:bg-red-800 transition">
                          {deleting ? '…' : 'Confirm'}
                        </button>
                      ) : (
                        <button onClick={() => setDeleteConfirm(item.id)} className="rounded px-2 py-0.5 text-xs text-zinc-600 hover:text-red-400 transition">✕</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                {item.reason && (
                  <p className="mt-2 text-xs text-zinc-500 border-t border-zinc-800 pt-2">{item.reason}</p>
                )}

                {/* Factor scores mini bar */}
                <FactorBar scores={item.factorScores} />

                {/* Trigger status row */}
                <TriggerStatusRow score={item.score} />

                {/* Signal result */}
                {result && <SignalResultPanel result={result} />}
              </div>
            )
          })}
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
  value:       string
  confidence:  number
  reasoning?:  string
  module_name?: string
}

interface SignalResult {
  ticker?:      string
  // New /api/analyze shape
  signals?:     SignalModule[]
  verdict?: {
    verdict?:      string
    finalVerdict?: string   // legacy compat
    confidence:    number
    score?:        number
    reasoning?:    string
  }
  speculation?: { score: number; label: string }
  price?:       number
  error?:       string
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Metric({ label, value, sub, valueClass = 'text-zinc-300' }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600">{sub}</p>}
    </div>
  )
}

function ConvictionDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i <= level ? 'bg-indigo-500' : 'bg-zinc-700'}`} />
      ))}
    </div>
  )
}

function FactorBar({ scores }: { scores: FactorScores }) {
  const labels = { q: 'Q', g: 'G', v: 'V', m: 'M', s: 'S' } as const
  return (
    <div className="mt-3 flex gap-1.5 items-end">
      {(Object.keys(labels) as (keyof FactorScores)[]).map((k) => {
        const val = scores[k]
        const pct = (val / 10) * 100
        const color = val >= 7 ? 'bg-emerald-500' : val >= 5 ? 'bg-yellow-500' : 'bg-red-500'
        return (
          <div key={k} className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-zinc-600 tabular-nums">{val.toFixed(0)}</span>
            <div className="w-5 bg-zinc-800 rounded-sm" style={{ height: 32 }}>
              <div className={`${color} rounded-sm w-full transition-all`} style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }} />
            </div>
            <span className="text-xs text-zinc-600">{labels[k]}</span>
          </div>
        )
      })}
    </div>
  )
}

function SignalResultPanel({ result }: { result: SignalResult }) {
  if (result.error) {
    return (
      <div className="mt-3 rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-xs text-red-400">
        ⚠ {result.error}
      </div>
    )
  }

  const signalList = Array.isArray(result.signals) ? result.signals : []
  const verdict    = result.verdict
  const verdictLabel = verdict?.verdict ?? verdict?.finalVerdict ?? 'HOLD'

  const verdictColor = verdictLabel === 'BUY'
    ? 'text-emerald-400 bg-emerald-900/30 border-emerald-800'
    : verdictLabel === 'SELL'
    ? 'text-red-400 bg-red-900/30 border-red-800'
    : 'text-yellow-400 bg-yellow-900/30 border-yellow-800'

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3 space-y-2">
      {verdict && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${verdictColor}`}>
            {verdictLabel}
            <span className="text-xs font-normal opacity-75">{(verdict.confidence * 100).toFixed(0)}% conf</span>
            {verdict.score != null && <span className="text-xs font-normal opacity-75">· {verdict.score.toFixed(1)}/10</span>}
          </div>
          {result.speculation && (
            <div className="rounded-lg bg-zinc-800/50 px-2 py-1 text-xs text-zinc-400">
              Speculation: <span className="font-medium text-white">{result.speculation.score}/10</span> {result.speculation.label}
            </div>
          )}
        </div>
      )}
      {verdict?.reasoning && (
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">{verdict.reasoning}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {signalList.map((sig, i) => (
          <div key={i} className="rounded-lg bg-zinc-800/50 px-2 py-1.5">
            <p className="text-xs text-zinc-500 capitalize">{(sig.module_name ?? `Signal ${i + 1}`).replace(/_/g, ' ')}</p>
            <p className={`text-xs font-semibold mt-0.5 ${
              sig.value === 'BULLISH' ? 'text-emerald-400' :
              sig.value === 'BEARISH' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {sig.value} <span className="text-zinc-500 font-normal">({(sig.confidence * 100).toFixed(0)}%)</span>
            </p>
            {sig.reasoning && <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">{sig.reasoning}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function TriggerStatusRow({ score }: { score: number }) {
  const fundamentalColor = score >= 7 ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800'
    : score >= 5 ? 'bg-yellow-900/40 text-yellow-300 border-yellow-800'
    : 'bg-red-900/40 text-red-300 border-red-800'
  const fundamentalLabel = score >= 7 ? 'Strong' : score >= 5 ? 'Moderate' : 'Weak'

  return (
    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
      <span className="text-xs text-zinc-600 mr-1">Triggers:</span>
      <TriggerBadge label="Technical"    status="—" />
      <TriggerBadge label="Fundamental"  status={fundamentalLabel} colorClass={fundamentalColor} />
      <TriggerBadge label="Sentiment"    status="—" />
      <TriggerBadge label="Momentum"     status="—" />
    </div>
  )
}

function TriggerBadge({
  label,
  status,
  colorClass = 'bg-zinc-800 text-zinc-500 border-zinc-700',
}: {
  label:       string
  status:      string
  colorClass?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${colorClass}`}>
      <span className="text-zinc-600 font-normal">{label}:</span>
      <span className="font-medium">{status}</span>
    </span>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
      <p className="text-3xl mb-3">👁</p>
      <h3 className="text-base font-semibold text-white mb-1">Nothing on watchlist</h3>
      <p className="text-sm text-zinc-500 mb-4">Add tickers you're monitoring. Set price/score triggers to get alerts.</p>
      <button onClick={onAdd} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition">
        + Add first ticker
      </button>
    </div>
  )
}

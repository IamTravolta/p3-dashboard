'use client'

/**
 * Action Center — the intelligence hub
 *
 * Tells the user exactly when to act and why:
 * - BUY opportunities (watchlist items with 4+ conditions aligned)
 * - HOLD/REVIEW/SELL assessments for positions
 * - Macro regime banner
 * - Full analysis runner (demo run)
 */

import { useState, useEffect, useCallback } from 'react'
import { usePrices } from '@/lib/store'
import type { OpportunityScore, OpportunityStrength, ActionType } from '@/lib/signals/opportunity'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MacroData {
  regime:        string
  regimeSummary: string
  vix:           number | null
  yieldSpread:   number | null
  creditSpread:  number | null
}

interface OpportunityResponse {
  watchlist:  OpportunityScore[]
  positions:  OpportunityScore[]
  macro:      MacroData | null
  scoredAt:   string
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const actionColors: Record<ActionType, string> = {
  BUY:    'text-emerald-400 bg-emerald-900/30 border-emerald-700/60',
  HOLD:   'text-indigo-400  bg-indigo-900/30  border-indigo-700/60',
  REVIEW: 'text-amber-400   bg-amber-900/30   border-amber-700/60',
  SELL:   'text-red-400     bg-red-900/30     border-red-700/60',
}

const actionBorder: Record<ActionType, string> = {
  BUY:    'border-l-emerald-500',
  HOLD:   'border-l-indigo-500',
  REVIEW: 'border-l-amber-500',
  SELL:   'border-l-red-500',
}

const strengthDots: Record<OpportunityStrength, { filled: number; color: string }> = {
  strong:   { filled: 3, color: 'bg-emerald-400' },
  moderate: { filled: 2, color: 'bg-yellow-400'  },
  weak:     { filled: 1, color: 'bg-amber-500'   },
  avoid:    { filled: 0, color: 'bg-red-500'     },
}

const macroColors: Record<string, string> = {
  'risk-on':  'border-emerald-800/60 bg-emerald-950/30 text-emerald-400',
  'cautious': 'border-yellow-800/60  bg-yellow-950/30  text-yellow-400',
  'risk-off': 'border-orange-800/60  bg-orange-950/30  text-orange-400',
  'crisis':   'border-red-800/60     bg-red-950/30     text-red-400',
}

// ── Macro Banner ──────────────────────────────────────────────────────────────

function MacroBanner({ macro }: { macro: MacroData }) {
  const cls = macroColors[macro.regime] ?? 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider">Macro: {macro.regime}</span>
            {macro.vix != null && (
              <span className="text-xs opacity-70">VIX {macro.vix.toFixed(1)}</span>
            )}
            {macro.yieldSpread != null && (
              <span className="text-xs opacity-70">
                Yield curve {macro.yieldSpread >= 0 ? '+' : ''}{macro.yieldSpread.toFixed(2)}%
                {macro.yieldSpread < 0 ? ' ⚠ inverted' : ''}
              </span>
            )}
            {macro.creditSpread != null && (
              <span className="text-xs opacity-70">HY spread {macro.creditSpread.toFixed(2)}%</span>
            )}
          </div>
          <p className="text-xs mt-1 opacity-80">{macro.regimeSummary}</p>
        </div>
      </div>
    </div>
  )
}

// ── Condition dots ─────────────────────────────────────────────────────────────

function ScoreDots({ score, max = 6, strength }: { score: number; max?: number; strength: OpportunityStrength }) {
  const { color } = strengthDots[strength]
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full transition-all ${i < Math.round(score) ? color : 'bg-zinc-700'}`}
        />
      ))}
      <span className="ml-1.5 text-xs font-mono text-zinc-500">{score}/{max}</span>
    </div>
  )
}

// ── Condition checklist ────────────────────────────────────────────────────────

function ConditionList({ conditions, defaultExpanded = false }: {
  conditions: OpportunityScore['conditions']
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
      >
        {expanded ? '▲ Hide conditions' : '▼ Show conditions'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {conditions.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 text-xs font-bold ${
                c.met ? 'text-emerald-400' : c.partial ? 'text-yellow-400' : 'text-red-400/60'
              }`}>
                {c.met ? '✓' : c.partial ? '~' : '✕'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-zinc-300">{c.label}</span>
                <span className="text-[10px] text-zinc-600 ml-1.5">{c.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({ item }: { item: OpportunityScore }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900 border-l-4 ${actionBorder[item.action]} px-4 py-4 space-y-3`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-bold text-white">{item.ticker}</span>
            <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${actionColors[item.action]}`}>
              {item.action}
            </span>
            <span className="text-[10px] text-zinc-600">{item.type === 'watchlist' ? 'Watchlist' : 'Position'}</span>
            {item.pnlPct !== undefined && (
              <span className={`text-xs font-mono font-semibold ${item.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {item.pnlPct >= 0 ? '+' : ''}{item.pnlPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-300 leading-snug">{item.headline}</p>
        </div>
        <ScoreDots score={item.score} strength={item.strength} />
      </div>

      {/* Reasoning */}
      <p className="text-xs text-zinc-500 leading-relaxed">{item.reasoning}</p>

      {/* Conditions */}
      <ConditionList conditions={item.conditions} defaultExpanded={expanded} />

      {/* Price */}
      {item.price != null && (
        <p className="text-[10px] text-zinc-600 tabular-nums">
          Live price: {item.price.toFixed(2)} · Scored {new Date(item.scoredAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({
  title, subtitle, items, emptyText, titleColor = 'text-zinc-400',
}: {
  title:      string
  subtitle:   string
  items:      OpportunityScore[]
  emptyText:  string
  titleColor?: string
}) {
  if (items.length === 0) return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${titleColor}`}>{title}</h3>
      <p className="text-xs text-zinc-600 italic">{emptyText}</p>
    </div>
  )
  return (
    <div className="space-y-3">
      <div>
        <h3 className={`text-xs font-bold uppercase tracking-widest ${titleColor}`}>{title}</h3>
        <p className="text-xs text-zinc-600 mt-0.5">{subtitle}</p>
      </div>
      {items.map((item) => (
        <OpportunityCard key={`${item.type}-${item.ticker}`} item={item} />
      ))}
    </div>
  )
}

// ── Full Analysis Runner ──────────────────────────────────────────────────────

function FullAnalysisRunner({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{
    processed: number; succeeded: number; failed: number;
    verdicts?: Array<{ ticker: string; verdict: string }>
    macro?: { regime: string; summary: string }
  } | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function run() {
    setStatus('running')
    setResult(null)
    setErrMsg(null)
    try {
      const resp = await fetch('/api/analyze/bulk', { method: 'POST' })
      const j    = await resp.json()
      if (!resp.ok) throw new Error(j.error ?? 'Bulk analysis failed')
      setResult(j)
      setStatus('done')
      onComplete()
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Full Portfolio Analysis</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Runs the complete intelligence pipeline on every position and watchlist item —
            technical signals, fundamentals, macro context, and insider data.
            Takes 1–2 minutes depending on portfolio size.
          </p>
        </div>
        <button
          onClick={run}
          disabled={status === 'running'}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {status === 'running' ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analysing…
            </>
          ) : (
            'Run Full Analysis'
          )}
        </button>
      </div>

      {status === 'done' && result && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-emerald-400 font-semibold">
              ✓ {result.succeeded}/{result.processed} items analysed
            </span>
            {result.macro && (
              <span className="text-xs text-zinc-500">
                Macro: <span className="text-zinc-300">{result.macro.regime}</span>
              </span>
            )}
            {result.failed > 0 && (
              <span className="text-xs text-amber-400">{result.failed} failed (price data unavailable)</span>
            )}
          </div>
          {result.verdicts && result.verdicts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.verdicts.map((v) => (
                <span
                  key={v.ticker}
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                    v.verdict === 'BUY'  ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/50' :
                    v.verdict === 'SELL' ? 'text-red-400 bg-red-900/20 border-red-800/50' :
                                          'text-yellow-400 bg-yellow-900/20 border-yellow-800/50'
                  }`}
                >
                  {v.ticker}: {v.verdict}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-400">{errMsg}</p>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function ActionCenterView() {
  const prices = usePrices()

  const [data,       setData]       = useState<OpportunityResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [lastScored, setLastScored] = useState<string | null>(null)
  const [errMsg,     setErrMsg]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrMsg(null)
    try {
      const pricesParam = encodeURIComponent(JSON.stringify(prices))
      const resp  = await fetch(`/api/opportunity?prices=${pricesParam}`)
      const json  = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? 'Failed to load')
      setData(json)
      setLastScored(new Date().toLocaleTimeString())
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load opportunity data')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(prices)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // Categorise
  const buyOpportunities  = (data?.watchlist ?? []).filter((w) => w.action === 'BUY')
  const watchOpportunities = (data?.watchlist ?? []).filter((w) => w.action !== 'BUY')
  const holdPositions     = (data?.positions ?? []).filter((p) => p.action === 'HOLD')
  const reviewPositions   = (data?.positions ?? []).filter((p) => p.action === 'REVIEW')
  const sellPositions     = (data?.positions ?? []).filter((p) => p.action === 'SELL')

  const totalActionable = buyOpportunities.length + reviewPositions.length + sellPositions.length

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Intelligence Center</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            When to act and why — updated on every price refresh
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastScored && (
            <span className="text-xs text-zinc-600">Scored {lastScored}</span>
          )}
          {totalActionable > 0 && (
            <span className="rounded-full bg-indigo-900/50 border border-indigo-700/60 px-2.5 py-1 text-xs font-semibold text-indigo-300">
              {totalActionable} items need attention
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Full analysis runner */}
      <FullAnalysisRunner onComplete={load} />

      {/* Macro banner */}
      {data?.macro && <MacroBanner macro={data.macro} />}

      {/* Loading / error */}
      {loading && !data && (
        <div className="py-12 text-center">
          <div className="mx-auto h-6 w-6 rounded-full border-2 border-zinc-700 border-t-indigo-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-500">Scoring opportunities across your portfolio…</p>
          <p className="text-xs text-zinc-600 mt-1">Fetching fundamentals, macro data, and insider activity</p>
        </div>
      )}

      {errMsg && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {errMsg}
        </div>
      )}

      {/* Content */}
      {data && !loading && (
        <div className="space-y-10">

          {/* BUY opportunities */}
          <Section
            title="Buy Opportunities"
            subtitle="Watchlist items where 4+ conditions are aligned — now is the right time to look closely"
            items={buyOpportunities}
            emptyText="No watchlist items have 4+ conditions aligned right now. Add items to your watchlist to track them."
            titleColor="text-emerald-400"
          />

          {/* Positions needing action */}
          {(sellPositions.length > 0 || reviewPositions.length > 0) && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">Position Alerts</h3>
                <p className="text-xs text-zinc-600 mt-0.5">Positions where the thesis may be weakening or broken</p>
              </div>
              {[...sellPositions, ...reviewPositions].map((item) => (
                <OpportunityCard key={`pos-${item.ticker}`} item={item} />
              ))}
            </div>
          )}

          {/* Healthy positions */}
          {holdPositions.length > 0 && (
            <Section
              title="Holding — Thesis Intact"
              subtitle="Positions where conditions remain healthy — continue holding"
              items={holdPositions}
              emptyText="No positions to display."
              titleColor="text-indigo-400"
            />
          )}

          {/* Watchlist monitoring */}
          {watchOpportunities.length > 0 && (
            <Section
              title="Watchlist — Not Yet"
              subtitle="Conditions not yet aligned — continue monitoring"
              items={watchOpportunities}
              emptyText=""
              titleColor="text-zinc-400"
            />
          )}

          {/* All clear */}
          {data.watchlist.length === 0 && data.positions.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
              <p className="text-sm text-zinc-500">No positions or watchlist items found.</p>
              <p className="text-xs text-zinc-600 mt-1">Add stocks to your portfolio or watchlist to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

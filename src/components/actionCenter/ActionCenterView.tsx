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

const actionPillClass: Record<ActionType, string> = {
  BUY:    'pill pill-success',
  HOLD:   'pill pill-info',
  REVIEW: 'pill pill-yellow',
  SELL:   'pill pill-danger',
}

const actionBorderColor: Record<ActionType, string> = {
  BUY:    'var(--success-text)',
  HOLD:   'var(--primary)',
  REVIEW: 'var(--yellow-text)',
  SELL:   'var(--danger-text)',
}

const strengthDots: Record<OpportunityStrength, { filled: number; color: string }> = {
  strong:   { filled: 3, color: 'bg-emerald-400' },
  moderate: { filled: 2, color: 'bg-yellow-400'  },
  weak:     { filled: 1, color: 'bg-amber-500'   },
  avoid:    { filled: 0, color: 'bg-red-500'     },
}

const macroStyleMap: Record<string, { borderColor: string; bg: string; color: string }> = {
  'risk-on':  { borderColor: 'var(--success-text)', bg: 'var(--success-bg)', color: 'var(--success-text)' },
  'cautious': { borderColor: 'var(--yellow-text)',  bg: 'var(--yellow-bg)',  color: 'var(--yellow-text)'  },
  'risk-off': { borderColor: 'var(--warning-text)', bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  'crisis':   { borderColor: 'var(--danger-text)',  bg: 'var(--danger-bg)',  color: 'var(--danger-text)'  },
}

// ── Macro Banner ──────────────────────────────────────────────────────────────

function MacroBanner({ macro }: { macro: MacroData }) {
  const s = macroStyleMap[macro.regime] ?? { borderColor: 'var(--border)', bg: 'var(--surface)', color: 'var(--text-secondary)' }
  return (
    <div className="rounded-xl px-4 py-3" style={{ border: `1px solid ${s.borderColor}`, background: s.bg, color: s.color }}>
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
          className={`h-2 w-2 rounded-full transition-all ${i < Math.round(score) ? color : ''}`}
          style={i < Math.round(score) ? {} : { background: 'var(--border)' }}
        />
      ))}
      <span className="ml-1.5 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{score}/{max}</span>
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
        className="text-[10px] transition"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? '▲ Hide conditions' : '▼ Show conditions'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {conditions.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-xs font-bold" style={{
                color: c.met ? 'var(--success-text)' : c.partial ? 'var(--yellow-text)' : 'var(--danger-text)',
              }}>
                {c.met ? '✓' : c.partial ? '~' : '✕'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-tertiary)' }}>{c.detail}</span>
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
      className="surface px-4 py-4 space-y-3"
      style={{ borderLeft: `4px solid ${actionBorderColor[item.action]}`, borderRadius: 12 }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.ticker}</span>
            <span className={actionPillClass[item.action]}>
              {item.action}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{item.type === 'watchlist' ? 'Watchlist' : 'Position'}</span>
            {item.pnlPct !== undefined && (
              <span className="text-xs font-mono font-semibold" style={{ color: item.pnlPct >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {item.pnlPct >= 0 ? '+' : ''}{item.pnlPct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs leading-snug" style={{ color: 'var(--text-secondary)' }}>{item.headline}</p>
        </div>
        <ScoreDots score={item.score} strength={item.strength} />
      </div>

      {/* Reasoning */}
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{item.reasoning}</p>

      {/* Conditions */}
      <ConditionList conditions={item.conditions} defaultExpanded={expanded} />

      {/* Price */}
      {item.price != null && (
        <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          Live price: {item.price.toFixed(2)} · Scored {new Date(item.scoredAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function Section({
  title, subtitle, items, emptyText, titleColor = 'var(--text-secondary)',
}: {
  title:      string
  subtitle:   string
  items:      OpportunityScore[]
  emptyText:  string
  titleColor?: string
}) {
  if (items.length === 0) return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: titleColor }}>{title}</h3>
      <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>{emptyText}</p>
    </div>
  )
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: titleColor }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
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
    <div className="surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Full Portfolio Analysis</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Runs the complete intelligence pipeline on every position and watchlist item —
            technical signals, fundamentals, macro context, and insider data.
            Takes 1–2 minutes depending on portfolio size.
          </p>
        </div>
        <button
          onClick={run}
          disabled={status === 'running'}
          className="btn btn-primary shrink-0 flex items-center gap-2 disabled:opacity-50"
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
            <span className="text-xs font-semibold" style={{ color: 'var(--success-text)' }}>
              ✓ {result.succeeded}/{result.processed} items analysed
            </span>
            {result.macro && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Macro: <span style={{ color: 'var(--text-primary)' }}>{result.macro.regime}</span>
              </span>
            )}
            {result.failed > 0 && (
              <span className="text-xs" style={{ color: 'var(--warning-text)' }}>{result.failed} failed (price data unavailable)</span>
            )}
          </div>
          {result.verdicts && result.verdicts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.verdicts.map((v) => (
                <span
                  key={v.ticker}
                  className={`pill ${
                    v.verdict === 'BUY'  ? 'pill-success' :
                    v.verdict === 'SELL' ? 'pill-danger' :
                                          'pill-yellow'
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
        <p className="text-xs" style={{ color: 'var(--danger-text)' }}>{errMsg}</p>
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
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--info-text)' }}>◆ Action Center</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--info-text)', opacity: 0.7 }}>Daily signals that need your attention, in plain language</div>
          </div>
          <div className="flex items-center gap-3">
            {lastScored && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Scored {lastScored}</span>
            )}
            {totalActionable > 0 && (
              <span className="pill pill-info">
                {totalActionable} items need attention
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="btn disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--info-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--info-text)', lineHeight: 1.6 }}>
            Prioritized list of actions across all modules. High urgency items appear first. Dismiss when actioned.
          </div>
        </div>
      </div>

      {/* Full analysis runner */}
      <FullAnalysisRunner onComplete={load} />

      {/* Macro banner */}
      {data?.macro && <MacroBanner macro={data.macro} />}

      {/* Loading / error */}
      {loading && !data && (
        <div className="py-12 text-center">
          <div className="mx-auto h-6 w-6 rounded-full border-2 animate-spin mb-3" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Scoring opportunities across your portfolio…</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Fetching fundamentals, macro data, and insider activity</p>
        </div>
      )}

      {errMsg && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
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
            titleColor="var(--success-text)"
          />

          {/* Positions needing action */}
          {(sellPositions.length > 0 || reviewPositions.length > 0) && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--danger-text)' }}>Position Alerts</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Positions where the thesis may be weakening or broken</p>
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
              titleColor="var(--info-text)"
            />
          )}

          {/* Watchlist monitoring */}
          {watchOpportunities.length > 0 && (
            <Section
              title="Watchlist — Not Yet"
              subtitle="Conditions not yet aligned — continue monitoring"
              items={watchOpportunities}
              emptyText=""
              titleColor="var(--text-secondary)"
            />
          )}

          {/* All clear */}
          {data.watchlist.length === 0 && data.positions.length === 0 && (
            <div className="rounded-xl py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No positions or watchlist items found.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Add stocks to your portfolio or watchlist to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

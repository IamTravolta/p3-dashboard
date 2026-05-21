'use client'

import { useEffect, useState } from 'react'
import TickerChip from '@/components/shared/TickerChip'

interface VerdictRow {
  id: string
  ticker: string
  verdict: string
  score: number
  confidence: number
  reasoning: string
  logged_at: string
}

type Filter = 'ALL' | 'BUY' | 'SELL' | 'HOLD'

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    BUY:  'bg-emerald-900/70 text-emerald-300 border border-emerald-700',
    SELL: 'bg-red-900/70 text-red-300 border border-red-700',
    HOLD: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${styles[verdict] ?? styles.HOLD}`}>
      {verdict}
    </span>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.min(100, confidence * 100)
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-500">{pct.toFixed(0)}%</span>
    </div>
  )
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)    return `${sec}s ago`
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function ClaudeLogView() {
  const [rows,       setRows]       = useState<VerdictRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [filter,     setFilter]     = useState<Filter>('ALL')
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({})
  const [evaluating, setEvaluating] = useState(false)
  const [evalMsg,    setEvalMsg]    = useState<string | null>(null)

  async function fetchVerdicts() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/verdicts')
      if (!r.ok) {
        setError('Could not load Claude log')
        return
      }
      const j = await r.json()
      setRows(j.data ?? j.verdicts ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVerdicts() }, [])

  async function evaluateOutcomes() {
    setEvaluating(true)
    setEvalMsg(null)
    try {
      const r = await fetch('/api/outcomes', { method: 'POST' })
      const j = await r.json()
      setEvalMsg(j.message ?? (r.ok ? 'Outcomes evaluated' : 'Evaluation failed'))
      if (r.ok) fetchVerdicts()
    } catch {
      setEvalMsg('Network error during evaluation')
    } finally {
      setEvaluating(false)
      setTimeout(() => setEvalMsg(null), 4000)
    }
  }

  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.verdict === filter)

  const FILTERS: Filter[] = ['ALL', 'BUY', 'SELL', 'HOLD']
  const filterColors: Record<Filter, string> = {
    ALL:  'bg-zinc-700 text-zinc-200',
    BUY:  'bg-emerald-600 text-white',
    SELL: 'bg-red-600 text-white',
    HOLD: 'bg-zinc-600 text-zinc-200',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Claude Log</h2>
          <p className="text-xs text-zinc-500 mt-0.5">All AI verdicts generated for your tickers</p>
        </div>
        <button
          onClick={evaluateOutcomes}
          disabled={evaluating}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-60 transition"
        >
          {evaluating ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-white animate-spin" />
              Evaluating…
            </>
          ) : 'Evaluate Outcomes'}
        </button>
      </div>

      {evalMsg && (
        <div className="rounded-lg border border-indigo-800 bg-indigo-950/40 px-4 py-2 text-sm text-indigo-300">
          {evalMsg}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === f
                ? filterColors[f]
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <span className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-indigo-400 animate-spin" />
          Loading verdicts…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
          <p className="text-sm text-zinc-400 font-medium">No verdicts yet</p>
          <p className="text-xs text-zinc-600 mt-1">Run analysis on tickers to populate the log</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Verdict</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((row) => {
                const isExpanded = expanded[row.id]
                return (
                  <tr key={row.id} className="hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 text-[11px] text-zinc-500 whitespace-nowrap">{timeAgo(row.logged_at)}</td>
                    <td className="px-4 py-3">
                      <TickerChip ticker={row.ticker} />
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-300">{row.score?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3">
                      <ConfidenceBar confidence={row.confidence} />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}
                        className="text-left text-xs text-zinc-400 hover:text-zinc-200 transition"
                      >
                        <span className={isExpanded ? '' : 'line-clamp-2'}>
                          {row.reasoning || '—'}
                        </span>
                        {row.reasoning && row.reasoning.length > 100 && (
                          <span className="text-indigo-400 ml-1">{isExpanded ? 'less' : 'more'}</span>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

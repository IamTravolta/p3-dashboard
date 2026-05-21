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
  const v = verdict?.toUpperCase()
  const pillClass = v === 'BUY' ? 'pill pill-success' : v === 'SELL' ? 'pill pill-danger' : 'pill pill-neutral'
  return <span className={pillClass}>{verdict}</span>
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.min(100, confidence * 100)
  const color = pct >= 70 ? 'var(--success-text)' : pct >= 45 ? 'var(--warning-text)' : 'var(--danger-text)'
  return (
    <div className="flex items-center gap-2">
      <div className="progress-track w-20">
        <div className="progress-fill rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{pct.toFixed(0)}%</span>
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

const FILTER_STYLES: Record<Filter, { active: React.CSSProperties; inactive: React.CSSProperties }> = {
  ALL:  { active: { background: 'var(--surface)', color: 'var(--text-primary)' }, inactive: { color: 'var(--text-tertiary)' } },
  BUY:  { active: { background: 'var(--success-bg)', color: 'var(--success-text)' }, inactive: { color: 'var(--text-tertiary)' } },
  SELL: { active: { background: 'var(--danger-bg)', color: 'var(--danger-text)' }, inactive: { color: 'var(--text-tertiary)' } },
  HOLD: { active: { background: 'var(--surface)', color: 'var(--text-secondary)' }, inactive: { color: 'var(--text-tertiary)' } },
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>📋 Claude Log</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Full verdict history with filters and outcome evaluation</div>
          </div>
          <button
            onClick={evaluateOutcomes}
            disabled={evaluating}
            className="btn flex items-center gap-2 disabled:opacity-60"
          >
            {evaluating ? (
              <>
                <span className="h-3 w-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text-primary)' }} />
                Evaluating…
              </>
            ) : 'Evaluate Outcomes'}
          </button>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>All AI verdicts logged with ticker, action, conviction, timestamp. Evaluate Outcomes runs batch tracking on pending entries.</div>
        </div>
      </div>

      {evalMsg && (
        <div className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--info-text)', background: 'var(--info-bg)', color: 'var(--info-text)' }}>
          {evalMsg}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => {
          const s = FILTER_STYLES[f]
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition"
              style={filter === f ? s.active : s.inactive}
            >
              {f}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
          <span className="h-4 w-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          Loading verdicts…
        </div>
      )}

      {!loading && error && (
        <div className="surface py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="surface py-12 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No verdicts yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Run analysis on tickers to populate the log</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Date', 'Ticker', 'Verdict', 'Score', 'Confidence', 'Reasoning'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isExpanded = expanded[row.id]
                return (
                  <tr key={row.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3 text-[11px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{timeAgo(row.logged_at)}</td>
                    <td className="px-4 py-3">
                      <TickerChip ticker={row.ticker} />
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--text-primary)' }}>{row.score?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3">
                      <ConfidenceBar confidence={row.confidence} />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}
                        className="text-left text-xs transition"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <span className={isExpanded ? '' : 'line-clamp-2'}>
                          {row.reasoning || '—'}
                        </span>
                        {row.reasoning && row.reasoning.length > 100 && (
                          <span className="ml-1" style={{ color: 'var(--primary)' }}>{isExpanded ? 'less' : 'more'}</span>
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

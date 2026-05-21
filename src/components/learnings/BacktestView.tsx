'use client'
import { railwayFetch } from '@/lib/utils/railwayFetch'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import { Play, RefreshCw } from 'lucide-react'

type Timeframe = '30d' | '60d' | '90d' | '180d'
type Metric    = 'Score' | 'Conviction' | 'Factor'

interface BacktestRow {
  signal_date:  string
  ticker:       string
  signal_type:  string
  verdict:      string
  return_30d:   number
  correct:      boolean
}

interface BacktestSummary {
  accuracy:        number
  avg_return_buy:  number
  avg_return_sell: number
  total_signals:   number
}

interface BacktestResult {
  summary: BacktestSummary
  rows:    BacktestRow[]
}

export default function BacktestView() {
  const positions = useDashboardStore((s) => s.positions)

  const [timeframe, setTimeframe] = useState<Timeframe>('30d')
  const [metric,    setMetric]    = useState<Metric>('Score')
  const [running,   setRunning]   = useState(false)
  const [result,    setResult]    = useState<BacktestResult | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  async function runBacktest() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const resp = await railwayFetch('/api/railway/backtest/score', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ timeframe, metric, positions }),
      })
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`)
      const data = await resp.json() as BacktestResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backtest failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>⏮ Backtest</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.7 }}>Historical strategy simulation on your current criteria</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--purple-text)', lineHeight: 1.6 }}>Simulates how your current signal weights and entry criteria would have performed historically.</div>
        </div>
      </div>

      {/* Controls */}
      <div className="surface p-5 space-y-4">
        <h3 className="text-sm font-medium pb-2" style={{ color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>Configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              <option value="30d">30 days</option>
              <option value="60d">60 days</option>
              <option value="90d">90 days</option>
              <option value="180d">180 days</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              <option value="Score">Score</option>
              <option value="Conviction">Conviction</option>
              <option value="Factor">Factor</option>
            </select>
          </div>
        </div>

        <button
          onClick={runBacktest}
          disabled={running}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {running
            ? <><RefreshCw size={14} className="animate-spin" /> Running…</>
            : <><Play size={14} /> Run Backtest</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result ? (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Accuracy"
              value={`${result.summary.accuracy.toFixed(1)}%`}
              color={result.summary.accuracy >= 55 ? 'var(--success-text)' : 'var(--danger-text)'}
            />
            <StatCard label="Total signals" value={String(result.summary.total_signals)} />
            <StatCard
              label="Avg return (BUY)"
              value={`${result.summary.avg_return_buy >= 0 ? '+' : ''}${result.summary.avg_return_buy.toFixed(2)}%`}
              color={result.summary.avg_return_buy >= 0 ? 'var(--success-text)' : 'var(--danger-text)'}
            />
            <StatCard
              label="Avg return (SELL)"
              value={`${result.summary.avg_return_sell >= 0 ? '+' : ''}${result.summary.avg_return_sell.toFixed(2)}%`}
              color={result.summary.avg_return_sell <= 0 ? 'var(--success-text)' : 'var(--danger-text)'}
            />
          </div>

          {/* Results table */}
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                    {['Signal Date', 'Ticker', 'Signal Type', 'Verdict', '30d Return', 'Correct?'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{row.signal_date}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{row.ticker}</td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{row.signal_type}</td>
                      <td className="px-4 py-2.5">
                        <VerdictPill verdict={row.verdict} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: row.return_30d >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {row.return_30d >= 0 ? '+' : ''}{row.return_30d.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5">
                        {row.correct
                          ? <span className="font-medium" style={{ color: 'var(--success-text)' }}>Yes</span>
                          : <span className="font-medium" style={{ color: 'var(--danger-text)' }}>No</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !running && !error ? (
        /* Empty state */
        <div className="surface py-16 text-center" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-3xl mb-3">📊</p>
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No backtest results yet</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Run a backtest to see how your signals performed</p>
        </div>
      ) : null}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function VerdictPill({ verdict }: { verdict: string }) {
  const v = verdict.toUpperCase()
  const pillClass = v === 'BUY' ? 'pill pill-success' : v === 'SELL' ? 'pill pill-danger' : 'pill pill-neutral'
  return <span className={pillClass}>{verdict}</span>
}

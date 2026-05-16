'use client'

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
      const resp = await fetch('/api/railway/backtest/score', {
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
      <div>
        <h2 className="text-lg font-semibold text-white">Backtest</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Test your scoring model against historical data</p>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="text-sm font-medium text-zinc-300 border-b border-zinc-800 pb-2">Configuration</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className={SELECT}
            >
              <option value="30d">30 days</option>
              <option value="60d">60 days</option>
              <option value="90d">90 days</option>
              <option value="180d">180 days</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className={SELECT}
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
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {running
            ? <><RefreshCw size={14} className="animate-spin" /> Running…</>
            : <><Play size={14} /> Run Backtest</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
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
              color={result.summary.accuracy >= 55 ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatCard
              label="Total signals"
              value={String(result.summary.total_signals)}
            />
            <StatCard
              label="Avg return (BUY)"
              value={`${result.summary.avg_return_buy >= 0 ? '+' : ''}${result.summary.avg_return_buy.toFixed(2)}%`}
              color={result.summary.avg_return_buy >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatCard
              label="Avg return (SELL)"
              value={`${result.summary.avg_return_sell >= 0 ? '+' : ''}${result.summary.avg_return_sell.toFixed(2)}%`}
              color={result.summary.avg_return_sell <= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>

          {/* Results table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-4 py-2.5 text-left font-medium">Signal Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Ticker</th>
                    <th className="px-4 py-2.5 text-left font-medium">Signal Type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Verdict</th>
                    <th className="px-4 py-2.5 text-right font-medium">30d Return</th>
                    <th className="px-4 py-2.5 text-center font-medium">Correct?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition">
                      <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{row.signal_date}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-white">{row.ticker}</td>
                      <td className="px-4 py-2.5 text-zinc-300">{row.signal_type}</td>
                      <td className="px-4 py-2.5">
                        <VerdictPill verdict={row.verdict} />
                      </td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${row.return_30d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.return_30d >= 0 ? '+' : ''}{row.return_30d.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {row.correct
                          ? <span className="text-emerald-400 font-medium">Yes</span>
                          : <span className="text-red-400 font-medium">No</span>}
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
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <p className="text-3xl mb-3">📊</p>
          <h3 className="text-base font-semibold text-white mb-1">No backtest results yet</h3>
          <p className="text-sm text-zinc-500">Run a backtest to see how your signals performed</p>
        </div>
      ) : null}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function VerdictPill({ verdict }: { verdict: string }) {
  const v = verdict.toUpperCase()
  const cls = v === 'BUY'
    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800'
    : v === 'SELL'
    ? 'bg-red-900/40 text-red-300 border-red-800'
    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium border ${cls}`}>
      {verdict}
    </span>
  )
}

const SELECT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

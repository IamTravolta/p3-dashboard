'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, BarChart3, Zap } from 'lucide-react'

interface SignalRow {
  id:           string
  ticker:       string
  module_name:  string
  value:        'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence:   number
  reasoning:    string
  generated_at: string
}

interface VerdictRow {
  id:           string
  ticker:       string
  verdict:      'BUY' | 'SELL' | 'HOLD'
  confidence:   number
  score:        number
  reasoning:    string
  generated_at: string
  outcome_30d:  string | null
  outcome_60d:  string | null
  outcome_90d:  string | null
}

interface ReliabilityRow {
  module_name:     string
  total_signals:   number
  correct_signals: number
}

export default function SignalsView() {
  const [verdicts,     setVerdicts]     = useState<VerdictRow[]>([])
  const [signals,      setSignals]      = useState<SignalRow[]>([])
  const [reliability,  setReliability]  = useState<ReliabilityRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeVerdict, setActiveVerdict] = useState<string | null>(null)
  const [evalLoading,  setEvalLoading]  = useState(false)
  const [evalStatus,   setEvalStatus]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [vRes, sRes, rRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('verdicts').select('*').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(30),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('signals').select('*').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(90),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('signal_reliability').select('*').eq('user_id', user.id),
      ])

      setVerdicts(vRes.data ?? [])
      setSignals(sRes.data ?? [])
      setReliability(rRes.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const evaluateOutcomes = useCallback(async () => {
    setEvalLoading(true)
    setEvalStatus(null)
    try {
      const resp = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        setEvalStatus(`Failed: ${err.error ?? resp.statusText}`)
      } else {
        setEvalStatus('Done — accuracy updated')
        load()
      }
    } catch (err) {
      setEvalStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setEvalLoading(false)
    }
  }, [load])

  const verdictColor = (v: string) =>
    v === 'BUY' ? 'text-emerald-400 bg-emerald-900/30' :
    v === 'SELL' ? 'text-red-400 bg-red-900/30' : 'text-zinc-400 bg-zinc-800'

  const signalColor = (v: string) =>
    v === 'BULLISH' ? 'text-emerald-400' :
    v === 'BEARISH' ? 'text-red-400' : 'text-zinc-400'

  const outcomeColor = (o: string | null) =>
    o === 'CORRECT' ? 'text-emerald-400' : o === 'INCORRECT' ? 'text-red-400' : 'text-zinc-600'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Signal History</h2>
        <p className="text-xs text-zinc-500 mt-0.5">All AI verdicts, module signals, and accuracy tracking</p>
      </div>

      {/* Signal reliability */}
      {reliability.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-indigo-400" />
            <h3 className="text-sm font-medium text-zinc-300">Signal Reliability</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {reliability.map((r) => {
              const acc = r.total_signals > 0 ? r.correct_signals / r.total_signals : 0
              const pct = Math.round(acc * 100)
              return (
                <div key={r.module_name} className="rounded-lg bg-zinc-800/60 p-3">
                  <p className="text-xs text-zinc-500 capitalize">{r.module_name}</p>
                  <p className="text-xl font-bold text-white mt-0.5">{pct}%</p>
                  <div className="mt-2 h-1 w-full rounded-full bg-zinc-700">
                    <div
                      className={`h-1 rounded-full ${pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">{r.correct_signals}/{r.total_signals} correct</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Loading…</div>
      ) : (
        <>
          {/* Verdicts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-300">Recent Verdicts</h3>
              <div className="ml-auto flex items-center gap-2">
                {evalStatus && (
                  <span className={`text-xs ${evalStatus.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {evalStatus}
                  </span>
                )}
                <button
                  onClick={evaluateOutcomes}
                  disabled={evalLoading}
                  className="rounded border border-indigo-700 bg-transparent px-2.5 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-900/30 disabled:opacity-50 transition"
                >
                  {evalLoading ? 'Evaluating…' : 'Evaluate Outcomes'}
                </button>
              </div>
            </div>
            {verdicts.length === 0 ? (
              <p className="text-sm text-zinc-600">No verdicts yet. Run an analysis from Portfolio or Watchlist.</p>
            ) : (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      {['Ticker', 'Verdict', 'Score', 'Confidence', '30d', '60d', '90d', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {verdicts.map((v) => (
                      <>
                        <tr
                          key={v.id}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/20 cursor-pointer transition"
                          onClick={() => setActiveVerdict(activeVerdict === v.id ? null : v.id)}
                        >
                          <td className="px-4 py-3 font-semibold text-white">{v.ticker}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdictColor(v.verdict)}`}>{v.verdict}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-white">{v.score.toFixed(1)}</td>
                          <td className="px-4 py-3 text-zinc-400">{(v.confidence * 100).toFixed(0)}%</td>
                          <td className={`px-4 py-3 text-xs ${outcomeColor(v.outcome_30d)}`}>{v.outcome_30d ?? '—'}</td>
                          <td className={`px-4 py-3 text-xs ${outcomeColor(v.outcome_60d)}`}>{v.outcome_60d ?? '—'}</td>
                          <td className={`px-4 py-3 text-xs ${outcomeColor(v.outcome_90d)}`}>{v.outcome_90d ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{new Date(v.generated_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-zinc-600 text-xs">↕</td>
                        </tr>
                        {activeVerdict === v.id && (
                          <tr key={`${v.id}-detail`} className="border-b border-zinc-800">
                            <td colSpan={9} className="px-4 py-3 text-sm text-zinc-300 bg-zinc-800/30 leading-relaxed">
                              {v.reasoning}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Module signals */}
          {signals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-indigo-400" />
                <h3 className="text-sm font-medium text-zinc-300">Recent Module Signals</h3>
              </div>
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      {['Ticker', 'Module', 'Signal', 'Confidence', 'Date'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition">
                        <td className="px-4 py-2.5 font-semibold text-white">{s.ticker}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 capitalize">{s.module_name}</td>
                        <td className={`px-4 py-2.5 text-xs font-medium ${signalColor(s.value)}`}>{s.value}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">{(s.confidence * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-600">{new Date(s.generated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

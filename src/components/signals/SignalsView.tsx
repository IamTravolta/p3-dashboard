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

  function verdictPillClass(v: string) {
    return v === 'BUY' ? 'pill pill-success' : v === 'SELL' ? 'pill pill-danger' : 'pill pill-neutral'
  }

  function signalColor(v: string): string {
    return v === 'BULLISH' ? 'var(--success-text)' : v === 'BEARISH' ? 'var(--danger-text)' : 'var(--text-secondary)'
  }

  function outcomeColor(o: string | null): string {
    return o === 'CORRECT' ? 'var(--success-text)' : o === 'INCORRECT' ? 'var(--danger-text)' : 'var(--text-tertiary)'
  }

  function reliabilityBarColor(pct: number): string {
    return pct >= 60 ? 'var(--success-text)' : pct >= 40 ? 'var(--warning-text)' : 'var(--danger-text)'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>⊙ Signals</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>Which signals are working? Win-rate and average return per type.</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>Every significant signal is automatically logged with current price. After 1d/5d/20d the outcome is automatically measured.</div>
        </div>
      </div>

      {/* Signal reliability */}
      {reliability.length > 0 && (
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Signal Reliability</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {reliability.map((r) => {
              const acc = r.total_signals > 0 ? r.correct_signals / r.total_signals : 0
              const pct = Math.round(acc * 100)
              return (
                <div key={r.module_name} className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>{r.module_name}</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{pct}%</p>
                  <div className="mt-2 progress-track w-full">
                    <div className="progress-fill rounded-full" style={{ width: `${pct}%`, background: reliabilityBarColor(pct) }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{r.correct_signals}/{r.total_signals} correct</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      ) : (
        <>
          {/* Verdicts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: 'var(--yellow-text)' }} />
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recent Verdicts</h3>
              <div className="ml-auto flex items-center gap-2">
                {evalStatus && (
                  <span className="text-xs" style={{ color: evalStatus.startsWith('Failed') ? 'var(--danger-text)' : 'var(--success-text)' }}>
                    {evalStatus}
                  </span>
                )}
                <button
                  onClick={evaluateOutcomes}
                  disabled={evalLoading}
                  className="btn disabled:opacity-50"
                >
                  {evalLoading ? 'Evaluating…' : 'Evaluate Outcomes'}
                </button>
              </div>
            </div>
            {verdicts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No verdicts yet. Run an analysis from Portfolio or Watchlist.</p>
            ) : (
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                      {['Ticker', 'Verdict', 'Score', 'Confidence', '30d', '60d', '90d', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {verdicts.map((v) => (
                      <>
                        <tr
                          key={v.id}
                          className="cursor-pointer transition"
                          style={{ borderBottom: '0.5px solid var(--border)' }}
                          onClick={() => setActiveVerdict(activeVerdict === v.id ? null : v.id)}
                        >
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{v.ticker}</td>
                          <td className="px-4 py-3">
                            <span className={verdictPillClass(v.verdict)}>{v.verdict}</span>
                          </td>
                          <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>{v.score.toFixed(1)}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{(v.confidence * 100).toFixed(0)}%</td>
                          <td className="px-4 py-3 text-xs" style={{ color: outcomeColor(v.outcome_30d) }}>{v.outcome_30d ?? '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: outcomeColor(v.outcome_60d) }}>{v.outcome_60d ?? '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: outcomeColor(v.outcome_90d) }}>{v.outcome_90d ?? '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(v.generated_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>↕</td>
                        </tr>
                        {activeVerdict === v.id && (
                          <tr key={`${v.id}-detail`} style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg)' }}>
                            <td colSpan={9} className="px-4 py-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
                <Activity size={14} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Recent Module Signals</h3>
              </div>
              <div className="surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                      {['Ticker', 'Module', 'Signal', 'Confidence', 'Date'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{s.ticker}</td>
                        <td className="px-4 py-2.5 text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{s.module_name}</td>
                        <td className="px-4 py-2.5 text-xs font-medium" style={{ color: signalColor(s.value) }}>{s.value}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{(s.confidence * 100).toFixed(0)}%</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(s.generated_at).toLocaleDateString()}</td>
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

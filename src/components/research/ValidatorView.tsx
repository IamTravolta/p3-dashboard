'use client'

import { useState } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

type Action  = 'BUY' | 'SELL' | 'TRIM'
type Verdict = 'PROCEED' | 'WAIT' | 'ABORT'

interface ValidationResult {
  verdict:    Verdict
  reasoning:  string
  rrScore:    number
  conviction: number
}

const verdictCssVars: Record<Verdict, { borderColor: string; bg: string; color: string; pillClass: string }> = {
  PROCEED: { borderColor: 'var(--success-text)', bg: 'var(--success-bg)', color: 'var(--success-text)', pillClass: 'pill pill-success' },
  WAIT:    { borderColor: 'var(--warning-text)', bg: 'var(--warning-bg)', color: 'var(--warning-text)', pillClass: 'pill pill-warning' },
  ABORT:   { borderColor: 'var(--danger-text)',  bg: 'var(--danger-bg)',  color: 'var(--danger-text)',  pillClass: 'pill pill-danger'  },
}

export default function ValidatorView() {
  const [ticker,  setTicker]  = useState('')
  const [action,  setAction]  = useState<Action>('BUY')
  const [thesis,  setThesis]  = useState('')
  const [result,  setResult]  = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  async function validate(e: React.FormEvent) {
    e.preventDefault()
    if (!ticker.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/railway/trade-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), action, thesis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.')
    } finally {
      setLoading(false)
    }
  }

  const styles = result ? verdictCssVars[result.verdict] : null

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--danger-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--danger-text)' }}>🔍 Trade Validator · Critical Committee</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--danger-text)', opacity: 0.7 }}>Paste your trade proposals. The committee critically challenges them.</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--danger-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--danger-text)', lineHeight: 1.6 }}>Per ticker: conviction, red-flag score, timing, R/R ratio, final status (BUY/STAGED/WAIT/SKIP), alternative allocation. Cost ~€0.15 per call.</div>
        </div>
      </div>

      {/* Backend not configured */}
      {!railwayUrl && (
        <div className="flex items-center gap-2 rounded-xl p-4 text-sm" style={{ border: '1px solid var(--warning-text)', background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
          <AlertTriangle size={15} className="shrink-0" />
          Backend not configured — add your Railway URL in Settings.
        </div>
      )}

      {/* Form */}
      <form onSubmit={validate} className="surface p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition"
              style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition"
              style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="TRIM">TRIM</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Thesis <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
          </label>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="Describe your rationale for this trade…"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none transition"
            style={{ border: '0.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
          className="btn btn-primary flex items-center gap-1.5 disabled:opacity-50"
        >
          <ShieldCheck size={13} />
          {loading ? 'Validating…' : 'Validate Trade'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid var(--danger-text)', background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="surface p-6 animate-pulse space-y-3">
          <div className="h-7 w-32 rounded" style={{ background: 'var(--bg)' }} />
          <div className="space-y-2">
            <div className="h-3 w-full rounded" style={{ background: 'var(--bg)' }} />
            <div className="h-3 w-5/6 rounded" style={{ background: 'var(--bg)' }} />
            <div className="h-3 w-3/4 rounded" style={{ background: 'var(--bg)' }} />
          </div>
        </div>
      )}

      {/* Result */}
      {result && styles && (
        <div className="rounded-xl p-5 space-y-4" style={{ border: `1px solid ${styles.borderColor}`, background: styles.bg }}>
          <div className="flex items-center gap-3">
            <span className={styles.pillClass}>{result.verdict}</span>
            <span className="text-lg font-bold" style={{ color: styles.color }}>
              {result.verdict === 'PROCEED' ? 'Go ahead.' : result.verdict === 'WAIT' ? 'Hold off for now.' : 'Do not proceed.'}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{result.reasoning}</p>
          <div className="flex gap-6 pt-2" style={{ borderTop: '0.5px solid var(--border)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Risk/Reward Score</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: styles.color }}>{result.rrScore?.toFixed(1) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Conviction</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: styles.color }}>{result.conviction ?? '—'}<span className="text-sm" style={{ color: 'var(--text-secondary)' }}>/10</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
